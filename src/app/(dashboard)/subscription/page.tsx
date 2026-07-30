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
    .select('subscription_status, subscription_expiry')
    .eq('id', user.id)
    .single()

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
        />
      </div>
    </div>
  )
}
