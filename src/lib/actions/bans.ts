'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from './auth-helpers'
import { pushToAC } from './ac-push'
import { revalidatePath } from 'next/cache'

export async function banTeamForAbandonment(
  tournamentId: string,
  teamId: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    // Fetch tournament to verify creator
    const { data: tournament, error: tourneyErr } = await supabase
      .from('tournaments')
      .select('id, creator_id, slug')
      .eq('id', tournamentId)
      .single()

    if (tourneyErr || !tournament) return { error: 'Torneo no encontrado' }

    const admin = await isAdmin()
    if (!admin && tournament.creator_id !== user.id) {
      return { error: 'Sin permisos para banear en este torneo' }
    }

    // Fetch all participants of this team
    const { data: teamParticipants, error: partErr } = await supabase
      .from('participants')
      .select('user_id, display_name')
      .eq('team_id', teamId)
      .eq('tournament_id', tournamentId)

    if (partErr) return { error: partErr.message }
    if (!teamParticipants || teamParticipants.length === 0) {
      return { error: 'No se encontraron participantes en este equipo' }
    }

    const adminSupabase = await createAdminClient()

    // Create bans
    const bans = teamParticipants.map((p: any) => ({
      creator_id: tournament.creator_id,
      user_id: p.user_id || null,
      display_name: p.display_name,
      source_tournament_id: tournamentId,
      reason: 'Abandono de torneo sin previo aviso'
    }))

    const { error: banErr } = await adminSupabase
      .from('creator_bans')
      .insert(bans)

    if (banErr) return { error: banErr.message }

    // Delete participants first
    await adminSupabase
      .from('participants')
      .delete()
      .eq('team_id', teamId)
      .eq('tournament_id', tournamentId)

    // Delete team to open up the slots
    const { error: deleteErr } = await adminSupabase
      .from('teams')
      .delete()
      .eq('id', teamId)
      .eq('tournament_id', tournamentId)

    if (deleteErr) return { error: deleteErr.message }

    // Push delete notification to ArenaCrypto
    pushToAC('teams', 'delete', { id: teamId })

    // Trigger recalculation of standings (since a team was removed, standings should be rebuilt)
    const { recalculateStandings } = await import('./submissions')
    await recalculateStandings(adminSupabase, tournamentId)

    revalidatePath(`/tournaments/${tournamentId}/participants`)
    revalidatePath(`/tournaments/${tournamentId}`)
    revalidatePath(`/t/${tournament.slug}`)
    
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error desconocido' }
  }
}
