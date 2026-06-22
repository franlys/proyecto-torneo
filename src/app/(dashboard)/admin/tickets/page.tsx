import { getProfile, isAdmin } from '@/lib/actions/auth-helpers'
import { getTickets } from '@/lib/actions/support-tickets'
import { AdminTicketsClient } from './AdminTicketsClient'
import { Orbitron } from 'next/font/google'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const orbitron = Orbitron({ subsets: ['latin'] })

export default async function AdminTicketsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  // Only SUPER_ADMIN, ADMIN, or KRONIX_STAFF can access this global ticket manager
  if (
    profile.role !== 'SUPER_ADMIN' &&
    profile.role !== 'ADMIN' &&
    profile.role !== 'KRONIX_STAFF'
  ) {
    redirect('/tournaments')
  }

  // Fetch tickets (this will fetch all because the user has an admin role)
  const ticketsResult = await getTickets()
  const tickets = 'error' in ticketsResult ? [] : ticketsResult

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header>
        <h1 className={`${orbitron.className} text-4xl font-black uppercase tracking-tighter mb-2`}>
          Buzón Global de <span className="text-neon-cyan">Tickets</span>
        </h1>
        <p className="text-white/40 text-lg">
          Atiende y resuelve las solicitudes de soporte de los streamers de la plataforma.
        </p>
      </header>

      <AdminTicketsClient initialTickets={tickets} />
    </div>
  )
}
