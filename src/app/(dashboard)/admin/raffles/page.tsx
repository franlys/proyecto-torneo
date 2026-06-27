import { redirect } from 'next/navigation'
import { getRaffles, isSystemAdmin } from '@/lib/actions/raffles'
import { createClient } from '@/lib/supabase/server'
import { AdminRafflesClient } from './AdminRafflesClient'

export const dynamic = 'force-dynamic'

export default async function AdminRafflesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = await isSystemAdmin(user.id)
  if (!admin) {
    redirect('/tournaments')
  }

  const res = await getRaffles()
  if ('error' in res) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center max-w-md">
          <p className="text-red-400 font-medium">Error al cargar sorteos en el panel admin</p>
          <p className="text-xs text-white/40 mt-1">{res.error}</p>
        </div>
      </div>
    )
  }

  const raffles = res.data || []

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <AdminRafflesClient initialRaffles={raffles} />
    </div>
  )
}
