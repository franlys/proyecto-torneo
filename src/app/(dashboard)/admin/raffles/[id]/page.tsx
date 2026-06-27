import { notFound, redirect } from 'next/navigation'
import { getRaffle, isSystemAdmin } from '@/lib/actions/raffles'
import { createClient } from '@/lib/supabase/server'
import { RaffleAdminClient } from './RaffleAdminClient'

export const dynamic = 'force-dynamic'

interface AdminRaffleDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AdminRaffleDetailPage({ params }: AdminRaffleDetailPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = await isSystemAdmin(user.id)
  if (!admin) {
    redirect('/tournaments')
  }

  const { id } = await params
  const res = await getRaffle(id)

  if ('error' in res || !res.data) {
    notFound()
  }

  const raffle = res.data
  const tickets = res.tickets

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <RaffleAdminClient raffle={raffle} tickets={tickets} />
    </div>
  )
}
