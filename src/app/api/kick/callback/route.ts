import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import {
  exchangeCodeForTokens,
  fetchKickUser,
  isValidOAuthState,
  upsertKickConnection,
  FLOW_COOKIE_SCHEMA,
  KICK_OAUTH_FLOW_COOKIE,
} from '@/lib/services/kick'

function redirectToProfile(request: NextRequest, params: { error?: string; success?: string }): NextResponse {
  const url = new URL('/profile', request.url)
  url.searchParams.set('tab', 'ajustes')
  if (params.error) url.searchParams.set('error', params.error)
  if (params.success) url.searchParams.set('success', params.success)
  const response = NextResponse.redirect(url)
  response.cookies.delete(KICK_OAUTH_FLOW_COOKIE)
  return response
}

/**
 * GET /api/kick/callback — Kick redirige aquí tras el consentimiento.
 *
 * 1. user_id SIEMPRE de la sesión Supabase (nunca de query params).
 * 2. Valida `state` (timing-safe) contra la cookie httpOnly del flujo.
 *    El contenido de la cookie pasa OBLIGATORIAMENTE por
 *    FLOW_COOKIE_SCHEMA.safeParse (S3 de la auditoría): JSON.parse con `as`
 *    jamás sustituye a la validación runtime. Si la validación falla, el
 *    flujo se rechaza de forma segura.
 * 3. Intercambia `code` por tokens con el code_verifier (PKCE, server-side).
 * 4. Obtiene la identidad verificada (GET /public/v1/users).
 * 5. Upsert cifrado (AES-256-GCM) con el admin client.
 * 6. Redirige al perfil con feedback (success/error).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirectToProfile(request, { error: 'Sesión expirada: inicia sesión y vuelve a intentar vincular tu cuenta de Kick.' })
  }

  const flowCookie = request.cookies.get(KICK_OAUTH_FLOW_COOKIE)?.value
  if (!flowCookie) {
    return redirectToProfile(request, { error: 'El flujo de vinculación expiró. Inténtalo de nuevo.' })
  }

  let flow: { state: string; codeVerifier: string; returnTo?: string }
  try {
    const parsed = FLOW_COOKIE_SCHEMA.safeParse(JSON.parse(flowCookie))
    if (!parsed.success) {
      throw new Error('flow cookie no cumple FLOW_COOKIE_SCHEMA')
    }
    flow = parsed.data
  } catch {
    return redirectToProfile(request, { error: 'El flujo de vinculación es inválido. Inténtalo de nuevo.' })
  }

  const url = new URL(request.url)
  const oauthError = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (oauthError) {
    const summary = oauthError === 'access_denied' ? 'Cancelaste la autorización en Kick.' : `Kick rechazó la autorización (${oauthError}).`
    return redirectToProfile(request, { error: summary })
  }

  if (!code) {
    return redirectToProfile(request, { error: 'Kick no devolvió el código de autorización. Inténtalo de nuevo.' })
  }

  if (!isValidOAuthState(state, flow.state)) {
    return redirectToProfile(request, { error: 'Error de seguridad (state inválido). El intento fue cancelado; inténtalo de nuevo.' })
  }

  try {
    const tokens = await exchangeCodeForTokens(code, flow.codeVerifier)
    const kickUser = await fetchKickUser(tokens.access_token)

    const adminClient = await createAdminClient()
    const result = await upsertKickConnection({ supabase: adminClient, userId: user.id, tokens, kickUser })

    if ('error' in result) {
      return redirectToProfile(request, { error: result.error })
    }

    return redirectToProfile(request, { success: `Cuenta de Kick vinculada con éxito como ${kickUser.username}.` })
  } catch (err) {
    // Mensaje genérico al cliente; detalle solo en logs de servidor.
    console.error('[Kick Callback] Fallo en el intercambio/persistencia:', err instanceof Error ? `${err.name}: ${err.message}` : err)
    return redirectToProfile(request, { error: 'No se pudo completar la vinculación con Kick. Inténtalo de nuevo.' })
  }
}
