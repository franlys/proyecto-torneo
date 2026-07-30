import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WalletClient } from './WalletClient'
import { Orbitron } from 'next/font/google'

const orbitron = Orbitron({ subsets: ['latin'] })

export const dynamic = 'force-dynamic'

export default async function WalletPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const adminSupabase = await createAdminClient()

  // 1. Fetch user's current profile balance
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('balance')
    .eq('id', user.id)
    .single()

  const balance = profile?.balance ? parseFloat(profile.balance as any) : 0.00

  // 2. Fetch deposits history
  const { data: deposits } = await adminSupabase
    .from('deposits')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // 3. Fetch coin transactions history
  const { data: transactions } = await adminSupabase
    .from('coin_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="text-left">
        <h1 className={`${orbitron.className} text-4xl font-black uppercase tracking-tighter mb-2`}>
          Billetera <span className="text-neon-cyan">Virtual</span>
        </h1>
        <p className="text-white/40 text-lg">
          Recarga saldo de forma automática mediante PayPal y consulta tu historial de transacciones.
        </p>
      </header>

      <WalletClient
        initialBalance={balance}
        deposits={deposits || []}
        transactions={transactions || []}
      />
    </div>
  )
}
