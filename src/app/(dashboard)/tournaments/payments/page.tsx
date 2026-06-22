import { getProfile } from '@/lib/actions/auth-helpers'
import { PaymentsClient } from './PaymentsClient'
import { Orbitron } from 'next/font/google'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const orbitron = Orbitron({ subsets: ['latin'] })

export default async function PaymentsConfigurationPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  // Only streamers, admins, or federation can edit these portal settings
  if (
    profile.role !== 'STREAMER' &&
    profile.role !== 'SUPER_ADMIN' &&
    profile.role !== 'ADMIN'
  ) {
    redirect('/tournaments')
  }

  // Load current values
  // Since we already retrieved the profile, let's fetch any additional organization fields we need.
  // Actually, we can fetch directly from profiles.
  const supabase = await import('@/lib/supabase/server').then(m => m.createClient())
  const { data: dbProfile } = await supabase
    .from('profiles')
    .select('organization_name, payment_details, discord_link, whatsapp_link')
    .eq('id', profile.id)
    .single()

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header>
        <h1 className={`${orbitron.className} text-4xl font-black uppercase tracking-tighter mb-2`}>
          Métodos de <span className="text-neon-cyan">Pago y Redes</span>
        </h1>
        <p className="text-white/40 text-lg">
          Configura tus instrucciones de cobro y enlaces para tus torneos.
        </p>
      </header>

      <PaymentsClient
        initialOrgName={dbProfile?.organization_name || ''}
        initialPaymentDetails={dbProfile?.payment_details || ''}
        initialDiscordLink={dbProfile?.discord_link || ''}
        initialWhatsappLink={dbProfile?.whatsapp_link || ''}
      />
    </div>
  )
}
