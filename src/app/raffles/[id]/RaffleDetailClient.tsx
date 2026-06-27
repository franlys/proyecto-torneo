'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trophy, Calendar, Ticket, ArrowLeft, Upload, Loader2, Sparkles, CheckCircle2, ShieldCheck, Landmark } from 'lucide-react'
import { CountdownClock } from '@/components/raffles/CountdownClock'
import { TicketSelector } from '@/components/raffles/TicketSelector'
import { buyTicketAction } from '@/lib/actions/raffles'
import { uploadEvidence } from '@/lib/actions/storage'

interface RaffleDetailClientProps {
  raffle: any
  tickets: any[]
  isLoggedIn: boolean
}

export function RaffleDetailClient({
  raffle,
  tickets,
  isLoggedIn,
}: RaffleDetailClientProps) {
  const router = useRouter()
  const [ticketCount, setTicketCount] = useState(1)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)
  const [assignedNumbers, setAssignedNumbers] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const soldTicketsCount = tickets.filter(t => t.payment_status === 'verified').length
  const pendingTicketsCount = tickets.filter(t => t.payment_status === 'pending_verification').length

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setFilePreview(URL.createObjectURL(file))
      setError(null)
    }
  }

  // Generar números de boletos aleatorios basados en los disponibles
  const generateRandomNumbers = (count: number): string[] => {
    const occupiedNumbers = new Set(tickets.map(t => t.ticket_number))
    const numbers: string[] = []
    
    // Intentar encontrar números disponibles de forma aleatoria
    while (numbers.length < count) {
      const randomVal = Math.floor(Math.random() * raffle.total_tickets)
      const formatted = randomVal.toString().padStart(4, '0')
      
      if (!occupiedNumbers.has(formatted) && !numbers.includes(formatted)) {
        numbers.push(formatted)
      }
      
      // Salvaguarda en caso de que esté casi lleno
      if (occupiedNumbers.size + numbers.length >= raffle.total_tickets) {
        break
      }
    }
    return numbers
  }

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoggedIn) {
      setError('Debes iniciar sesión para poder adquirir boletos.')
      return
    }

    if (!selectedFile) {
      setError('Por favor selecciona una captura o foto de tu comprobante de pago.')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      // 1. Subir recibo de pago usando el helper uploadEvidence
      const formData = new FormData()
      formData.append('file', selectedFile)
      
      const fileExt = selectedFile.name.split('.').pop()
      const filePath = `raffles/${raffle.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      formData.append('filePath', filePath)

      const uploadRes = await uploadEvidence(formData)
      if ('error' in uploadRes) {
        setError(uploadRes.error)
        setIsUploading(false)
        return
      }

      const receiptUrl = `https://postgres.otssvwinchttedisfqtr.supabase.co/storage/v1/object/public/evidences/${uploadRes.path}`

      // 2. Generar números de boletos
      const ticketNumbers = generateRandomNumbers(ticketCount)
      if (ticketNumbers.length < ticketCount) {
        setError('No quedan suficientes boletos disponibles en este sorteo.')
        setIsUploading(false)
        return
      }

      // 3. Ejecutar compra en Server Action
      startTransition(async () => {
        const res = await buyTicketAction(raffle.id, ticketNumbers, receiptUrl)
        setIsUploading(false)
        if ('error' in res) {
          setError(res.error)
        } else {
          setAssignedNumbers(ticketNumbers)
          setPurchaseSuccess(true)
        }
      })
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al procesar tu solicitud.')
      setIsUploading(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header Back Button */}
      <div className="flex items-center justify-between">
        <Link
          href="/raffles"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-white uppercase tracking-wider transition-colors"
        >
          <ArrowLeft size={14} /> Volver al catálogo
        </Link>
        {raffle.status === 'finished' && (
          <span className="px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] uppercase font-bold tracking-widest font-orbitron">
            ✓ Finalizado
          </span>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Prize Info & Countdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prize Card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.01] p-6 space-y-6">
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Image Preview */}
              <div className="relative w-full sm:w-56 aspect-video sm:aspect-square rounded-xl bg-neutral-900 overflow-hidden shrink-0 border border-white/5">
                {raffle.prize_image ? (
                  <img src={raffle.prize_image} alt={raffle.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Trophy size={48} className="text-white/10" />
                  </div>
                )}
              </div>

              {/* Title & Desc */}
              <div className="flex-1 flex flex-col justify-between py-1">
                <div className="space-y-3">
                  <span className="px-2.5 py-0.5 rounded bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan text-[10px] uppercase font-bold tracking-widest font-orbitron inline-block">
                    Sorteo Oficial
                  </span>
                  <h1 className="text-xl sm:text-2xl font-orbitron font-black text-white uppercase tracking-tight leading-snug">
                    {raffle.title}
                  </h1>
                  <p className="text-xs text-white/40 leading-relaxed">
                    {raffle.description}
                  </p>
                </div>

                <div className="flex items-center gap-6 text-[11px] font-bold text-white/30 uppercase tracking-widest pt-4 border-t border-white/5">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-neon-purple" />
                    {new Date(raffle.draw_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Ticket size={13} className="text-neon-cyan" />
                    {raffle.total_tickets} Boletos
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Countdown Clock */}
          {raffle.status === 'active' && (
            <div className="p-6 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col items-center justify-center space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Tiempo restante para el sorteo</span>
              <CountdownClock targetDate={raffle.draw_date} />
            </div>
          )}

          {/* Winner info if finished */}
          {raffle.status === 'finished' && (
            <div className="p-8 bg-gradient-to-b from-gold/10 to-transparent border border-gold/20 rounded-3xl text-center space-y-4 shadow-[0_0_30px_rgba(212,175,55,0.05)]">
              <Trophy size={48} className="mx-auto text-gold animate-pulse" />
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gold/60 font-orbitron">¡Ganador Oficial Seleccionado!</span>
                <h2 className="text-2xl font-orbitron font-black text-white uppercase tracking-tight">{raffle.winner_name}</h2>
              </div>
              <div className="inline-block px-6 py-2 rounded-xl bg-gold/10 border border-gold/20 text-gold font-orbitron text-lg font-black">
                Boleto Ganador: #{tickets.find(t => t.id === raffle.winner_ticket_id)?.ticket_number || 'N/A'}
              </div>
              <p className="text-xs text-white/40 max-w-sm mx-auto">
                El sorteo se realizó mediante la ruleta digital en vivo. ¡Felicidades al ganador!
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Ticket Count Selector & Purchase */}
        <div className="space-y-6">
          {raffle.status === 'active' && !purchaseSuccess && (
            <form onSubmit={handlePurchase} className="space-y-6">
              {/* Ticket Selector Counter */}
              <TicketSelector
                ticketPrice={raffle.ticket_price}
                currency={raffle.currency}
                selectedCount={ticketCount}
                onChange={setTicketCount}
                soldTicketsCount={soldTicketsCount}
                totalTicketsCount={raffle.total_tickets}
                maxTickets={100}
              />

              {/* Bank Details */}
              <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/50 flex items-center gap-2">
                  <Landmark size={14} className="text-neon-purple" /> DATOS DE TRANSFERENCIA
                </h4>
                <div className="text-xs space-y-2 text-white/70">
                  <p><strong className="text-white/40">Banco:</strong> {raffle.payment_bank_name}</p>
                  <p><strong className="text-white/40">Titular:</strong> {raffle.payment_account_holder}</p>
                  <p><strong className="text-white/40">No. Cuenta:</strong> <span className="font-mono text-white font-bold bg-white/5 px-1.5 py-0.5 rounded">{raffle.payment_bank_id}</span></p>
                  {raffle.payment_details && (
                    <p className="text-white/40 italic mt-2 border-t border-white/5 pt-2">{raffle.payment_details}</p>
                  )}
                </div>
              </div>

              {/* Image Receipt Upload */}
              <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/50 flex items-center gap-2">
                  <Upload size={14} className="text-neon-cyan" /> COMPROBANTE DE DEPÓSITO
                </h4>
                
                {filePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-neutral-900">
                    <img src={filePreview} alt="Comprobante" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null)
                        setFilePreview(null)
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/80 hover:bg-black text-white hover:scale-105 transition-all text-xs font-bold"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border border-dashed border-white/10 hover:border-white/20 rounded-xl p-6 cursor-pointer bg-white/[0.01] hover:bg-white/[0.02] transition-all group">
                    <Upload size={24} className="text-white/20 group-hover:text-white/40 transition-colors mb-2" />
                    <span className="text-xs font-semibold text-white/40 group-hover:text-white/60 transition-colors">Subir Captura</span>
                    <span className="text-[10px] text-white/20 mt-1">PNG, JPG o JPEG</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      required
                    />
                  </label>
                )}
              </div>

              {/* Error messages */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl text-center">
                  {error}
                </div>
              )}

              {/* Submit CTA */}
              {!isLoggedIn ? (
                <Link
                  href="/login"
                  className="flex items-center justify-center w-full py-3 rounded-xl text-xs font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 uppercase tracking-widest transition-all"
                >
                  Inicia sesión para comprar
                </Link>
              ) : (
                <button
                  type="submit"
                  disabled={isUploading || isPending}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-neon-cyan to-neon-purple uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  {(isUploading || isPending) ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Procesando...
                    </>
                  ) : (
                    'Confirmar Pago e Inscribirse'
                  )}
                </button>
              )}
            </form>
          )}

          {/* Success Box */}
          {purchaseSuccess && (
            <div className="p-6 bg-gradient-to-b from-neon-cyan/10 to-transparent border border-neon-cyan/20 rounded-2xl text-center space-y-4">
              <CheckCircle2 size={44} className="mx-auto text-neon-cyan animate-pulse" />
              <div className="space-y-1">
                <h3 className="text-base font-orbitron font-black text-white uppercase">¡Reserva Completada!</h3>
                <p className="text-xs text-white/40">
                  Tu comprobante ha sido enviado. Tus números de boletos reservados son:
                </p>
              </div>
              
              <div className="flex flex-wrap gap-1.5 items-center justify-center p-3 bg-white/5 rounded-xl border border-white/5">
                {assignedNumbers.map(num => (
                  <span key={num} className="px-2.5 py-1 rounded bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan font-orbitron text-sm font-bold">
                    #{num}
                  </span>
                ))}
              </div>

              <div className="text-xs text-white/30 leading-relaxed border-t border-white/5 pt-4">
                Hemos enviado un correo a tu cuenta con los detalles. Tu boleto estará verificado una vez confirmemos la transferencia bancaria.
              </div>

              <Link
                href="/raffles/my-tickets"
                className="inline-flex items-center gap-1.5 w-full justify-center py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all uppercase tracking-wider"
              >
                Ver mis boletos
              </Link>
            </div>
          )}

          {/* Finished Raffle right panel summary */}
          {raffle.status === 'finished' && (
            <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl space-y-4 text-center">
              <ShieldCheck size={36} className="mx-auto text-neon-cyan" />
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/50">Sorteo Verificado</h4>
              <p className="text-[11px] text-white/40 leading-relaxed">
                Este sorteo ha concluido de forma legal y transparente en la plataforma de Kronix. Todos los boletos han sido cerrados y ya no se aceptan nuevos participantes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
