import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import path from 'node:path'
import {
  buildAuthorizeUrl,
  decryptToken,
  disconnectKickConnection,
  encryptToken,
  exchangeCodeForTokens,
  fetchKickUser,
  generateCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
  getValidKickAccessToken,
  isValidOAuthState,
  refreshKickTokens,
  upsertKickConnection,
  FLOW_COOKIE_SCHEMA,
  KickServiceError,
  KICK_GATE1_SCOPES,
  KICK_OAUTH_FLOW_COOKIE,
} from '../kick'
import type { KickTokenResponse, KickUser } from '@/types'

// ── Fixtures & helpers ───────────────────────────────────────────────────────

const TEST_KEY = randomBytes(32).toString('base64')

const TOKENS: KickTokenResponse = {
  access_token: 'at-plain-123',
  token_type: 'Bearer',
  refresh_token: 'rt-plain-456',
  expires_in: 3600,
  scope: 'user:read',
}

const KICK_USER: KickUser = { user_id: 'kick-99', username: 'streamerX', email: 'x@kick.com', profile_picture: 'https://pic' }

type SupabaseOverrides = {
  selectData?: unknown
  selectError?: { code?: string; message: string } | null
  upsertError?: { code?: string; message: string } | null
  updateError?: { code?: string; message: string } | null
  deleteError?: { code?: string; message: string } | null
}

function createMockSupabase(overrides: SupabaseOverrides = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: overrides.selectData ?? null, error: overrides.selectError ?? null })
  const upsert = vi.fn().mockResolvedValue({ data: null, error: overrides.upsertError ?? null })
  // Spies ESTABLES: el servicio llama from() varias veces; los .eq finales son
  // compartidos para que los asserts vean todas las llamadas.
  const updateEq = vi.fn().mockResolvedValue({ data: null, error: overrides.updateError ?? null })
  const updateFn = vi.fn(() => ({ eq: updateEq }))
  const deleteEq = vi.fn().mockResolvedValue({ data: null, error: overrides.deleteError ?? null })
  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
      upsert,
      update: updateFn,
      delete: vi.fn(() => ({ eq: deleteEq })),
    })),
    _upsert: upsert,
    _maybeSingle: maybeSingle,
    _update: updateFn,
    _deleteEq: deleteEq,
  }
  return client
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function stubKickFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: string | URL, init: RequestInit = {}) => handler(String(url), init))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function getCall(fetchMock: ReturnType<typeof vi.fn>, index = 0): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit]
  return { url, init }
}

beforeEach(() => {
  vi.stubEnv('KICK_CLIENT_ID', 'test-client-id')
  vi.stubEnv('KICK_CLIENT_SECRET', 'test-client-secret')
  vi.stubEnv('KICK_REDIRECT_URL', 'https://www.kronix.do/api/kick/callback')
  vi.stubEnv('KICK_ENCRYPTION_KEY', TEST_KEY)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// ── PKCE ─────────────────────────────────────────────────────────────────────

describe('PKCE', () => {
  it('generateCodeVerifier: 43 chars base64url, único por llamada', () => {
    const v = generateCodeVerifier()
    expect(v).toHaveLength(43)
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(v).not.toBe(generateCodeVerifier())
  })

  it('generateCodeChallenge: BASE64URL(SHA256(verifier)) — RFC 7636 S256 exacto', () => {
    const verifier = 'test-verifier-with-exactly-43-characters-aaaaaaa'
    const expected = createHash('sha256').update(verifier, 'ascii').digest('base64url')
    expect(generateCodeChallenge(verifier)).toBe(expected)
  })

  it('generateCodeChallenge: challenges distintos para verifiers distintos', () => {
    expect(generateCodeChallenge(generateCodeVerifier())).not.toBe(generateCodeChallenge(generateCodeVerifier()))
  })
})

// ── state anti-CSRF ──────────────────────────────────────────────────────────

describe('OAuth state (anti-CSRF)', () => {
  it('generateOAuthState: ≥43 chars y distinto en cada llamada', () => {
    const s = generateOAuthState()
    expect(s.length).toBeGreaterThanOrEqual(43)
    expect(s).not.toBe(generateOAuthState())
  })

  it('rechaza state ausente, distinto o de longitud distinta', () => {
    const expected = generateOAuthState()
    expect(isValidOAuthState(null, expected)).toBe(false)
    expect(isValidOAuthState(undefined, expected)).toBe(false)
    expect(isValidOAuthState('abc', null)).toBe(false)
    expect(isValidOAuthState('tampered-state-aaaa', expected)).toBe(false)
    expect(isValidOAuthState(expected.slice(0, 10), expected)).toBe(false)
  })

  it('acepta solo el par exacto (comparación timing-safe)', () => {
    const expected = generateOAuthState()
    expect(isValidOAuthState(expected, expected)).toBe(true)
  })
})

// ── Cifrado AES-256-GCM ──────────────────────────────────────────────────────

describe('encryptToken / decryptToken (AES-256-GCM)', () => {
  it('roundtrip exacto y formato v1.<iv>.<ct>.<tag>', () => {
    const payload = encryptToken('mi-token-secreto')
    expect(payload).toMatch(/^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/)
    expect(decryptToken(payload)).toBe('mi-token-secreto')
  })

  it('falla ante ciphertext manipulado (auth tag GCM inválido)', () => {
    const payload = encryptToken('mi-token-secreto')
    const parts = payload.split('.')
    const ct = Buffer.from(parts[2], 'base64')
    ct[0] = ct[0] ^ 0xff
    expect(() => decryptToken(['v1', parts[1], ct.toString('base64'), parts[3]].join('.'))).toThrow(KickServiceError)
  })

  it('falla ante payload malformado (sin prefijo v1 / segmentos faltantes)', () => {
    expect(() => decryptToken('garbage')).toThrow(KickServiceError)
    expect(() => decryptToken('v1.solo.dos')).toThrow(KickServiceError)
    expect(() => decryptToken('v2.a.b.c')).toThrow(KickServiceError)
  })

  it('IV distinto en cada llamada: mismo plaintext → ciphertexts diferentes', () => {
    const a = encryptToken('mismo-token')
    const b = encryptToken('mismo-token')
    expect(a).not.toBe(b)
    expect(decryptToken(a)).toBe(decryptToken(b))
  })
})

// ── Authorize URL ────────────────────────────────────────────────────────────

describe('buildAuthorizeUrl', () => {
  it('host exacto https://id.kick.com/oauth/authorize con response_type=code y S256', () => {
    const url = new URL(
      buildAuthorizeUrl({ clientId: 'cid', redirectUrl: 'https://www.kronix.do/api/kick/callback', state: 'st', codeChallenge: 'ch' })
    )
    expect(url.origin + url.pathname).toBe('https://id.kick.com/oauth/authorize')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('incluye scope=user:read (Gate 1), state y code_challenge como query params', () => {
    const url = new URL(
      buildAuthorizeUrl({ clientId: 'cid', redirectUrl: 'https://r', state: 'st-123', codeChallenge: 'ch-123' })
    )
    expect(url.searchParams.get('scope')).toBe(KICK_GATE1_SCOPES.join(' '))
    expect(url.searchParams.get('scope')).toBe('user:read')
    expect(url.searchParams.get('state')).toBe('st-123')
    expect(url.searchParams.get('code_challenge')).toBe('ch-123')
  })

  it('urlencoded del redirect_uri correcto', () => {
    const redirect = 'https://www.kronix.do/api/kick/callback'
    const url = new URL(buildAuthorizeUrl({ clientId: 'cid', redirectUrl: redirect, state: 's', codeChallenge: 'c' }))
    expect(url.searchParams.get('redirect_uri')).toBe(redirect)
    expect(url.toString()).toContain(encodeURIComponent(redirect))
  })
})

// ── Token exchange / refresh ─────────────────────────────────────────────────

describe('exchangeCodeForTokens', () => {
  it('envía exactamente los 6 campos exigidos por la doc de Kick (form-urlencoded)', async () => {
    const fetchMock = stubKickFetch(() => jsonResponse(TOKENS))
    await exchangeCodeForTokens('the-code', 'the-verifier')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const { url, init } = getCall(fetchMock)
    expect(url).toBe('https://id.kick.com/oauth/token')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded')
    const body = new URLSearchParams(init.body as string)
    expect(Array.from(body.keys()).sort()).toEqual(
      ['client_id', 'client_secret', 'code', 'code_verifier', 'grant_type', 'redirect_uri'].sort()
    )
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('the-code')
    expect(body.get('code_verifier')).toBe('the-verifier')
    expect(body.get('client_id')).toBe('test-client-id')
    expect(body.get('client_secret')).toBe('test-client-secret')
    expect(body.get('redirect_uri')).toBe('https://www.kronix.do/api/kick/callback')
  })

  it('400 invalid_grant → error controlado, sin throw crudo', async () => {
    stubKickFetch(() => new Response('{"error":"invalid_grant"}', { status: 400 }))
    await expect(exchangeCodeForTokens('c', 'v')).rejects.toMatchObject({ code: 'invalid_grant' })
  })

  it('timeout de red (AbortController 10s) → error controlado', async () => {
    stubKickFetch(() => {
      throw new Error('The operation was aborted')
    })
    await expect(exchangeCodeForTokens('c', 'v')).rejects.toMatchObject({ code: 'network_error' })
  })

  it('respuesta con forma inesperada → invalid_response (nada se persiste)', async () => {
    stubKickFetch(() => jsonResponse({ access_token: 'only-at' }))
    await expect(exchangeCodeForTokens('c', 'v')).rejects.toMatchObject({ code: 'invalid_response' })
  })
})

describe('refreshKickTokens', () => {
  it('rota y devuelve ambos tokens nuevos', async () => {
    const refreshed: KickTokenResponse = { ...TOKENS, access_token: 'at-new', refresh_token: 'rt-new' }
    const fetchMock = stubKickFetch(() => jsonResponse(refreshed))
    const result = await refreshKickTokens('rt-old')
    expect(result).toEqual(refreshed)
    const { init } = getCall(fetchMock)
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('rt-old')
  })

  it('401/invalid_grant → kick_reconnect_required', async () => {
    stubKickFetch(() => new Response('{"error":"invalid_grant"}', { status: 401 }))
    await expect(refreshKickTokens('dead')).rejects.toMatchObject({ code: 'kick_reconnect_required' })
  })
})

// ── Identidad ────────────────────────────────────────────────────────────────

describe('fetchKickUser', () => {
  it('GET /public/v1/users con Bearer y devuelve la identidad validada', async () => {
    const fetchMock = stubKickFetch(() => jsonResponse({ data: { user_id: 'kick-99', username: 'streamerX' } }))
    const user = await fetchKickUser('at-plain-123')
    expect(user.user_id).toBe('kick-99')
    expect(user.username).toBe('streamerX')
    const { url, init } = getCall(fetchMock)
    expect(url).toBe('https://api.kick.com/public/v1/users')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer at-plain-123')
  })

  it('respuesta sin data.user_id → error de validación (no se persiste nada)', async () => {
    stubKickFetch(() => jsonResponse({ data: { username: 'sin-id' } }))
    await expect(fetchKickUser('at')).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('401 → invalid_grant', async () => {
    stubKickFetch(() => new Response('{"error":"invalid_token"}', { status: 401 }))
    await expect(fetchKickUser('expired')).rejects.toMatchObject({ code: 'invalid_grant' })
  })
})

// ── Upsert / no duplicación ──────────────────────────────────────────────────

describe('upsertKickConnection', () => {
  it('persiste SOLO ciphertext: el payload a Supabase jamás contiene tokens en claro', async () => {
    const supabase = createMockSupabase()
    const result = await upsertKickConnection({ supabase: supabase as never, userId: 'u1', tokens: TOKENS, kickUser: KICK_USER })
    expect(result).toEqual({ success: true })
    const row = supabase._upsert.mock.calls[0][0]
    expect(row.access_token_encrypted).toMatch(/^v1\./)
    expect(row.refresh_token_encrypted).toMatch(/^v1\./)
    expect(JSON.stringify(row)).not.toContain('at-plain-123')
    expect(JSON.stringify(row)).not.toContain('rt-plain-456')
    expect(decryptToken(row.access_token_encrypted)).toBe(TOKENS.access_token)
    expect(decryptToken(row.refresh_token_encrypted)).toBe(TOKENS.refresh_token)
  })

  it('reconexión del MISMO usuario actualiza la fila (upsert on user_id, sin duplicados)', async () => {
    const supabase = createMockSupabase()
    await upsertKickConnection({ supabase: supabase as never, userId: 'u1', tokens: TOKENS, kickUser: KICK_USER })
    await upsertKickConnection({ supabase: supabase as never, userId: 'u1', tokens: TOKENS, kickUser: KICK_USER })
    expect(supabase._upsert).toHaveBeenCalledTimes(2)
    for (const call of supabase._upsert.mock.calls) {
      expect(call[0].user_id).toBe('u1')
      expect(call[1]).toEqual({ onConflict: 'user_id' })
    }
  })

  it('rechaza con code kick_account_in_use si la cuenta de Kick pertenece a otro usuario (23505)', async () => {
    const supabase = createMockSupabase({ upsertError: { code: '23505', message: 'duplicate key value violates unique constraint' } })
    const result = await upsertKickConnection({ supabase: supabase as never, userId: 'u2', tokens: TOKENS, kickUser: KICK_USER })
    expect(result).toMatchObject({ code: 'kick_account_in_use' })
  })

  it('calcula access_token_expires_at con skew de seguridad de 60s', async () => {
    const supabase = createMockSupabase()
    await upsertKickConnection({ supabase: supabase as never, userId: 'u1', tokens: TOKENS, kickUser: KICK_USER })
    const row = supabase._upsert.mock.calls[0][0]
    const expected = Date.now() + (TOKENS.expires_in - 60) * 1000
    const actual = new Date(row.access_token_expires_at).getTime()
    expect(Math.abs(actual - expected)).toBeLessThan(5000)
  })
})

// ── getValidKickAccessToken (refresh + re-persistencia) ──────────────────────

describe('getValidKickAccessToken', () => {
  // Lazy: encryptToken exige KICK_ENCRYPTION_KEY (stubbeada en beforeEach),
  // así que la fila se construye en tiempo de test, no de colección.
  const makeFutureRow = () => ({
    id: 'row-1',
    user_id: 'u1',
    kick_user_id: 'kick-99',
    access_token_encrypted: encryptToken('at-plain-123'),
    refresh_token_encrypted: encryptToken('rt-plain-456'),
    scopes: 'user:read',
    access_token_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  })

  it('token vigente → devuelve el descifrado sin llamar a la red', async () => {
    const fetchMock = stubKickFetch(() => jsonResponse({}))
    const supabase = createMockSupabase({ selectData: makeFutureRow() })
    const result = await getValidKickAccessToken(supabase as never, 'u1')
    if ('error' in result) throw new Error(result.error)
    expect(result.accessToken).toBe('at-plain-123')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('expirado → refresca, re-persiste ambos tokens cifrados y devuelve el nuevo', async () => {
    const refreshed: KickTokenResponse = { ...TOKENS, access_token: 'at-refreshed', refresh_token: 'rt-refreshed' }
    stubKickFetch(() => jsonResponse(refreshed))
    const expiredRow = { ...makeFutureRow(), access_token_expires_at: new Date(Date.now() - 60 * 1000).toISOString() }
    const supabase = createMockSupabase({ selectData: expiredRow })
    const result = await getValidKickAccessToken(supabase as never, 'u1')
    if ('error' in result) throw new Error(result.error)
    expect(result.accessToken).toBe('at-refreshed')
    const updateCall = supabase._update.mock.calls[0] as unknown as [Record<string, string>] | undefined
    if (!updateCall) throw new Error('update() no fue llamado')
    const updatedRow = updateCall[0]
    expect(decryptToken(updatedRow.access_token_encrypted)).toBe('at-refreshed')
    expect(decryptToken(updatedRow.refresh_token_encrypted)).toBe('rt-refreshed')
  })

  it('sin fila → devuelve { error, code: kick_reconnect_required } (S5: aserción real, sin .rejects sin matcher)', async () => {
    stubKickFetch(() => jsonResponse({}))
    const supabase = createMockSupabase({ selectData: null })
    const result = await getValidKickAccessToken(supabase as never, 'u1')
    expect('error' in result).toBe(true)
    expect(result).toMatchObject({ code: 'kick_reconnect_required' })
  })
})

// ── Disconnect (revoke best-effort + borrado server-side) ────────────────────

describe('disconnectKickConnection', () => {
  it('revoke exitoso: revoca el REFRESH token (S2) con hint refresh_token y borra la fila', async () => {
    const fetchMock = stubKickFetch(() => new Response('', { status: 200 }))
    const supabase = createMockSupabase({ selectData: { refresh_token_encrypted: encryptToken('rt-plain-456') } })
    const result = await disconnectKickConnection(supabase as never, 'u1')
    expect(result).toEqual({ success: true })
    const { url, init } = getCall(fetchMock)
    expect(url).toBe('https://id.kick.com/oauth/revoke')
    const body = new URLSearchParams(init.body as string)
    expect(body.get('token')).toBe('rt-plain-456')
    expect(body.get('token_hint_type')).toBe('refresh_token')
    expect(supabase._deleteEq).toHaveBeenCalledTimes(1)
  })

  it('revoke falla pero IGUAL borra la fila local (best-effort)', async () => {
    stubKickFetch(() => new Response('{"error":"server_error"}', { status: 500 }))
    const supabase = createMockSupabase({ selectData: { refresh_token_encrypted: encryptToken('rt-plain-456') } })
    const result = await disconnectKickConnection(supabase as never, 'u1')
    expect(result).toEqual({ success: true })
    expect(supabase._deleteEq).toHaveBeenCalledTimes(1)
  })

  it('sin fila local: no llama a revoke y aun así intenta el borrado', async () => {
    const fetchMock = stubKickFetch(() => new Response('', { status: 200 }))
    const supabase = createMockSupabase({ selectData: null })
    const result = await disconnectKickConnection(supabase as never, 'u1')
    expect(result).toEqual({ success: true })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(supabase._deleteEq).toHaveBeenCalledTimes(1)
  })

  it('error de lectura → error controlado y NO borra', async () => {
    stubKickFetch(() => new Response('', { status: 200 }))
    const supabase = createMockSupabase({ selectError: { code: 'PGRST', message: 'boom' } })
    const result = await disconnectKickConnection(supabase as never, 'u1')
    expect('error' in result).toBe(true)
    expect(supabase._deleteEq).not.toHaveBeenCalled()
  })
})

// ── Schemas corregidos (S1/S2) + FLOW_COOKIE_SCHEMA (S3) ─────────────────────

describe('KickUserSchema vía fetchKickUser (S1: user_id numérico)', () => {
  it('user_id numérico (int64 JSON number) → coaccionado a string y aceptado', async () => {
    stubKickFetch(() => jsonResponse({ data: { user_id: 485612, username: 'numericId', email: null, profile_picture: null } }))
    const user = await fetchKickUser('at')
    expect(user.user_id).toBe('485612')
    expect(typeof user.user_id).toBe('string')
    expect(user.username).toBe('numericId')
  })

  it('forma interna esperada (user_id string) sigue aceptándose', async () => {
    stubKickFetch(() => jsonResponse({ data: { user_id: '485612', username: 'stringId' } }))
    const user = await fetchKickUser('at')
    expect(user.user_id).toBe('485612')
  })

  it('respuesta REAL de Kick (data como array de un usuario con "name") → PASS y mapea "name" a "username"', async () => {
    stubKickFetch(() =>
      jsonResponse({
        data: [
          {
            user_id: 59058553,
            name: 'Franlys07',
            email: 'test@kronix.do',
            profile_picture: 'https://kick.com/img/avatar.webp',
          },
        ],
        message: 'OK',
      })
    )
    const user = await fetchKickUser('at')
    expect(user.user_id).toBe('59058553')
    expect(user.username).toBe('Franlys07')
    expect(user.email).toBe('test@kronix.do')
    expect(user.profile_picture).toBe('https://kick.com/img/avatar.webp')
  })

  it('data como array vacío (data: []) → FAIL controlado con invalid_response', async () => {
    stubKickFetch(() => jsonResponse({ data: [], message: 'OK' }))
    await expect(fetchKickUser('at')).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('forma inválida (user_id ausente) → FAIL con invalid_response', async () => {
    stubKickFetch(() => jsonResponse({ data: { username: 'sin-id' } }))
    await expect(fetchKickUser('at')).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('forma inválida (user_id de tipo no string/number) → FAIL con invalid_response', async () => {
    stubKickFetch(() => jsonResponse({ data: { user_id: { nested: 'object' }, username: 'obj' } }))
    await expect(fetchKickUser('at')).rejects.toMatchObject({ code: 'invalid_response' })
  })
})

describe('KickTokenResponseSchema vía exchangeCodeForTokens (S2: expires_in string|number)', () => {
  it('expires_in como string → coaccionado a number y aceptado', async () => {
    stubKickFetch(() => jsonResponse({ ...TOKENS, expires_in: '3600' }))
    const tokens = await exchangeCodeForTokens('c', 'v')
    expect(tokens.expires_in).toBe(3600)
    expect(typeof tokens.expires_in).toBe('number')
  })

  it('expires_in como number sigue aceptándose', async () => {
    stubKickFetch(() => jsonResponse({ ...TOKENS, expires_in: 7200 }))
    const tokens = await exchangeCodeForTokens('c', 'v')
    expect(tokens.expires_in).toBe(7200)
  })

  it('expires_in inválido ("abc" / 0 / negativo) → FAIL con invalid_response', async () => {
    stubKickFetch(() => jsonResponse({ ...TOKENS, expires_in: 'abc' }))
    await expect(exchangeCodeForTokens('c', 'v')).rejects.toMatchObject({ code: 'invalid_response' })
    stubKickFetch(() => jsonResponse({ ...TOKENS, expires_in: 0 }))
    await expect(exchangeCodeForTokens('c', 'v')).rejects.toMatchObject({ code: 'invalid_response' })
    stubKickFetch(() => jsonResponse({ ...TOKENS, expires_in: -30 }))
    await expect(exchangeCodeForTokens('c', 'v')).rejects.toMatchObject({ code: 'invalid_response' })
  })
})

describe('FLOW_COOKIE_SCHEMA (S3: la cookie del flujo se valida en runtime)', () => {
  it('cookie válida (state ≥16 + codeVerifier 43..128) → PASS', () => {
    const parsed = FLOW_COOKIE_SCHEMA.safeParse({ state: 'a'.repeat(32), codeVerifier: 'v'.repeat(43) })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.state).toBe('a'.repeat(32))
      expect(parsed.data.codeVerifier).toBe('v'.repeat(43))
    }
  })

  it('cookie válida con returnTo opcional → PASS', () => {
    const parsed = FLOW_COOKIE_SCHEMA.safeParse({ state: 'a'.repeat(32), codeVerifier: 'v'.repeat(64), returnTo: '/profile' })
    expect(parsed.success).toBe(true)
  })

  it('cookie inválida (codeVerifier corto) → FAIL', () => {
    const parsed = FLOW_COOKIE_SCHEMA.safeParse({ state: 'a'.repeat(32), codeVerifier: 'short' })
    expect(parsed.success).toBe(false)
  })

  it('cookie inválida (state ausente) → FAIL', () => {
    const parsed = FLOW_COOKIE_SCHEMA.safeParse({ codeVerifier: 'v'.repeat(43) })
    expect(parsed.success).toBe(false)
  })

  it('cookie inválida (null / garbage / tipos incorrectos) → FAIL', () => {
    expect(FLOW_COOKIE_SCHEMA.safeParse(null).success).toBe(false)
    expect(FLOW_COOKIE_SCHEMA.safeParse('garbage').success).toBe(false)
    expect(FLOW_COOKIE_SCHEMA.safeParse({ state: 12345, codeVerifier: 'v'.repeat(43) }).success).toBe(false)
  })
})

// ── Routes (mock de sesión) ──────────────────────────────────────────────────

let mockUser: { id: string } | null = null
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
  })),
  createAdminClient: vi.fn(async () => {
    throw new Error('admin client no usado en estos tests')
  }),
}))

describe('GET /api/kick/authorize', () => {
  it('sin sesión → redirect a /auth/login sin generar cookie ni URL de Kick', async () => {
    mockUser = null
    const { GET } = await import('@/app/api/kick/authorize/route')
    const request = new Request('http://localhost:3000/api/kick/authorize')
    const res = await GET(request as never)
    expect(res.headers.get('location')).toContain('/auth/login')
    expect(res.headers.get('location')).not.toContain('id.kick.com')
    expect(res.headers.get('set-cookie') ?? '').not.toContain(KICK_OAUTH_FLOW_COOKIE)
  })

  it('con sesión → 307 a https://id.kick.com/oauth/authorize con cookie httpOnly + secure', async () => {
    mockUser = { id: 'u1' }
    vi.stubEnv('NODE_ENV', 'production') // habilita el flag secure de la cookie
    const { GET } = await import('@/app/api/kick/authorize/route')
    const request = new Request('http://localhost:3000/api/kick/authorize')
    const res = await GET(request as never)
    const location = res.headers.get('location') ?? ''
    const url = new URL(location)
    expect(url.origin + url.pathname).toBe('https://id.kick.com/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('test-client-id')
    expect(url.searchParams.get('scope')).toBe('user:read')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(KICK_OAUTH_FLOW_COOKIE)
    expect(setCookie.toLowerCase()).toContain('httponly')
    expect(setCookie.toLowerCase()).toContain('secure')
    expect(setCookie.toLowerCase()).toContain('max-age=600')

    const cookieValue = setCookie.split(';')[0].split(`${KICK_OAUTH_FLOW_COOKIE}=`)[1]
    const flow = JSON.parse(decodeURIComponent(cookieValue)) as { state: string; codeVerifier: string }
    expect(flow.codeVerifier).toHaveLength(43)
    expect(url.searchParams.get('state')).toBe(flow.state)
  })
})

describe('POST /api/kick/disconnect (route guard)', () => {
  it('sin sesión → 401 sin tocar la base de datos', async () => {
    mockUser = null
    const { POST } = await import('@/app/api/kick/disconnect/route')
    const res = await POST()
    expect(res.status).toBe(401)
  })
})

// ── S1: regresión de la migración (grants) ───────────────────────────────────

describe('migración kick_connections — regresión S1', () => {
  const sql = readFileSync(
    path.resolve(process.cwd(), 'supabase/migrations/20260911000000_kick_connections.sql'),
    'utf8'
  )

  it('REVOKE ALL a anon/authenticated: el rol del navegador no puede escribir', () => {
    expect(sql).toContain('REVOKE ALL ON public.kick_connections FROM anon, authenticated')
  })

  it('NO existe ningún GRANT INSERT/UPDATE/DELETE/ALL para authenticated', () => {
    expect(sql).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE|ALL)/i)
  })

  it('GRANT SELECT solo sobre columnas seguras (sin columnas cifradas)', () => {
    expect(sql).toMatch(/GRANT SELECT \(/i)
    expect(sql).toContain('GRANT SELECT (')
    const grantBlock = sql.slice(sql.indexOf('GRANT SELECT ('))
    expect(grantBlock).not.toContain('access_token_encrypted')
    expect(grantBlock).not.toContain('refresh_token_encrypted')
  })

  it('RLS habilitado con policies sobre auth.uid() = user_id', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql.match(/auth\.uid\(\) = user_id/g)?.length).toBeGreaterThanOrEqual(4)
  })

  it('doble unicidad: UNIQUE(user_id) y UNIQUE(kick_user_id)', () => {
    expect(sql).toMatch(/user_id\s+uuid NOT NULL UNIQUE/)
    expect(sql).toMatch(/kick_user_id\s+text NOT NULL UNIQUE/)
  })
})
