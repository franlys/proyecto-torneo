import { getTournament } from '@/lib/actions/tournaments'
import { getTournamentMatches } from '@/lib/actions/matches'
import { MatchesManager } from './MatchesManager'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function MatchesPage({ params }: { params: { id: string } }) {
  const tRes = await getTournament(params.id)
  if ('error' in tRes) redirect('/tournaments')

  const mRes = await getTournamentMatches(params.id)
  if ('error' in mRes) {
    return (
      <div className="p-8 text-center bg-dark-card border border-red-500/20 rounded-2xl">
        <p className="text-red-400">Error al cargar las partidas: {mRes.error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-orbitron font-black text-white uppercase tracking-tighter">
            Gestión de Partidas
          </h1>
          <p className="text-white/40 text-sm mt-1">Configura los nombres de rondas y mapas para {tRes.data.name}</p>
        </div>
        <Link 
          href={`/tournaments/${params.id}`}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-all text-sm border border-white/5"
        >
          ← Volver al Torneo
        </Link>
      </div>

      <MatchesManager 
        tournamentId={params.id}
        initialMatches={mRes.data}
      />
    </div>
  )
}
