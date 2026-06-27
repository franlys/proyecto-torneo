import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/actions/auth-helpers'
import { Navbar } from '@/components/navigation/Navbar'
import { Trophy, Calendar, Ticket, ArrowRight, ShieldCheck } from 'lucide-react'
import { getRaffles } from '@/lib/actions/raffles'

export const dynamic = 'force-dynamic'

export default async function RafflesCatalogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = user ? await getProfile() : null

  const res = await getRaffles()
  
  if ('error' in res) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white pt-28">
        <Navbar user={user} profile={profile} />
        <div className="flex flex-col items-center justify-center p-4 min-h-[50vh]">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center max-w-md">
            <p className="text-red-400 font-medium">Error al cargar sorteos</p>
            <p className="text-xs text-white/40 mt-1">{res.error}</p>
          </div>
        </div>
      </div>
    )
  }

  const raffles = res.data || []
  const activeRaffles = raffles.filter(r => r.status !== 'finished')
  const finishedRaffles = raffles.filter(r => r.status === 'finished')

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white pt-28 pb-12">
      <Navbar user={user} profile={profile} />
      
      {/* Decorative gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[-10%] w-[40%] h-[40%] bg-neon-cyan/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-neon-purple/5 blur-[120px] rounded-full" />
      </div>

      <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-12 relative z-10">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-neon-cyan/5 via-transparent to-neon-purple/5 p-6 sm:p-10 text-center space-y-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,245,255,0.05)_0%,transparent_70%)] pointer-events-none" />
        <span className="px-3 py-1 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan text-[10px] uppercase font-bold tracking-widest font-orbitron inline-block">
          Sorteos Oficiales Kronix
        </span>
        <h1 className="text-2xl sm:text-4xl font-orbitron font-black text-white uppercase tracking-tighter max-w-2xl mx-auto">
          Participa y Gana Premios de <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple">Esports & Gaming</span>
        </h1>
        <p className="text-xs sm:text-sm text-white/40 max-w-md mx-auto">
          Adquiere tus boletos de forma segura mediante transferencia bancaria, sube tu comprobante y participa en la ruleta en vivo.
        </p>
        <div className="flex items-center justify-center gap-4 pt-2">
          <Link
            href="/profile?tab=sorteos"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-all"
          >
            <Ticket size={14} className="text-neon-cyan" /> Mis Boletos
          </Link>
        </div>
      </div>

      {/* Active Raffles Grid */}
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-orbitron font-black text-white uppercase tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" /> Sorteos Activos
          </h2>
          <p className="text-xs text-white/30 mt-1">Sorteos abiertos listos para recibir tus participaciones.</p>
        </div>

        {activeRaffles.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white/[0.01] border border-white/5">
            <Trophy size={40} className="mx-auto text-white/10 mb-3" />
            <p className="text-sm font-bold text-white/60">No hay sorteos activos en este momento</p>
            <p className="text-xs text-white/30 mt-1">Vuelve pronto para ver nuevos sorteos de la plataforma.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeRaffles.map((r) => {
              const drawDate = new Date(r.draw_date)
              return (
                <div
                  key={r.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 flex flex-col sm:flex-row"
                >
                  {/* Prize Image */}
                  <div className="relative w-full sm:w-44 h-44 sm:h-auto shrink-0 bg-neutral-900 overflow-hidden">
                    {r.prize_image ? (
                      <img
                        src={r.prize_image}
                        alt={r.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
                        <Trophy size={32} className="text-white/20" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/70 border border-white/10 text-white text-[10px] font-orbitron font-bold uppercase">
                      {r.currency} {Number(r.ticket_price).toFixed(2)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <h3 className="text-base font-orbitron font-black text-white uppercase group-hover:text-neon-cyan transition-colors leading-snug line-clamp-1">
                        {r.title}
                      </h3>
                      <p className="text-xs text-white/40 line-clamp-2 leading-relaxed">
                        {r.description}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {/* Meta information */}
                      <div className="flex items-center gap-4 text-[10px] text-white/30 font-semibold uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-neon-purple" />
                          {drawDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Ticket size={12} className="text-neon-cyan" />
                          Max {r.total_tickets}
                        </span>
                      </div>

                      {/* CTA Button */}
                      <Link
                        href={`/raffles/${r.id}`}
                        className="inline-flex items-center gap-1.5 w-full justify-center py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-neon-cyan to-neon-purple group-hover:opacity-90 active:scale-[0.98] transition-all"
                      >
                        Comprar Boletos <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Finished Raffles Grid */}
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-orbitron font-black text-white uppercase tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white/20" /> Historial de Ganadores
          </h2>
          <p className="text-xs text-white/30 mt-1">Sorteos finalizados y ganadores oficiales del sorteo.</p>
        </div>

        {finishedRaffles.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white/[0.01] border border-white/5">
            <p className="text-xs text-white/30">No hay sorteos finalizados en el registro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {finishedRaffles.map((r) => {
              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 space-y-4"
                >
                  <div className="relative aspect-video rounded-xl bg-neutral-900 overflow-hidden">
                    {r.prize_image ? (
                      <img src={r.prize_image} alt={r.title} className="w-full h-full object-cover opacity-60" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
                        <Trophy size={28} className="text-white/20" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 px-2 py-0.5 rounded bg-neutral-950 border border-white/10 text-white/50 text-[9px] font-orbitron font-bold uppercase">
                      Finalizado
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-orbitron font-black text-white uppercase line-clamp-1">
                      {r.title}
                    </h3>
                    <p className="text-[11px] text-white/40">
                      Finalizado el {new Date(r.finished_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Winner display card */}
                  <div className="bg-white/[0.02] border border-white/5 p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-widest text-white/30 block">Ganador</span>
                      <span className="text-xs font-semibold text-white font-orbitron line-clamp-1">{r.winner_name || 'Sin nombre'}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[9px] uppercase font-bold tracking-widest text-white/30 block">Boleto</span>
                      <span className="text-xs font-bold text-neon-cyan font-orbitron">#{r.winner_ticket_id ? 'N/A' : 'Conf'}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  </div>
  )
}
