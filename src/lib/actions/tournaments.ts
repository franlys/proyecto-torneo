'use server'

import { createClient } from '@/lib/supabase/server'
import { createTournamentSchema, updateTournamentSchema } from '@/lib/validations/schemas'
import type { Tournament, ScoringRule } from '@/types'
import type { CreateTournamentInput, UpdateTournamentInput } from '@/lib/validations/schemas'

// ─── helpers ────────────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)

  const shortId = Math.random().toString(36).slice(2, 8)
  return `${base}-${shortId}`
}

function mapTournamentRow(row: Record<string, unknown>): Tournament {
  return {
    id: row.id as string,
    creatorId: row.creator_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    rulesText: row.rules_text as string | undefined,
    slug: row.slug as string,
    mode: row.mode as Tournament['mode'],
    format: row.format as Tournament['format'],
    level: row.level as Tournament['level'],
    status: row.status as Tournament['status'],
    totalMatches: row.total_matches as number,
    matchesCompleted: row.matches_completed as number,
    killRateEnabled: row.kill_rate_enabled as boolean,
    potTopEnabled: row.pot_top_enabled as boolean,
    vipEnabled: row.vip_enabled as boolean,
    tiebreakerMatchEnabled: row.tiebreaker_match_enabled as boolean,
    killRaceTimeLimitMinutes: row.kill_race_time_limit_minutes as number | undefined,
    startDate: row.start_date as string | undefined,
    endDate: row.end_date as string | undefined,
  }
}

function mapScoringRuleRow(row: Record<string, unknown>): ScoringRule {
  return {
    id: row.id as string,
    tournamentId: row.tournament_id as string,
    killPoints: Number(row.kill_points),
    placementPoints: row.placement_points as Record<string, number>,
  }
}

// ─── actions ────────────────────────────────────────────────────────────────

export async function createTournament(
  data: CreateTournamentInput
): Promise<{ data: Tournament } | { error: string }> {
  const parsed = createTournamentSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    return { error: first?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const input = parsed.data
  const slug = generateSlug(input.name)

  // Insert tournament
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .insert({
      creator_id: user.id,
      name: input.name,
      description: input.description ?? null,
      rules_text: input.rulesText ?? null,
      slug,
      mode: input.mode,
      format: input.format,
      level: input.level,
      status: 'draft',
      total_matches: input.totalMatches,
      kill_rate_enabled: input.killRateEnabled,
      pot_top_enabled: input.potTopEnabled,
      vip_enabled: input.vipEnabled,
      tiebreaker_match_enabled: input.tiebreakerMatchEnabled,
      kill_race_time_limit_minutes: input.killRaceTimeLimitMinutes ?? null,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
    })
    .select()
    .single()

  if (tErr || !tournament) {
    return { error: tErr?.message ?? 'Error al crear el torneo' }
  }

  // Insert scoring rule
  const { error: srErr } = await supabase.from('scoring_rules').insert({
    tournament_id: tournament.id,
    kill_points: input.scoringRule.killPoints,
    placement_points: input.scoringRule.placementPoints,
  })

  if (srErr) {
    // Rollback tournament
    await supabase.from('tournaments').delete().eq('id', tournament.id)
    return { error: srErr.message }
  }

  // Create matches automatically
  const matchRows = Array.from({ length: input.totalMatches }, (_, i) => ({
    tournament_id: tournament.id,
    match_number: i + 1,
    name: `Partida ${i + 1}`,
  }))

  const { error: mErr } = await supabase.from('matches').insert(matchRows)
  if (mErr) {
    await supabase.from('tournaments').delete().eq('id', tournament.id)
    return { error: mErr.message }
  }

  return { data: mapTournamentRow(tournament as Record<string, unknown>) }
}

export async function updateTournament(
  id: string,
  data: UpdateTournamentInput
): Promise<{ data: Tournament } | { error: string }> {
  const parsed = updateTournamentSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    return { error: first?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership and draft status
  const { data: existing, error: fetchErr } = await supabase
    .from('tournaments')
    .select('status, creator_id')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) return { error: 'Torneo no encontrado' }
  if (existing.creator_id !== user.id) return { error: 'Sin permisos' }
  if (existing.status !== 'draft') {
    return { error: 'No se puede modificar un torneo activo o finalizado' }
  }

  const input = parsed.data
  const updatePayload: Record<string, unknown> = {}

  if (input.name !== undefined) updatePayload.name = input.name
  if (input.description !== undefined) updatePayload.description = input.description
  if (input.rulesText !== undefined) updatePayload.rules_text = input.rulesText
  if (input.mode !== undefined) updatePayload.mode = input.mode
  if (input.format !== undefined) updatePayload.format = input.format
  if (input.level !== undefined) updatePayload.level = input.level
  if (input.totalMatches !== undefined) updatePayload.total_matches = input.totalMatches
  if (input.killRateEnabled !== undefined) updatePayload.kill_rate_enabled = input.killRateEnabled
  if (input.potTopEnabled !== undefined) updatePayload.pot_top_enabled = input.potTopEnabled
  if (input.vipEnabled !== undefined) updatePayload.vip_enabled = input.vipEnabled
  if (input.tiebreakerMatchEnabled !== undefined)
    updatePayload.tiebreaker_match_enabled = input.tiebreakerMatchEnabled
  if (input.killRaceTimeLimitMinutes !== undefined)
    updatePayload.kill_race_time_limit_minutes = input.killRaceTimeLimitMinutes
  if (input.startDate !== undefined) updatePayload.start_date = input.startDate || null
  if (input.endDate !== undefined) updatePayload.end_date = input.endDate || null

  const { data: updated, error: updateErr } = await supabase
    .from('tournaments')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (updateErr || !updated) {
    return { error: updateErr?.message ?? 'Error al actualizar' }
  }

  // Update scoring rule if provided
  if (input.scoringRule) {
    await supabase
      .from('scoring_rules')
      .update({
        kill_points: input.scoringRule.killPoints,
        placement_points: input.scoringRule.placementPoints,
      })
      .eq('tournament_id', id)
  }

  return { data: mapTournamentRow(updated as Record<string, unknown>) }
}

export async function activateTournament(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('status, creator_id, format, kill_race_time_limit_minutes')
    .eq('id', id)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }
  if (tournament.creator_id !== user.id) return { error: 'Sin permisos' }
  if (tournament.status !== 'draft') {
    return { error: 'El torneo ya está activo o finalizado' }
  }

  // Verify scoring rule exists
  const { data: rule, error: ruleErr } = await supabase
    .from('scoring_rules')
    .select('id')
    .eq('tournament_id', id)
    .single()

  if (ruleErr || !rule) {
    return { error: 'El torneo debe tener una regla de puntuación antes de activarse' }
  }

  // Kill Race requires time limit
  if (tournament.format === 'kill_race' && !tournament.kill_race_time_limit_minutes) {
    return { error: 'Kill Race requiere un límite de tiempo configurado' }
  }

  const { error: activateErr } = await supabase
    .from('tournaments')
    .update({ status: 'active' })
    .eq('id', id)

  if (activateErr) return { error: activateErr.message }
  return { success: true }
}

export async function getTournaments(): Promise<
  { data: Tournament[] } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return {
    data: (data ?? []).map((row) => mapTournamentRow(row as Record<string, unknown>)),
  }
}

export async function getTournament(
  id: string
): Promise<{ data: Tournament & { scoringRule?: ScoringRule } } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .eq('creator_id', user.id)
    .single()

  if (tErr || !tournament) return { error: 'Torneo no encontrado' }

  const { data: rule } = await supabase
    .from('scoring_rules')
    .select('*')
    .eq('tournament_id', id)
    .single()

  return {
    data: {
      ...mapTournamentRow(tournament as Record<string, unknown>),
      scoringRule: rule
        ? mapScoringRuleRow(rule as Record<string, unknown>)
        : undefined,
    },
  }
}

export async function deleteTournament(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership before deleting
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('creator_id, name, status')
    .eq('id', id)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }
  if (tournament.creator_id !== user.id) return { error: 'Sin permisos para eliminar este torneo' }

  // Delete tournament — FK cascade in Supabase will remove:
  // matches, submissions, team_standings, scoring_rules, teams, leaderboard_themes
  const { error: deleteErr } = await supabase
    .from('tournaments')
    .delete()
    .eq('id', id)

  if (deleteErr) return { error: deleteErr.message }

  return { success: true }
}
