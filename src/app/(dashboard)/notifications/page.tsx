import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getMyNotificationsAction } from '@/lib/actions/notifications'
import { NotificationsClient } from './NotificationsClient'
import { Orbitron } from 'next/font/google'

const orbitron = Orbitron({ subsets: ['latin'] })

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const res = await getMyNotificationsAction()
  const notifications = res.success ? (res.data || []) : []

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <header className="text-left">
        <h1 className={`${orbitron.className} text-4xl font-black uppercase tracking-tighter mb-2`}>
          Centro de <span className="text-neon-cyan">Alertas</span>
        </h1>
        <p className="text-white/40 text-lg">
          Entérate de las actividades de tus torneos, emparejamientos y premios al instante.
        </p>
      </header>

      <NotificationsClient initialNotifications={notifications} />
    </div>
  )
}
