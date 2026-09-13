import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  authorizeKickPartner,
  updateKickPartnerFlags,
  revokeKickPartner,
  validateKickPartnerAuthority,
} from '../kick-partners'
import {
  authorizePartnerAction,
  updatePartnerFlagsAction,
  revokePartnerAction,
  getPartnersListAction,
} from '../../actions/kick-partners'
import { isSuperAdmin } from '../../actions/auth-helpers'
import { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'p1', user_id: 'u1', kick_user_id: 'k1' }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: { kick_user_id: 'k1' }, error: null }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'p1', user_id: 'u1', kick_user_id: 'k1' }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'p1', user_id: 'u1', kick_user_id: 'k1' }, error: null }),
          }),
        }),
      }),
    }),
  }),
}))

vi.mock('../../actions/auth-helpers', () => ({
  isSuperAdmin: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

interface TestPartnerPayload {
  integration_enabled?: boolean
  subscriber_tournaments_enabled?: boolean
  revoked_at?: string | null
  updated_at?: string
}

describe('Gate 4A: Kick Streamer Partners Service & Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('authorizeKickPartner throws an error if target user has no Kick connection', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'kick_connections') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    await expect(
      authorizeKickPartner(mockSupabase, 'user-without-kick')
    ).rejects.toThrow('El usuario no tiene una cuenta de Kick conectada en Kronix')
  })

  it('authorizeKickPartner inserts a new partner when valid Kick connection exists', async () => {
    const mockPartner = {
      id: 'partner-1',
      user_id: 'user-1',
      kick_user_id: 'kick-100',
      integration_enabled: true,
      subscriber_tournaments_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
      profiles: { username: 'streamer_one' },
      kick_connections: { kick_username: 'kick_one' },
    }

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'kick_connections') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { kick_user_id: 'kick-100', kick_username: 'kick_one' },
              error: null,
            }),
          }
        }
        if (table === 'kick_streamer_partners') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockPartner, error: null }),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    const result = await authorizeKickPartner(mockSupabase, 'user-1')

    expect(result.userId).toBe('user-1')
    expect(result.kickUserId).toBe('kick-100')
    expect(result.integrationEnabled).toBe(true)
    expect(result.subscriberTournamentsEnabled).toBe(true)
    expect(result.revokedAt).toBeNull()
  })

  it('authorizeKickPartner reactivates an existing revoked partner', async () => {
    const existingRevoked = {
      id: 'partner-revoked',
      user_id: 'user-1',
      kick_user_id: 'kick-100',
      revoked_at: '2026-01-01T00:00:00Z',
    }

    const updatedPartner = {
      ...existingRevoked,
      integration_enabled: true,
      subscriber_tournaments_enabled: true,
      revoked_at: null,
      profiles: { username: 'streamer_one' },
      kick_connections: { kick_username: 'kick_one' },
    }

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'kick_connections') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { kick_user_id: 'kick-100', kick_username: 'kick_one' },
              error: null,
            }),
          }
        }
        if (table === 'kick_streamer_partners') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: existingRevoked, error: null }),
            update: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: updatedPartner, error: null }),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    const result = await authorizeKickPartner(mockSupabase, 'user-1')
    expect(result.revokedAt).toBeNull()
    expect(result.integrationEnabled).toBe(true)
  })

  it('updateKickPartnerFlags forces subscriberTournamentsEnabled=false if integrationEnabled is set to false', async () => {
    const currentPartner = {
      id: 'partner-1',
      user_id: 'user-1',
      kick_user_id: 'kick-100',
      integration_enabled: true,
      subscriber_tournaments_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      revoked_at: null,
    }

    const capturedPayloads: TestPartnerPayload[] = []

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'kick_streamer_partners') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: currentPartner, error: null }),
            update: vi.fn().mockImplementation((payload: TestPartnerPayload) => {
              capturedPayloads.push(payload)
              return {
                eq: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: { ...currentPartner, ...payload },
                  error: null,
                }),
              }
            }),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    await updateKickPartnerFlags(mockSupabase, 'partner-1', {
      integrationEnabled: false,
      subscriberTournamentsEnabled: true,
    })

    expect(capturedPayloads.length).toBeGreaterThan(0)
    expect(capturedPayloads[0]?.integration_enabled).toBe(false)
    expect(capturedPayloads[0]?.subscriber_tournaments_enabled).toBe(false)
  })

  it('revokeKickPartner sets revoked_at timestamp and disables flags', async () => {
    const capturedPayloads: TestPartnerPayload[] = []

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'kick_streamer_partners') {
          return {
            update: vi.fn().mockImplementation((payload: TestPartnerPayload) => {
              capturedPayloads.push(payload)
              return {
                eq: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: { id: 'partner-1', user_id: 'u1', kick_user_id: 'k1', ...payload },
                  error: null,
                }),
              }
            }),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    const result = await revokeKickPartner(mockSupabase, 'partner-1')
    expect(result.revokedAt).not.toBeNull()
    expect(capturedPayloads.length).toBeGreaterThan(0)
    expect(capturedPayloads[0]?.integration_enabled).toBe(false)
    expect(capturedPayloads[0]?.subscriber_tournaments_enabled).toBe(false)
  })

  it('validateKickPartnerAuthority approves null or empty broadcaster ID', async () => {
    const mockSupabase = {} as unknown as SupabaseClient
    const res1 = await validateKickPartnerAuthority(mockSupabase, null)
    expect(res1.valid).toBe(true)

    const res2 = await validateKickPartnerAuthority(mockSupabase, '  ')
    expect(res2.valid).toBe(true)
  })

  it('validateKickPartnerAuthority approves active partner with sub tournaments enabled', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'kick_streamer_partners') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'partner-1',
                integration_enabled: true,
                subscriber_tournaments_enabled: true,
                revoked_at: null,
              },
              error: null,
            }),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    const res = await validateKickPartnerAuthority(mockSupabase, 'kick-authorized-100')
    expect(res.valid).toBe(true)
    expect(res.error).toBeNull()
  })

  it('validateKickPartnerAuthority rejects arbitrary or non-partner kick_user_id', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'kick_streamer_partners') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    const res = await validateKickPartnerAuthority(mockSupabase, 'arbitrary-kick-id-999')
    expect(res.valid).toBe(false)
    expect(res.error).toContain('no es un Kick Streamer Partner activo')
  })

  it('Server Actions authority check: ADMIN role is REJECTED while SUPER_ADMIN is PERMITTED', async () => {
    // 1. Test ADMIN role -> REJECTED
    vi.mocked(isSuperAdmin).mockResolvedValue(false)

    const authRes = await authorizePartnerAction('user-1')
    expect(authRes.error).toContain('No autorizado. Se requieren permisos de Super Admin')

    const flagsRes = await updatePartnerFlagsAction('p1', true, true)
    expect(flagsRes.error).toContain('No autorizado. Se requieren permisos de Super Admin')

    const revokeRes = await revokePartnerAction('p1')
    expect(revokeRes.error).toContain('No autorizado. Se requieren permisos de Super Admin')

    const listRes = await getPartnersListAction()
    expect(listRes.error).toContain('No autorizado. Se requieren permisos de Super Admin')

    // 2. Test SUPER_ADMIN role -> PERMITTED
    vi.mocked(isSuperAdmin).mockResolvedValue(true)

    const authSuccess = await authorizePartnerAction('user-1')
    expect(authSuccess.error).toBeUndefined()
    expect(authSuccess.success).toBe(true)
  })
})
