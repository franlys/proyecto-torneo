import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTournament } from '@/lib/actions/tournaments'
import { getSubmissions } from '@/lib/actions/submissions'
import { SubmissionsManager } from './SubmissionsManager'

export default async function SubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  const [tournamentResult, submissionsResult] = await Promise.all([
    getTournament(id),
    getSubmissions(id)
  ])

  if ('error' in tournamentResult) notFound()
  if ('error' in submissionsResult) {
    return <div className="p-8 max-w-4xl mx-auto text-red-500">Error: {submissionsResult.error}</div>
  }

  const { data: tournament } = tournamentResult
  const submissions = submissionsResult.data ?? []

  return (
    <div className="p-8 max-w-6xl mx-auto">
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
        <span className="text-white/50">Moderación de Envios</span>
      </div>

      <div className="mb-8">
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
      />
    </div>
  )
}
