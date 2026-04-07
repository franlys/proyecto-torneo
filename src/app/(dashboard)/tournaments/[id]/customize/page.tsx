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
    <div className="p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-white/30 mb-8">
        <Link href="/tournaments" className="hover:text-white/60 transition-colors">
          Mis Torneos
        </Link>
        <span>/</span>
        <Link href={`/tournaments/${id}`} className="hover:text-white/60 transition-colors truncate max-w-[200px]">
          {tournament.name}
        </Link>
        <span>/</span>
        <span className="text-white/50">Personalizar Tema</span>
      </div>

      <div className="mb-8">
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
