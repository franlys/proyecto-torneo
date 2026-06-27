import { notFound } from 'next/navigation'
import { getRaffle } from '@/lib/actions/raffles'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/actions/auth-helpers'
import { Navbar } from '@/components/navigation/Navbar'
import { RaffleDetailClient } from './RaffleDetailClient'

export const dynamic = 'force-dynamic'

interface RaffleDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function RaffleDetailPage({ params }: RaffleDetailPageProps) {
  const { id } = await params
  const res = await getRaffle(id)

  if ('error' in res || !res.data) {
    notFound()
  }

  const raffle = res.data
  const tickets = res.tickets

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await getProfile() : null
  const isLoggedIn = !!user

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white pt-28 pb-12">
      <Navbar user={user} profile={profile} />
      
      {/* Decorative gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[-10%] w-[40%] h-[40%] bg-neon-cyan/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-neon-purple/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10">
        <RaffleDetailClient
          raffle={raffle}
          tickets={tickets}
          isLoggedIn={isLoggedIn}
        />
      </div>
    </div>
  )
}
