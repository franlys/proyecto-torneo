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

  // 3. Check if user already has an account
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', cleanEmail)
    .single()

  const adminSupabase = await createAdminClient()

  if (!targetProfile) {
    // User does not exist, invite them via Supabase Auth (emails are sent via Resend SMTP)
    const { error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(
      cleanEmail,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/tournaments/staff`,
        data: {
          role: 'USER', // default role
        },
      }
    )
    if (inviteError) return { error: inviteError.message }
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
  const { error } = await supabase
    .from('streamer_staff')
    .delete()
    .eq('id', staffRelationId)
    .eq('streamer_id', profile.id) // Ensure security

  if (error) return { error: error.message }

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
