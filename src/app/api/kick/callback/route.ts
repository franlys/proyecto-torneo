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
        return redirectToProfile(request, { error: result.error })
      }
      return redirectToProfile(request, { success: `Cuenta de Kick vinculada con éxito como ${kickUser.username}.` })
    } else {
      // 2. Unauthenticated user -> 1-Click Login or Signup via Kick
      let targetUserId: string | null = null
      let targetEmail: string | null = kickUser.email || null

      // Check existing connection in DB
      const { data: existingConn } = await adminClient
        .from('kick_connections')
        .select('user_id')
        .eq('kick_user_id', String(kickUser.id))
        .maybeSingle()

      if (existingConn?.user_id) {
        targetUserId = existingConn.user_id
        const { data: uData } = await adminClient.auth.admin.getUserById(targetUserId as string)
        if (uData?.user?.email) {
          targetEmail = uData.user.email
        }
      }

      if (!targetUserId) {
        if (!targetEmail) {
          targetEmail = `kick_${kickUser.id}@users.kronix.do`
        }

        // Check if user exists by email
        const { data: existingUsers } = await adminClient.auth.admin.listUsers()
        const foundUser = existingUsers?.users?.find((u) => u.email?.toLowerCase() === targetEmail?.toLowerCase())

        if (foundUser) {
          targetUserId = foundUser.id
        } else {
          // Create new user in Supabase
          const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
            email: targetEmail,
            email_confirm: true,
            user_metadata: {
              username: kickUser.username,
              full_name: kickUser.username,
            },
          })

          if (createErr || !newUser?.user) {
            console.error('[Kick Auth Callback] Error creando usuario:', createErr?.message)
            return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('No se pudo crear la cuenta mediante Kick.')}`)
          }

          targetUserId = newUser.user.id

          const { count } = await adminClient.from('profiles').select('*', { count: 'exact', head: true })
          await adminClient.from('profiles').insert({
            id: targetUserId,
            username: kickUser.username,
            email: targetEmail,
            role: (count ?? 0) === 0 ? 'ADMIN' : 'USER',
          })
        }
      }

      // Upsert Kick connection
      await upsertKickConnection({ supabase: adminClient, userId: targetUserId, tokens, kickUser })

      // Sign in user via magic link
      if (targetEmail) {
        const { data: linkData } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: targetEmail,
          options: {
            redirectTo: `${origin}/kronix`,
          },
        })

        if (linkData?.properties?.action_link) {
          const res = NextResponse.redirect(linkData.properties.action_link)
          res.cookies.delete(KICK_OAUTH_FLOW_COOKIE)
          return res
        }
      }

      return NextResponse.redirect(`${origin}/kronix`)
    }
  } catch (err) {
    console.error('[Kick Callback] Fallo en el intercambio/persistencia:', err instanceof Error ? `${err.name}: ${err.message}` : err)
    if (user) return redirectToProfile(request, { error: 'No se pudo completar la vinculación con Kick. Inténtalo de nuevo.' })
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('No se pudo completar el acceso con Kick. Inténtalo de nuevo.')}`)
  }
}
