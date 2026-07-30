'use client'

import React, { useState, useTransition } from 'react'
import { Search, Loader2, Calendar } from 'lucide-react'
import { findMyTicketsPublicAction } from '@/lib/actions/raffles'

export function MyTicketsClient({ 
  isLoggedIn = false, 
  initialTickets = [] 
}: { 
  isLoggedIn?: boolean
  initialTickets?: any[] 
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [tickets, setTickets] = useState<any[]>(initialTickets)
  const [searched, setSearched] = useState(isLoggedIn)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSearched(false)

    if (!name.trim() || !phone.trim()) {
      setError('Por favor completa ambos campos para buscar.')
      return
    }

    startTransition(async () => {
      try {
        const res = await findMyTicketsPublicAction(name.trim(), phone.trim())
        if ('error' in res && res.error) {
          setError(res.error)
        } else if ('data' in res && res.data) {
          setTickets(res.data)
          setSearched(true)
        }
      } catch (err: any) {
        setError(err.message || 'Error al realizar la búsqueda.')
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-orbitron font-black text-white uppercase tracking-tight">
          🔍 BUSCAR MIS BOLETOS
        </h1>
        <p className="text-xs text-white/40 max-w-md mx-auto">
          Consulta tus boletos adquiridos ingresando el nombre y el celular de contacto con el que realizaste la compra.
        </p>
      </div>

      {/* Search Box (Only for guests) */}
      {!isLoggedIn && (
        <div className="max-w-md mx-auto p-6 bg-white/[0.01] border border-white/5 rounded-2xl shadow-xl space-y-4">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Nombre Completo *</label>
              <input
                type="text"
                placeholder="Nombre y Apellido como te registraste"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-neon-cyan"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Celular / WhatsApp *</label>
              <input
                type="tel"
                placeholder="Ej: 809-555-0100"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-neon-cyan"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 font-bold bg-red-500/5 p-2 rounded-lg border border-red-500/10 text-center">
                ⚠️ {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 uppercase tracking-widest font-orbitron flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Buscando...
                </>
              ) : (
                <>
                  <Search size={14} /> Buscar Boletos
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Results List */}
      {searched && (
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-sm font-orbitron font-bold text-white uppercase tracking-wider text-center sm:text-left border-b border-white/5 pb-2">
            Boletos Encontrados ({tickets.length})
          </h2>

          {tickets.length === 0 ? (
            <div className="p-12 text-center text-xs text-white/30 border border-white/5 rounded-2xl bg-white/[0.005]">
              {isLoggedIn 
                ? 'Aún no tienes boletos de sorteos asociados a tu cuenta.' 
                : 'No se encontraron boletos asociados a estos datos de contacto. Verifica que hayas escrito el nombre y celular exactamente igual que al realizar la compra.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tickets.map((t) => {
                const drawDate = t.raffles ? new Date(t.raffles.draw_date) : null
                const formattedDate = drawDate 
                  ? drawDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                  : 'N/A'
                
                return (
                  <div 
                    key={t.id} 
                    className="p-4 rounded-2xl border border-white/5 bg-white/[0.01] hover:border-white/10 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block truncate max-w-[150px]">
                          {t.raffles?.title || 'Sorteo'}
                        </span>
                        
                        {t.payment_status === 'verified' ? (
                          <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-green-500/10 border border-green-500/20 text-green-400 font-orbitron">
                            ✓ Verificado
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-orbitron">
                            ⏳ Pendiente
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-baseline pt-1">
                        <span className="text-2xl font-orbitron font-black text-neon-cyan">
                          #{t.ticket_number}
                        </span>
                        {t.is_bonus && (
                          <span className="text-[8px] font-black uppercase text-neon-purple bg-neon-purple/10 border border-neon-purple/20 px-1 py-0.5 rounded font-orbitron font-mono">
                            REGALO
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] text-white/30 border-t border-white/5 pt-2 font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-neon-purple" />
                        Sorteo: {formattedDate}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
