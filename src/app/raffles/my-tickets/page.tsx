import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/actions/auth-helpers'
import { Navbar } from '@/components/navigation/Navbar'
import { HomeTracker } from '@/components/analytics/HomeTracker'
import { MyTicketsClient } from './MyTicketsClient'

export const dynamic = 'force-dynamic'

export default async function MyTicketsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await getProfile() : null

  let initialTickets: any[] = []
  if (user) {
    const { data: userTickets } = await supabase
      .from('tickets')
      .select('*, raffles!inner(title, draw_date)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (userTickets) {
      initialTickets = userTickets
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-neon-cyan/30 pb-20">
      <HomeTracker path="/raffles/my-tickets" />
      <Navbar user={user} profile={profile} />
      <main className="max-w-4xl mx-auto px-6 sm:px-8 pt-32 space-y-8">
        <MyTicketsClient isLoggedIn={!!user} initialTickets={initialTickets} />
      </main>
    </div>
  )
}
