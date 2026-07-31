import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ThemeEditor } from './ThemeEditor'

export default async function CustomizePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch the tournament
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('*, leaderboard_themes(*)')
    .eq('id', id)
    .single()

  if (tErr || !tournament) notFound()

  const theme = Array.isArray(tournament.leaderboard_themes)
    ? tournament.leaderboard_themes[0]
    : tournament.leaderboard_themes

  return (
    <div className="space-y-6 text-left">
      <div className="mb-6">
        <h1 className="font-orbitron text-2xl font-bold text-white tracking-wide mb-2">
          Personalización Visual
        </h1>
        <p className="text-sm text-white/40">
          Personaliza los colores y el estilo general del Leaderboard público para tu audiencia.
        </p>
      </div>

      <ThemeEditor tournamentId={id} initialTheme={theme} slug={tournament.slug} />
    </div>
  )
}
