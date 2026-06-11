import { getPlatformAnalytics } from '@/lib/actions/analytics'
import { isAdmin } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'
import { AnalyticsClient } from './AnalyticsClient'

export default async function AdminAnalyticsPage() {
  const admin = await isAdmin()
  if (!admin) redirect('/tournaments')

  const res = await getPlatformAnalytics()
  
  if ('error' in res) {
    return (
      <div className="p-8 text-center bg-red-500/10 border border-red-500/20 rounded-2xl max-w-lg mx-auto">
        <h2 className="text-red-400 font-bold text-lg">Error al cargar analíticas</h2>
        <p className="text-white/60 text-sm mt-2">{res.error}</p>
      </div>
    )
  }

  return <AnalyticsClient data={res.data} />
}
