import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/kronix'
  const errorParam = searchParams.get('error')
  const errorDesc = searchParams.get('error_description')

  if (errorParam) {
    console.error('[auth/callback] Error returned from Supabase OAuth:', errorParam, errorDesc)
  }

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[auth/callback] exchangeCodeForSession failed:', error.message)
    }

    // Garantizar que el perfil existe (red de seguridad si el trigger falló)
    if (data?.user) {
      console.log('[auth/callback] Logged in user resolved:', data.user.id, data.user.email)
      const adminSupabase = await createAdminClient()
      const { data: existingProfile } = await adminSupabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!existingProfile) {
        console.log('[auth/callback] Creating new profile for user:', data.user.id)
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
        const { data: { user: fullUser }, error: userErr } = await adminSupabase.auth.admin.getUserById(data.user.id)
        if (userErr) {
          console.error('[auth/callback] Error fetching full user details:', userErr.message)
        }

        const discordIdentity = fullUser?.identities?.find((id) => id.provider === 'discord')
        console.log('[auth/callback] Discord identity lookup result:', discordIdentity)

        if (discordIdentity) {
          const idData = (discordIdentity.identity_data as any) || {}
          console.log('[auth/callback] Discord identity_data details:', idData)
          
          const discordUsername = idData.username || idData.full_name || idData.name || idData.custom_claims?.username || idData.user_name || null
          console.log('[auth/callback] Resolved discordUsername:', discordUsername)

          if (discordUsername) {
            const { error: updateErr } = await adminSupabase
              .from('profiles')
              .update({ 
                discord_username: discordUsername,
                discord_connected: true
              })
              .eq('id', data.user.id)

            if (updateErr) {
              console.error('[auth/callback] Failed to update profile discord_username:', updateErr.message)
            } else {
              console.log('[auth/callback] Profile discord_username successfully updated to:', discordUsername)
            }
          }
        }
      } catch (syncErr) {
        console.error('[auth/callback] Unexpected error syncing Discord identity:', syncErr)
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
