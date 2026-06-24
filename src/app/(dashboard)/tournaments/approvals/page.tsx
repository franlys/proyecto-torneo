import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/actions/auth-helpers'
import { getTournaments } from '@/lib/actions/tournaments'
import { ApprovalsClient } from './ApprovalsClient'
import { AdminErrorCard } from '@/components/ui/AdminErrorCard'
import type { Tournament } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ApprovalsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  // Solo creadores/streamers/admins tienen acceso a este panel
  const isAuthorized = profile.role !== 'USER'

  if (!isAuthorized) {
    redirect('/tournaments')
  }

  try {
    const result = await getTournaments()
    if ('error' in result) {
      throw new Error(result.error)
    }

    const tournaments: Tournament[] = JSON.parse(JSON.stringify(result.data))

    // Filtrar para mostrar solo los torneos que el streamer puede administrar (activos o pendientes)
    // donde el estado no sea 'finished'
    const activeAndPending = tournaments.filter(t => t.status !== 'finished')

    return (
      <div className="p-4 sm:p-8 max-w-5xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="font-orbitron text-xl sm:text-2xl font-bold text-white tracking-wide mb-2 flex items-center gap-2">
            <span>📥</span> Solicitudes y Pagos
          </h1>
          <p className="text-white/30 text-xs sm:text-sm">
            Gestiona inscripciones y validaciones de transferencias de todos tus torneos.
          </p>
        </div>

        <ApprovalsClient initialTournaments={activeAndPending} />
      </div>
    )
  } catch (err: any) {
    return (
      <div className="p-4 sm:p-8">
        <AdminErrorCard section="Aprobaciones" error={err?.message || String(err)} />
      </div>
    )
  }
}
