import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { disconnectKickConnection } from '@/lib/services/kick'

/**
 * POST /api/kick/disconnect — desvincula la cuenta de Kick del usuario.
 *
 * 1. Verifica sesión Supabase.
 * 2. Descifra el REFRESH token (admin client) y lo revoca en Kick
 *    (best-effort: si Kick falla, se loguea pero NO se bloquea el borrado
 *    local). S2 de la auditoría: revocar el refresh invalida la familia
 *    completa de tokens; revocar solo el access dejaba la sesión renovable.
 * 3. Borra la fila con el admin client (nunca desde el navegador).
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  try {
    const adminClient = await createAdminClient()
    const result = await disconnectKickConnection(adminClient, user.id)

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Kick Disconnect] Error inesperado:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'No se pudo desvincular tu cuenta de Kick. Intenta de nuevo.' }, { status: 500 })
  }
}
