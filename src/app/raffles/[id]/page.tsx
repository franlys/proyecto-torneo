import { notFound } from 'next/navigation'
import { getRaffle } from '@/lib/actions/raffles'
import { createClient } from '@/lib/supabase/server'
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
  const isLoggedIn = !!user

  return (
    <RaffleDetailClient
      raffle={raffle}
      tickets={tickets}
      isLoggedIn={isLoggedIn}
    />
  )
}
