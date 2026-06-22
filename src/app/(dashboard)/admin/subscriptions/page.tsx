import { createClient } from '@/lib/supabase/server'
import { Orbitron } from 'next/font/google'
import { SubscriptionsClient } from './SubscriptionsClient'

const orbitron = Orbitron({ subsets: ['latin'] })

export default async function AdminSubscriptionsPage() {
  const supabase = await createClient()
  
  const { data: requests } = await supabase
    .from('subscription_requests')
    .select(`
      *,
      profiles:user_id (
        username,
        role
      )
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-12">
      <header>
        <h1 className={`${orbitron.className} text-4xl font-black uppercase tracking-tighter mb-2`}>
          Gestión de <span className="text-neon-cyan">Suscripciones</span>
        </h1>
        <p className="text-white/40 text-lg">Valida los pagos manuales de $15 para habilitar a los streamers.</p>
      </header>

      <SubscriptionsClient requests={requests || []} />
    </div>
  )
}
