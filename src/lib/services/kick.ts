/**
 * Kick OAuth Service — Gate 1: Kick OAuth Connection & Identity
 *
 * Implementa OAuth 2.1 + PKCE (S256) según docs.kick.com:
 * - Authorize:  https://id.kick.com/oauth/authorize
 * - Token:      https://id.kick.com/oauth/token
 * - Revoke:     https://id.kick.com/oauth/revoke
 * - Identidad:  GET https://api.kick.com/public/v1/users (Bearer access_token)
 *
 * Seguridad:
 * - Los tokens NUNCA se persisten en claro: AES-256-GCM con KICK_ENCRYPTION_KEY
 *   (32 bytes, base64). Formato: `v1.<iv_b64>.<ciphertext_b64>.<auth_tag_b64>`.
 * - El user_id SIEMPRE sale de la sesión de Supabase, jamás de query params.
 * - El `state` OAuth se compara con timingSafeEqual (anti CSRF).
 * - Scopes de este Gate: `user:read` únicamente (D3).
 */

import { createHash, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { KickTokenResponse, KickUser } from '@/types'

// ── Constantes (fuentes: docs.kick.com / KickDevDocs) ────────────────────────

export const KICK_AUTHORIZE_URL = 'https://id.kick.com/oauth/authorize'
export const KICK_TOKEN_URL = 'https://id.kick.com/oauth/token'
export const KICK_REVOKE_URL = 'https://id.kick.com/oauth/revoke'
export const KICK_API_BASE_URL = 'https://api.kick.com/public/v1'

/** Único scope autorizado para Gate 1 (D3). */
export const KICK_GATE1_SCOPES = ['user:read'] as const

/** Cookie httpOnly que guarda el contexto del flujo OAuth (10 min). */
export const KICK_OAUTH_FLOW_COOKIE = 'kick_oauth_flow'

/** Tiempo de vida del contexto OAuth en la cookie (segundos). */
export const KICK_OAUTH_FLOW_MAX_AGE = 600

/**
 * Contenido de la cookie de flujo OAuth. El callback lo valida con safeParse
 * (S3 de la auditoría): JSON.parse sin validación runtime jamás sustituye
 * al schema.
 */
export const FLOW_COOKIE_SCHEMA = z.object({
  state: z.string().min(16),
  codeVerifier: z.string().min(43).max(128),
  returnTo: z.string().max(2048).optional(),
  redirectUrl: z.string().max(2048).optional(),
})

/** Skew de seguridad restando al expires_in al calcular la expiración. */
const TOKEN_EXPIRY_SKEW_SECONDS = 60

/** Timeout de red para todas las llamadas a Kick (ms). */
const KICK_FETCH_TIMEOUT_MS = 10_000

// ── Errores tipados ──────────────────────────────────────────────────────────

export type KickErrorCode =
  | 'config_missing'
  | 'network_error'
  | 'invalid_response'
  | 'invalid_grant'
  | 'kick_account_in_use'
  | 'kick_reconnect_required'

export class KickServiceError extends Error {
  readonly code: KickErrorCode
  constructor(code: KickErrorCode, message: string) {
    super(message)
    this.name = 'KickServiceError'
    this.code = code
  }
}

// ── Config ───────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new KickServiceError('config_missing', `La variable de entorno ${name} no está configurada`)
  }
  return value
}

export function getKickConfig(): { clientId: string; clientSecret: string; redirectUrl: string } {
  return {
    clientId: requireEnv('KICK_CLIENT_ID'),
    clientSecret: requireEnv('KICK_CLIENT_SECRET'),
    redirectUrl: requireEnv('KICK_REDIRECT_URL'),
  }
}

// ── PKCE (RFC 7636, S256) ────────────────────────────────────────────────────

/** code_verifier: 43-128 chars, [A-Za-z0-9-._~]. 32 bytes → 43 chars base64url. */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

/** code_challenge = BASE64URL(SHA256(ASCII(code_verifier))) — método S256. */
export function generateCodeChallenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier, 'ascii').digest('base64url')
}

// ── state anti-CSRF ──────────────────────────────────────────────────────────

export function generateOAuthState(): string {
  return randomBytes(32).toString('base64url')
}

/** Comparación timing-safe del state recibido vs el esperado. */
export function isValidOAuthState(received: string | null | undefined, expected: string | null | undefined): boolean {
  if (!received || !expected) return false
  const a = Buffer.from(received, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ── Cifrado AES-256-GCM ──────────────────────────────────────────────────────

const CIPHERTEXT_PREFIX = 'v1'

function getEncryptionKey(): Buffer {
  const raw = requireEnv('KICK_ENCRYPTION_KEY')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new KickServiceError(
      'config_missing',
      'KICK_ENCRYPTION_KEY debe ser exactamente 32 bytes en base64 (genera una con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))")'
    )
  }
  return key
}

/** Cifra un token con AES-256-GCM → `v1.<iv>.<ciphertext>.<auth_tag>` (todo base64). */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [CIPHERTEXT_PREFIX, iv.toString('base64'), ciphertext.toString('base64'), authTag.toString('base64')].join('.')
}

/** Descifra un payload `v1.<iv>.<ciphertext>.<auth_tag>`. Falla si el auth tag GCM no valida. */
export function decryptToken(payload: string): string {
  const key = getEncryptionKey()
  const parts = payload.split('.')
  if (parts.length !== 4 || parts[0] !== CIPHERTEXT_PREFIX) {
    throw new KickServiceError('invalid_response', 'Payload cifrado malformado (se esperaba v1.<iv>.<ct>.<tag>)')
  }
  try {
    const iv = Buffer.from(parts[1], 'base64')
    const ciphertext = Buffer.from(parts[2], 'base64')
    const authTag = Buffer.from(parts[3], 'base64')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    throw new KickServiceError('invalid_response', 'No se pudo descifrar el token (auth tag inválido o payload manipulado)')
  }
}

// ── Authorize URL ────────────────────────────────────────────────────────────

export function buildAuthorizeUrl(params: { clientId: string; redirectUrl: string; state: string; codeChallenge: string }): string {
  const url = new URL(KICK_AUTHORIZE_URL)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', KICK_GATE1_SCOPES.join(' '))
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), KICK_FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    throw new KickServiceError('network_error', `Error de red contactando a Kick: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    clearTimeout(timer)
  }
}

async function readJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

// ── Token exchange / refresh / revoke ────────────────────────────────────────

/**
 * Intercambia `code` por tokens. Envía exactamente los 6 campos que exige la
 * doc de Kick (form-urlencoded): grant_type, code, client_id, client_secret,
 * redirect_uri, code_verifier.
 */
export async function exchangeCodeForTokens(code: string, codeVerifier: string, customRedirectUrl?: string): Promise<KickTokenResponse> {
  const { clientId, clientSecret, redirectUrl } = getKickConfig()
  const targetRedirectUrl = customRedirectUrl || redirectUrl
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: targetRedirectUrl,
    code_verifier: codeVerifier,
  })

  let response: Response
  try {
    response = await fetchWithTimeout(KICK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } catch (err) {
    if (err instanceof KickServiceError) throw err
    throw new KickServiceError('network_error', 'Error de red en el token exchange')
  }

  if (!response.ok) {
    // Nunca logueamos el body completo: puede contener datos sensibles.
    const summary = response.status === 400 || response.status === 401 ? 'invalid_grant' : `http_${response.status}`
    console.error('[Kick Service] Token exchange falló:', summary)
    throw new KickServiceError('invalid_grant', 'Kick rechazó el código de autorización (posible code usado/expirado o PKCE inválido)')
  }

  const data = KickTokenResponseSchema.safeParse(await readJsonSafe(response))
  if (!data.success) {
    console.error('[Kick Service] Respuesta de token con forma inesperada')
    throw new KickServiceError('invalid_response', 'La respuesta de token de Kick no tiene la forma esperada')
  }
  return data.data
}

export const KickTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
  refresh_token: z.string().min(1),
  // Kick ha documentado/enviado expires_in como number y como string
  // (RFC 6749 permite ambas representaciones): se coacciona SIEMPRE a number.
  expires_in: z.union([z.number(), z.string()]).transform((v) => (typeof v === 'number' ? v : Number.parseInt(v, 10))).pipe(z.number().int().positive()),
  scope: z.string().min(1),
})

/** Refresca los tokens con el refresh_token. Rotación: Kick devuelve uno nuevo. */
export async function refreshKickTokens(refreshToken: string): Promise<KickTokenResponse> {
  const { clientId, clientSecret } = getKickConfig()
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })

  let response: Response
  try {
    response = await fetchWithTimeout(KICK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } catch (err) {
    if (err instanceof KickServiceError) throw err
    throw new KickServiceError('network_error', 'Error de red refrescando el token')
  }

  if (!response.ok) {
    const summary = response.status === 400 || response.status === 401 ? 'invalid_grant' : `http_${response.status}`
    console.error('[Kick Service] Token refresh falló:', summary)
    throw new KickServiceError('kick_reconnect_required', 'El refresh token ya no es válido: el usuario debe reconectar su cuenta de Kick')
  }

  const data = KickTokenResponseSchema.safeParse(await readJsonSafe(response))
  if (!data.success) {
    console.error('[Kick Service] Respuesta de refresh con forma inesperada')
    throw new KickServiceError('invalid_response', 'La respuesta de refresh de Kick no tiene la forma esperada')
  }
  return data.data
}

/** Revoca un token en Kick (best-effort: los callers ignoran su resultado). */
export async function revokeKickToken(token: string): Promise<{ success: boolean }> {
  try {
    // S2 (auditoría): se revoca el REFRESH token. RFC 7009 §2.1: si el server
    // no soporta token_hint_type, ignora el hint y revoca el token enviado.
    // Revocar el refresh invalida la familia de tokens en Kick (el access
    // caduca solo en ≤ expires_in); revocar solo el access dejaba la sesión
    // renovable indefinidamente. El payload del token NUNCA se loguea.
    const body = new URLSearchParams({ token, token_hint_type: 'refresh_token' })
    const response = await fetchWithTimeout(KICK_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    return { success: response.ok }
  } catch (err) {
    console.warn('[Kick Service] Revoke falló (best-effort):', err instanceof Error ? err.message : err)
    return { success: false }
  }
}

// ── Identidad de Kick ────────────────────────────────────────────────────────

/**
 * S1 (auditoría): Kick devuelve user_id como número (int64 JSON number).
 * Se coacciona EXPLÍCITAMENTE a la representación interna string vía
 * String(v) — validación runtime real, nunca un TypeScript `as`.
 * Exportado para que tooling/E2E valide con EXACTAMENTE este schema.
 */
export const SingleKickUserSchema = z
  .object({
    user_id: z
      .union([z.string().min(1), z.number()])
      .transform((v) => String(v))
      .pipe(z.string().min(1)),
    username: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    email: z.string().email().optional().nullable(),
    profile_picture: z.string().optional().nullable(),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    if (!val.username && !val.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Se requiere username o name en el usuario de Kick',
        path: ['username'],
      })
    }
  })
  .transform((val) => ({
    user_id: val.user_id,
    username: (val.username ?? val.name)!,
    email: val.email ?? null,
    profile_picture: val.profile_picture ?? null,
  }))

export const KickUserSchema = z.object({
  data: z.union([
    z.array(SingleKickUserSchema).min(1),
    SingleKickUserSchema.transform((u) => [u]),
  ]),
})

/** GET /public/v1/users con el Bearer token → identidad verificada de Kick. */
export async function fetchKickUser(accessToken: string): Promise<KickUser> {
  let response: Response
  try {
    response = await fetchWithTimeout(`${KICK_API_BASE_URL}/users`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
  } catch (err) {
    if (err instanceof KickServiceError) throw err
    throw new KickServiceError('network_error', 'Error de red obteniendo el usuario de Kick')
  }

  if (!response.ok) {
    const summary = response.status === 401 ? 'invalid_token' : `http_${response.status}`
    console.error('[Kick Service] fetchKickUser falló:', summary)
    throw new KickServiceError('invalid_grant', 'Kick rechazó el access token al consultar la identidad del usuario')
  }

  const parsed = KickUserSchema.safeParse(await readJsonSafe(response))
  if (!parsed.success || !parsed.data.data || parsed.data.data.length === 0) {
    console.error('[Kick Service] Respuesta de /users con forma inesperada')
    throw new KickServiceError('invalid_response', 'La identidad de Kick recibida no es válida')
  }
  return parsed.data.data[0]
}

// ── Persistencia (conexiones) ────────────────────────────────────────────────

export interface UpsertKickConnectionInput {
  supabase: SupabaseClient
  /** SIEMPRE de la sesión de Supabase — nunca de query params. */
  userId: string
  tokens: KickTokenResponse
  kickUser: KickUser
}

/**
 * Upsert de la conexión: reconexión del MISMO usuario actualiza su fila
 * (conflict target: user_id, respaldado por UNIQUE(user_id)); si la cuenta de
 * Kick ya pertenece a OTRO usuario, PostgREST devuelve 23505 por
 * UNIQUE(kick_user_id) y se reporta como 'kick_account_in_use'.
 * Persiste SOLO ciphertext — jamás tokens en claro.
 */
export async function upsertKickConnection(input: UpsertKickConnectionInput): Promise<{ success: true } | { error: string; code: KickErrorCode }> {
  const { supabase, userId, tokens, kickUser } = input
  const expiresAt = new Date(Date.now() + (tokens.expires_in - TOKEN_EXPIRY_SKEW_SECONDS) * 1000).toISOString()

  const row = {
    user_id: userId,
    kick_user_id: kickUser.user_id,
    kick_username: kickUser.username,
    kick_email: kickUser.email ?? null,
    kick_profile_picture: kickUser.profile_picture ?? null,
    access_token_encrypted: encryptToken(tokens.access_token),
    refresh_token_encrypted: encryptToken(tokens.refresh_token),
    scopes: tokens.scope,
    access_token_expires_at: expiresAt,
  }

  const { error } = await supabase
    .from('kick_connections')
    .upsert(row, { onConflict: 'user_id' })

  if (error) {
    if (error.code === '23505') {
      console.warn(`[Kick Service] Cuenta de Kick ${kickUser.user_id} ya vinculada a otro usuario`)
      return { error: 'Esa cuenta de Kick ya está vinculada a otro usuario de la plataforma.', code: 'kick_account_in_use' }
    }
    console.error('[Kick Service] Error persistiendo la conexión:', error.code ?? error.message)
    return { error: 'No se pudo guardar la conexión con Kick. Intenta de nuevo.', code: 'invalid_response' }
  }

  return { success: true }
}

export interface KickConnectionRow {
  id: string
  user_id: string
  kick_user_id: string
  kick_username: string | null
  kick_email: string | null
  kick_profile_picture: string | null
  access_token_encrypted: string
  refresh_token_encrypted: string
  scopes: string
  access_token_expires_at: string
}

/**
 * Devuelve un access_token vigente para el usuario, refrescando y re-persistiendo
 * si expiró. Usa SOLO el admin client (service_role): `authenticated` no puede
 * leer las columnas cifradas (S1).
 */
export async function getValidKickAccessToken(
  adminClient: SupabaseClient,
  userId: string
): Promise<{ accessToken: string; connection: KickConnectionRow } | { error: string; code: KickErrorCode }> {
  const { data: connection, error } = await adminClient
    .from('kick_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[Kick Service] Error leyendo la conexión:', error.code ?? error.message)
    return { error: 'No se pudo leer tu conexión con Kick.', code: 'invalid_response' }
  }
  if (!connection) {
    return { error: 'No tienes una cuenta de Kick vinculada.', code: 'kick_reconnect_required' }
  }

  const row = connection as KickConnectionRow
  const expiresAtMs = new Date(row.access_token_expires_at).getTime()
  const accessToken = decryptToken(row.access_token_encrypted)

  if (Number.isFinite(expiresAtMs) && expiresAtMs - TOKEN_EXPIRY_SKEW_SECONDS * 1000 > Date.now()) {
    return { accessToken, connection: row }
  }

  // Expirado (o dentro del skew): refrescar y re-persistir ambos tokens.
  const refreshToken = decryptToken(row.refresh_token_encrypted)
  const refreshed = await refreshKickTokens(refreshToken)
  const newExpiresAt = new Date(Date.now() + (refreshed.expires_in - TOKEN_EXPIRY_SKEW_SECONDS) * 1000).toISOString()

  const { error: updateError } = await adminClient
    .from('kick_connections')
    .update({
      access_token_encrypted: encryptToken(refreshed.access_token),
      refresh_token_encrypted: encryptToken(refreshed.refresh_token),
      scopes: refreshed.scope,
      access_token_expires_at: newExpiresAt,
    })
    .eq('user_id', userId)

  if (updateError) {
    console.error('[Kick Service] Error re-persistiendo tokens refrescados:', updateError.code ?? updateError.message)
    return { error: 'No se pudo actualizar tu conexión con Kick.', code: 'invalid_response' }
  }

  return {
    accessToken: refreshed.access_token,
    connection: { ...row, access_token_encrypted: '', refresh_token_encrypted: '', scopes: refreshed.scope, access_token_expires_at: newExpiresAt },
  }
}

/**
 * Desconexión server-side: revoca en Kick (best-effort) y borra la fila con el
 * admin client. El revoke NUNCA bloquea el borrado local.
 */
export async function disconnectKickConnection(
  adminClient: SupabaseClient,
  userId: string
): Promise<{ success: true } | { error: string }> {
  // S2 (auditoría): se lee el REFRESH token para la revocación — revocar solo
  // el access dejaba la sesión renovable indefinidamente en Kick.
  const { data: connection, error } = await adminClient
    .from('kick_connections')
    .select('refresh_token_encrypted')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[Kick Service] Error leyendo la conexión para desconectar:', error.code ?? error.message)
    return { error: 'No se pudo leer tu conexión con Kick.' }
  }

  if (connection) {
    try {
      const refreshToken = decryptToken((connection as { refresh_token_encrypted: string }).refresh_token_encrypted)
      const revoked = await revokeKickToken(refreshToken)
      if (!revoked.success) {
        console.warn(`[Kick Service] Revoke no confirmado para el usuario ${userId}; se continúa con el borrado local (best-effort)`)
      }
    } catch (err) {
      console.warn('[Kick Service] No se pudo descifrar el token para revocar; se continúa con el borrado local:', err instanceof Error ? err.message : err)
    }
  }

  const { error: deleteError } = await adminClient
    .from('kick_connections')
    .delete()
    .eq('user_id', userId)

  if (deleteError) {
    console.error('[Kick Service] Error borrando la conexión:', deleteError.code ?? deleteError.message)
    return { error: 'No se pudo eliminar la conexión con Kick. Intenta de nuevo.' }
  }

  return { success: true }
}
