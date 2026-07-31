import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTournament } from '@/lib/actions/tournaments'
import { getTeamsWithParticipants } from '@/lib/actions/participants'
import { ParticipantsManager } from './ParticipantsManager'

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  const [tournamentResult, participantsResult] = await Promise.all([
    getTournament(id),
    getTeamsWithParticipants(id)
  ])

  if ('error' in tournamentResult) notFound()
  if ('error' in participantsResult) {
    return <div className="p-8 max-w-4xl mx-auto text-red-500">Error: {participantsResult.error}</div>
  }

  const { data: tournament } = tournamentResult
  const { teams, participants } = participantsResult

  return (
    <div className="space-y-6 text-left">
      <div className="mb-6">
        <h1 className="font-orbitron text-2xl font-bold text-white tracking-wide mb-2">
          Gestión de Participantes
        </h1>
        <p className="text-sm text-white/40">
          Modalidad del torneo: <span className="text-white/70 font-medium capitalize">{tournament.mode}</span>
        </p>
      </div>

      <ParticipantsManager 
        tournamentId={id}
        tournamentSlug={tournament.slug}
        tournamentMode={tournament.mode} 
        tournamentDiscipline={tournament.discipline}
        tournamentStatus={tournament.status}
        initialTeams={teams} 
        initialParticipants={participants} 
      />
    </div>
  )
}
