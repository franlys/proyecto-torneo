/**
 * Kick Webhooks Service — Gate 2: Kick Subscriber Webhooks Integration (Refinado)
 *
 * Clasificación de Validación: "Schema contract validation with tolerated additional fields" (.passthrough()).
 *
 * Contrato Oficial vs Fallback Defensivo:
 * - Schemas Oficiales (KickOfficial*): Representan el contrato documentado por Kick para los eventos:
 *   - channel.subscription.new
 *   - channel.subscription.renewal
 *   - channel.subscription.gifts
 * - Schema Defensivo (KickDefensive*): Proporciona compatibilidad histórica defensiva (separada del contrato oficial).
 *
 * Reglas Criptográficas & Idempotencia:
 * - Firma RSA PKCS#1 v1.5 + SHA-256 sobre `${message_id}.${timestamp}.${raw_body}`.
 * - Replay protection (tol. 300s).
 * - Claim atómico concurrente sobre `created_at` (threshold 300s).
 * - Invariante `processed_at`: NULL mientras status != 'processed'.
 * - RLS + service_role exclusivamente para persistencia.
 * - CERO modificaciones a Gate 1.
 */

import { createVerify, createPublicKey, type KeyObject } from 'node:crypto'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Constantes & Headers Oficiales ───────────────────────────────────────────

export const KICK_PUBLIC_KEY_URL = 'https://api.kick.com/public/v1/public-key'

/** 6 Headers obligatorios según la especificación oficial de Kick */
export const KICK_MANDATORY_HEADERS = [
  'Kick-Event-Message-Id',
  'Kick-Event-Subscription-Id',
  'Kick-Event-Signature',
  'Kick-Event-Message-Timestamp',
  'Kick-Event-Type',
  'Kick-Event-Version',
] as const

/** Headers prohibidos explícitamente en Gate 2 */
export const KICK_PROHIBITED_HEADERS = [
  'Kick-Event-Subscription-Timestamp',
  'Kick-Event-Subscription-Type',
] as const

/** Eventos autorizados para Gate 2 */
export const KICK_AUTHORIZED_EVENTS = [
  'channel.subscription.new',
  'channel.subscription.renewal',
  'channel.subscription.gifts',
] as const

export type KickAuthorizedEventType = (typeof KICK_AUTHORIZED_EVENTS)[number]

/** Tolerancia de tiempo para Replay Protection (5 minutos en ms) */
export const REPLAY_TOLERANCE_MS = 300_000

/** Threshold para considerar una tarea stale en orphan recovery (5 minutos en ms) */
export const STALE_THRESHOLD_MS = 300_000

/** Timeout para llamadas HTTP de red (ms) */
const KICK_FETCH_TIMEOUT_MS = 10_000

// ── Tipos de Errores ─────────────────────────────────────────────────────────

export type KickWebhookErrorCode =
  | 'missing_headers'
  | 'prohibited_headers'
  | 'invalid_timestamp'
  | 'replay_attack'
  | 'invalid_signature'
  | 'invalid_public_key'
  | 'unauthorized_event'
  | 'invalid_payload'
  | 'network_error'
  | 'database_error'

export class KickWebhookError extends Error {
  readonly code: KickWebhookErrorCode
  constructor(code: KickWebhookErrorCode, message: string) {
    super(message)
    this.name = 'KickWebhookError'
    this.code = code
  }
}

// ── Estructura de Headers Validados ──────────────────────────────────────────

export interface KickWebhookHeadersData {
  messageId: string
  subscriptionId: string
  signature: string
  timestamp: string
  eventType: string
  eventVersion: string
}

export function extractAndValidateHeaders(
  headersGetter: (name: string) => string | null | undefined
): KickWebhookHeadersData {
  for (const prohib of KICK_PROHIBITED_HEADERS) {
    const val = headersGetter(prohib) || headersGetter(prohib.toLowerCase())
    if (val) {
      throw new KickWebhookError(
        'prohibited_headers',
        `Header prohibido detectado: ${prohib}`
      )
    }
  }

  const extracted: Record<string, string> = {}
  for (const key of KICK_MANDATORY_HEADERS) {
    const val = headersGetter(key) || headersGetter(key.toLowerCase())
    if (!val || val.trim() === '') {
      throw new KickWebhookError(
        'missing_headers',
        `Falta el header obligatorio de Kick: ${key}`
      )
    }
    extracted[key] = val.trim()
  }

  return {
    messageId: extracted['Kick-Event-Message-Id'],
    subscriptionId: extracted['Kick-Event-Subscription-Id'],
    signature: extracted['Kick-Event-Signature'],
    timestamp: extracted['Kick-Event-Message-Timestamp'],
    eventType: extracted['Kick-Event-Type'],
    eventVersion: extracted['Kick-Event-Version'],
  }
}

// ── Replay Protection ────────────────────────────────────────────────────────

export function parseKickTimestamp(rawTimestamp: string): number {
  if (/^\d+$/.test(rawTimestamp)) {
    const num = Number.parseInt(rawTimestamp, 10)
    return rawTimestamp.length <= 10 ? num * 1000 : num
  }
  const parsed = Date.parse(rawTimestamp)
  if (Number.isNaN(parsed)) {
    throw new KickWebhookError(
      'invalid_timestamp',
      'El timestamp del webhook no es válido'
    )
  }
  return parsed
}

export function isTimestampWithinTolerance(
  rawTimestamp: string,
  nowMs = Date.now(),
  toleranceMs = REPLAY_TOLERANCE_MS
): boolean {
  const eventTimeMs = parseKickTimestamp(rawTimestamp)
  const diff = Math.abs(nowMs - eventTimeMs)
  return diff <= toleranceMs
}

// ── Sanitización de Errores ──────────────────────────────────────────────────

export function sanitizeErrorMessage(rawError: unknown): string {
  let message =
    rawError instanceof Error
      ? rawError.message
      : typeof rawError === 'string'
      ? rawError
      : String(rawError ?? 'Error desconocido')

  message = message
    .replace(/(?:access_token|refresh_token|client_secret|api_key|token|secret|key)=?[^\s&"',;]+/gi, '[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+/gi, '[REDACTED_ENCRYPTED_TOKEN]')

  return message.slice(0, 500)
}

// ── Clave Pública Kick (Cache + Resilient Fallback) ───────────────────────────

let cachedKeyObject: KeyObject | null = null

export function resetPublicKeyCache(): void {
  cachedKeyObject = null
}

export function validateRsaPublicKey(pemKey: string): KeyObject {
  try {
    const keyObject = createPublicKey(pemKey)
    if (keyObject.type !== 'public') {
      throw new Error('La clave obtenida no es de tipo pública')
    }
    if (!keyObject.asymmetricKeyType?.includes('rsa')) {
      throw new Error(`La clave pública debe ser RSA (recibida: ${keyObject.asymmetricKeyType})`)
    }
    return keyObject
  } catch (err) {
    throw new KickWebhookError(
      'invalid_public_key',
      `La clave pública RSA no es válida: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

export async function getKickPublicKey(): Promise<KeyObject> {
  if (cachedKeyObject) {
    return cachedKeyObject
  }

  const envPem = process.env.KICK_PUBLIC_KEY?.trim()

  if (envPem) {
    try {
      const validEnvKey = validateRsaPublicKey(envPem)
      cachedKeyObject = validEnvKey
      return validEnvKey
    } catch {
      console.warn(
        '[Kick Webhook] KICK_PUBLIC_KEY en env es inválida; realizando fallback a la API oficial de Kick'
      )
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), KICK_FETCH_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(KICK_PUBLIC_KEY_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  } catch (err) {
    throw new KickWebhookError(
      'network_error',
      `Error de red al consultar la clave pública de Kick: ${err instanceof Error ? err.message : String(err)}`
    )
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new KickWebhookError(
      'network_error',
      `HTTP ${response.status} consultando la clave pública de Kick`
    )
  }

  const body: unknown = await response.json().catch(() => null)
  const parsed = z
    .object({
      data: z.object({
        public_key: z.string().min(1),
      }),
    })
    .safeParse(body)

  if (!parsed.success) {
    throw new KickWebhookError(
      'invalid_public_key',
      'Respuesta con formato inesperado al consultar la clave pública de Kick'
    )
  }

  const officialPem = parsed.data.data.public_key
  const validOfficialKey = validateRsaPublicKey(officialPem)
  cachedKeyObject = validOfficialKey
  return validOfficialKey
}

// ── Verificación de Firma RSA PKCS#1 v1.5 + SHA-256 ──────────────────────────

export function verifyKickWebhookSignature(params: {
  messageId: string
  timestamp: string
  rawBody: string
  signatureB64: string
  publicKey: KeyObject | string
}): boolean {
  const { messageId, timestamp, rawBody, signatureB64, publicKey } = params
  const signedData = `${messageId}.${timestamp}.${rawBody}`

  try {
    const verifier = createVerify('SHA256')
    verifier.update(Buffer.from(signedData, 'utf8'))
    const sigBuffer = Buffer.from(signatureB64, 'base64')
    return verifier.verify(publicKey, sigBuffer)
  } catch (err) {
    console.error('[Kick Webhook] Error en verificación de firma RSA:', err)
    return false
  }
}

// ── Schemas Zod Oficiales (Schema contract validation with tolerated additional fields) ──

const KickUserRefSchema = z.object({
  user_id: z.union([z.number(), z.string()]).transform((v) => String(v)),
  username: z.string().optional(),
  slug: z.string().optional(),
})

const KickGifterRefSchema = z.object({
  user_id: z.union([z.number(), z.string()]).transform((v) => String(v)).nullable().optional(),
  username: z.string().optional().nullable(),
})

const KickGifteeRefSchema = z.object({
  user_id: z.union([z.number(), z.string()]).transform((v) => String(v)).nullable().optional(),
  username: z.string().optional().nullable(),
  duration: z.number().int().positive().optional(),
})

/**
 * Contrato Oficial Documentado por Kick para channel.subscription.new:
 * Payload: { broadcaster: { user_id, username }, subscriber: { user_id, username }, duration, created_at, expires_at }
 * Clasificación: Schema contract validation with tolerated additional fields (.passthrough())
 */
export const KickOfficialNewSubscriptionSchema = z
  .object({
    broadcaster: KickUserRefSchema,
    subscriber: KickUserRefSchema.optional(),
    duration: z.number().int().positive().optional(),
    created_at: z.string().optional(),
    expires_at: z.string().optional(),
  })
  .passthrough()
  .transform((val) => ({
    broadcasterKickUserId: val.broadcaster.user_id,
    subscriberKickUserId: val.subscriber?.user_id,
    duration: val.duration,
  }))

/**
 * Contrato Oficial Documentado por Kick para channel.subscription.renewal:
 * Payload: { broadcaster: { user_id, username }, subscriber: { user_id, username }, duration, created_at, expires_at }
 * Clasificación: Schema contract validation with tolerated additional fields (.passthrough())
 */
export const KickOfficialRenewalSubscriptionSchema = z
  .object({
    broadcaster: KickUserRefSchema,
    subscriber: KickUserRefSchema.optional(),
    duration: z.number().int().positive().optional(),
    created_at: z.string().optional(),
    expires_at: z.string().optional(),
  })
  .passthrough()
  .transform((val) => ({
    broadcasterKickUserId: val.broadcaster.user_id,
    subscriberKickUserId: val.subscriber?.user_id,
    duration: val.duration,
  }))

/**
 * Contrato Oficial Documentado por Kick para channel.subscription.gifts:
 * Payload: { broadcaster: { user_id, username }, gifter: { user_id, username }, giftees: [...], created_at, expires_at }
 * Clasificación: Schema contract validation with tolerated additional fields (.passthrough())
 */
export const KickOfficialGiftedSubscriptionSchema = z
  .object({
    broadcaster: KickUserRefSchema,
    gifter: KickGifterRefSchema.optional().nullable(),
    giftees: z.array(KickGifteeRefSchema).optional(),
    created_at: z.string().optional(),
    expires_at: z.string().optional(),
  })
  .passthrough()
  .transform((val) => ({
    broadcasterKickUserId: val.broadcaster.user_id,
    gifterKickUserId: val.gifter?.user_id ?? null,
    gifteeCount: val.giftees?.length ?? 0,
    giftees: val.giftees ?? [],
  }))

// ── Schema de Fallback Defensivo Histórico (Declarado Separado del Contrato Oficial) ──

export const KickDefensiveSubscriptionSchema = z
  .object({
    broadcaster_user_id: z
      .union([z.number(), z.string()])
      .transform((v) => String(v))
      .optional(),
    broadcaster_kick_user_id: z
      .union([z.number(), z.string()])
      .transform((v) => String(v))
      .optional(),
  })
  .passthrough()
  .transform((val) => ({
    broadcasterKickUserId: val.broadcaster_user_id ?? val.broadcaster_kick_user_id,
  }))

/**
 * Valida en runtime el payload JSON según el eventType.
 * 1. Ejecuta primero la validación del Contrato Oficial de Kick.
 * 2. Si falla, ejecuta de forma aislada el Fallback Defensivo.
 * Extrae únicamente: broadcaster.user_id -> broadcasterKickUserId.
 */
export function validateAndParseEventPayload(
  eventType: string,
  rawPayload: unknown
): { broadcasterKickUserId: string } {
  if (!KICK_AUTHORIZED_EVENTS.includes(eventType as KickAuthorizedEventType)) {
    throw new KickWebhookError(
      'unauthorized_event',
      `El evento ${eventType} no está autorizado para Gate 2`
    )
  }

  let broadcasterId: string | undefined

  if (eventType === 'channel.subscription.new') {
    const official = KickOfficialNewSubscriptionSchema.safeParse(rawPayload)
    if (official.success) {
      broadcasterId = official.data.broadcasterKickUserId
    } else {
      const defensive = KickDefensiveSubscriptionSchema.safeParse(rawPayload)
      if (defensive.success && defensive.data.broadcasterKickUserId) {
        broadcasterId = defensive.data.broadcasterKickUserId
      }
    }
  } else if (eventType === 'channel.subscription.renewal') {
    const official = KickOfficialRenewalSubscriptionSchema.safeParse(rawPayload)
    if (official.success) {
      broadcasterId = official.data.broadcasterKickUserId
    } else {
      const defensive = KickDefensiveSubscriptionSchema.safeParse(rawPayload)
      if (defensive.success && defensive.data.broadcasterKickUserId) {
        broadcasterId = defensive.data.broadcasterKickUserId
      }
    }
  } else if (eventType === 'channel.subscription.gifts') {
    const official = KickOfficialGiftedSubscriptionSchema.safeParse(rawPayload)
    if (official.success) {
      broadcasterId = official.data.broadcasterKickUserId
    } else {
      const defensive = KickDefensiveSubscriptionSchema.safeParse(rawPayload)
      if (defensive.success && defensive.data.broadcasterKickUserId) {
        broadcasterId = defensive.data.broadcasterKickUserId
      }
    }
  }

  if (!broadcasterId) {
    throw new KickWebhookError(
      'invalid_payload',
      `No se pudo determinar broadcaster.user_id en el payload del evento ${eventType}`
    )
  }

  return { broadcasterKickUserId: broadcasterId }
}

// ── Persistencia & Claim Atómico Verdaderamente Concurrente ───────────────────

export type WebhookClaimResult =
  | { claimed: true; isReclaim: boolean }
  | { claimed: false; reason: 'already_processed' | 'currently_processing' }

export interface ClaimWebhookInput {
  messageId: string
  subscriptionId: string
  eventType: string
  eventVersion: string
  broadcasterKickUserId: string
}

export async function claimKickWebhookEvent(
  adminClient: SupabaseClient,
  input: ClaimWebhookInput,
  nowMs = Date.now()
): Promise<WebhookClaimResult> {
  const { messageId, subscriptionId, eventType, eventVersion, broadcasterKickUserId } = input
  const nowIso = new Date(nowMs).toISOString()

  // 1. Intentar Insert primario
  const { error: insertError } = await adminClient.from('kick_webhook_events').insert({
    message_id: messageId,
    subscription_id: subscriptionId,
    event_type: eventType,
    event_version: eventVersion ?? '1',
    broadcaster_kick_user_id: broadcasterKickUserId,
    status: 'processing',
    processed_at: null,
    created_at: nowIso,
  })

  if (!insertError) {
    return { claimed: true, isReclaim: false }
  }

  if (insertError.code !== '23505') {
    console.error('[Kick Webhook] Error insertando webhook event:', insertError.code ?? insertError.message)
    throw new KickWebhookError('database_error', `Error DB en idempotency claim: ${insertError.message}`)
  }

  // 2. Conflicto UNIQUE: Ejecutar UPDATE Atómico de Reclaim
  const staleCutoff = new Date(nowMs - STALE_THRESHOLD_MS).toISOString()

  const { data: reclaimedRows, error: updateError } = await adminClient
    .from('kick_webhook_events')
    .update({
      status: 'processing',
      created_at: nowIso,
      error_message: null,
      processed_at: null,
    })
    .eq('message_id', messageId)
    .or(`status.eq.failed,and(status.eq.processing,created_at.lte.${staleCutoff})`)
    .select('id')

  if (updateError) {
    console.error('[Kick Webhook] Error en atomic reclaim:', updateError.message)
    throw new KickWebhookError('database_error', 'Error en atomic reclaim')
  }

  if (reclaimedRows && reclaimedRows.length > 0) {
    return { claimed: true, isReclaim: true }
  }

  // 3. Si no pudo obtener reclaim (0 filas actualizadas), consultar estado actual para causa exacta
  const { data: existing } = await adminClient
    .from('kick_webhook_events')
    .select('status')
    .eq('message_id', messageId)
    .maybeSingle()

  if (existing?.status === 'processed') {
    return { claimed: false, reason: 'already_processed' }
  }

  return { claimed: false, reason: 'currently_processing' }
}

export async function markKickWebhookEventProcessed(
  adminClient: SupabaseClient,
  messageId: string
): Promise<void> {
  const { error } = await adminClient
    .from('kick_webhook_events')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('message_id', messageId)

  if (error) {
    console.error('[Kick Webhook] Error al marcar evento como processed:', error.message)
    throw new KickWebhookError('database_error', 'No se pudo actualizar status a processed')
  }
}

export async function markKickWebhookEventFailed(
  adminClient: SupabaseClient,
  messageId: string,
  rawError: unknown
): Promise<void> {
  const sanitized = sanitizeErrorMessage(rawError)
  const { error } = await adminClient
    .from('kick_webhook_events')
    .update({
      status: 'failed',
      processed_at: null,
      error_message: sanitized,
    })
    .eq('message_id', messageId)

  if (error) {
    console.error('[Kick Webhook] Error al marcar evento como failed:', error.message)
  }
}

// ── EventSub Subscription Helper (OpenAPI Oficial) ─────────────────────────────

export interface EventSubItemInput {
  name: KickAuthorizedEventType | string
  version?: number
}

export interface CreateKickEventSubInput {
  events: EventSubItemInput[]
  method?: string
  broadcasterUserId?: string | number
}

export async function createKickEventSubscription(
  accessToken: string,
  input: CreateKickEventSubInput
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), KICK_FETCH_TIMEOUT_MS)

  const payloadBody: Record<string, unknown> = {
    events: input.events.map((e) => ({
      name: e.name,
      version: e.version ?? 1,
    })),
    method: input.method ?? 'webhook',
  }

  if (input.broadcasterUserId !== undefined) {
    payloadBody.broadcaster_user_id =
      typeof input.broadcasterUserId === 'number'
        ? input.broadcasterUserId
        : Number.parseInt(String(input.broadcasterUserId), 10) || input.broadcasterUserId
  }

  let response: Response
  try {
    response = await fetch('https://api.kick.com/public/v1/events/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payloadBody),
      signal: controller.signal,
    })
  } catch (err) {
    throw new KickWebhookError(
      'network_error',
      `Error de red creando suscripción EventSub en Kick: ${err instanceof Error ? err.message : String(err)}`
    )
  } finally {
    clearTimeout(timer)
  }

  const json: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const errorMsg =
      typeof json === 'object' && json !== null && 'message' in json
        ? String((json as { message: unknown }).message)
        : `HTTP ${response.status}`
    throw new KickWebhookError(
      'network_error',
      `Kick rechazó la creación de suscripción EventSub: ${errorMsg}`
    )
  }

  return json
}
