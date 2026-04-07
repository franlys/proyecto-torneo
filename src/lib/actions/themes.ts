'use server'

import { createClient } from '@/lib/supabase/server'

export async function updateTheme(
  tournamentId: string,
  themeData: {
    primary_color?: string
    background_type?: string
    background_value?: string
  }
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Auth verification
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('creator_id')
    .eq('id', tournamentId)
    .single()

  if (!tournament || tournament.creator_id !== user.id) {
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
  return { success: true }
}
