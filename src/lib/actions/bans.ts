'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
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

    // Fetch tournament to verify creator/collaborator
    const { data: tournament, error: tourneyErr } = await supabase
      .from('tournaments')
      .select('id, name, creator_id, collaborator_id, slug')
      .eq('id', tournamentId)
      .single()

    if (tourneyErr || !tournament) return { error: 'Torneo no encontrado' }

    const { checkTournamentAccess } = await import('./tournaments')
    const hasAccess = await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id)
    if (!hasAccess) {
      return { error: 'Sin permisos para banear en este torneo' }
    }

    // Fetch all participants of this team
    const { data: teamParticipants, error: partErr } = await supabase
      .from('participants')
      .select('user_id, display_name, game_id')
      .eq('team_id', teamId)
      .eq('tournament_id', tournamentId)

    if (partErr) return { error: partErr.message }
    if (!teamParticipants || teamParticipants.length === 0) {
      return { error: 'No se encontraron participantes en este equipo' }
    }

    const adminSupabase = await createAdminClient()

    // Fetch team name and captain details for notification email before they are deleted
    const { data: teamData } = await adminSupabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single()

    const { data: captainPart } = await adminSupabase
      .from('participants')
      .select('display_name, user_id')
      .eq('team_id', teamId)
      .eq('is_captain', true)
      .maybeSingle()

    let captainEmail = null
    if (captainPart?.user_id) {
      const { data: capProfile } = await adminSupabase
        .from('profiles')
        .select('email')
        .eq('id', captainPart.user_id)
        .maybeSingle()
      captainEmail = capProfile?.email
    }

    // Send email notification if captain is found
    if (captainEmail && teamData) {
      try {
        const { data: creatorProfile } = await adminSupabase
          .from('profiles')
          .select('username, email, whatsapp_link, discord_link, role')
          .eq('id', tournament.creator_id)
          .single()

        if (creatorProfile) {
          const { sendTeamRemovedEmail } = await import('@/lib/services/email')
          const isKronixOfficial = creatorProfile.role === 'SUPER_ADMIN' || creatorProfile.role === 'ADMIN'
          const isCollaboration = !isKronixOfficial && !!tournament.collaborator_id

          await sendTeamRemovedEmail({
            email: captainEmail,
            captainName: captainPart?.display_name || 'Capitán',
            teamName: teamData.name,
            tournamentName: tournament.name,
            reason: 'Abandono de torneo sin previo aviso (Baneo del creador aplicado)',
            creatorName: creatorProfile.username || 'Organizador',
            creatorEmail: creatorProfile.email || '',
            whatsappLink: creatorProfile.whatsapp_link,
            discordLink: creatorProfile.discord_link,
            isKronixOfficial,
            isCollaboration,
          })
        }
      } catch (emailErr) {
        console.error('Error al enviar correo de abandono:', emailErr)
      }
    }

    // Create bans
    const bans = teamParticipants.map((p: any) => ({
      creator_id: tournament.creator_id,
      user_id: p.user_id || null,
      display_name: p.display_name,
      game_id: p.game_id || null,
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
