import { createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { RoleSelect } from './RoleSelect'

export default async function AdminUsersPage() {
  const admin = await isAdmin()
  if (!admin) redirect('/tournaments')

  const supabase = await createAdminClient()

  const { data: users } = await supabase
    .from('profiles')
    .select('id, username, role, subscription_status, created_at')
    .order('created_at', { ascending: false })

  // Get emails from auth.users via admin API
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const emailMap = new Map(authUsers?.users?.map((u) => [u.id, u.email]) ?? [])

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-white/40 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <p className="text-white/40 text-sm">{users?.length ?? 0} registrados</p>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Email</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Username</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Rol</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Suscripción</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Registro</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(users ?? []).map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-sm text-white/70">{emailMap.get(u.id) ?? '—'}</td>
                  <td className="px-5 py-3 text-sm text-white/50">{u.username ?? <span className="italic text-white/20">—</span>}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      u.role === 'ADMIN'
                        ? 'border-neon-cyan/30 text-neon-cyan bg-neon-cyan/10'
                        : 'border-white/10 text-white/40'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      u.subscription_status === 'ACTIVE'
                        ? 'border-green-500/30 text-green-400 bg-green-500/10'
                        : u.subscription_status === 'PENDING'
                        ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'
                        : 'border-white/5 text-white/20'
                    }`}>
                      {u.subscription_status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-white/30">
                    {new Date(u.created_at).toLocaleDateString('es')}
                  </td>
                  <td className="px-5 py-3">
                    <RoleSelect userId={u.id} currentRole={u.role} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
