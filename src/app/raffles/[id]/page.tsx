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
    <div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-neon-cyan/30 pb-20">
      <Navbar user={user} profile={profile} />
      <main className="max-w-5xl mx-auto pt-32 px-4 sm:px-8">
        <RaffleDetailClient
          raffle={raffle}
          tickets={tickets}
          isLoggedIn={isLoggedIn}
        />
      </main>
    </div>
  )
}
