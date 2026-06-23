'use server'

import { createClient } from '@/lib/supabase/server'

export type Profile = {
  id: string
  username: string | null
  role: 'SUPER_ADMIN' | 'ADMIN' | 'KRONIX_STAFF' | 'FEDERATION' | 'STREAMER' | 'USER'
  subscriptionStatus: 'NONE' | 'PENDING' | 'ACTIVE' | 'EXPIRED'
  subscriptionExpiry: string | null
  avatarUrl: string | null
  usernameChangesCount: number
  shortId: string | null
  organizationName: string | null
}

/**
 * Fetches the profile of the current authenticated user.
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null
 
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  return {
    id: profile.id,
    username: profile.username,
    role: profile.role,
    subscriptionStatus: profile.subscription_status,
    subscriptionExpiry: profile.subscription_expiry,
    avatarUrl: profile.avatar_url,
    usernameChangesCount: profile.username_changes_count || 0,
    shortId: profile.short_id || null,
    organizationName: profile.organization_name || null
  }
}

/**
 * Checks if the current user is an admin, super admin, kronix staff, or federation member.
 */
export async function isAdmin() {
  const profile = await getProfile()
  return (
    profile?.role === 'SUPER_ADMIN' ||
    profile?.role === 'ADMIN' ||
    profile?.role === 'KRONIX_STAFF' ||
    profile?.role === 'FEDERATION'
  )
}

/**
 * Checks if the current user is specifically a Super Admin.
 */
export async function isSuperAdmin() {
  const profile = await getProfile()
  return profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN'
}

/**
 * Checks if the current user is specifically Kronix Support Staff.
 */
export async function isKronixStaff() {
  const profile = await getProfile()
  return profile?.role === 'KRONIX_STAFF'
}

/**
 * Checks if the current user has an active subscription.
 */
export async function isActiveStreamer() {
  const profile = await getProfile()
  if (profile?.role === 'USER') return false
  return (
    profile?.role === 'SUPER_ADMIN' ||
    profile?.role === 'ADMIN' ||
    profile?.role === 'KRONIX_STAFF' ||
    profile?.role === 'FEDERATION' ||
    profile?.subscriptionStatus === 'ACTIVE'
  )
}

