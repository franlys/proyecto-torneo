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

  // Load collaborative earnings
  const { data: collabEarnings } = await supabase
    .from('tournaments')
    .select(`
      id,
      name,
      entry_fee,
      organizer_split,
      streamer_split,
      created_at,
      tournament_financials (
        total_revenue,
        total_prizes,
        remainder,
        organizer_payout,
        streamer_payout
      )
    `)
    .eq('collaborator_id', profile.id)
    .eq('status', 'finished')
    .order('created_at', { ascending: false })

  const formattedCollabEarnings = (collabEarnings || []).map((t: any) => {
    const fin = Array.isArray(t.tournament_financials) ? t.tournament_financials[0] : t.tournament_financials
    return {
      id: t.id,
      name: t.name,
      revenue: Number(fin?.total_revenue || 0),
      prizes: Number(fin?.total_prizes || 0),
      remainder: Number(fin?.remainder || 0),
      payout: Number(fin?.streamer_payout || 0),
      splitRatio: `${Math.round(t.organizer_split)}/${Math.round(t.streamer_split)}`,
      createdAt: t.created_at
    }
  })

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
        colabEarnings={formattedCollabEarnings}
      />
    </div>
  )
}
