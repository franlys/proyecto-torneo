'use server'

import { createClient } from '@/lib/supabase/server'
import { isAdmin } from './auth-helpers'
import { revalidatePath } from 'next/cache'

export async function updateTheme(
  tournamentId: string,
  themeData: {
    primary_color?: string
    background_type?: string
    background_value?: string | null
    background_mobile_value?: string | null
    background_opacity?: number
    logo_url?: string | null
    preset_name?: string | null
  }
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const admin = await isAdmin()

  // Auth verification
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('creator_id, collaborator_id, slug')
    .eq('id', tournamentId)
    .single()

  if (!tournament) return { error: 'Torneo no encontrado' }

  const { checkTournamentAccess } = await import('./tournaments')
  const hasAccess = admin || await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id)
  if (!hasAccess) {
    return { error: 'Sin permisos' }
  }

  // Upsert the theme
  const { error } = await supabase
    .from('leaderboard_themes')
    .upsert(
      {
        tournament_id: tournamentId,
        ...themeData,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'tournament_id' }
    )

  if (error) return { error: error.message }

  // Invalidate cache for the public leaderboard page
  if (tournament.slug) {
    const slugLower = tournament.slug.toLowerCase()
    revalidatePath(`/t/${slugLower}`)
    revalidatePath(`/t/${tournament.slug}`)
  }

  return { success: true }
}
