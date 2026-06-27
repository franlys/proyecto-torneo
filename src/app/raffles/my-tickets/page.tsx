import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Ticket, Calendar, Clock, CheckCircle2, AlertTriangle, ArrowLeft, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/actions/auth-helpers'
import { Navbar } from '@/components/navigation/Navbar'
import { getMyTickets } from '@/lib/actions/raffles'

export const dynamic = 'force-dynamic'

export default async function MyTicketsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const profile = await getProfile()

  const res = await getMyTickets()

  if ('error' in res) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white pt-28">
        <Navbar user={user} profile={profile} />
        <div className="flex flex-col items-center justify-center p-4 min-h-[50vh]">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center max-w-md">
            <p className="text-red-400 font-medium">Error al cargar tus boletos</p>
            <p className="text-xs text-white/40 mt-1">{res.error}</p>
          </div>
        </div>
      </div>
    )
  }

  const tickets = res.data || []

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white pt-28 pb-12">
      <Navbar user={user} profile={profile} />
      
      {/* Decorative gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[-10%] w-[40%] h-[40%] bg-neon-cyan/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-neon-purple/5 blur-[120px] rounded-full" />
      </div>

      <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8 relative z-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
        <div className="space-y-1.5">
          <Link
            href="/raffles"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-white uppercase tracking-wider transition-colors mb-2"
          >
            <ArrowLeft size={12} /> Ver Sorteos
          </Link>
          <h1 className="text-2xl font-orbitron font-black text-white uppercase tracking-tight">
            Mis Boletos Adquiridos
          </h1>
          <p className="text-xs text-white/40">Consulta el estado de verificación y resultados de tus participaciones.</p>
        </div>
        <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white/70">
          Total: {tickets.length} boletos
        </div>
      </div>

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-white/[0.01] border border-white/5 space-y-4">
          <Ticket size={48} className="mx-auto text-white/10" />
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-white/70">No has comprado boletos aún</h3>
            <p className="text-xs text-white/30 max-w-xs mx-auto">
              Explora nuestros sorteos activos y participa para ganar increíbles premios gaming.
            </p>
          </div>
          <Link
            href="/raffles"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-purple text-xs font-bold text-white uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
          >
            Ver Sorteos Activos
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((t: any) => {
            const isVerified = t.payment_status === 'verified'
            const isFinished = t.raffle?.status === 'finished'
            const isWinner = isFinished && t.raffle?.winner_name === t.buyer_name // Simple mapping logic

            return (
              <div
                key={t.id}
                className="p-5 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row justify-between gap-6"
              >
                {/* Raffle summary */}
                <div className="flex gap-4">
                  {/* Small preview image */}
                  <div className="w-16 h-16 rounded-xl bg-neutral-900 overflow-hidden shrink-0 border border-white/5">
                    {t.raffle?.prize_image ? (
                      <img src={t.raffle.prize_image} alt={t.raffle.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Trophy size={20} className="text-white/20" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 py-0.5">
                    <h3 className="text-sm font-orbitron font-black text-white uppercase line-clamp-1">
                      {t.raffle?.title}
                    </h3>
                    <div className="flex items-center gap-4 text-[10px] text-white/30 font-semibold uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-neon-purple" />
                        {new Date(t.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="flex items-center gap-1 font-orbitron text-neon-cyan">
                        Boleto #{t.ticket_number}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status elements */}
                <div className="flex flex-row sm:flex-col justify-between sm:justify-center items-end gap-3 shrink-0">
                  {/* Payment Status Label */}
                  {isVerified ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-wider">
                      <CheckCircle2 size={11} /> Confirmado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase tracking-wider">
                      <Clock size={11} /> Verificando Pago
                    </span>
                  )}

                  {/* Draw Status / Winner Label */}
                  {isFinished && (
                    <div className="text-right">
                      {isWinner ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-orbitron font-bold uppercase tracking-widest animate-pulse">
                          🏆 Ganador
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/30 uppercase tracking-widest block font-orbitron">
                          No premiado
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  </div>
  )
}
