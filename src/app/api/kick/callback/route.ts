import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
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

  const flowCookie = request.cookies.get(KICK_OAUTH_FLOW_COOKIE)?.value
  if (!flowCookie) {
    const fallbackPath = user ? '/profile?tab=ajustes&error=' : '/login?error='
    return NextResponse.redirect(new URL(fallbackPath + encodeURIComponent('El flujo de vinculación expiró. Inténtalo de nuevo.'), request.url))
  }

  let flow: { state: string; codeVerifier: string; returnTo?: string; redirectUrl?: string; isAuthFlow?: boolean }
  try {
    const parsed = FLOW_COOKIE_SCHEMA.safeParse(JSON.parse(flowCookie))
    if (!parsed.success) {
      throw new Error('flow cookie no cumple FLOW_COOKIE_SCHEMA')
    }
    flow = parsed.data
  } catch {
    const fallbackPath = user ? '/profile?tab=ajustes&error=' : '/login?error='
    return NextResponse.redirect(new URL(fallbackPath + encodeURIComponent('El flujo de vinculación es inválido. Inténtalo de nuevo.'), request.url))
  }

  const url = new URL(request.url)
  const origin = url.origin
  const oauthError = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (oauthError) {
    const summary = oauthError === 'access_denied' ? 'Cancelaste la autorización en Kick.' : `Kick rechazó la autorización (${oauthError}).`
    if (user) return redirectToProfile(request, { error: summary })
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(summary)}`)
  }

  if (!code) {
    const errText = 'Kick no devolvió el código de autorización. Inténtalo de nuevo.'
    if (user) return redirectToProfile(request, { error: errText })
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errText)}`)
  }

  if (!isValidOAuthState(state, flow.state)) {
    const errText = 'Error de seguridad (state inválido). El intento fue cancelado; inténtalo de nuevo.'
    if (user) return redirectToProfile(request, { error: errText })
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errText)}`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code, flow.codeVerifier, flow.redirectUrl)
    const kickUser = await fetchKickUser(tokens.access_token)
    const adminClient = await createAdminClient()

    if (user) {
      // 1. Authenticated user -> link Kick connection
      const result = await upsertKickConnection({ supabase: adminClient, userId: user.id, tokens, kickUser })
      if ('error' in result) {
        if (flow.returnTo) {
          const sep = flow.returnTo.includes('?') ? '&' : '?'
          const res = NextResponse.redirect(`${origin}${flow.returnTo}${sep}kick_error=${encodeURIComponent(result.error)}`)
          res.cookies.delete(KICK_OAUTH_FLOW_COOKIE)
          return res
        }
        return redirectToProfile(request, { error: result.error })
      }
      if (flow.returnTo) {
        const sep = flow.returnTo.includes('?') ? '&' : '?'
        const res = NextResponse.redirect(`${origin}${flow.returnTo}${sep}kick_linked=true`)
        res.cookies.delete(KICK_OAUTH_FLOW_COOKIE)
        return res
      }
      return redirectToProfile(request, { success: `Cuenta de Kick vinculada con éxito como ${kickUser.username}.` })
    } else {
      // 2. Unauthenticated user -> 1-Click Login or Signup via Kick
      const { data: existingConn } = await adminClient
        .from('kick_connections')
        .select('user_id')
        .eq('kick_user_id', kickUser.user_id)
        .maybeSingle()

      let targetUserId: string | null = null
      let targetEmail: string = kickUser.email || `kick_${kickUser.user_id}@users.kronix.do`

      if (existingConn?.user_id) {
        const foundUserId = existingConn.user_id
        targetUserId = foundUserId
        const { data: userData } = await adminClient.auth.admin.getUserById(foundUserId)
        if (userData?.user?.email) {
          targetEmail = userData.user.email
        }
      }

      // Generate login / signup magic link directly via Supabase Auth Admin
      const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: targetEmail,
        options: {
          data: {
            username: kickUser.username,
            full_name: kickUser.username,
          },
        },
      })

      if (linkErr || !linkData?.user || !linkData?.properties?.hashed_token) {
        console.error('[Kick Auth Callback] Error generando link de acceso:', linkErr?.message)
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('No se pudo autenticar con Kick: ' + (linkErr?.message || 'Token inválido'))}`)
      }

      targetUserId = linkData.user.id

      // Ensure profile exists or is updated
      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('id')
        .eq('id', targetUserId)
        .maybeSingle()

      if (!existingProfile) {
        const { count } = await adminClient.from('profiles').select('*', { count: 'exact', head: true })
        await adminClient.from('profiles').upsert({
          id: targetUserId,
          username: kickUser.username,
          email: targetEmail,
          role: (count ?? 0) === 0 ? 'ADMIN' : 'USER',
        })
      }

      // Upsert Kick connection
      await upsertKickConnection({ supabase: adminClient, userId: targetUserId, tokens, kickUser })

      const finalDestination = flow.returnTo
        ? `${origin}${flow.returnTo}${flow.returnTo.includes('?') ? '&' : '?'}kick_linked=true`
        : `${origin}/kronix`

      const res = NextResponse.redirect(finalDestination)
      const isKronixDomain = url.hostname.endsWith('kronix.do')
      res.cookies.delete(KICK_OAUTH_FLOW_COOKIE)
      if (isKronixDomain) {
        res.cookies.set(KICK_OAUTH_FLOW_COOKIE, '', { maxAge: 0, path: '/', domain: '.kronix.do' })
      }

      // Create an SSR client attached directly to the redirect response so session cookies
      // have full path='/', maxAge, httpOnly, sameSite, secure attributes on Set-Cookie headers
      const ssrClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
              cookiesToSet.forEach(({ name, value, options }) => {
                res.cookies.set(name, value, {
                  ...(options as Parameters<typeof res.cookies.set>[2]),
                  path: '/',
                  domain: isKronixDomain ? '.kronix.do' : undefined,
                })
              })
            },
          },
        }
      )

      const otpType = (linkData.properties.verification_type as any) || 'signup'
      const { data: sessionData, error: verifyErr } = await ssrClient.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: otpType,
      })

      if (verifyErr || !sessionData?.session) {
        console.error('[Kick Auth Callback] verifyOtp failed on server:', verifyErr?.message)
        if (linkData.properties.action_link) {
          const fallbackRes = NextResponse.redirect(linkData.properties.action_link)
          fallbackRes.cookies.delete(KICK_OAUTH_FLOW_COOKIE)
          if (isKronixDomain) {
            fallbackRes.cookies.set(KICK_OAUTH_FLOW_COOKIE, '', { maxAge: 0, path: '/', domain: '.kronix.do' })
          }
          return fallbackRes
        }
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Error al establecer sesión con Kick: ' + (verifyErr?.message || 'Sesión no generada'))}`)
      }

      return res
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[Kick Callback] Fallo en el intercambio/persistencia:', errorMsg)
    if (user) return redirectToProfile(request, { error: 'No se pudo completar la vinculación con Kick: ' + errorMsg })
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('No se pudo completar el acceso con Kick: ' + errorMsg)}`)
  }
}
