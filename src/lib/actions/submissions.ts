'use server'

import { createClient } from '@/lib/supabase/server'
import { submissionSchema } from '@/lib/validations/schemas'
import type { CreateSubmissionInput } from '@/lib/validations/schemas'
import type { Submission } from '@/types'
import { analyzeSubmissionImage } from '../services/ai-vision'

export async function createSubmission(
  data: CreateSubmissionInput
): Promise<{ data: Submission } | { error: string }> {
  const parsed = submissionSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Datos de envío inválidos' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Check if match exists and tournament is active
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('tournament_id, is_completed, is_warmup, tournaments(status)')
    .eq('id', parsed.data.matchId)
    .single()

  if (matchErr || !match) return { error: 'Partida no encontrada' }
  if (match.is_completed) return { error: 'La partida ya está completada' }
  
  // Skip status check for warmup matches; only enforce active status for official matches
  if (!match.is_warmup) {
    const tStatus = Array.isArray(match.tournaments) 
      ? match.tournaments[0]?.status 
      : (match.tournaments as any)?.status
    if (tStatus !== 'active') {
      return { error: 'El torneo no está activo' }
    }
  }

  // Ensure team is not already submitted for this match
  const { data: existing } = await supabase
    .from('submissions')
    .select('id')
    .eq('match_id', parsed.data.matchId)
    .eq('team_id', parsed.data.teamId)
    .single()

  if (existing) {
    return { error: 'Este equipo ya tiene un registro para esta partida' }
  }

  const { data: submission, error: subErr } = await supabase
    .from('submissions')
    .insert({
      tournament_id: parsed.data.tournamentId,
      match_id: parsed.data.matchId,
      team_id: parsed.data.teamId,
      submitted_by: parsed.data.submittedBy,
      kill_count: parsed.data.killCount,
      player_kills: parsed.data.playerKills || {},
      rank: parsed.data.rank || (parsed.data.potTop ? 1 : null),
      pot_top: parsed.data.potTop || parsed.data.rank === 1,
      status: 'pending',
    })
    .select()
    .single()

  if (subErr) return { error: subErr.message }

  if (parsed.data.evidence) {
    const { error: evErr } = await supabase
      .from('evidence_files')
      .insert({
        submission_id: submission.id,
        storage_path: parsed.data.evidence.storagePath,
        file_name: parsed.data.evidence.fileName,
        file_size: parsed.data.evidence.fileSize,
        mime_type: parsed.data.evidence.mimeType,
      })
      
    if (evErr) {
      // NOTE: Normally we might rollback the submission here, but for simplicity
      // we'll return an error and leave the pending submission without evidence.
      // A cron or manual check can clean up orphaned submissions.
      return { error: 'Envío creado, pero hubo un error al registrar la evidencia: ' + evErr.message }
    }

    // NEW: Trigger AI Validation asynchronously (Wait for it in this action for demo purposes or fire and forget)
    // For now, we'll let it run and update the DB in the background
    processAIValidation(submission.id, parsed.data.evidence.storagePath, parsed.data.evidence.mimeType)
      .catch(err => console.error('Background AI validation failed:', err))
  }

  return {
    data: {
      id: submission.id,
      tournamentId: submission.tournament_id,
      teamId: submission.team_id,
      matchId: submission.match_id,
      submittedBy: submission.submitted_by,
      killCount: submission.kill_count,
      playerKills: submission.player_kills,
      rank: submission.rank,
      potTop: submission.pot_top,
      status: submission.status,
      rejectionReason: submission.rejection_reason,
      submittedAt: submission.submitted_at,
    }
  }
}

export async function recalculateStandings(supabase: any, tournamentId: string) {
  // Fetch tournament + rule
  const { data: tourney } = await supabase.from('tournaments')
    .select('id, total_matches, format, scoring_rules(kill_points, placement_points)')
    .eq('id', tournamentId).single()
  
  console.log(`[STANDINGS] Recalculating for Tournament: ${tournamentId}`)
  if (!tourney) {
    console.error(`[STANDINGS] Tournament not found: ${tournamentId}`)
    return
  }

  const sRules = Array.isArray(tourney.scoring_rules) ? tourney.scoring_rules[0] : tourney.scoring_rules
  const rule = {
    id: 'req',
    tournamentId: tourney.id,
    killPoints: Number(sRules?.kill_points ?? 1),
    placementPoints: sRules?.placement_points ?? {},
  }

  // Fetch all teams
  const { data: teams } = await supabase.from('teams').select('id, name, avatar_url, vip_score').eq('tournament_id', tournamentId)
  if (!teams) {
    console.warn(`[STANDINGS] No teams found for tournament: ${tournamentId}`)
    return
  }
  console.log(`[STANDINGS] Found ${teams.length} teams`)

  // FETCH SUBMISSIONS (Including warmup for testing if needed, or stick to approved)
  const { data: subs } = await supabase.from('submissions')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('status', 'approved')
  
  console.log(`[STANDINGS] Found ${(subs || []).length} approved submissions`)
  
  const mappedTeams = teams.map((t: any) => ({
    id: t.id, name: t.name, avatarUrl: t.avatar_url, vipScore: t.vip_score
  }))
  
  const mappedSubs = (subs || []).map((s: any) => ({
    id: s.id, tournamentId: s.tournament_id, teamId: s.team_id, matchId: s.match_id,
    submittedBy: s.submitted_by, killCount: s.kill_count, rank: s.rank, potTop: s.pot_top, status: s.status,
    submittedAt: s.submitted_at
  }))

  const { computeStandings, calculateKillRaceStandings } = await import('@/lib/scoring/engine')

  let standings = []
  if (tourney.format === 'kill_race') {
    standings = calculateKillRaceStandings(mappedSubs, mappedTeams)
  } else {
    standings = computeStandings(mappedSubs, rule, { totalMatches: tourney.total_matches, teams: mappedTeams })
  }

  // Upsert to team_standings
  const standingRows = standings.map((s: any) => ({
    tournament_id: tournamentId,
    team_id: s.teamId,
    total_points: s.totalPoints,
    total_kills: s.totalKills,
    kill_rate: s.killRate,
    pot_top_count: s.potTopCount,
    vip_score: s.vipScore,
    rank: s.rank,
    previous_rank: s.previousRank || s.rank,
    updated_at: new Date().toISOString()
  }))

  console.log(`[STANDINGS] Upserting ${standingRows.length} rows to team_standings`)
  const { error: upsertErr } = await supabase.from('team_standings').upsert(standingRows, { onConflict: 'tournament_id,team_id' })
  if (upsertErr) console.error(`[STANDINGS] Upsert ERROR:`, upsertErr)
  else console.log(`[STANDINGS] Successfully updated team_standings`)

  // Upsert uses conflict on unique (tournament_id, team_id)
  await supabase.from('team_standings').upsert(standingRows, { onConflict: 'tournament_id,team_id' })

  // ─── NEW: Update Individual Participant Kills ─────────────────────────────
  
  // Aggregate kills per participant from ALL approved submissions in this tournament
  const playerKillsMap: Record<string, number> = {}
  
  subs.forEach((s: any) => {
    const breakdown = s.player_kills || {}
    Object.entries(breakdown).forEach(([pId, kills]) => {
      playerKillsMap[pId] = (playerKillsMap[pId] || 0) + (kills as number)
    })
  })

  // Update participants total_kills
  for (const [pId, totalKills] of Object.entries(playerKillsMap)) {
    await supabase.from('participants')
      .update({ total_kills: totalKills })
      .eq('id', pId)
  }
}

export async function approveSubmission(
  submissionId: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Validate ownership implicitly through RLS or explicitly
  const { data: submission, error: subErr } = await supabase
    .from('submissions')
    .select('tournament_id, status, tournaments!inner(creator_id)')
    .eq('id', submissionId)
    .single()

  if (subErr || !submission) return { error: 'Envío no encontrado' }
  
  const creatorId = Array.isArray(submission.tournaments) 
    ? submission.tournaments[0]?.creator_id 
    : (submission.tournaments as any)?.creator_id

  if (creatorId !== user.id) return { error: 'Sin permisos' }
  if (submission.status === 'approved') return { error: 'Ya está aprobado' }

  // Update status
  const { error: updateErr } = await supabase
    .from('submissions')
    .update({ 
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id
    })
    .eq('id', submissionId)

  if (updateErr) return { error: updateErr.message }

  // Trigger recalculation of standings
  await recalculateStandings(supabase, submission.tournament_id)

  return { success: true }
}

export async function rejectSubmission(
  submissionId: string,
  reason: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: submission, error: subErr } = await supabase
    .from('submissions')
    .select('tournament_id, status, tournaments!inner(creator_id)')
    .eq('id', submissionId)
    .single()

  if (subErr || !submission) return { error: 'Envío no encontrado' }
  
  const creatorId = Array.isArray(submission.tournaments) 
    ? submission.tournaments[0]?.creator_id 
    : (submission.tournaments as any)?.creator_id

  if (creatorId !== user.id) return { error: 'Sin permisos' }

  const { error: updateErr } = await supabase
    .from('submissions')
    .update({ 
      status: 'rejected',
      rejection_reason: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id
    })
    .eq('id', submissionId)

  if (updateErr) return { error: updateErr.message }

  // Potentially recalculate if it was previously approved, but a rejected submission is usually coming from 'pending' state. 
  // Safety call:
  if (submission.status === 'approved') {
    await recalculateStandings(supabase, submission.tournament_id)
  }

  return { success: true }
}

export async function getSubmissions(
  tournamentId: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data, error } = await supabase
    .from('submissions')
    .select('*, teams(name), matches(name, match_number)')
    .eq('tournament_id', tournamentId)
    .order('submitted_at', { ascending: false })

  if (error) return { error: error.message }
  return { data }
}

/**
 * Background AI Validation Process
 */
export async function processAIValidation(
  submissionId: string,
  storagePath: string,
  mimeType: string
) {
  const supabase = await createClient()

  try {
    // 1. Mark as processing
    await supabase
      .from('submissions')
      .update({ ai_status: 'processing' })
      .eq('id', submissionId)

    // 2. Download file from Storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('evidences')
      .download(storagePath)

    if (downloadErr || !fileData) {
      throw new Error(`Error descargando evidencia: ${downloadErr?.message}`)
    }

    // 3. Convert to buffer
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 4. Run AI Analysis
    const aiResult = await analyzeSubmissionImage(buffer, mimeType)

    if ('error' in aiResult) {
       throw new Error(aiResult.error)
    }

    // 5. Update Submission with AI results
    await supabase
      .from('submissions')
      .update({
        ai_status: 'completed',
        ai_data: {
          team_name: aiResult.teamName,
          kill_count: aiResult.killCount,
          rank: aiResult.rank,
        },
        ai_confidence: aiResult.confidence,
      })
      .eq('id', submissionId)

  } catch (error: any) {
    console.error(`AI Validation Failed for ${submissionId}:`, error)
    await supabase
      .from('submissions')
      .update({
        ai_status: 'failed',
        ai_error: error.message || 'Error desconocido'
      })
      .eq('id', submissionId)
  }
}
