import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkKickTournamentEligibility } from '../kick-eligibility'
import {
  createTournament,
  updateTournament,
  validateKickBroadcasterAuthority,
} from '../../actions/tournaments'
import { registerTournament } from '../../actions/registration'
import type { CreateTournamentInput } from '@/lib/validations/schemas'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock next/cache revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const CREATOR_ID = '11111111-1111-4111-a111-111111111111'
const ADMIN_ID = '22222222-2222-4222-a222-222222222222'
const NO_KICK_USER_ID = '33333333-3333-4333-a333-333333333333'
const COLLAB_ID = '44444444-4444-4444-a444-444444444444'

// Estado dinámico del mock para controlar las pruebas
let mockCurrentUser: { id: string } | null = { id: CREATOR_ID }
let mockUserProfile: { id: string; role: string; subscription_status: string } | null = {
  id: CREATOR_ID,
  role: 'STREAMER',
  subscription_status: 'ACTIVE',
}

let mockKickConnections: Record<string, { kick_user_id: string } | null> = {
  [CREATOR_ID]: { kick_user_id: 'kick-creator-100' },
  [ADMIN_ID]: { kick_user_id: 'kick-admin-200' },
  [COLLAB_ID]: { kick_user_id: 'kick-collab-456' },
  [NO_KICK_USER_ID]: null,
}

let mockTournamentInDb: any = {
  id: 'tourney-1',
  name: 'Torneo Existente',
  slug: 'torneo-existente',
  status: 'draft',
  creator_id: CREATOR_ID,
  collaborator_id: COLLAB_ID,
  kick_broadcaster_id: null,
  is_private: false,
  registration_password: null,
  max_teams: 10,
  registration_start_date: null,
  registration_end_date: null,
  created_at: new Date().toISOString(),
  entry_fee: 0,
  discipline: 'warzone',
}

let mockSubscriberInDb: any = null

const teamInsertSpy = vi.fn().mockImplementation(() => ({
  select: vi.fn().mockImplementation(() => ({
    single: vi.fn().mockResolvedValue({
      data: { id: 'team-uuid-1', registration_status: 'confirmed' },
      error: null,
    }),
  })),
}))

const participantInsertSpy = vi.fn().mockResolvedValue({ data: [], error: null })

function buildMockSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn().mockImplementation(async () => ({
        data: { user: mockCurrentUser },
        error: mockCurrentUser ? null : { message: 'No auth user' },
      })),
      admin: {
        getUserById: vi.fn().mockImplementation(async (id: string) => ({
          data: { user: { id, user_metadata: {} } },
          error: null,
        })),
      },
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col, id) => ({
              single: vi.fn().mockImplementation(async () => {
                const profile = mockUserProfile?.id === id
                  ? mockUserProfile
                  : { id, role: 'STREAMER', subscription_status: 'ACTIVE' }
                return { data: profile, error: null }
              }),
              maybeSingle: vi.fn().mockImplementation(async () => {
                const profile = mockUserProfile?.id === id
                  ? mockUserProfile
                  : { id, role: 'STREAMER', subscription_status: 'ACTIVE' }
                return { data: profile, error: null }
              }),
            })),
          }),
        }
      }

      if (table === 'kick_connections') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col, id) => ({
              maybeSingle: vi.fn().mockImplementation(async () => {
                const conn = mockKickConnections[id] ?? null
                return { data: conn, error: null }
              }),
            })),
          }),
        }
      }

      if (table === 'kick_subscribers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col1, bId) => ({
              eq: vi.fn().mockImplementation((_col2, sId) => ({
                maybeSingle: vi.fn().mockImplementation(async () => {
                  if (
                    mockSubscriberInDb &&
                    mockSubscriberInDb.broadcaster_kick_user_id === bId &&
                    mockSubscriberInDb.subscriber_kick_user_id === sId
                  ) {
                    return { data: mockSubscriberInDb, error: null }
                  }
                  return { data: null, error: null }
                }),
              })),
            })),
          }),
        }
      }

      if (table === 'tournaments') {
        return {
          select: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation((_col, _val) => ({
              maybeSingle: vi.fn().mockImplementation(async () => {
                if (_col === 'slug') return { data: null, error: null }
                return { data: mockTournamentInDb, error: null }
              }),
              single: vi.fn().mockImplementation(async () => {
                return { data: mockTournamentInDb, error: null }
              }),
            })),
          })),
          insert: vi.fn().mockImplementation((payload) => ({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'new-tourney-1',
                  ...payload,
                  created_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          })),
          update: vi.fn().mockImplementation((payload) => ({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    ...mockTournamentInDb,
                    ...payload,
                  },
                  error: null,
                }),
              }),
            }),
          })),
        }
      }

      if (table === 'matches') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'match-1', tournament_id: 'new-tourney-1' }],
              error: null,
            }),
          }),
          insert: vi.fn().mockImplementation((payload) => ({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'match-1',
                  ...payload,
                },
                error: null,
              }),
            }),
          })),
        }
      }

      if (table === 'scoring_rules') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }

      if (table === 'teams') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              head: true,
              count: 0,
            }),
          }),
          insert: teamInsertSpy,
        }
      }

      if (table === 'participants') {
        return {
          insert: participantInsertSpy,
        }
      }

      if (table === 'creator_bans') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }
      }

      return {}
    }),
  } as unknown as SupabaseClient
}

// Mock @/lib/supabase/server
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => buildMockSupabaseClient()),
  createAdminClient: vi.fn().mockImplementation(async () => buildMockSupabaseClient()),
}))

// Helper de datos base para crear torneo
function getBaseTournamentInput(overrides: Partial<CreateTournamentInput> = {}): CreateTournamentInput {
  return {
    name: 'Torneo Test Kick Private',
    description: 'Descripción de prueba',
    mode: 'duos',
    format: 'battle_royale_clasico',
    level: 'casual',
    totalMatches: 3,
    killRateEnabled: true,
    potTopEnabled: true,
    vipEnabled: false,
    tiebreakerMatchEnabled: false,
    defaultRoundsPerMatch: 1,
    entryFee: 0,
    prize1st: 0,
    prize2nd: 0,
    prize3rd: 0,
    prizeMvp: 0,
    organizerSplit: 0,
    streamerSplit: 100,
    arenaBettingEnabled: false,
    discordIntegrationEnabled: false,
    scoringRule: {
      killPoints: 1,
      placementPoints: { '1': 15, '2': 12, '3': 10 },
      useMultiplier: false,
    },
    discipline: 'warzone',
    ...overrides,
  }
}

describe('FEATURE CONTRACT — Kick Private Tournaments v1.0 (Remediated Final)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentUser = { id: CREATOR_ID }
    mockUserProfile = { id: CREATOR_ID, role: 'STREAMER', subscription_status: 'ACTIVE' }
    mockSubscriberInDb = null
    mockTournamentInDb = {
      id: 'tourney-1',
      name: 'Torneo Existente',
      slug: 'torneo-existente',
      status: 'draft',
      creator_id: CREATOR_ID,
      collaborator_id: COLLAB_ID,
      kick_broadcaster_id: null,
      is_private: false,
      registration_password: null,
      max_teams: 10,
      registration_start_date: null,
      registration_end_date: null,
      created_at: new Date().toISOString(),
      entry_fee: 0,
      discipline: 'warzone',
    }
  })

  // ── 1. Verificación del Helper (Sin 'any' en Firma) ───────────────────────────

  it('1. validateKickBroadcasterAuthority no usa `any` en la firma de SupabaseClient', async () => {
    const mockClient = buildMockSupabaseClient()
    const res = await validateKickBroadcasterAuthority(mockClient, CREATOR_ID, 'kick-creator-100')
    expect(res.valid).toBe(true)
  })

  // ── 2. Pruebas Reales de Entry Points: createTournament() y updateTournament() (A - F) ─

  it('A. createTournament() y updateTournament(): Creador con su propio Kick conectado -> PERMITIDO', async () => {
    mockCurrentUser = { id: CREATOR_ID }
    mockUserProfile = { id: CREATOR_ID, role: 'STREAMER', subscription_status: 'ACTIVE' }

    // createTournament
    const input = getBaseTournamentInput({ kickBroadcasterId: 'kick-creator-100' })
    const createRes = await createTournament(input)
    expect('error' in createRes).toBe(false)
    if ('data' in createRes) {
      expect(createRes.data.kickBroadcasterId).toBe('kick-creator-100')
    }

    // updateTournament
    const updateRes = await updateTournament('tourney-1', { kickBroadcasterId: 'kick-creator-100' })
    expect('error' in updateRes).toBe(false)
    if ('data' in updateRes) {
      expect(updateRes.data.kickBroadcasterId).toBe('kick-creator-100')
    }
  })

  it('B. createTournament() y updateTournament(): Usuario intentando Kick ID arbitrario -> RECHAZADO', async () => {
    mockCurrentUser = { id: CREATOR_ID }
    mockUserProfile = { id: CREATOR_ID, role: 'STREAMER', subscription_status: 'ACTIVE' }

    // createTournament
    const input = getBaseTournamentInput({ kickBroadcasterId: 'arbitrary-kick-999' })
    const createRes = await createTournament(input)
    expect('error' in createRes).toBe(true)
    if ('error' in createRes) {
      expect(createRes.error).toMatch(/No estás autorizado/)
    }

    // updateTournament
    const updateRes = await updateTournament('tourney-1', { kickBroadcasterId: 'arbitrary-kick-999' })
    expect('error' in updateRes).toBe(true)
    if ('error' in updateRes) {
      expect(updateRes.error).toMatch(/No estás autorizado/)
    }
  })

  it('C. createTournament() y updateTournament(): Creador intentando Kick ID de colaborador -> RECHAZADO', async () => {
    mockCurrentUser = { id: CREATOR_ID }
    mockUserProfile = { id: CREATOR_ID, role: 'STREAMER', subscription_status: 'ACTIVE' }

    // createTournament
    const input = getBaseTournamentInput({
      kickBroadcasterId: 'kick-collab-456',
      collaboratorId: COLLAB_ID,
    })
    const createRes = await createTournament(input)
    expect('error' in createRes).toBe(true)
    if ('error' in createRes) {
      expect(createRes.error).toMatch(/No estás autorizado/)
    }

    // updateTournament
    const updateRes = await updateTournament('tourney-1', { kickBroadcasterId: 'kick-collab-456' })
    expect('error' in updateRes).toBe(true)
    if ('error' in updateRes) {
      expect(updateRes.error).toMatch(/No estás autorizado/)
    }
  })

  it('D. createTournament() y updateTournament(): ADMIN intentando Kick ID de colaborador -> RECHAZADO', async () => {
    mockCurrentUser = { id: ADMIN_ID }
    mockUserProfile = { id: ADMIN_ID, role: 'ADMIN', subscription_status: 'ACTIVE' }
    mockTournamentInDb.creator_id = ADMIN_ID

    // createTournament
    const input = getBaseTournamentInput({
      kickBroadcasterId: 'kick-collab-456',
      collaboratorId: COLLAB_ID,
    })
    const createRes = await createTournament(input)
    expect('error' in createRes).toBe(true)
    if ('error' in createRes) {
      expect(createRes.error).toMatch(/No estás autorizado/)
    }

    // updateTournament
    const updateRes = await updateTournament('tourney-1', { kickBroadcasterId: 'kick-collab-456' })
    expect('error' in updateRes).toBe(true)
    if ('error' in updateRes) {
      expect(updateRes.error).toMatch(/No estás autorizado/)
    }
  })

  it('E. createTournament() y updateTournament(): Usuario sin conexión Kick intentando activar restricción -> RECHAZADO', async () => {
    mockCurrentUser = { id: NO_KICK_USER_ID }
    mockUserProfile = { id: NO_KICK_USER_ID, role: 'STREAMER', subscription_status: 'ACTIVE' }

    // createTournament
    const input = getBaseTournamentInput({ kickBroadcasterId: 'any-target-kick-123' })
    const createRes = await createTournament(input)
    expect('error' in createRes).toBe(true)
    if ('error' in createRes) {
      expect(createRes.error).toMatch(/No estás autorizado/)
    }

    // updateTournament
    mockTournamentInDb.creator_id = NO_KICK_USER_ID
    const updateRes = await updateTournament('tourney-1', { kickBroadcasterId: 'any-target-kick-123' })
    expect('error' in updateRes).toBe(true)
    if ('error' in updateRes) {
      expect(updateRes.error).toMatch(/No estás autorizado/)
    }
  })

  it('F. createTournament() y updateTournament(): NULL o vacío -> Comportamiento normal PERMITIDO', async () => {
    mockCurrentUser = { id: CREATOR_ID }
    mockUserProfile = { id: CREATOR_ID, role: 'STREAMER', subscription_status: 'ACTIVE' }

    // createTournament
    const input = getBaseTournamentInput({ kickBroadcasterId: null })
    const createRes = await createTournament(input)
    expect('error' in createRes).toBe(false)

    // updateTournament
    const updateRes = await updateTournament('tourney-1', { kickBroadcasterId: null })
    expect('error' in updateRes).toBe(false)
  })

  // ── 3. Pruebas de Elegibilidad de Inscripción (G - J) ──────────────────────────

  it('G. Direct activo correcto -> Eligible', async () => {
    const mockClient = buildMockSupabaseClient()
    mockSubscriberInDb = {
      broadcaster_kick_user_id: 'broadcaster-999',
      subscriber_kick_user_id: 'kick-creator-100',
      subscription_type: 'direct',
      is_active: true,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }

    const result = await checkKickTournamentEligibility(mockClient, {
      userId: CREATOR_ID,
      broadcasterKickUserId: 'broadcaster-999',
    })

    expect(result.eligible).toBe(true)
    expect(result.reason).toBe('eligible')
    expect(result.subscriptionType).toBe('direct')
  })

  it('H. Gifted -> Ineligible', async () => {
    const mockClient = buildMockSupabaseClient()
    mockSubscriberInDb = {
      broadcaster_kick_user_id: 'broadcaster-999',
      subscriber_kick_user_id: 'kick-creator-100',
      subscription_type: 'gifted',
      is_active: true,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }

    const result = await checkKickTournamentEligibility(mockClient, {
      userId: CREATOR_ID,
      broadcasterKickUserId: 'broadcaster-999',
    })

    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('gifted_subscription_ineligible')
  })

  it('I. Expirado -> Ineligible', async () => {
    const mockClient = buildMockSupabaseClient()
    mockSubscriberInDb = {
      broadcaster_kick_user_id: 'broadcaster-999',
      subscriber_kick_user_id: 'kick-creator-100',
      subscription_type: 'direct',
      is_active: true,
      expires_at: new Date(Date.now() - 10000).toISOString(),
    }

    const result = await checkKickTournamentEligibility(mockClient, {
      userId: CREATOR_ID,
      broadcasterKickUserId: 'broadcaster-999',
    })

    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('subscription_expired')
  })

  it('J. Broadcaster diferente -> Ineligible', async () => {
    const mockClient = buildMockSupabaseClient()
    mockSubscriberInDb = {
      broadcaster_kick_user_id: 'broadcaster-OTHER',
      subscriber_kick_user_id: 'kick-creator-100',
      subscription_type: 'direct',
      is_active: true,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }

    const result = await checkKickTournamentEligibility(mockClient, {
      userId: CREATOR_ID,
      broadcasterKickUserId: 'broadcaster-999',
    })

    expect(result.eligible).toBe(false)
    expect(result.reason).toBe('no_subscription_found')
  })

  // ── 4. Pruebas de Entry Point Real para Inscripción: registerTournament() (Test K) ─

  it('K. REAL registerTournament(): Rechazo por Kick retorne error Y NO ejecute inserción de equipos ni participantes (Sin side-effects)', async () => {
    mockCurrentUser = { id: NO_KICK_USER_ID } // Usuario sin cuenta de Kick conectada
    mockUserProfile = { id: NO_KICK_USER_ID, role: 'USER', subscription_status: 'NONE' }
    mockTournamentInDb = {
      id: 'tourney-kick-private-99',
      name: 'Torneo Exclusivo Kick Streamer',
      status: 'pending',
      kick_broadcaster_id: 'broadcaster-target-777',
      is_private: false,
      registration_password: null,
      max_teams: 10,
      registration_start_date: null,
      registration_end_date: null,
    }

    const regFormData = {
      teamName: 'Equipo Los Inelegibles',
      participants: [{ displayName: 'Jugador 1', userId: NO_KICK_USER_ID }],
    }

    // Ejecutar la acción real registerTournament()
    const result = await registerTournament('tourney-kick-private-99', regFormData)

    // 1. Debe retornar rechazo con mensaje explicativo
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toMatch(/Este torneo requiere una cuenta de Kick vinculada/)
    }

    // 2. Confirmar que NINGÚN side-effect de equipo ni participante fue ejecutado
    expect(teamInsertSpy).not.toHaveBeenCalled()
    expect(participantInsertSpy).not.toHaveBeenCalled()
  })
})
