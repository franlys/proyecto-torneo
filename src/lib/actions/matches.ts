'use server'

import { createClient } from '@/lib/supabase/server'
import type { Match } from '@/types'
import { revalidatePath } from 'next/cache'
import { pushToAC } from './ac-push'

export async function getTournamentMatches(tournamentId: string): Promise<{ data: Match[] } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('match_number', { ascending: true })
    .order('round_number', { ascending: true })

  if (error) return { error: error.message }

  const mapped: Match[] = (data || []).map(m => ({
    id: m.id,
    tournamentId: m.tournament_id,
    name: m.name,
    matchNumber: m.match_number,
    isCompleted: m.is_completed,
    isWarmup: m.is_warmup,
    isActive: m.is_active ?? false,
    parentMatchId: m.parent_match_id,
    roundNumber: m.round_number,
    mapName: m.map_name,
    createdAt: m.created_at,
  }))

  return { data: mapped }
}

export async function updateMatch(
  tournamentId: string,
  matchId: string,
  data: Partial<Pick<Match, 'name' | 'mapName' | 'isCompleted' | 'isWarmup' | 'isActive'>>
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership or admin
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('creator_id')
    .eq('id', tournamentId)
    .single()

  const { isAdmin } = await import('./auth-helpers')
  const admin = await isAdmin()

  if (!tournament || (!admin && tournament.creator_id !== user.id)) {
    return { error: 'Sin permisos' }
  }

  const updatePayload: Record<string, unknown> = {}
  if (data.name !== undefined) updatePayload.name = data.name
  if (data.mapName !== undefined) updatePayload.map_name = data.mapName
  if (data.isCompleted !== undefined) updatePayload.is_completed = data.isCompleted
  if (data.isWarmup !== undefined) updatePayload.is_warmup = data.isWarmup
  if (data.isActive !== undefined) updatePayload.is_active = data.isActive

  // If activating this match, deactivate all others in the tournament first
  if (data.isActive === true) {
    await supabase
      .from('matches')
      .update({ is_active: false })
      .eq('tournament_id', tournamentId)
      .neq('id', matchId)
  }

  const { error } = await supabase
    .from('matches')
    .update(updatePayload)
    .eq('id', matchId)
    .eq('tournament_id', tournamentId)

  if (error) return { error: error.message }

  // Push updated match to AC mirror
  const { data: updatedMatch } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single()
  if (updatedMatch) {
    pushToAC('matches', 'upsert', {
      id: updatedMatch.id,
      tournamentId: updatedMatch.tournament_id,
      name: updatedMatch.name,
      matchNumber: updatedMatch.match_number,
      roundNumber: updatedMatch.round_number,
      mapName: updatedMatch.map_name,
      isCompleted: updatedMatch.is_completed,
      isActive: updatedMatch.is_active,
      isWarmup: updatedMatch.is_warmup,
      parentMatchId: updatedMatch.parent_match_id,
    })
  }

  revalidatePath(`/t/[slug]`, 'page')
  revalidatePath(`/tournaments/${tournamentId}/matches`)
  return { success: true }
}
