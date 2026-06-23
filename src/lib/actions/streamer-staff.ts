'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getProfile } from './auth-helpers'
import { revalidatePath } from 'next/cache'

/**
 * Invites a user by email to join the streamer's staff.
 */
export async function inviteStaffMember(
  email: string,
  role: 'editor' | 'referee' | 'analyst' = 'editor'
): Promise<{ success: boolean } | { error: string }> {
  const streamerProfile = await getProfile()
  if (!streamerProfile) return { error: 'No autenticado' }

  // Only Streamers, Admins or Federation can have staff
  if (
    streamerProfile.role !== 'STREAMER' &&
    streamerProfile.role !== 'SUPER_ADMIN' &&
    streamerProfile.role !== 'ADMIN'
  ) {
    return { error: 'No tienes permisos para invitar staff' }
  }

  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail) return { error: 'Email inválido' }

  const supabase = await createClient()

  // Verify staff limit for STREAMER accounts
  if (streamerProfile.role === 'STREAMER') {
    const { count, error: countErr } = await supabase
      .from('streamer_staff')
      .select('id', { count: 'exact', head: true })
      .eq('streamer_id', streamerProfile.id)

    if (countErr) return { error: countErr.message }
    if (count !== null && count >= 2) {
      return { error: 'Has alcanzado el límite de 2 colaboradores incluidos en tu plan. Para agregar más, contacta a Kronix ($5/mes por usuario adicional).' }
    }
  }

  // 1. Check if user is already a staff member
  const { data: existingStaff } = await supabase
    .from('streamer_staff')
    .select('id, profiles!streamer_staff_staff_id_fkey(email)')
    .eq('streamer_id', streamerProfile.id)

  const isAlreadyStaff = existingStaff?.some(
    (s: any) => s.profiles?.email?.toLowerCase() === cleanEmail
  )
  if (isAlreadyStaff) return { error: 'El usuario ya es parte de tu staff' }

  // 2. Check if there's already a pending invitation
  const { data: existingInvite } = await supabase
    .from('streamer_staff_invitations')
    .select('id')
    .eq('streamer_id', streamerProfile.id)
    .eq('email', cleanEmail)
    .eq('status', 'pending')
    .single()

  if (existingInvite) return { error: 'Ya existe una invitación pendiente para este email' }

  const adminSupabase = await createAdminClient()

  // 3. Check if user already has an account in Supabase Auth
  const { data: userList } = await adminSupabase.auth.admin.listUsers()
  const existingAuthUser = userList?.users?.find(
    (u) => u.email?.toLowerCase() === cleanEmail
  )

  let inviteUrl = ''
  const streamerName = streamerProfile.organizationName || streamerProfile.username || 'un Streamer'

  if (!existingAuthUser) {
    // User does not exist — generate invite link to send custom email via Resend
    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'invite',
      email: cleanEmail,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
        data: { 
          role: 'USER',
          invited_by: streamerName
        },
      }
    })
    
    if (linkError) return { error: linkError.message }
    
    const hashedToken = linkData?.properties?.hashed_token
    if (hashedToken) {
      inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/verify?token_hash=${hashedToken}&type=invite`
    } else if (linkData?.properties?.action_link) {
      inviteUrl = linkData.properties.action_link
    } else {
      return { error: 'No se pudo generar el enlace de invitación.' }
    }
  } else {
    // User already exists - point them to the tournaments dashboard to accept invitation
    inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/tournaments`
  }

  // 4. Create the invitation record
  const { error: insertError } = await supabase
    .from('streamer_staff_invitations')
    .insert({
      streamer_id: streamerProfile.id,
      email: cleanEmail,
      role: role,
      status: 'pending',
    })

  if (insertError) return { error: insertError.message }

  // 5. Send invite email via Resend
  const { sendStaffInviteEmail } = await import('@/lib/services/email')
  sendStaffInviteEmail({
    email: cleanEmail,
    streamerName,
    role,
    inviteUrl,
    isNewUser: !existingAuthUser
  }).catch(err => console.error('Failed to send staff invite email:', err))

  revalidatePath('/tournaments/staff')
  return { success: true }
}

/**
 * Gets all staff members of the current streamer.
 */
export async function getStaffMembers(): Promise<any[] | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'No autenticado' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('streamer_staff')
    .select(`
      id,
      role,
      created_at,
      staff:profiles!streamer_staff_staff_id_fkey(id, username, email, avatar_url)
    `)
    .eq('streamer_id', profile.id)

  if (error) return { error: error.message }
  return data || []
}

/**
 * Gets all pending staff invitations sent by the current streamer.
 */
export async function getPendingInvitations(): Promise<any[] | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'No autenticado' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('streamer_staff_invitations')
    .select('*')
    .eq('streamer_id', profile.id)
    .eq('status', 'pending')

  if (error) return { error: error.message }
  return data || []
}

/**
 * Gets invitations sent to the currently logged in user's email.
 */
export async function getMyInvitations(): Promise<any[] | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'No autenticado' }

  const supabase = await createClient()
  
  // Fetch user email from profiles
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', profile.id)
    .single()

  if (!userProfile?.email) return []

  const { data, error } = await supabase
    .from('streamer_staff_invitations')
    .select(`
      id,
      role,
      created_at,
      status,
      streamer:profiles!streamer_staff_invitations_streamer_id_fkey(id, username, organization_name)
    `)
    .eq('email', userProfile.email.toLowerCase())
    .eq('status', 'pending')

  if (error) return { error: error.message }
  return data || []
}

/**
 * Removes a staff member from the streamer's staff.
 */
export async function removeStaffMember(staffRelationId: string): Promise<{ success: boolean } | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'No autenticado' }

  const supabase = await createClient()

  // Fetch details to send notification email before deleting
  const { data: relation } = await supabase
    .from('streamer_staff')
    .select(`
      role,
      staff:profiles!streamer_staff_staff_id_fkey(email),
      streamer:profiles!streamer_staff_streamer_id_fkey(username, organization_name)
    `)
    .eq('id', staffRelationId)
    .eq('streamer_id', profile.id)
    .maybeSingle()

  const { error } = await supabase
    .from('streamer_staff')
    .delete()
    .eq('id', staffRelationId)
    .eq('streamer_id', profile.id) // Ensure security

  if (error) return { error: error.message }

  // Send notification email if staff email is available
  const staffEmail = (relation?.staff as any)?.email
  const streamerName = (relation?.streamer as any)?.organization_name || (relation?.streamer as any)?.username || 'Streamer'
  const role = relation?.role || 'staff'

  if (staffEmail) {
    const { sendStaffRemovalEmail } = await import('@/lib/services/email')
    sendStaffRemovalEmail({
      email: staffEmail,
      streamerName,
      role
    }).catch(err => console.error('Failed to send staff removal email:', err))
  }

  revalidatePath('/tournaments/staff')
  return { success: true }
}

/**
 * Cancels a pending staff invitation.
 */
export async function cancelInvitation(invitationId: string): Promise<{ success: boolean } | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'No autenticado' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('streamer_staff_invitations')
    .delete()
    .eq('id', invitationId)
    .eq('streamer_id', profile.id)

  if (error) return { error: error.message }

  revalidatePath('/tournaments/staff')
  return { success: true }
}

/**
 * Accepts an invitation to become staff.
 */
export async function acceptInvitation(invitationId: string): Promise<{ success: boolean } | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'No autenticado' }

  const supabase = await createClient()

  // 1. Fetch the invitation
  const { data: invite, error: inviteErr } = await supabase
    .from('streamer_staff_invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('status', 'pending')
    .single()

  if (inviteErr || !invite) return { error: 'Invitación no encontrada o ya procesada' }

  // 2. Validate email matches
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', profile.id)
    .single()

  if (!userProfile?.email || userProfile.email.toLowerCase() !== invite.email.toLowerCase()) {
    return { error: 'Este correo no coincide con la invitación' }
  }

  // Verify staff limit for STREAMER accounts before accepting
  const { data: streamerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', invite.streamer_id)
    .single()

  if (streamerProfile?.role === 'STREAMER') {
    const { count, error: countErr } = await supabase
      .from('streamer_staff')
      .select('id', { count: 'exact', head: true })
      .eq('streamer_id', invite.streamer_id)

    if (countErr) return { error: countErr.message }
    if (count !== null && count >= 2) {
      return { error: 'El streamer ha alcanzado el límite de 2 colaboradores activos. No se puede aceptar la invitación hasta que actualice su plan.' }
    }
  }

  // 3. Use transaction / batch to accept
  // Insert into streamer_staff
  const { error: staffErr } = await supabase
    .from('streamer_staff')
    .insert({
      streamer_id: invite.streamer_id,
      staff_id: profile.id,
      role: invite.role,
    })

  if (staffErr) return { error: staffErr.message }

  // Update invitation status
  await supabase
    .from('streamer_staff_invitations')
    .update({ status: 'accepted' })
    .eq('id', invitationId)

  revalidatePath('/tournaments/staff')
  return { success: true }
}

/**
 * Rejects an invitation to become staff.
 */
export async function rejectInvitation(invitationId: string): Promise<{ success: boolean } | { error: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'No autenticado' }

  const supabase = await createClient()

  // Validate email matches
  const { data: invite } = await supabase
    .from('streamer_staff_invitations')
    .select('*')
    .eq('id', invitationId)
    .single()

  if (!invite) return { error: 'Invitación no encontrada' }

  const { data: userProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', profile.id)
    .single()

  if (!userProfile?.email || userProfile.email.toLowerCase() !== invite.email.toLowerCase()) {
    return { error: 'Este correo no coincide con la invitación' }
  }

  // Update status
  const { error } = await supabase
    .from('streamer_staff_invitations')
    .update({ status: 'rejected' })
    .eq('id', invitationId)

  if (error) return { error: error.message }

  revalidatePath('/tournaments/staff')
  return { success: true }
}

/**
 * Helper to get the list of streamer IDs this user is staff of.
 */
export async function getStreamersForStaff(userId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('streamer_staff')
    .select('streamer_id')
    .eq('staff_id', userId)

  return data?.map((s: any) => s.streamer_id) || []
}
