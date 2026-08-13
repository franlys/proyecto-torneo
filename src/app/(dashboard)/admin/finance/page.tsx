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

  // 7. Fetch User Bets (Apuestas)
  const { data: userBets } = await adminSupabase
    .from('user_bets')
    .select('id, amount, odds, potential_payout, status, created_at, bet_markets(id, question, tournament_id, tournaments(id, name))')

  // 8. Fetch Subscription Requests (Membresías VIP)
  const { data: approvedSubs } = await adminSupabase
    .from('subscription_requests')
    .select('id, amount, created_at')
    .eq('status', 'APPROVED')

  // 9. Fetch Live Coin Transactions (Libro Diario Contable)
  const { data: coinTransactions } = await adminSupabase
    .from('coin_transactions')
    .select('id, user_id, amount, type, description, reference_id, created_at, profiles:user_id(username, email)')
    .order('created_at', { ascending: false })
    .limit(300)

  // 10. Calculations
  let tourneyNetRevenue = 0
  let tourneyTotalRevenue = 0
  let tourneyTotalPrizes = 0

  if (tournamentFinancials) {
    tournamentFinancials.forEach((f: any) => {
      const rev = Number(f.total_revenue || 0)
      const prizes = Number(f.total_prizes || 0)
      const remainder = Number(f.remainder || 0)
      const orgPayout = Number(f.organizer_payout || 0)
      const strPayout = Number(f.streamer_payout || 0)
      
      tourneyTotalRevenue += rev
      tourneyTotalPrizes += prizes
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

  // Bet calculations
  const totalBetVolume = (userBets || []).reduce((acc, b) => acc + Number(b.amount || 0), 0)
  const totalBetWonPayouts = (userBets || []).filter(b => b.status === 'won').reduce((acc, b) => acc + Number(b.potential_payout || 0), 0)
  const betsResolvedVolume = (userBets || []).filter(b => b.status === 'won' || b.status === 'lost').reduce((acc, b) => acc + Number(b.amount || 0), 0)
  const betsHouseNet = betsResolvedVolume - totalBetWonPayouts

  // Subscriptions total
  const totalVipRevenueUSD = (approvedSubs || []).reduce((acc, s) => acc + Number(s.amount || 0), 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <header className="text-left">
        <h1 className={`${orbitron.className} text-2xl sm:text-4xl font-black uppercase tracking-tighter mb-2`}>
          Centro de Control <span className="text-neon-cyan">Financiero</span>
        </h1>
        <p className="text-white/40 text-xs sm:text-sm">
          Monitorea todas las entradas, salidas, recaudación por torneos, apuestas, rifas y libro mayor contable en tiempo real.
        </p>
      </header>

      <FinanceClient
        tourneyNetRevenue={tourneyNetRevenue}
        tourneyTotalRevenue={tourneyTotalRevenue}
        tourneyTotalPrizes={tourneyTotalPrizes}
        raffleNetRevenue={raffleNetRevenue}
        totalCirculatingCoins={totalCirculatingCoins}
        withdrawals={withdrawals || []}
        completedDeposits={completedDeposits || []}
        tournamentFinancials={tournamentFinancials || []}
        userBets={userBets || []}
        totalBetVolume={totalBetVolume}
        totalBetWonPayouts={totalBetWonPayouts}
        betsHouseNet={betsHouseNet}
        totalVipRevenueUSD={totalVipRevenueUSD}
        coinTransactions={coinTransactions || []}
      />
    </div>
  )
}
