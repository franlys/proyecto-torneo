'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { Trophy, Calendar, Ticket, Plus, X, Loader2, Landmark } from 'lucide-react'
import { createRaffleAction } from '@/lib/actions/raffles'

interface AdminRafflesClientProps {
  initialRaffles: any[]
}

export function AdminRafflesClient({ initialRaffles }: AdminRafflesClientProps) {
  const [raffles, setRaffles] = useState(initialRaffles)
  const [showModal, setShowModal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [drawDate, setDrawDate] = useState('')
  const [ticketPrice, setTicketPrice] = useState(100)
  const [totalTickets, setTotalTickets] = useState(1000)
  const [prizeImage, setPrizeImage] = useState('')
  const [paymentBankName, setPaymentBankName] = useState('')
  const [paymentAccountHolder, setPaymentAccountHolder] = useState('')
  const [paymentBankId, setPaymentBankId] = useState('')
  const [paymentDetails, setPaymentDetails] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title || !description || !drawDate || !ticketPrice || !paymentBankName || !paymentAccountHolder || !paymentBankId) {
      setError('Por favor completa todos los campos obligatorios.')
      return
    }

    startTransition(async () => {
      const res = await createRaffleAction({
        title,
        description,
        drawDate,
        ticketPrice,
        totalTickets,
        prizeImage,
        paymentBankName,
        paymentAccountHolder,
        paymentBankId,
        paymentDetails,
      })

      if ('error' in res) {
        setError(res.error)
      } else {
        setRaffles(prev => [res.data, ...prev])
        setShowModal(false)
        
        // Reset form
        setTitle('')
        setDescription('')
        setDrawDate('')
        setTicketPrice(100)
        setTotalTickets(1000)
        setPrizeImage('')
        setPaymentBankName('')
        setPaymentAccountHolder('')
        setPaymentBankId('')
        setPaymentDetails('')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-orbitron font-black text-white uppercase tracking-tight">
            Gestión de Sorteos
          </h1>
          <p className="text-xs text-white/40">Crea, edita y realiza sorteos en vivo para toda la comunidad.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-neon-cyan/10"
        >
          <Plus size={14} /> Nuevo Sorteo
        </button>
      </div>

      {/* Grid of Raffles */}
      {raffles.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-white/[0.01] border border-white/5 space-y-4">
          <Trophy size={48} className="mx-auto text-white/10" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white/60">No hay sorteos registrados</h3>
            <p className="text-xs text-white/30">Crea tu primer sorteo utilizando el botón superior.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {raffles.map((r) => {
            const isFinished = r.status === 'finished'
            return (
              <div
                key={r.id}
                className="rounded-2xl border border-white/5 bg-white/[0.01] overflow-hidden flex flex-col justify-between"
              >
                {/* Image & Price */}
                <div className="relative aspect-video bg-neutral-900 overflow-hidden">
                  {r.prize_image ? (
                    <img src={r.prize_image} alt={r.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Trophy size={32} className="text-white/20" />
                    </div>
                  )}
                  <span className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/70 border border-white/10 text-white text-[9px] font-orbitron font-bold">
                    {r.currency} {Number(r.ticket_price).toFixed(2)}
                  </span>
                  <span className={`absolute top-3 right-3 px-2 py-0.5 rounded text-[9px] font-orbitron font-bold uppercase ${
                    isFinished ? 'bg-white/10 text-white/60 border border-white/5' : 'bg-neon-cyan/20 border border-neon-cyan/30 text-neon-cyan'
                  }`}>
                    {r.status === 'finished' ? 'Finalizado' : 'Activo'}
                  </span>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-orbitron font-black text-white uppercase line-clamp-1">
                      {r.title}
                    </h3>
                    <p className="text-[11px] text-white/40 line-clamp-2 leading-relaxed">
                      {r.description}
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between text-[10px] text-white/30 font-semibold uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-neon-purple" />
                        {new Date(r.draw_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="flex items-center gap-1 font-orbitron text-neon-cyan">
                        {r.total_tickets} Boletos
                      </span>
                    </div>

                    <Link
                      href={`/admin/raffles/${r.id}`}
                      className="inline-flex items-center gap-1.5 w-full justify-center py-2 px-4 rounded-xl text-xs font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all uppercase tracking-wider"
                    >
                      Administrar Sorteo
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-neutral-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-white/5">
              <h3 className="text-sm font-orbitron font-black text-white uppercase">Crear Nuevo Sorteo</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-white/5 rounded-lg text-white/50 hover:text-white transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Título del Sorteo *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej. Sorteo de Setup Gaming Premium"
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-neon-cyan text-xs text-white"
                    required
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Descripción *</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe los detalles del sorteo y premios..."
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
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-neon-cyan text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Precio del Boleto (RD$) *</label>
                  <input
                    type="number"
                    min={1}
                    value={ticketPrice}
                    onChange={(e) => setTicketPrice(Number(e.target.value))}
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-neon-cyan text-xs text-white"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Total de Boletos (Cantidad) *</label>
                  <input
                    type="number"
                    min={10}
                    value={totalTickets}
                    onChange={(e) => setTotalTickets(Number(e.target.value))}
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:border-neon-cyan text-xs text-white"
                    required
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
                      placeholder="Ej. Banco Popular"
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
                      placeholder="Nombre completo"
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
                      placeholder="Ej. 792-348293-1"
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
                      placeholder="Ej. Colocar cédula en concepto"
                      className="w-full px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-neon-purple text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Error messages */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl text-center">
                  {error}
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white/50 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 transition-all disabled:opacity-40"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> Guardando...
                    </>
                  ) : (
                    'Crear Sorteo'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
