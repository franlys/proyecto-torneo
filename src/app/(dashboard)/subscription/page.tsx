import SubscriptionClient from './SubscriptionClient'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Membresía VIP | Kronix',
  description: 'Adquiere tu pase VIP y obtén beneficios exclusivos.',
}

export default async function SubscriptionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin')
  }

  // Get current status
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_expiry, role, balance')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'USER') {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <div className="max-w-md w-full bg-dark-card border border-white/5 rounded-3xl p-8 text-center space-y-6 shadow-xl">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full mx-auto flex items-center justify-center border border-yellow-500/30">
            <span className="text-2xl">👑</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white font-orbitron uppercase tracking-widest">Membresía VIP Exclusiva</h1>
            <p className="text-sm text-white/60 leading-relaxed">
              La Membresía VIP de Kronix está reservada únicamente para cuentas de **Streamers y Organizadores** de torneos.
            </p>
            <p className="text-xs text-white/40 leading-relaxed">
              Los usuarios estándar no requieren VIP, ya que los beneficios están diseñados para ampliar los límites de colaboradores (staff), personalización de sponsors y herramientas avanzadas de organización.
            </p>
          </div>
          <div className="border-t border-white/5 pt-6">
            <p className="text-xs text-yellow-500/80 font-semibold mb-3">
              ¿Quieres organizar tus propios torneos?
            </p>
            <a
              href="/support"
              className="w-full py-3 bg-[#009cde] hover:bg-[#007fb5] text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-colors block text-center"
            >
              Contactar Soporte para ser Streamer
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white font-orbitron uppercase tracking-widest flex items-center gap-3">
            <span className="text-[#009cde]">Membresía</span> VIP
          </h1>
          <p className="text-white/60 mt-2 text-sm md:text-base max-w-2xl">
            Sube de nivel tu experiencia en Kronix. Obtén beneficios exclusivos, destaca en la plataforma y accede a torneos cerrados.
          </p>
        </div>

        <SubscriptionClient 
          initialStatus={profile?.subscription_status || 'NONE'}
          initialExpiry={profile?.subscription_expiry}
          role={profile?.role}
          initialBalance={parseFloat(profile?.balance || '0.00')}
        />
      </div>
    </div>
  )
}
