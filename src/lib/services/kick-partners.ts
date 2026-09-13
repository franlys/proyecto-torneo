import { SupabaseClient } from '@supabase/supabase-js'
import { KickStreamerPartner } from '@/types'

export interface ActivePartnerOption {
  kickUserId: string
  kickUsername: string | null
  username: string | null
  userId: string
}

export interface PartnerRow {
  id: string
  user_id: string
  kick_user_id: string
  integration_enabled: boolean
  subscriber_tournaments_enabled: boolean
  created_at: string
  updated_at: string
  revoked_at?: string | null
  profiles?: { username: string | null } | null
  kick_connections?: { kick_username: string | null } | null
}

/**
 * Maps database row to KickStreamerPartner domain object with strict type safety.
 */
export function mapPartnerRow(row: Record<string, unknown>): KickStreamerPartner {
  const profiles = row.profiles as { username?: string | null } | null | undefined
  const kickConn = row.kick_connections as { kick_username?: string | null } | null | undefined

  return {
    id: String(row.id),
    userId: String(row.user_id),
    kickUserId: String(row.kick_user_id),
    integrationEnabled: Boolean(row.integration_enabled),
    subscriberTournamentsEnabled: Boolean(row.subscriber_tournaments_enabled),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    username: profiles?.username || null,
    kickUsername: kickConn?.kick_username || null,
  }
}

/**
 * Gets all Kick Streamer Partners for Super Admin management.
 */
export async function getKickStreamerPartners(supabase: SupabaseClient): Promise<KickStreamerPartner[]> {
  const { data, error } = await supabase
    .from('kick_streamer_partners')
    .select(`
      *,
      profiles:user_id (username),
      kick_connections:user_id (kick_username)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching kick streamer partners:', error)
    throw new Error(`Error al obtener partners de Kick: ${error.message}`)
  }

  return (data || []).map((row) => mapPartnerRow(row as Record<string, unknown>))
}

/**
 * Gets active authorized partners for tournament selection.
 * Only returns partners where revoked_at IS NULL, integration_enabled = true, subscriber_tournaments_enabled = true.
 */
export async function getActiveKickPartnersForTournaments(supabase: SupabaseClient): Promise<ActivePartnerOption[]> {
  const { data, error } = await supabase
    .from('kick_streamer_partners')
    .select(`
      user_id,
      kick_user_id,
      profiles:user_id (username),
      kick_connections:user_id (kick_username)
    `)
    .is('revoked_at', null)
    .eq('integration_enabled', true)
    .eq('subscriber_tournaments_enabled', true)

  if (error) {
    console.error('Error fetching active kick partners:', error)
    return []
  }

  return (data || []).map((row: Record<string, unknown>) => {
    const profiles = row.profiles as { username?: string | null } | null | undefined
    const kickConn = row.kick_connections as { kick_username?: string | null } | null | undefined
    return {
      userId: String(row.user_id),
      kickUserId: String(row.kick_user_id),
      username: profiles?.username || null,
      kickUsername: kickConn?.kick_username || null,
    }
  })
}

/**
 * Authorizes a user as a Kick Streamer Partner.
 * Requires user to have an existing kick_connections entry.
 * If partner row already exists (even if revoked), reactivates it (revoked_at = NULL).
 */
export async function authorizeKickPartner(
  supabase: SupabaseClient,
  targetUserId: string
): Promise<KickStreamerPartner> {
  // 1. Verify target user has an active Kick connection
  const { data: connection, error: connError } = await supabase
    .from('kick_connections')
    .select('kick_user_id, kick_username')
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (connError || !connection) {
    throw new Error('El usuario no tiene una cuenta de Kick conectada en Kronix')
  }

  // 2. Check if partner row already exists for targetUserId
  const { data: existingPartner } = await supabase
    .from('kick_streamer_partners')
    .select('*')
    .eq('user_id', targetUserId)
    .maybeSingle()

  const now = new Date().toISOString()

  if (existingPartner) {
    // Reactivate / update existing partner
    const { data: updated, error: updateError } = await supabase
      .from('kick_streamer_partners')
      .update({
        kick_user_id: connection.kick_user_id,
        integration_enabled: true,
        subscriber_tournaments_enabled: true,
        revoked_at: null,
        updated_at: now,
      })
      .eq('id', existingPartner.id)
      .select(`
        *,
        profiles:user_id (username),
        kick_connections:user_id (kick_username)
      `)
      .single()

    if (updateError) {
      console.error('Error reactivating partner:', updateError)
      throw new Error(`Error al reactivar partner: ${updateError.message}`)
    }

    return mapPartnerRow(updated as Record<string, unknown>)
  }

  // Insert new partner
  const { data: inserted, error: insertError } = await supabase
    .from('kick_streamer_partners')
    .insert({
      user_id: targetUserId,
      kick_user_id: connection.kick_user_id,
      integration_enabled: true,
      subscriber_tournaments_enabled: true,
      revoked_at: null,
    })
    .select(`
      *,
      profiles:user_id (username),
      kick_connections:user_id (kick_username)
    `)
    .single()

  if (insertError) {
    console.error('Error inserting partner:', insertError)
    throw new Error(`Error al registrar partner: ${insertError.message}`)
  }

  return mapPartnerRow(inserted as Record<string, unknown>)
}

/**
 * Updates flags for a Kick Streamer Partner.
 * Enforces invariant: if integration_enabled is false, subscriber_tournaments_enabled must also be false.
 */
export async function updateKickPartnerFlags(
  supabase: SupabaseClient,
  partnerId: string,
  flags: { integrationEnabled?: boolean; subscriberTournamentsEnabled?: boolean }
): Promise<KickStreamerPartner> {
  const { data: current } = await supabase
    .from('kick_streamer_partners')
    .select('*')
    .eq('id', partnerId)
    .single()

  if (!current) {
    throw new Error('Partner no encontrado')
  }

  let newIntegration = flags.integrationEnabled !== undefined ? flags.integrationEnabled : Boolean(current.integration_enabled)
  let newSubscriber = flags.subscriberTournamentsEnabled !== undefined ? flags.subscriberTournamentsEnabled : Boolean(current.subscriber_tournaments_enabled)

  // Invariant enforcement
  if (!newIntegration) {
    newSubscriber = false
  }

  const { data: updated, error } = await supabase
    .from('kick_streamer_partners')
    .update({
      integration_enabled: newIntegration,
      subscriber_tournaments_enabled: newSubscriber,
      updated_at: new Date().toISOString(),
    })
    .eq('id', partnerId)
    .select(`
      *,
      profiles:user_id (username),
      kick_connections:user_id (kick_username)
    `)
    .single()

  if (error) {
    console.error('Error updating partner flags:', error)
    throw new Error(`Error al actualizar flags del partner: ${error.message}`)
  }

  return mapPartnerRow(updated as Record<string, unknown>)
}

/**
 * Revokes a Kick Streamer Partner (logical revocation via revoked_at = NOW()).
 */
export async function revokeKickPartner(
  supabase: SupabaseClient,
  partnerId: string
): Promise<KickStreamerPartner> {
  const now = new Date().toISOString()

  const { data: updated, error } = await supabase
    .from('kick_streamer_partners')
    .update({
      revoked_at: now,
      integration_enabled: false,
      subscriber_tournaments_enabled: false,
      updated_at: now,
    })
    .eq('id', partnerId)
    .select(`
      *,
      profiles:user_id (username),
      kick_connections:user_id (kick_username)
    `)
    .single()

  if (error) {
    console.error('Error revoking partner:', error)
    throw new Error(`Error al revocar partner: ${error.message}`)
  }

  return mapPartnerRow(updated as Record<string, unknown>)
}

/**
 * Validates whether a kickBroadcasterId is authorized as an active Partner with subscriber tournaments enabled.
 * If kickBroadcasterId is null, undefined, or empty -> returns valid (no restriction).
 */
export async function validateKickPartnerAuthority(
  supabase: SupabaseClient,
  kickBroadcasterId: string | null | undefined
): Promise<{ valid: boolean; error: string | null }> {
  if (!kickBroadcasterId || kickBroadcasterId.trim() === '') {
    return { valid: true, error: null }
  }

  const { data: partner, error } = await supabase
    .from('kick_streamer_partners')
    .select('id, integration_enabled, subscriber_tournaments_enabled, revoked_at')
    .eq('kick_user_id', kickBroadcasterId.trim())
    .is('revoked_at', null)
    .eq('integration_enabled', true)
    .eq('subscriber_tournaments_enabled', true)
    .maybeSingle()

  if (error || !partner) {
    return {
      valid: false,
      error: 'El broadcaster de Kick seleccionado no es un Kick Streamer Partner activo con torneos para suscriptores habilitados',
    }
  }

  return { valid: true, error: null }
}
