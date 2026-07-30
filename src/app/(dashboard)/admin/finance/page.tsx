import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FinanceClient } from './FinanceClient'
import { Orbitron } from 'next/font/google'

const orbitron = Orbitron({ subsets: ['latin'] })

export const dynamic = 'force-dynamic'

export default async function AdminFinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 1. Verify user is ADMIN or SUPER_ADMIN
  const adminSupabase = await createAdminClient()
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN')) {
    redirect('/profile')
  }

  // 2. Fetch Tournament Financials
  const { data: tournamentFinancials } = await adminSupabase
    .from('tournament_financials')
    .select('*, tournaments(name)')

  // 3. Fetch Raffle Tickets sold
  const { data: tickets } = await adminSupabase
    .from('tickets')
    .select('discount_amount, raffles(ticket_price, title)')
    .eq('payment_status', 'verified')

  // 4. Fetch Total Coins in circulation
  const { data: profiles } = await adminSupabase
    .from('profiles')
    .select('balance')

  // 5. Fetch Payouts/Withdrawals History
  const { data: withdrawals } = await adminSupabase
    .from('withdrawals')
    .select('*, profiles(username, email)')
    .order('created_at', { ascending: false })

  // 6. Fetch monthly completed deposits for graph
  const { data: completedDeposits } = await adminSupabase
    .from('deposits')
    .select('amount, created_at')
    .eq('status', 'completed')

  // 7. Calculate calculations
  let tourneyNetRevenue = 0
  if (tournamentFinancials) {
    tournamentFinancials.forEach((f: any) => {
      const remainder = Number(f.remainder || 0)
      const orgPayout = Number(f.organizer_payout || 0)
      const strPayout = Number(f.streamer_payout || 0)
      tourneyNetRevenue += (remainder - orgPayout - strPayout)
    })
  }

  let raffleNetRevenue = 0
  if (tickets) {
    tickets.forEach((t: any) => {
      const price = Number(t.raffles?.ticket_price || 0)
      const discount = Number(t.discount_amount || 0)
      raffleNetRevenue += (price - discount)
    })
  }

  const totalCirculatingCoins = profiles
    ? profiles.reduce((sum: number, p: any) => sum + parseFloat(p.balance || '0.00'), 0)
    : 0

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="text-left">
        <h1 className={`${orbitron.className} text-4xl font-black uppercase tracking-tighter mb-2`}>
          Auditoría <span className="text-neon-cyan">Financiera</span>
        </h1>
        <p className="text-white/40 text-lg">
          Supervisa ingresos, moneda en circulación y retiros de PayPal Payouts de la plataforma.
        </p>
      </header>

      <FinanceClient
        tourneyNetRevenue={tourneyNetRevenue}
        raffleNetRevenue={raffleNetRevenue}
        totalCirculatingCoins={totalCirculatingCoins}
        withdrawals={withdrawals || []}
        completedDeposits={completedDeposits || []}
        tournamentFinancials={tournamentFinancials || []}
      />
    </div>
  )
}
