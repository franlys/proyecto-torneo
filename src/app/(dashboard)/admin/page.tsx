import { createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SendRemindersButton } from './SendRemindersButton'

export default async function AdminPage() {
  const admin = await isAdmin()
  if (!admin) redirect('/tournaments')

  const supabase = await createAdminClient()

  const [
    { count: totalUsers },
    { count: totalTournaments },
    { count: pendingRequests },
    { data: recentUsers },
    { data: allTournaments },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }),
    supabase.from('subscription_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
    supabase
      .from('profiles')
      .select('id, username, role, subscription_status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('tournaments')
      .select('id, name, status, creator_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Panel de Administración</h1>
        <p className="text-white/40 text-sm mt-1">Vista global de la plataforma Kronix</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-widest">Usuarios registrados</p>
          <p className="text-3xl font-bold text-white mt-2">{totalUsers ?? 0}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-widest">Torneos totales</p>
          <p className="text-3xl font-bold text-neon-cyan mt-2">{totalTournaments ?? 0}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-widest">Solicitudes pendientes</p>
          <p className={`text-3xl font-bold mt-2 ${(pendingRequests ?? 0) > 0 ? 'text-yellow-400' : 'text-white'}`}>
            {pendingRequests ?? 0}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 items-center">
        <Link
          href="/admin/users"
          className="px-4 py-2 bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan text-sm rounded-lg hover:bg-neon-cyan/20 transition-colors"
        >
          Gestionar usuarios
        </Link>
        <Link
          href="/admin/subscriptions"
          className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm rounded-lg hover:bg-yellow-500/20 transition-colors"
        >
          Ver solicitudes pendientes
        </Link>
        <SendRemindersButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-white font-semibold text-sm">Usuarios recientes</h2>
            <Link href="/admin/users" className="text-neon-cyan text-xs hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-white/5">
            {(recentUsers ?? []).map((u) => (
              <div key={u.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm">{u.username ?? <span className="text-white/30 italic">Sin username</span>}</p>
                  <p className="text-white/30 text-xs mt-0.5">{new Date(u.created_at).toLocaleDateString('es')}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  u.role === 'ADMIN'
                    ? 'border-neon-cyan/30 text-neon-cyan bg-neon-cyan/10'
                    : u.subscription_status === 'ACTIVE'
                    ? 'border-green-500/30 text-green-400 bg-green-500/10'
                    : 'border-white/10 text-white/40'
                }`}>
                  {u.role === 'ADMIN' ? 'ADMIN' : u.subscription_status === 'ACTIVE' ? 'ACTIVO' : 'FREE'}
                </span>
              </div>
            ))}
            {(recentUsers ?? []).length === 0 && (
              <p className="px-5 py-6 text-white/30 text-sm text-center">Sin usuarios</p>
            )}
          </div>
        </div>

        {/* Recent Tournaments */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="text-white font-semibold text-sm">Todos los torneos</h2>
          </div>
          <div className="divide-y divide-white/5">
            {(allTournaments ?? []).map((t) => (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <Link href={`/tournaments/${t.id}`} className="text-white text-sm hover:text-neon-cyan transition-colors">
                    {t.name}
                  </Link>
                  <p className="text-white/30 text-xs mt-0.5">{new Date(t.created_at).toLocaleDateString('es')}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  t.status === 'active'
                    ? 'border-green-500/30 text-green-400 bg-green-500/10'
                    : t.status === 'finished'
                    ? 'border-white/10 text-white/30'
                    : 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'
                }`}>
                  {t.status === 'active' ? 'EN VIVO' : t.status === 'finished' ? 'FINALIZADO' : 'DRAFT'}
                </span>
              </div>
            ))}
            {(allTournaments ?? []).length === 0 && (
              <p className="px-5 py-6 text-white/30 text-sm text-center">Sin torneos</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
