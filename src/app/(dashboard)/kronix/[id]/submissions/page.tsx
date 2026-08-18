import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTournament } from '@/lib/actions/tournaments'
import { getSubmissions } from '@/lib/actions/submissions'
import { getTeamsWithParticipants } from '@/lib/actions/participants'
import { SubmissionsManager } from './SubmissionsManager'

export default async function SubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  const [tournamentResult, submissionsResult, teamsResult] = await Promise.all([
    getTournament(id),
    getSubmissions(id),
    getTeamsWithParticipants(id)
  ])

  if ('error' in tournamentResult) notFound()
  if ('error' in submissionsResult) {
    return <div className="p-8 max-w-4xl mx-auto text-red-500">Error: {submissionsResult.error}</div>
  }

  const { data: tournament } = tournamentResult
  const submissions = submissionsResult.data ?? []
  const teams = 'error' in teamsResult ? [] : (teamsResult.teams ?? [])

  return (
    <div className="space-y-6 text-left">
      <div className="mb-6">
        <h1 className="font-orbitron text-2xl font-bold text-white tracking-wide mb-2">
          Moderación de Submissions
        </h1>
        <p className="text-sm text-white/40">
          Revisa y aprueba las puntuaciones enviadas por los participantes.
        </p>
      </div>

      <SubmissionsManager 
        tournamentId={id} 
        initialSubmissions={submissions as any} 
        allTeams={teams as any}
      />
    </div>
  )
}
