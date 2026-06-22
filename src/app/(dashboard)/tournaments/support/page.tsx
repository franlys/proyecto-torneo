import { getProfile } from '@/lib/actions/auth-helpers'
import { getTickets } from '@/lib/actions/support-tickets'
import { SupportPortalClient } from './SupportPortalClient'
import { Orbitron } from 'next/font/google'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const orbitron = Orbitron({ subsets: ['latin'] })

export default async function SupportTicketsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  // Only streamers, admins, or federation can open support tickets
  if (
    profile.role !== 'STREAMER' &&
    profile.role !== 'SUPER_ADMIN' &&
    profile.role !== 'ADMIN'
  ) {
    redirect('/tournaments')
  }

  // Fetch tickets
  const ticketsResult = await getTickets()
  const tickets = 'error' in ticketsResult ? [] : ticketsResult

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header>
        <h1 className={`${orbitron.className} text-4xl font-black uppercase tracking-tighter mb-2`}>
          Soporte <span className="text-neon-cyan">Kronix</span>
        </h1>
        <p className="text-white/40 text-lg">
          ¿Tienes problemas o dudas con la plataforma? Abre un ticket de soporte directo con nuestro equipo.
        </p>
      </header>

      <SupportPortalClient initialTickets={tickets} />
    </div>
  )
}
