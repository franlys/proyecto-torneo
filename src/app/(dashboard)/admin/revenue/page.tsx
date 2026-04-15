import { createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/actions/auth-helpers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminRevenuePage() {
  const admin = await isAdmin()
  if (!admin) redirect('/tournaments')

  const supabase = await createAdminClient()

  // Ingresos por suscripciones (pagos aprobados)
  const { data: approvedSubs } = await supabase
    .from('subscription_requests')
    .select('id, user_id, amount, created_at')
    .eq('status', 'APPROVED')
    .order('created_at', { ascending: false })

  const totalSubRevenue = approvedSubs?.reduce((acc, s) => acc + Number(s.amount), 0) ?? 0
  const monthlySubRevenue = approvedSubs
    ?.filter((s) => {
      const d = new Date(s.created_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((acc, s) => acc + Number(s.amount), 0) ?? 0

  // Códigos de streamer activos (cada uno representa volumen potencial de apuestas)
  const { data: activeCodes, count: activeCodesCount } = await supabase
    .from('streamer_codes')
    .select('id, code, streamer_name, tournament_id, created_at', { count: 'exact' })
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(20)

  // Torneos activos/finalizados
  const { count: activeTournaments } = await supabase
    .from('tournaments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const { count: finishedTournaments } = await supabase
    .from('tournaments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'finished')

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

      {/* Stats de suscripciones */}
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
            <p className="text-3xl font-bold text-neon-cyan mt-2">{activeTournaments ?? 0}</p>
            <p className="text-white/20 text-xs mt-1">{finishedTournaments ?? 0} finalizados</p>
          </div>
        </div>
      </div>

      {/* Ingresos por apuestas — Bridge ArenaCrypto */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-neon-purple/70 font-semibold mb-3">
          Bridge de Apuestas — ArenaCrypto
        </h2>
        <div className="bg-neon-purple/5 border border-neon-purple/20 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-neon-purple/20 border border-neon-purple/30 flex items-center justify-center shrink-0">
              <span className="text-neon-purple text-lg">⚡</span>
            </div>
            <div>
              <h3 className="text-white font-semibold">Comisión por volumen de apuestas</h3>
              <p className="text-white/40 text-sm mt-1">
                Cada código de streamer generado desde un torneo Kronix lleva tráfico a ArenaCrypto.
                El porcentaje del volumen apostado con esos códigos se transfiere a Kronix según el
                acuerdo de revenue share configurado en ArenaCrypto.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/5 rounded-lg p-4">
              <p className="text-white/40 text-xs uppercase tracking-widest">Códigos activos</p>
              <p className="text-2xl font-bold text-neon-purple mt-1">{activeCodesCount ?? 0}</p>
              <p className="text-white/20 text-xs mt-1">generando tráfico en AC</p>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-lg p-4">
              <p className="text-white/40 text-xs uppercase tracking-widest">Volumen apostado</p>
              <p className="text-2xl font-bold text-white/30 mt-1">—</p>
              <p className="text-white/20 text-xs mt-1">reportado por ArenaCrypto</p>
            </div>
          </div>

          <p className="text-white/20 text-xs">
            * Los datos de volumen y comisiones son reportados por ArenaCrypto vía webhook o sincronización manual.
            Configura el endpoint de ingresos en el panel de ArenaCrypto para sincronizar automáticamente.
          </p>
        </div>
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
                      <code className="text-neon-cyan text-sm font-mono bg-neon-cyan/5 px-2 py-0.5 rounded">{c.code}</code>
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
