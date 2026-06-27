'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trophy, Calendar, Ticket, Check, X, ShieldAlert, Loader2, Play, Landmark, Image, Eye, Trash2 } from 'lucide-react'
import { LiveWheel } from '@/components/raffles/LiveWheel'
import { verifyTicketAction, drawRaffleAction, updateRaffleAction, deleteRaffleAction } from '@/lib/actions/raffles'

interface RaffleAdminClientProps {
  raffle: any
  tickets: any[]
}

export function RaffleAdminClient({ raffle, tickets }: RaffleAdminClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'pending' | 'draw' | 'settings'>('pending')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  
  // Settings Form States
  const [title, setTitle] = useState(raffle.title)
  const [description, setDescription] = useState(raffle.description)
  const [drawDate, setDrawDate] = useState(new Date(raffle.draw_date).toISOString().slice(0, 16))
  const [ticketPrice, setTicketPrice] = useState(raffle.ticket_price)
  const [prizeImage, setPrizeImage] = useState(raffle.prize_image || '')
  const [paymentBankName, setPaymentBankName] = useState(raffle.payment_bank_name)
  const [paymentAccountHolder, setPaymentAccountHolder] = useState(raffle.payment_account_holder)
  const [paymentBankId, setPaymentBankId] = useState(raffle.payment_bank_id)
  const [paymentDetails, setPaymentDetails] = useState(raffle.payment_details || '')

  // Live drawing states
  const [triggerSpin, setTriggerSpin] = useState(false)
  const [winnerName, setWinnerName] = useState<string | null>(raffle.winner_name || null)
  const [winningTicketNum, setWinningTicketNum] = useState<string | null>(
    tickets.find(t => t.id === raffle.winner_ticket_id)?.ticket_number || null
  )

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null)

  const pendingTickets = tickets.filter(t => t.payment_status === 'pending_verification')
  const verifiedTickets = tickets.filter(t => t.payment_status === 'verified')

  // Group pending tickets by receipt_url + email to show unified transactions
  const groupedTransactions: Record<string, {
    buyer_name: string
    buyer_email: string
    buyer_phone: string
    receipt_url: string
    ticket_numbers: string[]
  }> = {}

  pendingTickets.forEach(t => {
    const key = `${t.buyer_email}_${t.receipt_url}`
    if (!groupedTransactions[key]) {
      groupedTransactions[key] = {
        buyer_name: t.buyer_name,
        buyer_email: t.buyer_email,
        buyer_phone: t.buyer_phone,
        receipt_url: t.receipt_url,
        ticket_numbers: []
      }
    }
    groupedTransactions[key].ticket_numbers.push(t.ticket_number)
  })

  const transactionsList = Object.values(groupedTransactions)

  const handleVerify = (buyerEmail: string, receiptUrl: string, action: 'verify' | 'reject') => {
    if (action === 'reject' && !confirm('¿Estás seguro de que quieres rechazar y borrar estos boletos?')) {
      return
    }

    startTransition(async () => {
      const res = await verifyTicketAction(raffle.id, buyerEmail, receiptUrl, action)
      if ('error' in res) {
        setError(res.error)
      } else {
        router.refresh()
      }
    })
  }

  const handleUpdateSettings = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const res = await updateRaffleAction(raffle.id, {
        title,
        description,
        drawDate,
        ticketPrice,
        prizeImage,
        paymentBankName,
        paymentAccountHolder,
        paymentBankId,
        paymentDetails,
      })

      if ('error' in res) {
        setError(res.error)
      } else {
        alert('Ajustes del sorteo actualizados correctamente.')
        router.refresh()
      }
    })
  }

  const handleDelete = () => {
    if (!confirm('¿Estás seguro de que deseas eliminar permanentemente este sorteo y todos sus boletos asociados? Esta acción no se puede deshacer.')) {
      return
    }

    startTransition(async () => {
      const res = await deleteRaffleAction(raffle.id)
      if ('error' in res) {
        setError(res.error)
      } else {
        router.push('/admin/raffles')
      }
    })
  }

  // Ruleta: Cuando termina el giro
  const handleDrawComplete = (winnerTicket: any) => {
    startTransition(async () => {
      const res = await drawRaffleAction(raffle.id, winnerTicket.ticketNumber)
      if ('error' in res) {
        alert(res.error)
      } else {
        setWinnerName(winnerTicket.name)
        setWinningTicketNum(winnerTicket.ticketNumber)
        router.refresh()
      }
    })
  }

  // Mapear participantes verificados para la ruleta
  const wheelParticipants = verifiedTickets.map(t => ({
    id: t.ticket_number,
    name: t.buyer_name,
    ticketNumber: t.ticket_number
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
        <div className="space-y-1.5">
          <Link
            href="/admin/raffles"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-white uppercase tracking-wider transition-colors mb-1"
          >
            <ArrowLeft size={12} /> Panel de Sorteos
          </Link>
          <h1 className="text-xl sm:text-2xl font-orbitron font-black text-white uppercase tracking-tight line-clamp-1">
            {raffle.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-[10px] text-white/40 font-semibold uppercase tracking-wider font-orbitron">
            <span>Ventas: <strong className="text-neon-cyan">{verifiedTickets.length} / {raffle.total_tickets}</strong></span>
            <span>Pendientes: <strong className="text-yellow-400">{pendingTickets.length}</strong></span>
            <span>Estado: <strong className={raffle.status === 'finished' ? 'text-white/60' : 'text-neon-cyan'}>{raffle.status}</strong></span>
          </div>
        </div>

        {/* Action button if active */}
        {raffle.status === 'active' && verifiedTickets.length > 0 && (
          <button
            onClick={() => {
              setActiveTab('draw')
              setTriggerSpin(true)
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-neon-cyan/15 uppercase font-orbitron"
          >
            <Play size={14} /> Realizar Sorteo en Vivo
          </button>
        )}
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 border-b border-white/5 pb-px overflow-x-auto select-none">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
            activeTab === 'pending'
              ? 'border-neon-cyan text-neon-cyan'
              : 'border-transparent text-white/40 hover:text-white/80'
          }`}
        >
          🎟️ Boletos Pendientes ({transactionsList.length})
        </button>
        <button
          onClick={() => setActiveTab('draw')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
            activeTab === 'draw'
              ? 'border-neon-cyan text-neon-cyan'
              : 'border-transparent text-white/40 hover:text-white/80'
          }`}
        >
          🎯 Sorteo en Vivo ({verifiedTickets.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
            activeTab === 'settings'
              ? 'border-neon-cyan text-neon-cyan'
              : 'border-transparent text-white/40 hover:text-white/80'
          }`}
        >
          ⚙️ Ajustes y Edición
        </button>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {/* Tab 1: Pending verifications */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {transactionsList.length === 0 ? (
              <div className="p-16 text-center rounded-2xl bg-white/[0.01] border border-white/5 space-y-4">
                <Ticket size={48} className="mx-auto text-white/10" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white/60">No hay boletos pendientes</h3>
                  <p className="text-xs text-white/30">Todos los depósitos han sido verificados.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {transactionsList.map((tx: any, idx) => {
                  const numbers = tx.ticket_numbers.map((n: string) => `#${n}`).join(', ')
                  return (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl border border-white/5 bg-white/[0.01] flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-semibold text-white">{tx.buyer_name}</h4>
                          <p className="text-xs text-white/40">{tx.buyer_email} • {tx.buyer_phone}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-[10px] uppercase font-bold text-white/30 tracking-wider">Boletos:</span>
                          <span className="text-xs font-bold text-neon-cyan font-orbitron">{numbers}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-end">
                        <button
                          onClick={() => setSelectedReceipt(tx.receipt_url)}
                          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5"
                        >
                          <Eye size={14} /> Ver Recibo
                        </button>
                        
                        <button
                          onClick={() => handleVerify(tx.buyer_email, tx.receipt_url, 'reject')}
                          disabled={isPending}
                          className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-xs font-bold flex items-center gap-1"
                        >
                          <X size={14} /> Rechazar
                        </button>

                        <button
                          onClick={() => handleVerify(tx.buyer_email, tx.receipt_url, 'verify')}
                          disabled={isPending}
                          className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all text-xs font-bold flex items-center gap-1"
                        >
                          <Check size={14} /> Aprobar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Live Wheel Drawing */}
        {activeTab === 'draw' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Roulette Area */}
            <div className="md:col-span-2 bg-white/[0.01] border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Animación del Sorteo en Vivo</span>
              
              {raffle.status === 'finished' ? (
                <div className="p-8 bg-gradient-to-b from-gold/10 to-transparent border border-gold/20 rounded-3xl text-center space-y-4 max-w-md mx-auto shadow-[0_0_30px_rgba(212,175,55,0.05)]">
                  <Trophy size={48} className="mx-auto text-gold animate-bounce" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gold/60 font-orbitron">¡Ganador Seleccionado!</span>
                    <h2 className="text-2xl font-orbitron font-black text-white uppercase tracking-tight">{winnerName}</h2>
                  </div>
                  <div className="inline-block px-6 py-2 rounded-xl bg-gold/10 border border-gold/20 text-gold font-orbitron text-lg font-black">
                    Boleto Ganador: #{winningTicketNum}
                  </div>
                </div>
              ) : (
                <>
                  <LiveWheel
                    participants={wheelParticipants}
                    onDrawComplete={handleDrawComplete}
                    triggerSpin={triggerSpin}
                  />

                  {/* Draw button */}
                  {!triggerSpin && verifiedTickets.length > 0 && (
                    <button
                      onClick={() => setTriggerSpin(true)}
                      className="px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-neon-cyan to-neon-purple uppercase tracking-widest hover:opacity-90 transition-all font-orbitron"
                    >
                      🎰 Iniciar Sorteo en Vivo
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Verified participants list */}
            <div className="bg-white/[0.01] border border-white/5 p-6 rounded-2xl space-y-4 max-h-[500px] overflow-y-auto">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 border-b border-white/5 pb-3">
                Boletos Verificados ({verifiedTickets.length})
              </h3>
              
              {verifiedTickets.length === 0 ? (
                <div className="py-12 text-center text-xs text-white/30">
                  No hay boletos verificados listos para participar.
                </div>
              ) : (
                <div className="space-y-2">
                  {verifiedTickets.map((t: any) => (
                    <div
                      key={t.id}
                      className="flex justify-between items-center text-xs p-2 bg-white/5 border border-white/5 rounded-lg"
                    >
                      <span className="font-medium text-white/80 line-clamp-1">{t.buyer_name}</span>
                      <span className="font-bold text-neon-cyan font-orbitron font-mono shrink-0">#{t.ticket_number}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Settings Form */}
        {activeTab === 'settings' && (
          <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-6">
            <form onSubmit={handleUpdateSettings} className="space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/60 border-b border-white/5 pb-3">
                Editar Datos del Sorteo
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Título del Sorteo *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-neon-cyan text-xs text-white"
                    required
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Descripción *</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-neon-cyan text-xs text-white resize-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Fecha del Sorteo *</label>
                  <input
                    type="datetime-local"
                    value={drawDate}
                    onChange={(e) => setDrawDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-neon-cyan text-xs text-white"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">URL de Imagen del Premio</label>
                  <input
                    type="url"
                    value={prizeImage}
                    onChange={(e) => setPrizeImage(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-neon-cyan text-xs text-white"
                  />
                </div>
              </div>

              {/* Bank Details section */}
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-neon-purple flex items-center gap-1.5">
                  <Landmark size={12} /> Datos de Cuenta de Banco
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-white/30">Banco *</label>
                    <input
                      type="text"
                      value={paymentBankName}
                      onChange={(e) => setPaymentBankName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-neon-purple text-xs text-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-white/30">Titular de Cuenta *</label>
                    <input
                      type="text"
                      value={paymentAccountHolder}
                      onChange={(e) => setPaymentAccountHolder(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-neon-purple text-xs text-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-white/30">No. Cuenta *</label>
                    <input
                      type="text"
                      value={paymentBankId}
                      onChange={(e) => setPaymentBankId(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-neon-purple text-xs text-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-white/30">Instrucciones Adicionales</label>
                    <input
                      type="text"
                      value={paymentDetails}
                      onChange={(e) => setPaymentDetails(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-neon-purple text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:text-white bg-red-500/10 border border-red-500/20 hover:bg-red-600 transition-all uppercase tracking-wider"
                >
                  <Trash2 size={13} /> Eliminar Sorteo
                </button>
                
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 transition-all disabled:opacity-40 uppercase tracking-wider"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Guardar Ajustes'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Full-screen Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-neutral-950 flex flex-col">
            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/80 hover:bg-black text-white hover:scale-105 transition-all text-xs font-bold z-10"
            >
              Cerrar
            </button>
            <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
              <img src={selectedReceipt} alt="Comprobante Completo" className="max-w-full max-h-full object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
