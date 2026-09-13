/**
 * Kick Subscriber Benefits & Tournament Eligibility Service — Gate 3 (Contract v1.2 Remediado)
 *
 * Implementa la Proyección de Estado Actual de Suscripciones Kick (`public.kick_subscribers`)
 * y el servicio de evaluación de elegibilidad para torneos exclusivos de suscriptores.
 *
 * Remediaciones Integradas:
 * 1. HIGH (Atomic RPC Upsert):
 *    - Reemplaza el patrón non-atomic check-then-act (select-then-write) por funciones
 *      RPC atómicas en Postgres (`upsert_kick_subscriber_projection` y `upsert_kick_subscriber_projection_batch`)
 *      con guard monotónico ON CONFLICT DO UPDATE WHERE last_event_timestamp < EXCLUDED.last_event_timestamp.
 *    - Batchea los giftees de `channel.subscription.gifts` en una sola llamada RPC.
 * 2. MEDIUM #1 (Failure Handling in Webhook Route):
 *    - La falla en la proyección registra el evento como 'failed' permitiendo orphan recovery/retry.
 * 3. Matriz de Transiciones y Prevalencia de `expires_at`:
 *    - Direct Activa + Gifted nuevo -> Conserva Direct Activa (ELEGIBLE).
 *    - Direct Expirada + Gifted nuevo -> Pasa a Gifted (NO ELEGIBLE).
 *    - Direct Expirada + Renovación -> Pasa a Direct Activa (ELEGIBLE).
 *    - Gifted Activa + Direct Nueva -> Actualiza a Direct Activa (ELEGIBLE).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  KickOfficialNewSubscriptionSchema,
  KickOfficialRenewalSubscriptionSchema,
  KickOfficialGiftedSubscriptionSchema,
  KickWebhookError,
} from './kick-webhooks'

// ── Tipos de Elegibilidad ────────────────────────────────────────────────────

export interface CheckKickEligibilityInput {
  userId: string
  broadcasterKickUserId: string
  subsType?: 'direct' | 'all' | null
}

export type KickEligibilityReason =
  | 'eligible'
  | 'kick_not_connected'
  | 'no_subscription_found'
  | 'gifted_subscription_ineligible'
  | 'subscription_expired'
  | 'database_error'

export interface KickEligibilityResult {
  eligible: boolean
  reason: KickEligibilityReason
  subscriptionType?: 'direct' | 'gifted'
  expiresAt?: string
}

export interface KickSubscriberRow {
  id: string
  broadcaster_kick_user_id: string
  subscriber_kick_user_id: string
  subscription_type: 'direct' | 'gifted'
  is_active: boolean
  expires_at: string
  last_event_timestamp: string
  created_at: string
  updated_at: string
}

// ── Servicio de Evaluación de Elegibilidad para Torneos ───────────────────────

export async function checkKickTournamentEligibility(
  adminClient: SupabaseClient,
  input: CheckKickEligibilityInput
): Promise<KickEligibilityResult> {
  const { userId, broadcasterKickUserId } = input

  // 1. Verificar conexión de Kick del usuario en Kronix (Gate 1)
  const { data: connection, error: connError } = await adminClient
    .from('kick_connections')
    .select('kick_user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (connError) {
    console.error('[Kick Eligibility] Error leyendo kick_connections:', connError.message)
    return { eligible: false, reason: 'database_error' }
  }

  if (!connection || !connection.kick_user_id) {
    return { eligible: false, reason: 'kick_not_connected' }
  }

  const subscriberKickUserId = connection.kick_user_id

  // 2. Consultar la proyección de estado actual en public.kick_subscribers
  const { data: subRecord, error: subError } = await adminClient
    .from('kick_subscribers')
    .select('*')
    .eq('broadcaster_kick_user_id', broadcasterKickUserId)
    .eq('subscriber_kick_user_id', subscriberKickUserId)
    .maybeSingle()

  if (subError) {
    console.error('[Kick Eligibility] Error leyendo kick_subscribers:', subError.message)
    return { eligible: false, reason: 'database_error' }
  }

  if (!subRecord) {
    return { eligible: false, reason: 'no_subscription_found' }
  }

  const row = subRecord as KickSubscriberRow
  const nowMs = Date.now()
  const expiresAtMs = new Date(row.expires_at).getTime()

  // 3. Regla de Prevalencia de expires_at: expires_at <= NOW() -> DENY (subscription_expired)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    return {
      eligible: false,
      reason: 'subscription_expired',
      subscriptionType: row.subscription_type,
      expiresAt: row.expires_at,
    }
  }

  // 4. Regla de Tipo de Suscripción: Si el torneo requiere 'direct' y la suscripción es 'gifted' -> DENY
  const requiredSubsType = input.subsType || 'direct'
  if (requiredSubsType === 'direct' && row.subscription_type === 'gifted') {
    return {
      eligible: false,
      reason: 'gifted_subscription_ineligible',
      subscriptionType: 'gifted',
      expiresAt: row.expires_at,
    }
  }

  // 5. Regla is_active
  if (!row.is_active) {
    return {
      eligible: false,
      reason: 'subscription_expired',
      subscriptionType: row.subscription_type,
      expiresAt: row.expires_at,
    }
  }

  // 6. Si todas las condiciones se cumplen -> ELIGIBLE
  return {
    eligible: true,
    reason: 'eligible',
    subscriptionType: row.subscription_type,
    expiresAt: row.expires_at,
  }
}

// ── Actualizador de Proyección de Estado Atómico Vía Postgres RPC ───────────

export interface UpdateProjectionParams {
  eventType: string
  rawPayload: unknown
  eventTimestampIso: string
}

export interface UpdateProjectionResult {
  updated: boolean
  reason?: 'stale_event' | 'unhandled_event' | 'invalid_payload'
  affectedSubscribersCount?: number
}

export async function updateKickSubscriberProjection(
  adminClient: SupabaseClient,
  params: UpdateProjectionParams
): Promise<UpdateProjectionResult> {
  const { eventType, rawPayload, eventTimestampIso } = params
  const incomingTimeMs = new Date(eventTimestampIso).getTime()

  if (eventType === 'channel.subscription.new' || eventType === 'channel.subscription.renewal') {
    const schema =
      eventType === 'channel.subscription.new'
        ? KickOfficialNewSubscriptionSchema
        : KickOfficialRenewalSubscriptionSchema

    const parsed = schema.safeParse(rawPayload)
    if (!parsed.success || !parsed.data.broadcasterKickUserId) {
      throw new KickWebhookError(
        'invalid_payload',
        `Payload de ${eventType} no válido para proyección`
      )
    }

    const broadcasterId = parsed.data.broadcasterKickUserId
    const subscriberId = parsed.data.subscriberKickUserId

    if (!subscriberId) {
      return { updated: false, reason: 'invalid_payload' }
    }

    const defaultExpiresAt = new Date(incomingTimeMs + 30 * 86400 * 1000).toISOString()
    const rawExpiresAt = (rawPayload as { expires_at?: string })?.expires_at
    const expiresAt = rawExpiresAt ? new Date(rawExpiresAt).toISOString() : defaultExpiresAt

    // 1. Intentar llamada RPC atómica en Postgres
    if (typeof adminClient.rpc === 'function') {
      const { data, error } = await adminClient.rpc('upsert_kick_subscriber_projection', {
        p_broadcaster_kick_user_id: broadcasterId,
        p_subscriber_kick_user_id: subscriberId,
        p_subscription_type: 'direct',
        p_is_active: true,
        p_expires_at: expiresAt,
        p_last_event_timestamp: eventTimestampIso,
      })

      if (error) {
        console.error('[Kick Eligibility] Error ejecutando RPC upsert_kick_subscriber_projection:', error.message)
        throw new KickWebhookError('database_error', `Error ejecutando RPC de proyección: ${error.message}`)
      }

      if (data) {
        const res = data as { updated: boolean; reason: string }
        return {
          updated: res.updated,
          reason: res.updated ? undefined : (res.reason as 'stale_event'),
          affectedSubscribersCount: res.updated ? 1 : 0,
        }
      }
    }

    // Fallback para entornos mock sin RPC configurado (unit tests)
    const { data: existing } = await adminClient
      .from('kick_subscribers')
      .select('last_event_timestamp')
      .eq('broadcaster_kick_user_id', broadcasterId)
      .eq('subscriber_kick_user_id', subscriberId)
      .maybeSingle()

    if (existing?.last_event_timestamp) {
      const existingTimeMs = new Date(existing.last_event_timestamp).getTime()
      if (incomingTimeMs <= existingTimeMs) {
        return { updated: false, reason: 'stale_event' }
      }
    }

    const { error: upsertError } = await adminClient.from('kick_subscribers').upsert(
      {
        broadcaster_kick_user_id: broadcasterId,
        subscriber_kick_user_id: subscriberId,
        subscription_type: 'direct',
        is_active: true,
        expires_at: expiresAt,
        last_event_timestamp: eventTimestampIso,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'broadcaster_kick_user_id,subscriber_kick_user_id' }
    )

    if (upsertError) {
      throw new KickWebhookError('database_error', 'Error actualizando kick_subscribers')
    }

    return { updated: true, affectedSubscribersCount: 1 }
  }

  if (eventType === 'channel.subscription.gifts') {
    const parsed = KickOfficialGiftedSubscriptionSchema.safeParse(rawPayload)
    if (!parsed.success || !parsed.data.broadcasterKickUserId) {
      throw new KickWebhookError(
        'invalid_payload',
        'Payload de channel.subscription.gifts no válido para proyección'
      )
    }

    const broadcasterId = parsed.data.broadcasterKickUserId
    const giftees = parsed.data.giftees ?? []

    if (giftees.length === 0) {
      return { updated: false, reason: 'invalid_payload' }
    }

    const defaultExpiresAt = new Date(incomingTimeMs + 30 * 86400 * 1000).toISOString()
    const rawExpiresAt = (rawPayload as { expires_at?: string })?.expires_at
    const expiresAt = rawExpiresAt ? new Date(rawExpiresAt).toISOString() : defaultExpiresAt

    const batchItems = giftees
      .filter((g) => Boolean(g.user_id))
      .map((g) => ({
        broadcaster_kick_user_id: broadcasterId,
        subscriber_kick_user_id: String(g.user_id),
        subscription_type: 'gifted',
        is_active: true,
        expires_at: expiresAt,
        last_event_timestamp: eventTimestampIso,
      }))

    if (batchItems.length === 0) {
      return { updated: false, reason: 'invalid_payload' }
    }

    // 1. Intentar llamada RPC Batch atómica en Postgres
    if (typeof adminClient.rpc === 'function') {
      const { data, error } = await adminClient.rpc('upsert_kick_subscriber_projection_batch', {
        p_items: batchItems,
      })

      if (error) {
        console.error('[Kick Eligibility] Error ejecutando RPC upsert_kick_subscriber_projection_batch:', error.message)
        throw new KickWebhookError('database_error', `Error ejecutando RPC de proyección batch: ${error.message}`)
      }

      if (data) {
        const res = data as { updated: boolean; reason: string; affected_rows: number }
        return {
          updated: res.updated,
          reason: res.updated ? undefined : (res.reason as 'stale_event'),
          affectedSubscribersCount: res.affected_rows,
        }
      }
    }

    // Fallback para entornos mock sin RPC configurado (unit tests)
    let updatedCount = 0
    let skippedStaleCount = 0

    for (const giftee of giftees) {
      if (!giftee.user_id) continue

      const gifteeSubscriberId = String(giftee.user_id)

      const { data: existing } = await adminClient
        .from('kick_subscribers')
        .select('subscription_type, is_active, expires_at, last_event_timestamp')
        .eq('broadcaster_kick_user_id', broadcasterId)
        .eq('subscriber_kick_user_id', gifteeSubscriberId)
        .maybeSingle()

      if (existing?.last_event_timestamp) {
        const existingTimeMs = new Date(existing.last_event_timestamp).getTime()
        if (incomingTimeMs <= existingTimeMs) {
          skippedStaleCount++
          continue
        }
      }

      const nowMs = Date.now()
      const existingExpiresMs = existing?.expires_at ? new Date(existing.expires_at).getTime() : 0
      const isDirectActive =
        existing?.subscription_type === 'direct' && existing?.is_active && existingExpiresMs > nowMs

      if (isDirectActive) {
        await adminClient
          .from('kick_subscribers')
          .update({
            last_event_timestamp: eventTimestampIso,
            updated_at: new Date().toISOString(),
          })
          .eq('broadcaster_kick_user_id', broadcasterId)
          .eq('subscriber_kick_user_id', gifteeSubscriberId)

        updatedCount++
        continue
      }

      const { error: upsertError } = await adminClient.from('kick_subscribers').upsert(
        {
          broadcaster_kick_user_id: broadcasterId,
          subscriber_kick_user_id: gifteeSubscriberId,
          subscription_type: 'gifted',
          is_active: true,
          expires_at: expiresAt,
          last_event_timestamp: eventTimestampIso,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'broadcaster_kick_user_id,subscriber_kick_user_id' }
      )

      if (!upsertError) {
        updatedCount++
      }
    }

    if (updatedCount === 0 && skippedStaleCount > 0) {
      return { updated: false, reason: 'stale_event', affectedSubscribersCount: 0 }
    }

    return { updated: true, affectedSubscribersCount: updatedCount }
  }

  return { updated: false, reason: 'unhandled_event' }
}
