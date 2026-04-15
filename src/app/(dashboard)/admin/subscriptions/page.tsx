import { createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SubscriptionActions } from './SubscriptionActions'

export default async function AdminSubscriptionsPage() {
  const admin = await isAdmin()
  if (!admin) redirect('/tournaments')

  const supabase = await createAdminClient()

  const { data: requests } = await supabase
    .from('subscription_requests')
    .select('id, user_id, amount, evidence_url, status, admin_notes, created_at')
    .order('created_at', { ascending: false })

  // Fetch emails
  const { data: authData } = await supabase.auth.admin.listUsers()
  const emailMap = new Map(authData?.users?.map((u) => [u.id, u.email]) ?? [])

  const pending = requests?.filter((r) => r.status === 'PENDING') ?? []
  const resolved = requests?.filter((r) => r.status !== 'PENDING') ?? []

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-white/40 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Solicitudes de Suscripción</h1>
          <p className="text-white/40 text-sm">
            {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Pendientes */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-yellow-400/80 font-semibold">
            Pendientes de revisión
          </h2>
          <div className="space-y-3">
            {pending.map((req) => (
              <div key={req.id} className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-white font-medium">{emailMap.get(req.user_id) ?? req.user_id}</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {new Date(req.created_at).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-yellow-400 text-sm font-semibold mt-1">${req.amount} USD</p>
                  </div>
                  <a
                    href={req.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-neon-cyan border border-neon-cyan/20 bg-neon-cyan/5 px-3 py-1.5 rounded-lg hover:bg-neon-cyan/10 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Ver comprobante
                  </a>
                </div>
                <SubscriptionActions requestId={req.id} userId={req.user_id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
          <p className="text-white/30 text-sm">No hay solicitudes pendientes</p>
        </div>
      )}

      {/* Historial */}
      {resolved.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-white/30 font-semibold">Historial</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
            {resolved.map((req) => (
              <div key={req.id} className="px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-white/60 text-sm">{emailMap.get(req.user_id) ?? req.user_id}</p>
                  <p className="text-white/30 text-xs mt-0.5">
                    {new Date(req.created_at).toLocaleDateString('es')} · ${req.amount}
                  </p>
                  {req.admin_notes && (
                    <p className="text-white/30 text-xs mt-0.5 italic">Nota: {req.admin_notes}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  req.status === 'APPROVED'
                    ? 'border-green-500/30 text-green-400 bg-green-500/10'
                    : 'border-red-500/30 text-red-400 bg-red-500/10'
                }`}>
                  {req.status === 'APPROVED' ? 'Aprobado' : 'Rechazado'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
