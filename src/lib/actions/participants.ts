'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { teamSchema, participantSchema } from '@/lib/validations/schemas'
import type { CreateTeamInput, CreateParticipantInput } from '@/lib/validations/schemas'
import type { Team, Participant } from '@/types'
import { pushToAC } from './ac-push'

async function assertAdmin(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return (!data || data.role !== 'ADMIN') ? 'Sin permisos' : null
}

// ─── Teams ──────────────────────────────────────────────────────────────────

export async function createTeam(
  tournamentId: string,
  data: CreateTeamInput
): Promise<{ data: Team } | { error: string }> {
  const parsed = teamSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Datos de equipo inválidos' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify tournament ownership
  const { data: tournament, error: authErr } = await supabase
    .from('tournaments')
    .select('id, creator_id, collaborator_id')
    .eq('id', tournamentId)
    .single()

  if (authErr || !tournament) return { error: 'Torneo no encontrado' }

  const { checkTournamentAccess } = await import('./tournaments')
  const hasAccess = await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id)
  if (!hasAccess) {
    return { error: 'Sin permisos para este torneo' }
  }

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({
      tournament_id: tournamentId,
      name: parsed.data.name,
      avatar_url: parsed.data.avatarUrl || null,
      stream_url: parsed.data.streamUrl || null,
    })
    .select()
    .single()

  if (teamErr) return { error: teamErr.message }

  pushToAC('teams', 'upsert', {
    id: team.id,
    tournamentId: team.tournament_id,
    name: team.name,
    avatarUrl: team.avatar_url,
    streamUrl: team.stream_url,
  })

  // Auto-initialize standings using admin client — the regular user session lacks
  // write permission on team_standings (no INSERT/UPDATE RLS policy for authenticated users).
  // Using the service role bypasses RLS and guarantees the row is created.
  const adminSupabase = await createAdminClient()
  const { error: standingsErr } = await adminSupabase.from('team_standings').upsert({
    tournament_id: tournamentId,
    team_id: team.id,
    total_points: 0,
    total_kills: 0,
    kill_rate: 0,
    pot_top_count: 0,
    vip_score: 0,
    rank: 99,
    previous_rank: 99,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tournament_id,team_id' })

  if (standingsErr) {
    console.error('[createTeam] Failed to initialize team_standings row:', standingsErr.message)
  }

  return {
    data: {
      id: team.id,
      tournamentId: team.tournament_id,
      name: team.name,
      avatarUrl: team.avatar_url,
      streamUrl: team.stream_url,
      vipScore: team.vip_score,
      registrationStatus: team.registration_status || 'confirmed',
      paymentEvidenceUrl: team.payment_evidence_url || null,
    }
  }
}

export async function deleteTeam(
  tournamentId: string,
  teamId: string,
  reason?: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, creator_id, collaborator_id')
    .eq('id', tournamentId)
    .single()

  if (!tournament) return { error: 'Torneo no encontrado' }

  const { checkTournamentAccess } = await import('./tournaments')
  const hasAccess = await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id)
  if (!hasAccess) {
    return { error: 'Sin permisos' }
  }

  const adminSupabase = await createAdminClient()

  // Obtener datos del equipo y torneo antes de cualquier acción
  const { data: teamData } = await adminSupabase
    .from('teams')
    .select('name, registration_status, amount_paid')
    .eq('id', teamId)
    .single()

  const { data: fullTournament } = await adminSupabase
    .from('tournaments')
    .select('name, creator_id, collaborator_id, status')
    .eq('id', tournamentId)
    .single()

  const { data: teamMembers } = await adminSupabase
    .from('participants')
    .select('display_name, user_id, is_captain')
    .eq('team_id', teamId)

  const captainPart = (teamMembers || []).find(p => p.is_captain) || (teamMembers || [])[0]

  // Reembolso automático si el torneo aún no ha comenzado (status === 'pending') y hubo pago
  const refundAmount = Number(teamData?.amount_paid || 0)
  let refundGiven = false

  if (fullTournament?.status === 'pending' && refundAmount > 0 && captainPart?.user_id) {
    try {
      const { data: capProfile } = await adminSupabase
        .from('profiles')
        .select('balance')
        .eq('id', captainPart.user_id)
        .single()

      const currentCapBal = Number(capProfile?.balance || 0)
      const newCapBal = currentCapBal + refundAmount

      // 1. Devolver saldo al capitán
      await adminSupabase
        .from('profiles')
        .update({ 
          balance: newCapBal,
          updated_at: new Date().toISOString()
        })
        .eq('id', captainPart.user_id)

      // 2. Registrar transacción contable de devolución
      await adminSupabase.from('coin_transactions').insert({
        user_id: captainPart.user_id,
        amount: refundAmount,
        type: 'deposit',
        description: `Reembolso de inscripción por remoción/cancelación antes del torneo: ${fullTournament.name}`,
        reference_id: tournamentId,
      })

      refundGiven = true
    } catch (refundErr) {
      console.error('Error al emitir reembolso automático de inscripción:', refundErr)
    }
  }

  // Notificar al capitán por correo y por la plataforma
  if (teamData && fullTournament) {
    try {
      let captainEmail = null
      if (captainPart?.user_id) {
        try {
          const { data: authUserData } = await adminSupabase.auth.admin.getUserById(captainPart.user_id)
          if (authUserData?.user?.email && !authUserData.user.email.endsWith('@manual.kronix.do')) {
            captainEmail = authUserData.user.email
          }
        } catch (authErr) {
          console.warn('Error fetching auth user email:', authErr)
        }

        if (!captainEmail) {
          const { data: capProfile } = await adminSupabase
            .from('profiles')
            .select('email')
            .eq('id', captainPart.user_id)
            .maybeSingle()
          captainEmail = capProfile?.email
        }
      }

      const { data: creatorProfile } = await adminSupabase
        .from('profiles')
        .select('username, email, whatsapp_link, discord_link, role')
        .eq('id', fullTournament.creator_id)
        .single()

      const refundNotice = refundGiven ? ` Se han devuelto ${refundAmount.toFixed(2)} K-Coins a tu billetera.` : ''

      if (creatorProfile && captainEmail) {
        const { sendTeamRemovedEmail } = await import('@/lib/services/email')

        const isKronixOfficial = creatorProfile.role === 'SUPER_ADMIN' || creatorProfile.role === 'ADMIN'
        const isCollaboration = !isKronixOfficial && !!fullTournament.collaborator_id

        await sendTeamRemovedEmail({
          email: captainEmail,
          captainName: captainPart?.display_name || 'Capitán',
          teamName: teamData.name,
          tournamentName: fullTournament.name,
          reason: `${(reason || 'Cancelación de inscripción').trim()}.${refundNotice}`,
          creatorName: creatorProfile.username || 'Organizador',
          creatorEmail: creatorProfile.email || '',
          whatsappLink: creatorProfile.whatsapp_link,
          discordLink: creatorProfile.discord_link,
          isKronixOfficial,
          isCollaboration,
        }).catch(err => console.error('Email removal error:', err))
      }

      // Crear notificación interna en la plataforma para todos los miembros del equipo con cuenta
      for (const member of (teamMembers || [])) {
        if (member.user_id) {
          const isCap = member.user_id === captainPart?.user_id
          await adminSupabase.from('notifications').insert({
            user_id: member.user_id,
            title: `🚫 Expulsión del Torneo: ${fullTournament.name}`,
            message: `Tu equipo "${teamData.name}" ha sido removido del torneo "${fullTournament.name}". Motivo: ${(reason || 'Cancelación de inscripción').trim()}.${isCap && refundGiven ? ` Se han reembolsado ${refundAmount.toFixed(2)} K-Coins a tu billetera.` : ''}`,
            is_read: false,
          })
        }
      }
    } catch (e) {
      console.error('Error al intentar notificar expulsión de equipo por correo o app:', e)
    }
  }


  // 0. Eliminar envíos (submissions) de este equipo para evitar constraint error
  const { error: subDeleteErr } = await adminSupabase
    .from('submissions')
    .delete()
    .eq('team_id', teamId)
    .eq('tournament_id', tournamentId)
  
  if (subDeleteErr) return { error: subDeleteErr.message }

  // 1. Eliminar todos los participantes vinculados a este equipo primero
  const { error: partDeleteErr } = await adminSupabase
    .from('participants')
    .delete()
    .eq('team_id', teamId)
    .eq('tournament_id', tournamentId)

  if (partDeleteErr) return { error: partDeleteErr.message }

  // 2. Eliminar el equipo
  const { error } = await adminSupabase
    .from('teams')
    .delete()
    .eq('id', teamId)
    .eq('tournament_id', tournamentId)

  if (error) return { error: error.message }

  pushToAC('teams', 'delete', { id: teamId })
  return { success: true }
}

// ─── Participants ───────────────────────────────────────────────────────────

export async function addParticipant(
  tournamentId: string,
  data: CreateParticipantInput
): Promise<{ data: Participant } | { error: string }> {
  const parsed = participantSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Datos de participante inválidos' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify tournament ownership
  const { data: tournament, error: authErr } = await supabase
    .from('tournaments')
    .select('id, creator_id, collaborator_id')
    .eq('id', tournamentId)
    .single()

  if (authErr || !tournament) return { error: 'Torneo no encontrado' }

  const { checkTournamentAccess } = await import('./tournaments')
  const hasAccess = await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id)
  if (!hasAccess) {
    return { error: 'Sin permisos para este torneo' }
  }

  const { data: participant, error: partErr } = await supabase
    .from('participants')
    .insert({
      tournament_id: tournamentId,
      display_name: parsed.data.displayName,
      contact_id: parsed.data.contactId || null,
      stream_url: parsed.data.streamUrl || null,
      team_id: parsed.data.teamId || null,
      is_captain: parsed.data.isCaptain,
      color: parsed.data.color || null,
    })
    .select()
    .single()

  if (partErr) return { error: partErr.message }

  pushToAC('participants', 'upsert', {
    id: participant.id,
    tournamentId: participant.tournament_id,
    teamId: participant.team_id,
    displayName: participant.display_name,
    streamUrl: participant.stream_url,
    totalKills: participant.total_kills || 0,
    isCaptain: participant.is_captain,
  })

  return {
    data: {
      id: participant.id,
      tournamentId: participant.tournament_id,
      teamId: participant.team_id,
      displayName: participant.display_name,
      contactId: participant.contact_id,
      streamUrl: participant.stream_url,
      isCaptain: participant.is_captain,
      totalKills: participant.total_kills || 0,
      kdRatio:            participant.kd_ratio          ?? undefined,
      avgKills:           participant.avg_kills          ?? undefined,
      classificationRank: participant.classification_rank ?? undefined,
      brAvgPlacement:     participant.br_avg_placement   ?? undefined,
      color:              participant.color              ?? undefined,
    }
  }
}

export async function deleteParticipant(
  tournamentId: string,
  participantId: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, creator_id, collaborator_id')
    .eq('id', tournamentId)
    .single()

  if (!tournament) return { error: 'Torneo no encontrado' }

  const { checkTournamentAccess } = await import('./tournaments')
  const hasAccess = await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id)
  if (!hasAccess) {
    return { error: 'Sin permisos' }
  }

  const adminSupabase = await createAdminClient()

  // 0. Eliminar envíos (submissions) de este participante para evitar constraint error
  await adminSupabase
    .from('submissions')
    .delete()
    .eq('submitted_by', participantId)

  const { error } = await adminSupabase
    .from('participants')
    .delete()
    .eq('id', participantId)
    .eq('tournament_id', tournamentId)

  if (error) return { error: error.message }

  pushToAC('participants', 'delete', { id: participantId })
  return { success: true }
}

export async function getTeamsWithParticipants(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  
  // No strict ownership check to allow public rendering if needed eventually,
  // but if we ONLY want admins:
  
  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true })

  if (teamsErr) return { error: teamsErr.message }

  const { data: participants, error: partErr } = await supabase
    .from('participants')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true })

  if (partErr) return { error: partErr.message }

  // Map to types
  const mappedTeams: Team[] = teams.map(t => ({
    id: t.id,
    tournamentId: t.tournament_id,
    name: t.name,
    avatarUrl: t.avatar_url,
    streamUrl: t.stream_url,
    vipScore: t.vip_score,
    registrationStatus: t.registration_status || 'confirmed',
    paymentEvidenceUrl: t.payment_evidence_url,
  }))

  const mappedParticipants: Participant[] = participants.map(p => ({
    id: p.id,
    tournamentId: p.tournament_id,
    teamId: p.team_id,
    displayName: p.display_name,
    avatarUrl: p.avatar_url ?? undefined,
    contactId: p.contact_id,
    streamUrl: p.stream_url,
    isCaptain: p.is_captain,
    totalKills: p.total_kills || 0,
    kdRatio:            p.kd_ratio            ?? undefined,
    avgKills:           p.avg_kills            ?? undefined,
    classificationRank: p.classification_rank  ?? undefined,
    brAvgPlacement:     p.br_avg_placement      ?? undefined,
    color:              p.color                 ?? undefined,
  }))

  return { teams: mappedTeams, participants: mappedParticipants }
}

export async function updateParticipantKills(
  tournamentId: string,
  participantId: string,
  kills: number
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify tournament ownership
  const { data: tournament, error: authErr } = await supabase
    .from('tournaments')
    .select('id, creator_id, collaborator_id')
    .eq('id', tournamentId)
    .single()

  if (authErr || !tournament) return { error: 'Torneo no encontrado' }

  const { checkTournamentAccess } = await import('./tournaments')
  const hasAccess = await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id)
  if (!hasAccess) {
    return { error: 'Sin permisos para este torneo' }
  }

  const { error: updateErr } = await supabase
    .from('participants')
    .update({ total_kills: kills })
    .eq('id', participantId)
    .eq('tournament_id', tournamentId)

  if (updateErr) return { error: updateErr.message }

  return { success: true }
}

export async function updateTeam(
  tournamentId: string,
  teamId: string,
  data: Partial<CreateTeamInput>
): Promise<{ data: Team } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, creator_id, collaborator_id')
    .eq('id', tournamentId)
    .single()

  if (!tournament) return { error: 'Torneo no encontrado' }

  const { checkTournamentAccess } = await import('./tournaments')
  const hasAccess = await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id)
  if (!hasAccess) {
    return { error: 'Sin permisos' }
  }

  const { data: team, error: updateErr } = await supabase
    .from('teams')
    .update({
      name: data.name,
      avatar_url: data.avatarUrl,
      stream_url: data.streamUrl,
    })
    .eq('id', teamId)
    .eq('tournament_id', tournamentId)
    .select()
    .single()

  if (updateErr) return { error: updateErr.message }

  pushToAC('teams', 'upsert', {
    id: team.id,
    tournamentId: team.tournament_id,
    name: team.name,
    avatarUrl: team.avatar_url,
    streamUrl: team.stream_url,
  })

  return {
    data: {
      id: team.id,
      tournamentId: team.tournament_id,
      name: team.name,
      avatarUrl: team.avatar_url,
      streamUrl: team.stream_url,
      vipScore: team.vip_score,
      registrationStatus: team.registration_status || 'confirmed',
      paymentEvidenceUrl: team.payment_evidence_url || null,
    }
  }
}

export async function updateParticipant(
  tournamentId: string,
  participantId: string,
  data: Partial<CreateParticipantInput>
): Promise<{ data: Participant } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, creator_id, collaborator_id')
    .eq('id', tournamentId)
    .single()

  if (!tournament) return { error: 'Torneo no encontrado' }

  const { checkTournamentAccess } = await import('./tournaments')
  const hasAccess = await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id)
  if (!hasAccess) {
    return { error: 'Sin permisos' }
  }

  const d = data as any

  // If setting this participant as captain, demote other captains in the same team first
  if (d.isCaptain) {
    const { data: currentPart } = await supabase
      .from('participants')
      .select('team_id')
      .eq('id', participantId)
      .eq('tournament_id', tournamentId)
      .single()

    if (currentPart?.team_id) {
      await supabase
        .from('participants')
        .update({ is_captain: false })
        .eq('team_id', currentPart.team_id)
        .eq('tournament_id', tournamentId)
    }
  }

  const { data: participant, error: updateErr } = await supabase
    .from('participants')
    .update({
      display_name:          data.displayName,
      avatar_url:            d.avatarUrl,
      stream_url:            data.streamUrl,
      is_captain:            d.isCaptain,
      kd_ratio:              d.kdRatio        ?? null,
      avg_kills:             d.avgKills        ?? null,
      classification_rank:   d.classificationRank ?? null,
      br_avg_placement:      d.brAvgPlacement  ?? null,
      color:                 data.color       ?? null,
      user_id:               d.userId !== undefined ? d.userId : undefined,
    })
    .eq('id', participantId)
    .eq('tournament_id', tournamentId)
    .select()
    .single()

  if (updateErr) return { error: updateErr.message }

  pushToAC('participants', 'upsert', {
    id: participant.id,
    tournamentId: participant.tournament_id,
    teamId: participant.team_id,
    displayName: participant.display_name,
    streamUrl: participant.stream_url,
    totalKills: participant.total_kills || 0,
    isCaptain: participant.is_captain,
  })

  return {
    data: {
      id: participant.id,
      tournamentId: participant.tournament_id,
      teamId: participant.team_id,
      displayName: participant.display_name,
      avatarUrl: participant.avatar_url,
      contactId: participant.contact_id,
      streamUrl: participant.stream_url,
      isCaptain: participant.is_captain,
      totalKills: participant.total_kills || 0,
      kdRatio:             participant.kd_ratio         ?? undefined,
      avgKills:            participant.avg_kills         ?? undefined,
      classificationRank:  participant.classification_rank ?? undefined,
      brAvgPlacement:      participant.br_avg_placement  ?? undefined,
      color:               participant.color            ?? undefined,
      userId:              participant.user_id          ?? undefined,
    }
  }
}

export async function findUserByShortId(shortId: string): Promise<{ data: any } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAuthorized = 
      userProfile?.role === 'SUPER_ADMIN' ||
      userProfile?.role === 'ADMIN' ||
      userProfile?.role === 'KRONIX_STAFF' ||
      userProfile?.role === 'FEDERATION' ||
      userProfile?.role === 'STREAMER'

    let hasStaffAccess = isAuthorized
    if (!hasStaffAccess) {
      const { data: staff } = await supabase
        .from('streamer_staff')
        .select('id')
        .eq('staff_id', user.id)
        .limit(1)
        .maybeSingle()
      if (staff) hasStaffAccess = true
    }

    if (!hasStaffAccess) {
      const { data: collab } = await supabase
        .from('tournaments')
        .select('id')
        .eq('collaborator_id', user.id)
        .limit(1)
        .maybeSingle()
      if (collab) hasStaffAccess = true
    }

    if (!hasStaffAccess) {
      return { error: 'Sin permisos' }
    }

    let formattedShortId = shortId.trim().toUpperCase()
    if (/^[0-9A-Z]{6}$/i.test(formattedShortId)) {
      formattedShortId = `KX-${formattedShortId}`
    }

    const adminSupabase = await createAdminClient()
    const { data: profile, error } = await adminSupabase
      .from('profiles')
      .select('id, username, avatar_url, stream_url, short_id')
      .eq('short_id', formattedShortId)
      .maybeSingle()

    if (error) throw error
    if (!profile) return { error: 'No se encontró ningún usuario con ese ID único' }

    return { data: profile }
  } catch (err: any) {
    return { error: err.message || 'Error al buscar el usuario' }
  }
}

export async function uploadAvatar(
  tournamentId: string,
  entityId: string,
  type: 'team' | 'participant',
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'ADMIN') return { error: 'Sin permisos' }

  const file = formData.get('file') as File
  if (!file) return { error: 'No se recibió archivo' }

  const ext = file.name.split('.').pop()
  const filePath = `avatars/${entityId}-${type}-avatar.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const admin = await createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('evidences')
    .upload(filePath, buffer, { upsert: true, contentType: file.type })

  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = admin.storage.from('evidences').getPublicUrl(filePath)
  const urlWithBust = `${publicUrl}?t=${Date.now()}`

  if (type === 'team') {
    await admin.from('teams').update({ avatar_url: urlWithBust }).eq('id', entityId)
  } else {
    await admin.from('participants').update({ avatar_url: urlWithBust }).eq('id', entityId)
  }

  return { url: urlWithBust }
}

export interface PlayerCareerProfile {
  displayName: string
  username?: string | null
  avatarUrl?: string | null
  totalTournaments: number
  firstPlaces: number
  podiumsCount: number
  top5Count: number
  totalKills: number
  avgKillsPerTournament: number
  winRate: number
  federationPoints?: number
  federationRank?: number
  dominantDiscipline?: string
  tournamentsHistory: {
    id: string
    name: string
    discipline: string
    date: string
    teamName: string
    rank: number | null
    kills: number
    status: string
  }[]
}

export async function getParticipantCareerStatsAction(input: {
  userId?: string | null
  displayName?: string
}): Promise<{ success: true; data: PlayerCareerProfile } | { error: string }> {
  try {
    const adminSupabase = await createAdminClient()
    const displayName = input.displayName?.trim() || ''
    const userId = input.userId

    if (!userId && !displayName) {
      return { error: 'Se requiere ID de usuario o nombre de competidor' }
    }

    // 1. Fetch all participations of this player across all tournaments
    let query = adminSupabase
      .from('participants')
      .select(`
        id,
        user_id,
        display_name,
        avatar_url,
        total_kills,
        team_id,
        tournament_id,
        tournaments:tournament_id(id, name, discipline, status, created_at),
        teams:team_id(id, name, avatar_url)
      `)

    if (userId) {
      query = query.or(`user_id.eq.${userId},display_name.ilike.${displayName || '---'}`)
    } else if (displayName) {
      query = query.ilike('display_name', displayName)
    }

    const { data: participations, error: pErr } = await query

    if (pErr) throw pErr

    // 2. Fetch avatar and profile info
    let profileAvatar: string | null = null
    let profileUsername: string | null = null
    if (userId) {
      const { data: prof } = await adminSupabase
        .from('profiles')
        .select('avatar_url, username')
        .eq('id', userId)
        .maybeSingle()
      if (prof) {
        profileAvatar = prof.avatar_url
        profileUsername = prof.username
      }
    }

    // 3. Fetch federation stats if available
    const { data: fedStats } = await adminSupabase
      .from('player_national_stats')
      .select('*')
      .or(displayName ? `display_name.ilike.${displayName}` : 'id.is.null')
      .maybeSingle()

    // 4. Fetch standings for each tournament participation
    const tourneyIds = Array.from(new Set((participations || []).map((p: any) => p.tournament_id).filter(Boolean)))
    const teamIds = Array.from(new Set((participations || []).map((p: any) => p.team_id).filter(Boolean)))

    let standingsMap = new Map<string, number>()
    if (tourneyIds.length > 0 && teamIds.length > 0) {
      const { data: standings } = await adminSupabase
        .from('team_standings')
        .select('tournament_id, team_id, rank')
        .in('tournament_id', tourneyIds)
        .in('team_id', teamIds)

      if (standings) {
        standings.forEach(s => {
          standingsMap.set(`${s.tournament_id}_${s.team_id}`, s.rank)
        })
      }
    }

    // 5. Aggregate metrics
    let totalKills = 0
    let firstPlaces = 0
    let podiumsCount = 0
    let top5Count = 0
    const historyMap = new Map<string, PlayerCareerProfile['tournamentsHistory'][0]>()
    const disciplineCounts: Record<string, number> = {}

    for (const p of (participations || [])) {
      const t = p.tournaments as any
      if (!t) continue

      const kills = Number(p.total_kills || 0)
      totalKills += kills

      const rank = standingsMap.get(`${p.tournament_id}_${p.team_id}`) ?? null
      if (rank === 1) firstPlaces++
      if (rank && rank <= 3) podiumsCount++
      if (rank && rank <= 5) top5Count++

      if (t.discipline) {
        disciplineCounts[t.discipline] = (disciplineCounts[t.discipline] || 0) + 1
      }

      if (!historyMap.has(t.id)) {
        historyMap.set(t.id, {
          id: t.id,
          name: t.name || 'Torneo',
          discipline: t.discipline || 'Desconocido',
          date: t.created_at,
          teamName: (p.teams as any)?.name || p.display_name || 'Equipo',
          rank,
          kills,
          status: t.status || 'finished'
        })
      } else {
        const existing = historyMap.get(t.id)!
        existing.kills += kills
      }
    }

    // Consider federation stats if platform participations are newly seeded
    if (fedStats) {
      podiumsCount = Math.max(podiumsCount, fedStats.podiums_count || 0)
    }

    const tournamentsHistory = Array.from(historyMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const totalTournaments = Math.max(tournamentsHistory.length, fedStats?.tournaments_played || 0)
    const avgKills = totalTournaments > 0 ? parseFloat((totalKills / totalTournaments).toFixed(1)) : totalKills
    const winRate = totalTournaments > 0 
      ? parseFloat(((firstPlaces / totalTournaments) * 100).toFixed(1))
      : (fedStats?.win_rate ? Number(fedStats.win_rate) : 0)

    // Dominant discipline
    let dominantDiscipline = fedStats?.discipline || 'General'
    let maxDiscCount = -1
    Object.entries(disciplineCounts).forEach(([d, count]) => {
      if (count > maxDiscCount) {
        maxDiscCount = count
        dominantDiscipline = d
      }
    })

    return {
      success: true,
      data: {
        displayName: displayName || profileUsername || 'Competidor',
        username: profileUsername || displayName,
        avatarUrl: profileAvatar || (participations && participations[0]?.avatar_url) || null,
        totalTournaments,
        firstPlaces,
        podiumsCount,
        top5Count,
        totalKills,
        avgKillsPerTournament: avgKills,
        winRate,
        federationPoints: fedStats?.points,
        dominantDiscipline,
        tournamentsHistory
      }
    }
  } catch (err: any) {
    console.error('Error in getParticipantCareerStatsAction:', err)
    return { error: err.message || 'Error al obtener historial de competidor' }
  }
}

