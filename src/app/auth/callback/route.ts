import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/kronix'

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // Garantizar que el perfil existe (red de seguridad si el trigger falló)
    if (data.user) {
      const adminSupabase = await createAdminClient()
      const { data: existingProfile } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!existingProfile) {
        const { count } = await adminSupabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })

        const metaUsername = data.user.user_metadata?.username || null
        const userEmail = data.user.email || null

        await adminSupabase.from('profiles').insert({
          id: data.user.id,
          username: metaUsername,
          email: userEmail,
          role: (count ?? 0) === 0 ? 'ADMIN' : 'USER',
        })
      }

      // Sync Discord username if logged in via Discord or connected it
      try {
        const { data: discordIdentity } = await adminSupabase
          .schema('auth')
          .from('identities')
          .select('provider_id, identity_data')
          .eq('user_id', data.user.id)
          .eq('provider', 'discord')
          .maybeSingle()

        if (discordIdentity) {
          const idData = (discordIdentity.identity_data as any) || {}
          const discordUsername = idData.custom_claims?.username || idData.user_name || idData.name || null
          if (discordUsername) {
            await adminSupabase
              .from('profiles')
              .update({ discord_username: discordUsername })
              .eq('id', data.user.id)
          }
        }
      } catch (syncErr) {
        console.error('Error syncing Discord identity inside auth callback:', syncErr)
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
