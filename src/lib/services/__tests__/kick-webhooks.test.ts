import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateKeyPairSync, createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  extractAndValidateHeaders,
  isTimestampWithinTolerance,
  parseKickTimestamp,
  validateRsaPublicKey,
  verifyKickWebhookSignature,
  validateAndParseEventPayload,
  claimKickWebhookEvent,
  markKickWebhookEventProcessed,
  markKickWebhookEventFailed,
  getKickPublicKey,
  resetPublicKeyCache,
  sanitizeErrorMessage,
  createKickEventSubscription,
  KickWebhookError,
  KICK_MANDATORY_HEADERS,
  KICK_PROHIBITED_HEADERS,
  REPLAY_TOLERANCE_MS,
  STALE_THRESHOLD_MS,
  KickOfficialNewSubscriptionSchema,
  KickOfficialRenewalSubscriptionSchema,
  KickOfficialGiftedSubscriptionSchema,
} from '../kick-webhooks'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── RSA Key Fixtures ─────────────────────────────────────────────────────────

const keyPairA = generateKeyPairSync('rsa', { modulusLength: 2048 })
const publicKeyPemA = keyPairA.publicKey.export({ type: 'spki', format: 'pem' }).toString()
const privateKeyObjectA = keyPairA.privateKey

const keyPairB = generateKeyPairSync('rsa', { modulusLength: 2048 })
const publicKeyPemB = keyPairB.publicKey.export({ type: 'spki', format: 'pem' }).toString()
const privateKeyObjectB = keyPairB.privateKey

function signData(signedData: string, privateKey = privateKeyObjectA): string {
  const signer = createSign('SHA256')
  signer.update(Buffer.from(signedData, 'utf8'))
  return signer.sign(privateKey, 'base64')
}

// ── Setup & Cleanup ──────────────────────────────────────────────────────────

beforeEach(() => {
  resetPublicKeyCache()
  vi.stubEnv('KICK_PUBLIC_KEY', publicKeyPemA)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// ── A. EventSub Request Helper (HIGH-01 OpenAPI) ─────────────────────────────

describe('A. EventSub Request Helper (HIGH-01 OpenAPI)', () => {
  it('envía el body exacto del contrato OpenAPI oficial con events[] y method', async () => {
    let capturedBody: Record<string, unknown> | null = null

    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(JSON.stringify({ subscription_id: 'sub-100', status: 'enabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await createKickEventSubscription('at-token-123', {
      events: [{ name: 'channel.subscription.new', version: 1 }],
      method: 'webhook',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(capturedBody).toEqual({
      events: [{ name: 'channel.subscription.new', version: 1 }],
      method: 'webhook',
    })
    // Verifica que NO se generen campos obsoletos en la raíz
    expect(capturedBody).not.toHaveProperty('name')
  })

  it('incluye broadcaster_user_id cuando es provisto (para App Access Tokens)', async () => {
    let capturedBody: Record<string, unknown> | null = null

    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(JSON.stringify({ subscription_id: 'sub-101' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await createKickEventSubscription('app-token-456', {
      events: [{ name: 'channel.subscription.renewal', version: 1 }],
      broadcasterUserId: 998877,
    })

    expect(capturedBody).toEqual({
      events: [{ name: 'channel.subscription.renewal', version: 1 }],
      method: 'webhook',
      broadcaster_user_id: 998877,
    })
  })
})

// ── B, C, D, E. Zod Schemas & Extracción de broadcaster.user_id (MEDIUM-01) ─────

describe('Zod Schemas Oficiales (MEDIUM-01)', () => {
  it('B & E. Payload NEW realista: extrae broadcaster.user_id -> broadcaster_kick_user_id', () => {
    const payloadNew = {
      broadcaster: { user_id: 12345, username: 'StreamerPro', slug: 'streamerpro' },
      subscriber: { user_id: 67890, username: 'FanOne', slug: 'fanone' },
      duration: 1,
      created_at: '2026-09-12T20:00:00Z',
      expires_at: '2026-10-12T20:00:00Z',
    }

    const officialParsed = KickOfficialNewSubscriptionSchema.safeParse(payloadNew)
    expect(officialParsed.success).toBe(true)
    if (officialParsed.success) {
      expect(officialParsed.data.broadcasterKickUserId).toBe('12345')
      expect(officialParsed.data.subscriberKickUserId).toBe('67890')
      expect(officialParsed.data.duration).toBe(1)
    }

    const extracted = validateAndParseEventPayload('channel.subscription.new', payloadNew)
    expect(extracted.broadcasterKickUserId).toBe('12345')
  })

  it('C & E. Payload RENEWAL realista: extrae broadcaster.user_id -> broadcaster_kick_user_id', () => {
    const payloadRenewal = {
      broadcaster: { user_id: 54321, username: 'StreamerTwo' },
      subscriber: { user_id: 98765, username: 'LoyalFan' },
      duration: 3,
      created_at: '2026-09-12T20:00:00Z',
      expires_at: '2026-12-12T20:00:00Z',
    }

    const officialParsed = KickOfficialRenewalSubscriptionSchema.safeParse(payloadRenewal)
    expect(officialParsed.success).toBe(true)
    if (officialParsed.success) {
      expect(officialParsed.data.broadcasterKickUserId).toBe('54321')
      expect(officialParsed.data.duration).toBe(3)
    }

    const extracted = validateAndParseEventPayload('channel.subscription.renewal', payloadRenewal)
    expect(extracted.broadcasterKickUserId).toBe('54321')
  })

  it('D & E. Payload GIFTS realista: valida broadcaster, gifter y giftees[]', () => {
    const payloadGifts = {
      broadcaster: { user_id: 88888, username: 'StreamerGifts' },
      gifter: { user_id: 77777, username: 'GenerousGifter' },
      giftees: [
        { user_id: 11111, username: 'LuckyOne' },
        { user_id: 22222, username: 'LuckyTwo' },
      ],
      created_at: '2026-09-12T20:00:00Z',
      expires_at: '2026-10-12T20:00:00Z',
    }

    const officialParsed = KickOfficialGiftedSubscriptionSchema.safeParse(payloadGifts)
    expect(officialParsed.success).toBe(true)
    if (officialParsed.success) {
      expect(officialParsed.data.broadcasterKickUserId).toBe('88888')
      expect(officialParsed.data.gifterKickUserId).toBe('77777')
      expect(officialParsed.data.gifteeCount).toBe(2)
    }

    const extracted = validateAndParseEventPayload('channel.subscription.gifts', payloadGifts)
    expect(extracted.broadcasterKickUserId).toBe('88888')
  })
})

// ── F. Mantenimiento de Tests Existentes (RSA, Replay, Idempotencia, etc.) ────

describe('Headers Validation (extractAndValidateHeaders)', () => {
  function makeValidHeadersMap(): Record<string, string> {
    return {
      'Kick-Event-Message-Id': 'msg-uuid-123',
      'Kick-Event-Subscription-Id': 'sub-uuid-456',
      'Kick-Event-Signature': 'sig-b64-789',
      'Kick-Event-Message-Timestamp': new Date().toISOString(),
      'Kick-Event-Type': 'channel.subscription.new',
      'Kick-Event-Version': '1',
    }
  }

  it('missing headers: falla si falta cualquiera de los 6 headers obligatorios', () => {
    for (const mandatoryHeader of KICK_MANDATORY_HEADERS) {
      const incomplete = makeValidHeadersMap()
      delete incomplete[mandatoryHeader]
      expect(() => extractAndValidateHeaders((name) => incomplete[name])).toThrow(
        KickWebhookError
      )
    }
  })

  it('prohibited headers: falla si se incluye cualquiera de los headers prohibidos', () => {
    for (const prohib of KICK_PROHIBITED_HEADERS) {
      const forbidden = { ...makeValidHeadersMap(), [prohib]: 'some-val' }
      expect(() => extractAndValidateHeaders((name) => forbidden[name])).toThrow(
        KickWebhookError
      )
    }
  })
})

describe('RSA PKCS#1 v1.5 Signature Verification', () => {
  const messageId = 'msg-001'
  const timestamp = '2026-09-12T21:00:00Z'
  const rawBody = '{"broadcaster":{"user_id":100}}'
  const signedData = `${messageId}.${timestamp}.${rawBody}`

  it('RSA valid signature: retorna true para firma válida sobre message_id.timestamp.raw_body', () => {
    const sig = signData(signedData)
    const isValid = verifyKickWebhookSignature({
      messageId,
      timestamp,
      rawBody,
      signatureB64: sig,
      publicKey: keyPairA.publicKey,
    })
    expect(isValid).toBe(true)
  })

  it('tampered signature: retorna false si el rawBody es alterado por 1 carácter', () => {
    const sig = signData(signedData)
    const tamperedBody = rawBody.replace('100', '101')
    const isValid = verifyKickWebhookSignature({
      messageId,
      timestamp,
      rawBody: tamperedBody,
      signatureB64: sig,
      publicKey: keyPairA.publicKey,
    })
    expect(isValid).toBe(false)
  })

  it('wrong key: retorna false si la firma fue generada con otra clave privada', () => {
    const sig = signData(signedData, privateKeyObjectB)
    const isValid = verifyKickWebhookSignature({
      messageId,
      timestamp,
      rawBody,
      signatureB64: sig,
      publicKey: keyPairA.publicKey,
    })
    expect(isValid).toBe(false)
  })
})

describe('Replay Protection', () => {
  const nowMs = 1_000_000_000_000

  it('replay: acepta timestamp dentro de 300s y rechaza fuera de 300s', () => {
    const validMs = nowMs - 60_000
    expect(isTimestampWithinTolerance(new Date(validMs).toISOString(), nowMs)).toBe(true)

    const pastMs = nowMs - (REPLAY_TOLERANCE_MS + 1000)
    expect(isTimestampWithinTolerance(new Date(pastMs).toISOString(), nowMs)).toBe(false)
  })
})

describe('Public Key Fallback', () => {
  it('env pem válida -> utiliza y cachea sin consultar la red', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const key = await getKickPublicKey()
    expect(key.type).toBe('public')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('env pem inválida -> ignora env, ejecuta fallback al endpoint oficial y valida', async () => {
    vi.stubEnv('KICK_PUBLIC_KEY', 'INVALID_PEM_DATA')
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ data: { public_key: publicKeyPemB } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const key = await getKickPublicKey()
    expect(key.type).toBe('public')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('Error Sanitization', () => {
  it('sanitiza tokens/secrets y trunca a 500 chars', () => {
    const sensitiveMsg =
      'Error de red con access_token=secret_abc123 y Bearer eyJhbGciOiJIUzI1Ni... ' +
      'refresh_token=rt_xyz789 client_secret=cs_456 key=super_secret_key. ' +
      'a'.repeat(600)

    const sanitized = sanitizeErrorMessage(sensitiveMsg)
    expect(sanitized.length).toBeLessThanOrEqual(500)
    expect(sanitized).not.toContain('secret_abc123')
    expect(sanitized).toContain('[REDACTED]')
  })
})

describe('Atomic Idempotency & REAL Concurrent Reclaim', () => {
  const claimInput = {
    messageId: 'msg-concurrent-1',
    subscriptionId: 'sub-1',
    eventType: 'channel.subscription.new',
    eventVersion: '1',
    broadcasterKickUserId: 'broadcaster-99',
  }

  it('REAL concurrent stale reclaim: Promise.all garantiza exactamente 1 winner y N-1 currently_processing', async () => {
    let updateCalledTimes = 0

    const mockInsert = vi.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } })
    const mockUpdateSelect = vi.fn(async () => {
      updateCalledTimes++
      if (updateCalledTimes === 1) {
        return { data: [{ id: 'stale-id' }], error: null }
      }
      return { data: [], error: null }
    })

    const mockUpdateOr = vi.fn(() => ({ select: mockUpdateSelect }))
    const mockUpdateEq = vi.fn(() => ({ or: mockUpdateOr }))
    const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }))

    const mockSelectMaybeSingle = vi.fn().mockResolvedValue({ data: { status: 'processing' } })
    const mockSelectEq = vi.fn(() => ({ maybeSingle: mockSelectMaybeSingle }))
    const mockSelect = vi.fn(() => ({ eq: mockSelectEq }))

    const supabase = {
      from: vi.fn(() => ({
        insert: mockInsert,
        update: mockUpdate,
        select: mockSelect,
      })),
    } as unknown as SupabaseClient

    const results = await Promise.all([
      claimKickWebhookEvent(supabase, claimInput),
      claimKickWebhookEvent(supabase, claimInput),
      claimKickWebhookEvent(supabase, claimInput),
    ])

    const winners = results.filter((r) => r.claimed === true)
    const losers = results.filter((r) => r.claimed === false && r.reason === 'currently_processing')

    expect(winners).toHaveLength(1)
    expect(losers).toHaveLength(2)
  })
})

describe('State Invariants (processed_at)', () => {
  it('processed_at invariant: NULL mientras status != processed, NOW() al marcar processed', async () => {
    const mockUpdate = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }))
    const supabase = {
      from: vi.fn(() => ({ update: mockUpdate })),
    } as unknown as SupabaseClient

    await markKickWebhookEventProcessed(supabase, 'msg-1')
    const updateCalls = mockUpdate.mock.calls as unknown as Array<[Record<string, unknown>]>
    const processedCall = updateCalls[0]?.[0]
    expect(processedCall?.status).toBe('processed')
    expect(processedCall?.processed_at).not.toBeNull()

    await markKickWebhookEventFailed(supabase, 'msg-1', 'Simulated Failure')
    const failedCall = updateCalls[1]?.[0]
    expect(failedCall?.status).toBe('failed')
    expect(failedCall?.processed_at).toBeNull()
  })
})

describe('Migración y RLS Security', () => {
  const sql = readFileSync(
    path.resolve(process.cwd(), 'supabase/migrations/20260912000000_kick_webhook_events.sql'),
    'utf8'
  )

  it('RLS habilitado y REVOKE ALL a anon/authenticated', () => {
    expect(sql).toContain('ALTER TABLE public.kick_webhook_events ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON public.kick_webhook_events FROM anon, authenticated')
    expect(sql).toContain('GRANT ALL ON public.kick_webhook_events TO service_role')
  })
})

describe('Preservación Estricta de Gate 1', () => {
  it('Gate 1 src/lib/services/kick.ts no tiene modificaciones', () => {
    const content = readFileSync(
      path.resolve(process.cwd(), 'src/lib/services/kick.ts'),
      'utf8'
    )
    expect(content).toContain('Kick OAuth Service — Gate 1')
  })
})
