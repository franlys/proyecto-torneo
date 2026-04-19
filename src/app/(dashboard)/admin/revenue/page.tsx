import { createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function fetchACRevenue() {
  const acUrl  = process.env.AC_WEBHOOK_URL
  const secret = process.env.AC_WEBHOOK_SECRET
  if (!acUrl || !secret) return null

  try {
    const res = await fetch(`${acUrl}/api/admin/revenue`, {
      headers: { 'x-ac-secret': secret },
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export default async function AdminRevenuePage() {
  const admin = await isAdmin()
  if (!admin) redirect('/tournaments')

  const supabase = await createAdminClient()

  const [
    { data: approvedSubs },
    { count: activeTournaments },
    { count: finishedTournaments },
    { data: activeCodes, count: activeCodesCount },
    acData,
  ] = await Promise.all([
    supabase
      .from('subscription_requests')
      .select('id, user_id, amount, created_at')
      .eq('status', 'APPROVED')
      .order('created_at', { ascending: false }),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('status', 'finished'),
    supabase
      .from('streamer_codes')
      .select('id, code, streamer_name, tournament_id, created_at', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20),
    fetchACRevenue(),
  ])

  const totalSubRevenue = approvedSubs?.reduce((acc, s) => acc + Number(s.amount), 0) ?? 0
  const monthlySubRevenue = approvedSubs
    ?.filter((s) => {
      const d = new Date(s.created_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((acc, s) => acc + Number(s.amount), 0) ?? 0

  const acSummary = acData?.summary
  const acRecords: any[] = acData?.records ?? []

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-white/40 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Ingresos</h1>
          <p className="text-white/40 text-sm">Panel financiero de Kronix</p>
        </div>
      </div>

      {/* Suscripciones */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-white/30 font-semibold mb-3">Suscripciones</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-white/40 text-xs uppercase tracking-widest">Este mes</p>
            <p className="text-3xl font-bold text-green-400 mt-2">${monthlySubRevenue}</p>
            <p className="text-white/20 text-xs mt-1">USD cobrados</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-white/40 text-xs uppercase tracking-widest">Total acumulado</p>
            <p className="text-3xl font-bold text-white mt-2">${totalSubRevenue}</p>
            <p className="text-white/20 text-xs mt-1">{approvedSubs?.length ?? 0} pagos aprobados</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-white/40 text-xs uppercase tracking-widest">Torneos activos</p>
            <p className="text-3xl font-bold text-cyan-400 mt-2">{activeTournaments ?? 0}</p>
            <p className="text-white/20 text-xs mt-1">{finishedTournaments ?? 0} finalizados</p>
          </div>
        </div>
      </div>

      {/* Bridge ArenaCrypto — datos reales */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-purple-400/70 font-semibold mb-3">
          Bridge de Apuestas — ArenaCrypto
        </h2>

        {acSummary ? (
          <>
            {/* Resumen global */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Volumen real',       value: `$${Number(acSummary.total_real_volume).toFixed(2)}`,    color: 'text-white' },
                { label: 'Vol. Kronix',        value: `$${Number(acSummary.total_kronix_volume).toFixed(2)}`,  color: 'text-purple-400' },
                { label: 'Comisión (1%)',      value: `$${Number(acSummary.total_commission).toFixed(2)}`,     color: 'text-green-400' },
                { label: 'Vol. test 🧪',       value: `$${Number(acSummary.total_test_volume).toFixed(2)}`,    color: 'text-yellow-400/70' },
                { label: 'Comisión test 🧪',   value: `$${Number(acSummary.total_test_commission ?? 0).toFixed(2)}`, color: 'text-yellow-300' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                  <p className="text-white/40 text-xs uppercase tracking-widest">{label}</p>
                  <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Por torneo */}
            {acRecords.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Torneo</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Vol. Real</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Vol. Kronix</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Comisión</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Vol. Test 🧪</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Com. Test 🧪</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {acRecords.map((r: any) => (
                      <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-white/80 font-medium text-xs">
                            {r.tournament_name ?? r.pt_tournament_id?.slice(0, 8) + '…'}
                          </p>
                          <p className="text-white/20 text-xs mt-0.5">
                            {new Date(r.period_end).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right text-white/60 tabular-nums">
                          ${Number(r.total_volume).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-purple-400 tabular-nums font-medium">
                          ${Number(r.kronix_volume).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-green-400 tabular-nums font-bold">
                          ${Number(r.commission_amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-yellow-400/50 tabular-nums text-xs">
                          ${Number(r.test_volume ?? 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-yellow-300/70 tabular-nums text-xs font-medium">
                          ${Number(r.test_commission ?? 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            r.status === 'paid'
                              ? 'bg-green-400/10 text-green-400'
                              : 'bg-yellow-400/10 text-yellow-400'
                          }`}>
                            {r.status === 'paid' ? 'Pagado' : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {acRecords.length === 0 && (
              <p className="text-white/30 text-sm text-center py-6">
                Sin apuestas registradas aún en ArenaCrypto.
              </p>
            )}
          </>
        ) : (
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                <span className="text-purple-400 text-lg">⚡</span>
              </div>
              <div>
                <h3 className="text-white font-semibold">Sin conexión con ArenaCrypto</h3>
                <p className="text-white/40 text-sm mt-1">
                  Verifica que <code className="text-purple-300 bg-purple-400/10 px-1 rounded">AC_WEBHOOK_URL</code> y{' '}
                  <code className="text-purple-300 bg-purple-400/10 px-1 rounded">AC_WEBHOOK_SECRET</code> estén configurados en el .env.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white/5 border border-white/5 rounded-lg p-4">
                <p className="text-white/40 text-xs uppercase tracking-widest">Códigos activos</p>
                <p className="text-2xl font-bold text-purple-400 mt-1">{activeCodesCount ?? 0}</p>
                <p className="text-white/20 text-xs mt-1">generando tráfico en AC</p>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-lg p-4">
                <p className="text-white/40 text-xs uppercase tracking-widest">Volumen apostado</p>
                <p className="text-2xl font-bold text-white/30 mt-1">—</p>
                <p className="text-white/20 text-xs mt-1">requiere conexión AC</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Códigos activos */}
      {(activeCodes ?? []).length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-widest text-white/30 font-semibold mb-3">
            Códigos de streamer activos
          </h2>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Código</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Streamer</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-widest text-white/30 font-medium">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(activeCodes ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <code className="text-cyan-400 text-sm font-mono bg-cyan-400/5 px-2 py-0.5 rounded">{c.code}</code>
                    </td>
                    <td className="px-5 py-3 text-sm text-white/60">{c.streamer_name}</td>
                    <td className="px-5 py-3 text-xs text-white/30">
                      {new Date(c.created_at).toLocaleDateString('es')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historial de pagos */}
      {(approvedSubs ?? []).length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-widest text-white/30 font-semibold mb-3">
            Historial de pagos aprobados
          </h2>
          <div className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
            {approvedSubs?.map((s) => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">{s.user_id}</p>
                  <p className="text-white/30 text-xs mt-0.5">
                    {new Date(s.created_at).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                </div>
                <span className="text-green-400 font-semibold text-sm">${s.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
