'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trophy, Calendar, Ticket, ArrowLeft, Upload, Loader2, Sparkles, CheckCircle2, ShieldCheck, Landmark, X } from 'lucide-react'
import { CountdownClock } from '@/components/raffles/CountdownClock'
import { TicketSelector } from '@/components/raffles/TicketSelector'
import { buyTicketAction, validatePromoCodeAction, buyTicketPublicAction, requestRaffleRefundAction } from '@/lib/actions/raffles'
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
  const [selectedQrUrl, setSelectedQrUrl] = useState<string | null>(null)

  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null)
  const [promoDiscountPercent, setPromoDiscountPercent] = useState(0)
  const [isValidatingPromo, setIsValidatingPromo] = useState(false)
  const [promoValidationError, setPromoValidationError] = useState<string | null>(null)

  const [buyerName, setBuyerName] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [buyerPhoneConfirm, setBuyerPhoneConfirm] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')

  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false)
  const [refundName, setRefundName] = useState('')
  const [refundPhone, setRefundPhone] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [isRefundPending, setIsRefundPending] = useState(false)
  const [refundSuccess, setRefundSuccess] = useState(false)
  const [refundError, setRefundError] = useState('')

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!refundName.trim() || !refundPhone.trim() || !refundReason.trim()) {
      setRefundError('Por favor completa todos los campos.')
      return
    }

    setIsRefundPending(true)
    setRefundError('')
    setRefundSuccess(false)
    try {
      const res = await requestRaffleRefundAction({
        raffleId: raffle.id,
        buyerName: refundName.trim(),
        buyerPhone: refundPhone.trim(),
        reason: refundReason.trim(),
      })

      if (res && 'error' in res) {
        setRefundError(res.error)
      } else {
        setRefundSuccess(true)
        setRefundName('')
        setRefundPhone('')
        setRefundReason('')
      }
    } catch (err: any) {
      setRefundError(err.message || 'Error al procesar la solicitud')
    } finally {
      setIsRefundPending(false)
    }
  }

  const handleValidatePromo = async () => {
    if (!promoCodeInput.trim()) return
    setIsValidatingPromo(true)
    setPromoValidationError(null)
    try {
      const res = await validatePromoCodeAction(promoCodeInput, raffle.id)
      if ('error' in res && res.error) {
        setPromoValidationError(res.error)
        setAppliedPromoCode(null)
        setPromoDiscountPercent(0)
      } else if ('valid' in res && res.valid) {
        setAppliedPromoCode(res.code || promoCodeInput.trim().toUpperCase())
        setPromoDiscountPercent(res.discountPercent || 0)
        setPromoValidationError(null)
      }
    } catch (e: any) {
      setPromoValidationError(e.message || 'Error al validar código')
    } finally {
      setIsValidatingPromo(false)
    }
  }

  const handleRemovePromo = () => {
    setAppliedPromoCode(null)
    setPromoDiscountPercent(0)
    setPromoCodeInput('')
    setPromoValidationError(null)
  }

  const soldTicketsCount = tickets.filter(t => t.payment_status === 'verified' && !t.is_bonus).length
  const pendingTicketsCount = tickets.filter(t => t.payment_status === 'pending_verification').length
  const progressPercent = soldTicketsCount > 0
    ? Math.max(1, Math.min(100, Math.round((soldTicketsCount / raffle.total_tickets) * 100)))
    : 0

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

      const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://otssvwinchttedisfqtr.supabase.co').replace(/\/$/, '')
      const receiptUrl = `${supabaseUrl}/storage/v1/object/public/evidences/${uploadRes.path}`

      // 2. Generar números de boletos
      const ticketNumbers = generateRandomNumbers(ticketCount)
      if (ticketNumbers.length < ticketCount) {
        setError('No quedan suficientes boletos disponibles en este sorteo.')
        setIsUploading(false)
        return
      }

      // 3. Ejecutar compra en Server Action
      startTransition(async () => {
        let res
        if (isLoggedIn) {
          res = await buyTicketAction(raffle.id, ticketNumbers, receiptUrl, appliedPromoCode || undefined)
        } else {
          if (!buyerName.trim()) {
            setError('Por favor introduce tu nombre.')
            setIsUploading(false)
            return
          }
          if (!buyerPhone.trim()) {
            setError('Por favor introduce tu número de celular o WhatsApp.')
            setIsUploading(false)
            return
          }
          if (buyerPhone.trim() !== buyerPhoneConfirm.trim()) {
            setError('Los números de teléfono ingresados no coinciden. Por favor, verifícalos.')
            setIsUploading(false)
            return
          }
          res = await buyTicketPublicAction(
            raffle.id,
            buyerName.trim(),
            buyerPhone.trim(),
            buyerEmail.trim() || undefined,
            ticketNumbers,
            receiptUrl,
            appliedPromoCode || undefined
          )
        }
        setIsUploading(false)
        if (res && 'error' in res) {
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
    <div className="space-y-6">
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
                </div>

                {/* Progress bar */}
                <div className="pt-4 border-t border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/40">
                    <span>Progreso de Meta / Venta</span>
                    <span className="text-neon-cyan font-orbitron">{progressPercent}%</span>
                  </div>
                  <div className="relative w-full h-2 rounded-full bg-white/5 overflow-hidden border border-white/5">
                    <div 
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-neon-cyan to-neon-purple rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Refund Info Banner / Button Card */}
          <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-left space-y-1">
              <h4 className="text-xs font-orbitron font-bold text-white uppercase tracking-wider">
                ¿Necesitas solicitar una devolución?
              </h4>
              <p className="text-[10px] text-white/40 leading-relaxed">
                Si deseas cancelar tu participación y solicitar el reembolso de tus boletos, puedes enviar una solicitud y nos pondremos en contacto contigo.
              </p>
            </div>
            <button
              onClick={() => {
                setRefundSuccess(false)
                setRefundError('')
                setIsRefundModalOpen(true)
              }}
              type="button"
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all uppercase tracking-wider font-orbitron shrink-0"
            >
              🔄 Solicitar Devolución
            </button>
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
              {/* Ticket selector notice */}
              <div className="p-4 bg-neon-cyan/5 border border-neon-cyan/15 rounded-xl flex items-start gap-2.5">
                <span className="text-neon-cyan text-xs">💡</span>
                <p className="text-[10px] text-white/60 leading-relaxed">
                  <strong>Importante:</strong> El sorteo se llevará a cabo una vez se vendan todos los boletos o cuando se alcance la cantidad mínima de boletos vendidos.
                </p>
              </div>

              {/* Ticket Selector Counter */}
              <TicketSelector
                ticketPrice={raffle.ticket_price}
                currency={raffle.currency}
                selectedCount={ticketCount}
                onChange={setTicketCount}
                maxTickets={100}
                discountPercent={promoDiscountPercent}
              />

              {/* Código de Descuento / Streamer */}
              <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl space-y-3 max-w-md mx-auto">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/50 flex items-center gap-2">
                  🎟️ CÓDIGO DE DESCUENTO
                </h4>
                
                {appliedPromoCode ? (
                  <div className="flex items-center justify-between p-3 bg-neon-cyan/5 border border-neon-cyan/15 rounded-xl text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-white/40 uppercase font-bold font-orbitron block">Código Aplicado</span>
                      <span className="font-mono font-bold text-neon-cyan uppercase">{appliedPromoCode} ({promoDiscountPercent}% de descuento)</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold font-orbitron uppercase text-[9px] transition-colors"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="INGRESA TU CÓDIGO"
                        value={promoCodeInput}
                        onChange={(e) => setPromoCodeInput(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-neon-cyan uppercase font-mono tracking-wider placeholder:text-white/20"
                      />
                      <button
                        type="button"
                        onClick={handleValidatePromo}
                        disabled={isValidatingPromo || !promoCodeInput.trim()}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-black bg-neon-cyan hover:bg-neon-cyan/85 disabled:opacity-40 disabled:pointer-events-none transition-all uppercase tracking-widest font-orbitron"
                      >
                        {isValidatingPromo ? '...' : 'Aplicar'}
                      </button>
                    </div>
                    {promoValidationError && (
                      <p className="text-[10px] text-red-400 font-bold pl-1">
                        ⚠️ {promoValidationError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Bank Details */}
              <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/50 flex items-center gap-2">
                  <Landmark size={14} className="text-neon-purple" /> DATOS DE TRANSFERENCIA
                </h4>
                <div className="space-y-3">
                  {(() => {
                    let paymentMethodsList: {
                      bankName: string
                      accountHolder: string
                      bankId: string
                      instructions: string
                      type?: 'banco' | 'paypal' | 'otro'
                      qrUrl?: string
                    }[] = [{
                      bankName: raffle.payment_bank_name || '',
                      accountHolder: raffle.payment_account_holder || '',
                      bankId: raffle.payment_bank_id || '',
                      instructions: raffle.payment_details || ''
                    }]
                    try {
                      if (raffle.payment_details && raffle.payment_details.startsWith('[')) {
                        paymentMethodsList = JSON.parse(raffle.payment_details)
                      }
                    } catch (e) {}

                    const isUrl = (str: string) => {
                      if (!str) return false
                      return str.trim().startsWith('http://') || str.trim().startsWith('https://')
                    }

                    const renderTextWithLinks = (text: string) => {
                      if (!text) return null
                      const urlRegex = /(https?:\/\/[^\s]+)/g
                      const parts = text.split(urlRegex)
                      return parts.map((part, index) => {
                        if (part.match(urlRegex)) {
                          return (
                            <a
                              key={index}
                              href={part}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-neon-cyan hover:underline font-semibold inline-flex items-center gap-0.5"
                            >
                              {part} 🔗
                            </a>
                          )
                        }
                        return part
                      })
                    }

                    return paymentMethodsList.map((pm, idx) => (
                      <div key={idx} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-xs space-y-2 text-white/70 relative">
                        {paymentMethodsList.length > 1 && (
                          <span className="text-[8px] font-orbitron font-bold text-neon-cyan uppercase block mb-1">
                            Opción #{idx + 1}
                          </span>
                        )}
                        <p><strong className="text-white/40">Banco:</strong> {pm.bankName}</p>
                        <p><strong className="text-white/40">Titular:</strong> {pm.accountHolder}</p>
                        <p>
                          <strong className="text-white/40">
                            {isUrl(pm.bankId) ? 'Enlace de Pago' : 'No. Cuenta'}:
                          </strong>{' '}
                          {isUrl(pm.bankId) ? (
                            <a
                              href={pm.bankId.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-neon-cyan hover:text-neon-cyan/80 font-bold underline bg-neon-cyan/10 border border-neon-cyan/20 px-2 py-0.5 rounded inline-flex items-center gap-1 transition-colors"
                            >
                              Pagar en línea 🔗
                            </a>
                          ) : (
                            <span className="font-mono text-white font-bold bg-white/5 px-1.5 py-0.5 rounded">
                              {pm.bankId}
                            </span>
                          )}
                        </p>
                        {pm.instructions && !pm.instructions.startsWith('[') && (
                          <p className="text-white/40 italic mt-2 border-t border-white/5 pt-2">
                            {renderTextWithLinks(pm.instructions)}
                          </p>
                        )}
                        {pm.qrUrl && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <button
                              type="button"
                              onClick={() => setSelectedQrUrl(pm.qrUrl || null)}
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[9px] font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 uppercase tracking-widest transition-all"
                            >
                              📱 Ver Código QR
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  })()}
                </div>
              </div>

              {/* Datos de contacto (Solo si el usuario no ha iniciado sesión) */}
              {!isLoggedIn && (
                <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-white/50 flex items-center gap-2 font-orbitron">
                    👤 TUS DATOS DE CONTACTO
                  </h4>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Nombre Completo *</label>
                      <input
                        type="text"
                        placeholder="Nombre y Apellido"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-neon-cyan"
                        required
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">WhatsApp / Celular *</label>
                      <input
                        type="tel"
                        placeholder="Ej: 809-555-0100"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-neon-cyan"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Confirmar WhatsApp / Celular *</label>
                      <input
                        type="tel"
                        placeholder="Repite tu WhatsApp / Celular"
                        value={buyerPhoneConfirm}
                        onChange={(e) => setBuyerPhoneConfirm(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-neon-cyan"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Correo Electrónico (Opcional)</label>
                      <input
                        type="email"
                        placeholder="usuario@correo.com"
                        value={buyerEmail}
                        onChange={(e) => setBuyerEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-neon-cyan"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Image Receipt Upload */}
              <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/50 flex items-center gap-2 font-orbitron">
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
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/80 hover:bg-black text-white hover:scale-105 transition-all text-xs font-bold font-orbitron"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border border-dashed border-white/10 hover:border-white/20 rounded-xl p-6 cursor-pointer bg-white/[0.01] hover:bg-white/[0.02] transition-all group">
                    <Upload size={24} className="text-white/20 group-hover:text-white/40 transition-colors mb-2" />
                    <span className="text-xs font-semibold text-white/40 group-hover:text-white/60 transition-colors font-orbitron">Subir Captura</span>
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
              <button
                type="submit"
                disabled={isUploading || isPending}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-neon-cyan to-neon-purple uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 font-orbitron"
              >
                {(isUploading || isPending) ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Procesando...
                  </>
                ) : (
                  'Confirmar Pago e Inscribirse'
                )}
              </button>
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
          {/* finished raffle info */}
        </div>
      </div>

      {/* QR Modal */}
      {selectedQrUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative max-w-sm w-full bg-dark-card border border-white/10 rounded-3xl p-6 text-center space-y-4 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <button
              type="button"
              onClick={() => setSelectedQrUrl(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
            >
              <X size={16} />
            </button>
            <h3 className="font-orbitron font-black text-sm uppercase tracking-wider text-white">Escanea el Código QR</h3>
            <p className="text-[10px] text-white/40">Usa la aplicación de tu banco, billetera o cámara para escanear y realizar el pago.</p>
            <div className="bg-white p-3 rounded-2xl inline-block border border-white/10 mx-auto">
              <img
                src={selectedQrUrl}
                alt="Código QR de Pago"
                className="w-56 h-56 object-contain rounded-lg"
              />
            </div>
            <button
              type="button"
              onClick={() => setSelectedQrUrl(null)}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 uppercase tracking-widest transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Refund Request Modal */}
      {isRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative max-w-md w-full bg-[#1a1a24] border border-white/10 rounded-3xl p-6 space-y-4 shadow-[0_0_50px_rgba(0,0,0,0.8)] text-left">
            <button
              type="button"
              onClick={() => setIsRefundModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
            >
              <X size={16} />
            </button>
            <h3 className="font-orbitron font-black text-base uppercase tracking-wider text-white">
              Solicitud de Devolución
            </h3>
            <p className="text-[11px] text-white/40">
              Ingresa tus datos de compra. El administrador revisará tus boletos y se pondrá en contacto para tramitar la devolución.
            </p>

            {refundSuccess ? (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-center space-y-2">
                <CheckCircle2 size={32} className="mx-auto text-green-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">¡Solicitud Enviada!</h4>
                <p className="text-[10px] text-white/55">
                  El administrador validará tus boletos comprados y se comunicará contigo al teléfono provisto.
                </p>
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(false)}
                  className="mt-2 px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all uppercase tracking-wider"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleRefundSubmit} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 uppercase tracking-widest font-medium">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={refundName}
                    onChange={(e) => setRefundName(e.target.value)}
                    required
                    placeholder="Ej: Juan Pérez"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-neon-cyan placeholder:text-white/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 uppercase tracking-widest font-medium">
                    Número de Celular / Teléfono
                  </label>
                  <input
                    type="tel"
                    value={refundPhone}
                    onChange={(e) => setRefundPhone(e.target.value)}
                    required
                    placeholder="Ej: 8091234567"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-neon-cyan placeholder:text-white/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 uppercase tracking-widest font-medium">
                    Motivo de la devolución
                  </label>
                  <textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    required
                    rows={4}
                    placeholder="Describe el por qué solicitas la devolución..."
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-neon-cyan placeholder:text-white/20 resize-none"
                  />
                </div>

                {refundError && (
                  <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl text-center">
                    {refundError}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRefundModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all uppercase tracking-wider font-orbitron"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isRefundPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-black bg-neon-cyan hover:bg-neon-cyan/85 disabled:opacity-50 transition-all uppercase tracking-wider font-orbitron"
                  >
                    {isRefundPending ? (
                      <>
                        <Loader2 size={12} className="animate-spin" /> Procesando
                      </>
                    ) : (
                      'Enviar Solicitud'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
