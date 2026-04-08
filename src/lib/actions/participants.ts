'use server'

import { createClient } from '@/lib/supabase/server'
import { teamSchema, participantSchema } from '@/lib/validations/schemas'
import type { CreateTeamInput, CreateParticipantInput } from '@/lib/validations/schemas'
import type { Team, Participant } from '@/types'

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
    .select('creator_id')
    .eq('id', tournamentId)
    .single()

  if (authErr || !tournament || tournament.creator_id !== user.id) {
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

  // Auto-initialize standings so team appears on leaderboard immediately with 0 pts
  await supabase.from('team_standings').upsert({
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

  return {
    data: {
      id: team.id,
      tournamentId: team.tournament_id,
      name: team.name,
      avatarUrl: team.avatar_url,
      streamUrl: team.stream_url,
      vipScore: team.vip_score,
    }
  }
}

export async function deleteTeam(
  tournamentId: string,
  teamId: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('creator_id')
    .eq('id', tournamentId)
    .single()

  if (!tournament || tournament.creator_id !== user.id) {
    return { error: 'Sin permisos' }
  }

  const { error } = await supabase
    .from('teams')
    .delete()
    .eq('id', teamId)
    .eq('tournament_id', tournamentId)

  if (error) return { error: error.message }
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
    .select('creator_id')
    .eq('id', tournamentId)
    .single()

  if (authErr || !tournament || tournament.creator_id !== user.id) {
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
    })
    .select()
    .single()

  if (partErr) return { error: partErr.message }

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
    .select('creator_id')
    .eq('id', tournamentId)
    .single()

  if (!tournament || tournament.creator_id !== user.id) {
    return { error: 'Sin permisos' }
  }

  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('id', participantId)
    .eq('tournament_id', tournamentId)

  if (error) return { error: error.message }
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
  }))

  const mappedParticipants: Participant[] = participants.map(p => ({
    id: p.id,
    tournamentId: p.tournament_id,
    teamId: p.team_id,
    displayName: p.display_name,
    contactId: p.contact_id,
    streamUrl: p.stream_url,
    isCaptain: p.is_captain,
    totalKills: p.total_kills || 0,
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
    .select('creator_id')
    .eq('id', tournamentId)
    .single()

  if (authErr || !tournament || tournament.creator_id !== user.id) {
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
    .select('creator_id')
    .eq('id', tournamentId)
    .single()

  if (!tournament || tournament.creator_id !== user.id) {
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

  return {
    data: {
      id: team.id,
      tournamentId: team.tournament_id,
      name: team.name,
      avatarUrl: team.avatar_url,
      streamUrl: team.stream_url,
      vipScore: team.vip_score,
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
    .select('creator_id')
    .eq('id', tournamentId)
    .single()

  if (!tournament || tournament.creator_id !== user.id) {
    return { error: 'Sin permisos' }
  }

  const { data: participant, error: updateErr } = await supabase
    .from('participants')
    .update({
      display_name: data.displayName,
      avatar_url: (data as any).avatarUrl,
      stream_url: data.streamUrl,
      is_captain: data.isCaptain,
    })
    .eq('id', participantId)
    .eq('tournament_id', tournamentId)
    .select()
    .single()

  if (updateErr) return { error: updateErr.message }

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
    }
  }
}
