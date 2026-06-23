'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getProfile } from './auth-helpers'
import { revalidatePath } from 'next/cache'
import { pushToAC } from './ac-push'

/**
 * Approves a registration request, allowing the team to proceed to payment.
 */
export async function approveRegistrationRequest(teamId: string): Promise<{ success: boolean } | { error: string }> {
  try {
    const profile = await getProfile()
    if (!profile) return { error: 'No autenticado' }

    const supabase = await createClient()
    const adminSupabase = await createAdminClient()

    // 1. Fetch team and tournament details
    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .select('id, name, tournament_id, registration_status')
      .eq('id', teamId)
      .single()

    if (teamErr || !team) return { error: 'No se encontró el equipo.' }

    // 2. Fetch tournament to verify permissions
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, creator_id, collaborator_id')
      .eq('id', team.tournament_id)
      .single()

    if (!tournament) return { error: 'No se encontró el torneo.' }

    const isCreator = tournament.creator_id === profile.id || tournament.collaborator_id === profile.id
    const isAdminUser = ['ADMIN', 'SUPER_ADMIN'].includes(profile.role)

    if (!isCreator && !isAdminUser) {
      return { error: 'No tienes permisos para administrar este torneo.' }
    }

    if (team.registration_status !== 'pending_approval') {
      return { error: 'La solicitud no está en estado pendiente de aprobación.' }
    }

    // 3. Update status to approved_to_pay
    const { error: updateErr } = await adminSupabase
      .from('teams')
      .update({ registration_status: 'approved_to_pay' })
      .eq('id', teamId)

    if (updateErr) return { error: updateErr.message }

    // 4. Fetch team captain to send notification email
    const { data: captain } = await supabase
      .from('participants')
      .select('display_name, user_id, profiles!participants_user_id_fkey(email)')
      .eq('team_id', teamId)
      .eq('is_captain', true)
      .single()

    const captainEmail = (captain?.profiles as any)?.email

    if (captainEmail && captain) {
      const { sendRegistrationApprovedEmail } = await import('@/lib/services/email')
      await sendRegistrationApprovedEmail({
        email: captainEmail,
        captainName: captain.display_name,
        tournamentName: tournament.name,
        portalUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/t/${tournament.id || team.tournament_id}`
      }).catch(e => console.error('Error al enviar correo de aprobación de registro:', e))
    }

    revalidatePath(`/tournaments/${tournament.id}/participants`)
    revalidatePath('/tournaments')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado al aprobar la solicitud.' }
  }
}

/**
 * Submits the payment evidence image URL and updates status to pending_payment_validation.
 */
export async function uploadPaymentEvidence(
  teamId: string,
  evidenceUrl: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    const profile = await getProfile()
    if (!profile) return { error: 'No autenticado' }

    const supabase = await createClient()
    const adminSupabase = await createAdminClient()

    // 1. Fetch team
    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .select('id, tournament_id, registration_status')
      .eq('id', teamId)
      .single()

    if (teamErr || !team) return { error: 'No se encontró el equipo.' }

    // Verify if current user is indeed a member/captain of the team
    const { data: participant } = await supabase
      .from('participants')
      .select('id, is_captain')
      .eq('team_id', teamId)
      .eq('user_id', profile.id)
      .maybeSingle()

    if (!participant) {
      return { error: 'No eres parte de este equipo.' }
    }

    if (team.registration_status !== 'approved_to_pay' && team.registration_status !== 'pending_payment_validation') {
      return { error: 'El equipo no está en el paso de realizar el pago.' }
    }

    // 2. Update team with evidence URL and change status
    const { error: updateErr } = await adminSupabase
      .from('teams')
      .update({
        payment_evidence_url: evidenceUrl,
        registration_status: 'pending_payment_validation'
      })
      .eq('id', teamId)

    if (updateErr) return { error: updateErr.message }

    // 3. Notify the streamer about payment validation request
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, creator_id')
      .eq('id', team.tournament_id)
      .single()

    if (tournament) {
      const { data: streamerProfile } = await adminSupabase
        .from('profiles')
        .select('email, username, organization_name')
        .eq('id', tournament.creator_id)
        .single()

      if (streamerProfile?.email) {
        // Enviar correo de aviso al streamer
        const { sendRegistrationRequestEmail } = await import('@/lib/services/email')
        await sendRegistrationRequestEmail({
          email: streamerProfile.email,
          streamerName: streamerProfile.organization_name || streamerProfile.username || 'Streamer',
          tournamentName: tournament.name,
          teamName: 'Comprobante de Pago Subido',
          portalUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/tournaments/${tournament.id}/participants`
        }).catch(e => console.error('Error al notificar comprobante al streamer:', e))
      }
    }

    revalidatePath(`/tournaments/${team.tournament_id}/participants`)
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado al subir el comprobante.' }
  }
}

/**
 * Confirms payment and officially registers the team (status -> confirmed).
 */
export async function confirmPaymentRegistration(teamId: string): Promise<{ success: boolean } | { error: string }> {
  try {
    const profile = await getProfile()
    if (!profile) return { error: 'No autenticado' }

    const supabase = await createClient()
    const adminSupabase = await createAdminClient()

    // 1. Fetch team
    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .select('id, name, tournament_id, registration_status, avatar_url, stream_url')
      .eq('id', teamId)
      .single()

    if (teamErr || !team) return { error: 'No se encontró el equipo.' }

    // 2. Fetch tournament to verify permissions
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, creator_id, collaborator_id, discord_url')
      .eq('id', team.tournament_id)
      .single()

    if (!tournament) return { error: 'No se encontró el torneo.' }

    const isCreator = tournament.creator_id === profile.id || tournament.collaborator_id === profile.id
    const isAdminUser = ['ADMIN', 'SUPER_ADMIN'].includes(profile.role)

    if (!isCreator && !isAdminUser) {
      return { error: 'No tienes permisos para administrar este torneo.' }
    }

    if (team.registration_status !== 'pending_payment_validation') {
      return { error: 'No hay ningún comprobante de pago pendiente de validar para este equipo.' }
    }

    // 3. Confirm registration status
    const { error: updateErr } = await adminSupabase
      .from('teams')
      .update({ registration_status: 'confirmed' })
      .eq('id', teamId)

    if (updateErr) return { error: updateErr.message }

    // 4. Initialize Standings
    const { error: standingsErr } = await adminSupabase
      .from('team_standings')
      .upsert({
        tournament_id: tournament.id,
        team_id: teamId,
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
      console.error('[confirmPaymentRegistration] Standings init failed:', standingsErr.message)
    }

    // Push confirmed team to AC mirror
    pushToAC('teams', 'upsert', {
      id: team.id,
      tournamentId: team.tournament_id,
      name: team.name,
      avatarUrl: team.avatar_url,
      streamUrl: team.stream_url,
    })

    // 5. Send registration confirmed email to captain
    const { data: captain } = await supabase
      .from('participants')
      .select('display_name, user_id, profiles!participants_user_id_fkey(email)')
      .eq('team_id', teamId)
      .eq('is_captain', true)
      .single()

    const captainEmail = (captain?.profiles as any)?.email

    if (captainEmail && captain) {
      const { sendRegistrationConfirmedEmail } = await import('@/lib/services/email')
      await sendRegistrationConfirmedEmail({
        email: captainEmail,
        captainName: captain.display_name,
        tournamentName: tournament.name,
        teamName: team.name,
        discordUrl: tournament.discord_url
      }).catch(e => console.error('Error al enviar correo de confirmación de registro:', e))
    }

    revalidatePath(`/tournaments/${tournament.id}/participants`)
    revalidatePath('/tournaments')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado al confirmar el registro.' }
  }
}

/**
 * Rejects the registration request or the payment validation.
 * - If pending_approval: deletes the team so they can register again.
 * - If pending_payment_validation: reverts status to approved_to_pay so they can re-upload.
 */
export async function rejectRegistrationRequest(
  teamId: string,
  reason?: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    const profile = await getProfile()
    if (!profile) return { error: 'No autenticado' }

    const supabase = await createClient()
    const adminSupabase = await createAdminClient()

    // 1. Fetch team
    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .select('id, name, tournament_id, registration_status')
      .eq('id', teamId)
      .single()

    if (teamErr || !team) return { error: 'No se encontró el equipo.' }

    // 2. Fetch tournament
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, creator_id, collaborator_id')
      .eq('id', team.tournament_id)
      .single()

    if (!tournament) return { error: 'No se encontró el torneo.' }

    const isCreator = tournament.creator_id === profile.id || tournament.collaborator_id === profile.id
    const isAdminUser = ['ADMIN', 'SUPER_ADMIN'].includes(profile.role)

    if (!isCreator && !isAdminUser) {
      return { error: 'No tienes permisos para administrar este torneo.' }
    }

    const currentStatus = team.registration_status

    if (currentStatus === 'pending_approval') {
      // Rejection of initial application -> Delete team to allow re-registration
      const { error: deleteErr } = await adminSupabase
        .from('teams')
        .delete()
        .eq('id', teamId)

      if (deleteErr) return { error: deleteErr.message }
    } else if (currentStatus === 'pending_payment_validation') {
      // Rejection of transfer screenshot -> Revert to approved_to_pay step
      const { error: updateErr } = await adminSupabase
        .from('teams')
        .update({
          registration_status: 'approved_to_pay',
          payment_evidence_url: null
        })
        .eq('id', teamId)

      if (updateErr) return { error: updateErr.message }

      // Optionally notify captain by email that payment was rejected
      const { data: captain } = await supabase
        .from('participants')
        .select('display_name, user_id, profiles!participants_user_id_fkey(email)')
        .eq('team_id', teamId)
        .eq('is_captain', true)
        .single()

      const captainEmail = (captain?.profiles as any)?.email
      if (captainEmail && captain) {
        // Enviar aviso simple
        const { sendRegistrationApprovedEmail } = await import('@/lib/services/email')
        await sendRegistrationApprovedEmail({
          email: captainEmail,
          captainName: captain.display_name,
          tournamentName: `${tournament.name} (Pago Rechazado${reason ? `: ${reason}` : ''})`,
          portalUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/t/${tournament.id || team.tournament_id}`
        }).catch(e => console.error('Error al notificar rechazo de pago:', e))
      }
    } else {
      return { error: 'No se puede rechazar un equipo ya confirmado o en estado inválido.' }
    }

    revalidatePath(`/tournaments/${tournament.id}/participants`)
    revalidatePath('/tournaments')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado al rechazar la solicitud.' }
  }
}
