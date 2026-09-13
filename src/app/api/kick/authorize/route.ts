import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildAuthorizeUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
  getKickConfig,
  KICK_OAUTH_FLOW_COOKIE,
  KICK_OAUTH_FLOW_MAX_AGE,
} from '@/lib/services/kick'

/**
 * GET /api/kick/authorize — inicia el flujo OAuth 2.1 + PKCE con Kick.
 *
 * 1. Exige sesión Supabase (user_id SIEMPRE de la sesión, nunca de query params).
 * 2. Genera code_verifier (PKCE), code_challenge (S256) y state (anti-CSRF).
 * 3. Guarda { state, codeVerifier } en cookie httpOnly + secure (10 min).
 * 4. 302 a https://id.kick.com/oauth/authorize con scope=user:read.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let config: ReturnType<typeof getKickConfig>
  try {
    config = getKickConfig()
  } catch (err) {
    console.error('[Kick Authorize] Configuración faltante:', err instanceof Error ? err.message : err)
    const targetPath = user ? '/profile?tab=ajustes&error=' : '/login?error='
    return NextResponse.redirect(new URL(targetPath + encodeURIComponent('La integración con Kick no está configurada en este entorno.'), request.url))
  }

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const state = generateOAuthState()

  const origin = new URL(request.url).origin
  const redirectUrl = `${origin}/api/kick/callback`

  const authorizeUrl = buildAuthorizeUrl({
    clientId: config.clientId,
    redirectUrl,
    state,
    codeChallenge,
  })

  const returnTo = new URL(request.url).searchParams.get('returnTo')

  const response = NextResponse.redirect(authorizeUrl)
  response.cookies.set(
    KICK_OAUTH_FLOW_COOKIE,
    JSON.stringify({ state, codeVerifier, redirectUrl, isAuthFlow: !user, returnTo: returnTo || null }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: KICK_OAUTH_FLOW_MAX_AGE,
      path: '/',
    }
  )
  return response
}
