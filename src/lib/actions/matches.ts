'use server'

import { createClient } from '@/lib/supabase/server'
import type { Match } from '@/types'
import { revalidatePath } from 'next/cache'

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
  data: Partial<Pick<Match, 'name' | 'mapName' | 'isCompleted' | 'isWarmup'>>
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('creator_id')
    .eq('id', tournamentId)
    .single()

  if (!tournament || tournament.creator_id !== user.id) {
    return { error: 'Sin permisos' }
  }

  const updatePayload: any = {}
  if (data.name !== undefined) updatePayload.name = data.name
  if (data.mapName !== undefined) updatePayload.map_name = data.mapName
  if (data.isCompleted !== undefined) updatePayload.is_completed = data.isCompleted
  if (data.isWarmup !== undefined) updatePayload.is_warmup = data.isWarmup

  const { error } = await supabase
    .from('matches')
    .update(updatePayload)
    .eq('id', matchId)
    .eq('tournament_id', tournamentId)

  if (error) return { error: error.message }

  revalidatePath(`/t/[slug]`, 'page')
  return { success: true }
}
