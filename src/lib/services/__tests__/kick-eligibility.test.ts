import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  checkKickTournamentEligibility,
  updateKickSubscriberProjection,
  type KickSubscriberRow,
} from '../kick-eligibility'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('Gate 3: Kick Subscriber Benefits & Tournament Eligibility', () => {
  const userId = 'user-uuid-123'
  const kickUserId = 'kick-user-777'
  const broadcasterKickUserId = 'broadcaster-999'

  function createMockSupabase(params: {
    connection?: { kick_user_id: string } | null
    subRecord?: Partial<KickSubscriberRow> | null
    upsertError?: { message: string } | null
  }) {
    const { connection, subRecord, upsertError = null } = params
    let storedSub: Partial<KickSubscriberRow> | null = subRecord ?? null

    const mockSelectConnection = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: connection !== undefined ? connection : { kick_user_id: kickUserId },
          error: null,
        }),
      }),
    })

    const mockSelectSub = vi.fn().mockReturnValue({
      eq: vi.fn().mockImplementation((_field, val) => ({
        eq: vi.fn().mockImplementation((_field2, val2) => ({
          maybeSingle: vi.fn().mockImplementation(async () => {
            if (!storedSub) return { data: null, error: null }
            if (
              storedSub.broadcaster_kick_user_id &&
              storedSub.broadcaster_kick_user_id !== val
            ) {
              return { data: null, error: null }
            }
            if (
              storedSub.subscriber_kick_user_id &&
              storedSub.subscriber_kick_user_id !== val2
            ) {
              return { data: null, error: null }
            }
            return { data: storedSub, error: null }
          }),
        })),
        maybeSingle: vi.fn().mockResolvedValue({ data: storedSub, error: null }),
      })),
    })

    const mockUpsert = vi.fn().mockImplementation(async (row) => {
      if (upsertError) return { error: upsertError }
      storedSub = { ...storedSub, ...row }
      return { error: null }
    })

    const mockUpdate = vi.fn().mockImplementation((updates) => ({
      eq: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockImplementation(async () => {
          if (storedSub) {
            storedSub = { ...storedSub, ...updates }
          }
          return { error: null }
        }),
      })),
    }))

    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'kick_connections') {
          return { select: mockSelectConnection }
        }
        if (table === 'kick_subscribers') {
          return {
            select: mockSelectSub,
            upsert: mockUpsert,
            update: mockUpdate,
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    return { supabase, getStoredSub: () => storedSub, mockUpsert }
  }

  // ── T3-01: Direct activa -> ELIGIBLE ───────────────────────────────────────
  it('T3-01: Direct activa (expires_at en futuro) -> ELIGIBLE', async () => {
    const futureExpires = new Date(Date.now() + 86400 * 1000).toISOString()
    const { supabase } = createMockSupabase({
      subRecord: {
        broadcaster_kick_user_id: broadcasterKickUserId,
        subscriber_kick_user_id: kickUserId,
        subscription_type: 'direct',
        is_active: true,
        expires_at: futureExpires,
        last_event_timestamp: new Date().toISOString(),
      },
    })

    const result = await checkKickTournamentEligibility(supabase, {
      userId,
      broadcasterKickUserId,
    })

    expect(result.eligible).toBe(true)
    expect(result.reason).toBe('eligible')
    expect(result.subscriptionType).toBe('direct')
  })

  // ── T3-02: Gifted -> DENY ──────────────────────────────────────────────────
  it('T3-02: Gifted activa (expires_at en futuro) -> DENY (gifted_subscription_ineligible)', async () => {
    const futureExpires = new Date(Date.now() + 86400 * 1000).toISOString()
    const { supabase } = createMockSupabase({
      subRecord: {
        broadcaster_kick_user_id: broadcasterKickUserId,
        subscriber_kick_user_id: kickUserId,
        subscription_type: 'gifted',
        is_active: true,
        expires_at: futureExpires,
        last_event_timestamp: new Date().toISOString(),
      },
    })

    const result = await checkKickTournamentEligibility(supabase, {
      userId,
      broadcasterKickUserId,
    })

    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('gifted_subscription_ineligible')
    expect(result.subscriptionType).toBe('gifted')
  })

  // ── T3-03: Expirada -> DENY ─────────────────────────────────────────────────
  it('T3-03: Direct expirada (expires_at <= NOW) -> DENY (subscription_expired)', async () => {
    const pastExpires = new Date(Date.now() - 3600 * 1000).toISOString()
    const { supabase } = createMockSupabase({
      subRecord: {
        broadcaster_kick_user_id: broadcasterKickUserId,
        subscriber_kick_user_id: kickUserId,
        subscription_type: 'direct',
        is_active: true, // is_active es true pero expires_at venció
        expires_at: pastExpires,
        last_event_timestamp: new Date().toISOString(),
      },
    })

    const result = await checkKickTournamentEligibility(supabase, {
      userId,
      broadcasterKickUserId,
    })

    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('subscription_expired')
  })

  // ── T3-04: Transición A (Direct activa + Gifted nuevo -> permanece Direct activa) ──
  it('T3-04: Transición A (Direct activa + Gifted nuevo -> permanece Direct activa / ELIGIBLE)', async () => {
    const futureExpires = new Date(Date.now() + 86400 * 1000).toISOString()
    const t1 = '2026-09-12T10:00:00.000Z'
    const t2 = '2026-09-12T11:00:00.000Z'

    const { supabase, getStoredSub } = createMockSupabase({
      subRecord: {
        broadcaster_kick_user_id: broadcasterKickUserId,
        subscriber_kick_user_id: kickUserId,
        subscription_type: 'direct',
        is_active: true,
        expires_at: futureExpires,
        last_event_timestamp: t1,
      },
    })

    const giftPayload = {
      broadcaster: { user_id: broadcasterKickUserId },
      gifter: { user_id: 'gifter-555' },
      giftees: [{ user_id: kickUserId }],
      expires_at: futureExpires,
    }

    const res = await updateKickSubscriberProjection(supabase, {
      eventType: 'channel.subscription.gifts',
      rawPayload: giftPayload,
      eventTimestampIso: t2,
    })

    expect(res.updated).toBe(true)
    const current = getStoredSub()
    expect(current?.subscription_type).toBe('direct')
    expect(current?.last_event_timestamp).toBe(t2)
  })

  // ── T3-05: Transición B (Direct expirada + Gifted nuevo -> pasa a Gifted / DENY) ──
  it('T3-05: Transición B (Direct expirada + Gifted nuevo -> pasa a Gifted / DENY)', async () => {
    const pastExpires = new Date(Date.now() - 3600 * 1000).toISOString()
    const futureExpires = new Date(Date.now() + 86400 * 1000).toISOString()
    const t1 = '2026-09-12T10:00:00.000Z'
    const t2 = '2026-09-12T11:00:00.000Z'

    const { supabase, getStoredSub } = createMockSupabase({
      subRecord: {
        broadcaster_kick_user_id: broadcasterKickUserId,
        subscriber_kick_user_id: kickUserId,
        subscription_type: 'direct',
        is_active: false,
        expires_at: pastExpires,
        last_event_timestamp: t1,
      },
    })

    const giftPayload = {
      broadcaster: { user_id: broadcasterKickUserId },
      gifter: { user_id: 'gifter-555' },
      giftees: [{ user_id: kickUserId }],
      expires_at: futureExpires,
    }

    const res = await updateKickSubscriberProjection(supabase, {
      eventType: 'channel.subscription.gifts',
      rawPayload: giftPayload,
      eventTimestampIso: t2,
    })

    expect(res.updated).toBe(true)
    const current = getStoredSub()
    expect(current?.subscription_type).toBe('gifted')
    expect(current?.last_event_timestamp).toBe(t2)
  })

  // ── T3-06: Transición C (Direct expirada + Renovación -> pasa a Direct activa / ELIGIBLE) ──
  it('T3-06: Transición C (Direct expirada + Renovación -> pasa a Direct activa / ELIGIBLE)', async () => {
    const pastExpires = new Date(Date.now() - 3600 * 1000).toISOString()
    const futureExpires = new Date(Date.now() + 86400 * 1000).toISOString()
    const t1 = '2026-09-12T10:00:00.000Z'
    const t2 = '2026-09-12T11:00:00.000Z'

    const { supabase, getStoredSub } = createMockSupabase({
      subRecord: {
        broadcaster_kick_user_id: broadcasterKickUserId,
        subscriber_kick_user_id: kickUserId,
        subscription_type: 'direct',
        is_active: false,
        expires_at: pastExpires,
        last_event_timestamp: t1,
      },
    })

    const renewalPayload = {
      broadcaster: { user_id: broadcasterKickUserId },
      subscriber: { user_id: kickUserId },
      duration: 1,
      created_at: t2,
      expires_at: futureExpires,
    }

    const res = await updateKickSubscriberProjection(supabase, {
      eventType: 'channel.subscription.renewal',
      rawPayload: renewalPayload,
      eventTimestampIso: t2,
    })

    expect(res.updated).toBe(true)
    const current = getStoredSub()
    expect(current?.subscription_type).toBe('direct')
    expect(current?.is_active).toBe(true)
    expect(current?.last_event_timestamp).toBe(t2)
  })

  // ── T3-07: Transición D (Gifted activa + Direct nueva -> actualiza a Direct activa / ELIGIBLE) ──
  it('T3-07: Transición D (Gifted activa + Direct nueva -> actualiza a Direct activa / ELIGIBLE)', async () => {
    const futureExpires = new Date(Date.now() + 86400 * 1000).toISOString()
    const t1 = '2026-09-12T10:00:00.000Z'
    const t2 = '2026-09-12T11:00:00.000Z'

    const { supabase, getStoredSub } = createMockSupabase({
      subRecord: {
        broadcaster_kick_user_id: broadcasterKickUserId,
        subscriber_kick_user_id: kickUserId,
        subscription_type: 'gifted',
        is_active: true,
        expires_at: futureExpires,
        last_event_timestamp: t1,
      },
    })

    const newPayload = {
      broadcaster: { user_id: broadcasterKickUserId },
      subscriber: { user_id: kickUserId },
      duration: 1,
      created_at: t2,
      expires_at: futureExpires,
    }

    const res = await updateKickSubscriberProjection(supabase, {
      eventType: 'channel.subscription.new',
      rawPayload: newPayload,
      eventTimestampIso: t2,
    })

    expect(res.updated).toBe(true)
    const current = getStoredSub()
    expect(current?.subscription_type).toBe('direct')
    expect(current?.is_active).toBe(true)
    expect(current?.last_event_timestamp).toBe(t2)
  })

  // ── T3-08: Aislamiento por Broadcaster ─────────────────────────────────────
  it('T3-08: Aislamiento por Broadcaster (sub en Broadcaster A -> NO ELEGIBLE en Broadcaster B)', async () => {
    const futureExpires = new Date(Date.now() + 86400 * 1000).toISOString()
    const { supabase } = createMockSupabase({
      subRecord: {
        broadcaster_kick_user_id: 'broadcaster-A',
        subscriber_kick_user_id: kickUserId,
        subscription_type: 'direct',
        is_active: true,
        expires_at: futureExpires,
        last_event_timestamp: new Date().toISOString(),
      },
    })

    // Consultar para Broadcaster B
    const result = await checkKickTournamentEligibility(supabase, {
      userId,
      broadcasterKickUserId: 'broadcaster-B',
    })

    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('no_subscription_found')
  })

  // ── T3-09: Authenticated INSERT rechazado por RLS (verificación de SQL) ──────
  it('T3-09: Authenticated INSERT rechazado por SQL RLS policy', () => {
    const sql = readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/20260913000000_kick_subscribers.sql'),
      'utf8'
    )
    expect(sql).toContain('ALTER TABLE public.kick_subscribers ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON public.kick_subscribers FROM anon, authenticated')
    expect(sql).toContain('GRANT SELECT ON public.kick_subscribers TO authenticated')
    expect(sql).toContain('GRANT ALL ON public.kick_subscribers TO service_role')
    expect(sql).not.toContain('GRANT INSERT ON public.kick_subscribers TO authenticated')
  })

  // ── T3-10: Webhook antiguo después de renovación -> no degrada (Out-of-Order Renewal) ──
  it('T3-10: Out-of-Order Renewal (T2 procesado, llega T1 antiguo donde T1 < T2) -> Se omite mutación', async () => {
    const futureExpires = new Date(Date.now() + 86400 * 1000).toISOString()
    const t1 = '2026-09-12T10:00:00.000Z' // antiguo
    const t2 = '2026-09-12T12:00:00.000Z' // reciente

    const { supabase, getStoredSub } = createMockSupabase({
      subRecord: {
        broadcaster_kick_user_id: broadcasterKickUserId,
        subscriber_kick_user_id: kickUserId,
        subscription_type: 'direct',
        is_active: true,
        expires_at: futureExpires,
        last_event_timestamp: t2,
      },
    })

    const staleRenewalPayload = {
      broadcaster: { user_id: broadcasterKickUserId },
      subscriber: { user_id: kickUserId },
      duration: 1,
      created_at: t1,
      expires_at: futureExpires,
    }

    const res = await updateKickSubscriberProjection(supabase, {
      eventType: 'channel.subscription.renewal',
      rawPayload: staleRenewalPayload,
      eventTimestampIso: t1, // T1 es menor a T2
    })

    expect(res.updated).toBe(false)
    expect(res.reason).toBe('stale_event')
    const current = getStoredSub()
    expect(current?.last_event_timestamp).toBe(t2)
  })

  // ── T3-11: Gifted antiguo después de renovación -> Direct permanece (Out-of-Order Gifted) ──
  it('T3-11: Out-of-Order Gifted (Direct activa en T2, llega Gifted T1 donde T1 < T2) -> Direct permanece', async () => {
    const futureExpires = new Date(Date.now() + 86400 * 1000).toISOString()
    const t1 = '2026-09-12T10:00:00.000Z' // antiguo
    const t2 = '2026-09-12T12:00:00.000Z' // reciente

    const { supabase, getStoredSub } = createMockSupabase({
      subRecord: {
        broadcaster_kick_user_id: broadcasterKickUserId,
        subscriber_kick_user_id: kickUserId,
        subscription_type: 'direct',
        is_active: true,
        expires_at: futureExpires,
        last_event_timestamp: t2,
      },
    })

    const staleGiftPayload = {
      broadcaster: { user_id: broadcasterKickUserId },
      gifter: { user_id: 'gifter-888' },
      giftees: [{ user_id: kickUserId }],
      expires_at: futureExpires,
    }

    const res = await updateKickSubscriberProjection(supabase, {
      eventType: 'channel.subscription.gifts',
      rawPayload: staleGiftPayload,
      eventTimestampIso: t1,
    })

    expect(res.updated).toBe(false)
    expect(res.reason).toBe('stale_event')
    const current = getStoredSub()
    expect(current?.subscription_type).toBe('direct')
    expect(current?.last_event_timestamp).toBe(t2)
  })

  // ── T3-12: Direct antiguo después de estado más reciente -> no degrada ───────
  it('T3-12: Out-of-Order Direct New (Estado T2 procesado, llega Direct New T1 donde T1 < T2) -> Se omite mutación', async () => {
    const futureExpires = new Date(Date.now() + 86400 * 1000).toISOString()
    const t1 = '2026-09-12T08:00:00.000Z' // antiguo
    const t2 = '2026-09-12T14:00:00.000Z' // reciente

    const { supabase, getStoredSub } = createMockSupabase({
      subRecord: {
        broadcaster_kick_user_id: broadcasterKickUserId,
        subscriber_kick_user_id: kickUserId,
        subscription_type: 'direct',
        is_active: true,
        expires_at: futureExpires,
        last_event_timestamp: t2,
      },
    })

    const staleNewPayload = {
      broadcaster: { user_id: broadcasterKickUserId },
      subscriber: { user_id: kickUserId },
      duration: 1,
      created_at: t1,
      expires_at: futureExpires,
    }

    const res = await updateKickSubscriberProjection(supabase, {
      eventType: 'channel.subscription.new',
      rawPayload: staleNewPayload,
      eventTimestampIso: t1,
    })

    expect(res.updated).toBe(false)
    expect(res.reason).toBe('stale_event')
    const current = getStoredSub()
    expect(current?.last_event_timestamp).toBe(t2)
  })
})
