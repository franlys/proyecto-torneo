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
    <div className="space-y-6 text-left">
      <div className="mb-6">
        <h1 className="text-2xl font-orbitron font-black text-white uppercase tracking-tighter">
          Gestión de Partidas
        </h1>
        <p className="text-white/40 text-sm mt-1">Configura los nombres de rondas y mapas para {tRes.data.name}</p>
      </div>

      <MatchesManager 
        tournamentId={params.id}
        initialMatches={mRes.data}
      />
    </div>
  )
}
