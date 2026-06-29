'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trophy, Calendar, Ticket, Check, X, ShieldAlert, Loader2, Play, Landmark, Image, Eye, Trash2, PlusCircle, Upload, Mail } from 'lucide-react'
import { LiveWheel } from '@/components/raffles/LiveWheel'
import { verifyTicketAction, drawRaffleAction, updateRaffleAction, deleteRaffleAction, announceRaffleToAllUsersAction } from '@/lib/actions/raffles'
import { uploadEvidence } from '@/lib/actions/storage'

interface RaffleAdminClientProps {
  raffle: any
  tickets: any[]
}

export function RaffleAdminClient({ raffle, tickets }: RaffleAdminClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'pending' | 'draw' | 'settings'>('pending')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [isAnnouncing, setIsAnnouncing] = useState(false)

  const handleAnnounce = async () => {
    if (!confirm('¿Estás seguro de que deseas anunciar este sorteo a todos los usuarios registrados por correo electrónico?')) {
      return
    }

    setIsAnnouncing(true)
    setError(null)
    try {
      const res = await announceRaffleToAllUsersAction(raffle.id)
      if ('error' in res) {
        setError(res.error)
      } else {
        alert('¡El sorteo ha sido anunciado exitosamente a todos los usuarios de la plataforma!')
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'Error al anunciar el sorteo')
    } finally {
      setIsAnnouncing(false)
    }
  }
  
  // Settings Form States
  const [title, setTitle] = useState(raffle.title)
  const [description, setDescription] = useState(raffle.description)
  const [drawDate, setDrawDate] = useState(new Date(raffle.draw_date).toISOString().slice(0, 16))
  const [ticketPrice, setTicketPrice] = useState(raffle.ticket_price)
  const [prizeImage, setPrizeImage] = useState(raffle.prize_image || '')
  
  // Local prize image/video upload states
  const [prizeFile, setPrizeFile] = useState<File | null>(null)
  const [prizeFilePreview, setPrizeFilePreview] = useState<string | null>(null)
  const [isUploadingFile, setIsUploadingFile] = useState(false)

  // Multiple payment methods states
  const [paymentMethods, setPaymentMethods] = useState<{ bankName: string; accountHolder: string; bankId: string; instructions: string; type?: 'banco' | 'paypal' | 'otro'; qrUrl?: string }[]>(() => {
    try {
      if (raffle.payment_details && raffle.payment_details.startsWith('[')) {
        const parsed = JSON.parse(raffle.payment_details)
        return parsed.map((pm: any) => ({
          ...pm,
          type: pm.type || (pm.bankName === 'PayPal' ? 'paypal' : 'banco'),
          qrUrl: pm.qrUrl
        }))
      }
    } catch (e) {}
    return [{
      bankName: raffle.payment_bank_name || '',
      accountHolder: raffle.payment_account_holder || '',
      bankId: raffle.payment_bank_id || '',
      instructions: raffle.payment_details || '',
      type: raffle.payment_bank_name === 'PayPal' ? 'paypal' : 'banco',
      qrUrl: undefined
    }]
  })
  const [qrFiles, setQrFiles] = useState<Record<number, File>>({})
  const [qrPreviews, setQrPreviews] = useState<Record<number, string>>({})

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
    ticketIds: string[]
    numbers: string[]
  }> = {}

  pendingTickets.forEach(t => {
    const key = `${t.receipt_url}_${t.buyer_email}`
    if (!groupedTransactions[key]) {
      groupedTransactions[key] = {
        buyer_name: t.buyer_name,
        buyer_email: t.buyer_email,
        buyer_phone: t.buyer_phone,
        receipt_url: t.receipt_url,
        ticketIds: [],
        numbers: []
      }
    }
    groupedTransactions[key].ticketIds.push(t.id)
    groupedTransactions[key].numbers.push(t.ticket_number)
  })

  const handlePrizeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPrizeFile(file)
      setPrizeFilePreview(URL.createObjectURL(file))
      setError(null)
    }
  }

  const handleAddPaymentMethod = () => {
    setPaymentMethods([...paymentMethods, { bankName: '', accountHolder: '', bankId: '', instructions: '', type: 'banco' }])
  }

  const handleRemovePaymentMethod = (index: number) => {
    if (paymentMethods.length > 1) {
      setPaymentMethods(paymentMethods.filter((_, idx) => idx !== index))
    }
  }

  const handlePaymentMethodChange = (index: number, field: string, value: string) => {
    const updated = [...paymentMethods]
    updated[index] = { ...updated[index], [field]: value }
    setPaymentMethods(updated)
  }

  const handleVerify = (buyerEmail: string, receiptUrl: string, approve: boolean) => {
    setError(null)
    startTransition(async () => {
      const res = await verifyTicketAction(raffle.id, buyerEmail, receiptUrl, approve ? 'verify' : 'reject')
      if ('error' in res) {
        setError(res.error)
      } else {
        router.refresh()
      }
    })
  }

  const handleDrawComplete = (winner: any) => {
    if (!winner) return
    setError(null)
    startTransition(async () => {
      const res = await drawRaffleAction(raffle.id, winner.ticketNumber)
      if ('error' in res) {
        setError(res.error)
        setTriggerSpin(false)
      } else {
        setWinnerName(winner.name)
        setWinningTicketNum(winner.ticketNumber)
        setTriggerSpin(false)
        router.refresh()
      }
    })
  }

  const handleDelete = () => {
    if (!confirm('¿Estás seguro de que deseas eliminar este sorteo permanentemente? Esta acción borrará todos los boletos asociados.')) {
      return
    }

    startTransition(async () => {
      const res = await deleteRaffleAction(raffle.id)
      if ('error' in res) {
        setError(res.error)
      } else {
        alert('Sorteo eliminado correctamente.')
        router.push('/admin/raffles')
        router.refresh()
      }
    })
  }

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate payment methods
    for (let i = 0; i < paymentMethods.length; i++) {
      const pm = paymentMethods[i]
      if (!pm.bankName || !pm.accountHolder || !pm.bankId) {
        setError(`Por favor completa los datos obligatorios para la Forma de Pago #${i + 1}.`)
        return
      }
    }

    setIsUploadingFile(true)
    let finalPrizeUrl = prizeImage

    try {
      if (prizeFile) {
        const formData = new FormData()
        formData.append('file', prizeFile)
        
        const fileExt = prizeFile.name.split('.').pop()
        const filePath = `raffles/prizes/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        formData.append('filePath', filePath)

        const uploadRes = await uploadEvidence(formData)
        if ('error' in uploadRes) {
          setError(uploadRes.error)
          setIsUploadingFile(false)
          return
        }
        const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://otssvwinchttedisfqtr.supabase.co').replace(/\/$/, '')
        finalPrizeUrl = `${supabaseUrl}/storage/v1/object/public/evidences/${uploadRes.path}`
      }

      // Upload QR files for payment methods if selected
      const updatedMethods = [...paymentMethods]
      for (let i = 0; i < updatedMethods.length; i++) {
        const file = qrFiles[i]
        if (file && (updatedMethods[i].type === 'paypal' || updatedMethods[i].type === 'otro')) {
          const formData = new FormData()
          formData.append('file', file)
          const fileExt = file.name.split('.').pop()
          const filePath = `raffles/qrs/${Date.now()}_pm_${i}_${Math.random().toString(36).substring(7)}.${fileExt}`
          formData.append('filePath', filePath)
          const uploadRes = await uploadEvidence(formData)
          if ('error' in uploadRes) {
            setError(`Error al subir el QR de la Forma de Pago #${i + 1}: ${uploadRes.error}`)
            setIsUploadingFile(false)
            return
          }
          const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://otssvwinchttedisfqtr.supabase.co').replace(/\/$/, '')
          updatedMethods[i].qrUrl = `${supabaseUrl}/storage/v1/object/public/evidences/${uploadRes.path}`
        }
      }

      startTransition(async () => {
        const primaryMethod = updatedMethods[0]
        const serializedDetails = JSON.stringify(updatedMethods)

        const res = await updateRaffleAction(raffle.id, {
          title,
          description,
          drawDate,
          ticketPrice,
          prizeImage: finalPrizeUrl || undefined,
          paymentBankName: primaryMethod.bankName,
          paymentAccountHolder: primaryMethod.accountHolder,
          paymentBankId: primaryMethod.bankId,
          paymentDetails: serializedDetails,
        })

        setIsUploadingFile(false)

        if ('error' in res) {
          setError(res.error)
        } else {
          alert('Ajustes del sorteo actualizados correctamente.')
          router.refresh()
        }
      })
    } catch (err: any) {
      setError(err.message || 'Error al procesar la subida del archivo.')
      setIsUploadingFile(false)
    }
  }

  // Prepara los participantes verificados para la ruleta
  const wheelParticipants = verifiedTickets.map(t => ({
    id: t.id,
    name: t.buyer_name,
    ticketNumber: t.ticket_number,
  }))

  const isVideo = raffle.prize_image?.match(/\.(mp4|webm|mov|avi)($|\?)/i)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <Link
            href="/admin/raffles"
            className="inline-flex items-center gap-1 text-xs font-bold text-white/50 hover:text-white uppercase tracking-wider transition-colors mb-2"
          >
            <ArrowLeft size={12} /> Volver a sorteos
          </Link>
          <h1 className="text-xl sm:text-2xl font-orbitron font-black text-white uppercase tracking-tight">
            {raffle.title}
          </h1>
          <p className="text-xs text-white/40">Realiza verificaciones, edita ajustes o gira la ruleta en vivo.</p>
        </div>

        {raffle.status !== 'finished' && (
          <button
            onClick={handleAnnounce}
            disabled={isAnnouncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-neon-cyan to-neon-purple uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {isAnnouncing ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Anunciando...
              </>
            ) : (
              <>
                <Mail size={14} /> Anunciar por Correo
              </>
            )}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 min-w-[120px] py-3.5 text-xs uppercase font-bold tracking-widest transition-colors border-b-2 ${
            activeTab === 'pending'
              ? 'text-neon-cyan border-neon-cyan font-black'
              : 'text-white/40 border-transparent hover:text-white/60'
          }`}
        >
          Transacciones Pendientes ({Object.keys(groupedTransactions).length})
        </button>
        <button
          onClick={() => setActiveTab('draw')}
          className={`flex-1 min-w-[100px] py-3.5 text-xs uppercase font-bold tracking-widest transition-colors border-b-2 ${
            activeTab === 'draw'
              ? 'text-neon-cyan border-neon-cyan font-black'
              : 'text-white/40 border-transparent hover:text-white/60'
          }`}
        >
          Ruleta en Vivo
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 min-w-[100px] py-3.5 text-xs uppercase font-bold tracking-widest transition-colors border-b-2 ${
            activeTab === 'settings'
              ? 'text-neon-cyan border-neon-cyan font-black'
              : 'text-white/40 border-transparent hover:text-white/60'
          }`}
        >
          Ajustes
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl text-center">
          {error}
        </div>
      )}

      {/* Contents */}
      <div className="space-y-6">
        {/* Tab 1: Pending Transactions */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {Object.keys(groupedTransactions).length === 0 ? (
              <div className="p-16 text-center rounded-2xl bg-white/[0.01] border border-white/5 space-y-3">
                <Check className="mx-auto text-green-400" size={36} />
                <div>
                  <h3 className="text-sm font-bold text-white/60">Todo al día</h3>
                  <p className="text-xs text-white/30 mt-1">No hay comprobantes pendientes de verificación.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {Object.values(groupedTransactions).map((tx, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl border border-white/5 bg-white/[0.01] flex flex-col md:flex-row justify-between items-start md:items-center gap-5"
                  >
                    {/* User and receipt info */}
                    <div className="flex gap-4 items-start">
                      {tx.receipt_url ? (
                        <div
                          onClick={() => setSelectedReceipt(tx.receipt_url)}
                          className="w-20 h-20 rounded-xl bg-neutral-900 overflow-hidden shrink-0 border border-white/10 hover:border-neon-cyan transition-all cursor-pointer relative group flex items-center justify-center"
                        >
                          <img src={tx.receipt_url} alt="Comprobante" className="w-full h-full object-cover group-hover:opacity-80" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye size={16} className="text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                          <Image size={24} className="text-white/20" />
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-orbitron font-bold text-white uppercase">{tx.buyer_name}</h4>
                        <p className="text-xs text-white/40 mt-0.5">{tx.buyer_email}</p>
                        <p className="text-[10px] text-white/30 uppercase mt-0.5">Celular: {tx.buyer_phone}</p>
                        
                        {/* Selected numbers list */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {tx.numbers.map(n => (
                            <span key={n} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-white/50 text-[9px] font-mono">
                              #{n}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2.5 w-full md:w-auto justify-end">
                      <button
                        onClick={() => handleVerify(tx.buyer_email, tx.receipt_url, false)}
                        disabled={isPending}
                        className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-600 hover:text-white transition-all uppercase tracking-wider"
                      >
                        Rechazar
                      </button>
                      <button
                        onClick={() => handleVerify(tx.buyer_email, tx.receipt_url, true)}
                        disabled={isPending}
                        className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 transition-all uppercase tracking-wider"
                      >
                        Aprobar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Live Wheel Drawing */}
        {activeTab === 'draw' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ruleta canvas container */}
            <div className="lg:col-span-2 bg-white/[0.01] border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center gap-6 min-h-[450px]">
              {winnerName ? (
                <div className="text-center space-y-4 animate-in fade-in zoom-in duration-300">
                  <Trophy size={60} className="mx-auto text-gold animate-bounce" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gold/60 font-orbitron">
                      ¡Tenemos un ganador!
                    </span>
                    <h2 className="text-3xl font-orbitron font-black text-white uppercase tracking-tight">
                      {winnerName}
                    </h2>
                  </div>
                  <div className="inline-block px-8 py-3 rounded-2xl bg-gold/10 border border-gold/20 text-gold font-orbitron text-xl font-black">
                    Boleto #{winningTicketNum}
                  </div>
                  <p className="text-xs text-white/40 max-w-sm mx-auto">
                    El premio de este sorteo se asignó exitosamente. ¡Felicitaciones!
                  </p>
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
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Imagen o Video del Premio</label>
                  {prizeFilePreview || prizeImage ? (
                    <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-neutral-900 flex items-center justify-center">
                      {prizeFile ? (
                        prizeFile.type.startsWith('video/') ? (
                          <video src={prizeFilePreview!} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                        ) : (
                          <img src={prizeFilePreview!} alt="Vista Previa" className="w-full h-full object-cover" />
                        )
                      ) : (
                        isVideo ? (
                          <video src={prizeImage} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                        ) : (
                          <img src={prizeImage} alt="Premio" className="w-full h-full object-cover" />
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setPrizeFile(null)
                          setPrizeFilePreview(null)
                          setPrizeImage('')
                        }}
                        className="absolute top-2 right-2 p-1 bg-black/80 hover:bg-black text-white rounded-md text-[10px] font-bold"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border border-dashed border-white/10 hover:border-white/20 rounded-xl p-4 cursor-pointer bg-white/[0.01] hover:bg-white/[0.02] transition-all">
                      <Upload size={16} className="text-white/20 mb-1" />
                      <span className="text-[10px] text-white/40 font-semibold">Subir Archivo Local</span>
                      <span className="text-[8px] text-white/20 mt-0.5 text-center">Imágenes o Videos (Max 50MB)</span>
                      <span className="text-[7px] text-neon-cyan/50 font-bold uppercase mt-0.5 text-center tracking-wider leading-relaxed">Recomendado: 16:9 (horizontal, ej. 1280x720) para evitar que se recorte o aumente</span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handlePrizeFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Multiple Payment Methods section */}
              <div className="space-y-3 pt-3 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neon-purple flex items-center gap-1.5">
                    <Landmark size={12} /> Cuentas de Banco (Formas de Pago) *
                  </span>
                  <button
                    type="button"
                    onClick={handleAddPaymentMethod}
                    className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-neon-cyan hover:underline"
                  >
                    <PlusCircle size={10} /> Agregar Otra
                  </button>
                </div>

                <div className="space-y-3">
                  {paymentMethods.map((pm, index) => (
                    <div key={index} className="p-4 bg-white/[0.01] border border-white/5 rounded-xl space-y-3 relative">
                      {paymentMethods.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePaymentMethod(index)}
                          className="absolute top-2 right-2 text-white/30 hover:text-red-400 p-1"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                      
                      <span className="text-[8px] font-orbitron font-bold text-white/40 uppercase block mb-1">
                        Forma de Pago #{index + 1}
                      </span>

                      {/* Selector de Tipo */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...paymentMethods]
                            updated[index] = {
                              ...updated[index],
                              type: 'banco',
                              bankName: updated[index].bankName === 'PayPal' ? '' : updated[index].bankName
                            }
                            setPaymentMethods(updated)
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                            (pm.type || 'banco') === 'banco'
                              ? 'bg-neon-cyan/15 border-neon-cyan/40 text-neon-cyan'
                              : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'
                          }`}
                        >
                          🏦 Banco
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...paymentMethods]
                            updated[index] = {
                              ...updated[index],
                              type: 'paypal',
                              bankName: 'PayPal'
                            }
                            setPaymentMethods(updated)
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                            pm.type === 'paypal'
                              ? 'bg-neon-purple/15 border-neon-purple/40 text-neon-purple'
                              : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'
                          }`}
                        >
                          💳 PayPal
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...paymentMethods]
                            updated[index] = {
                              ...updated[index],
                              type: 'otro',
                              bankName: updated[index].bankName === 'PayPal' ? '' : updated[index].bankName
                            }
                            setPaymentMethods(updated)
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                            pm.type === 'otro'
                              ? 'bg-white/10 border-white/20 text-white'
                              : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'
                          }`}
                        >
                          🌐 Otro / Enlace
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-white/30">
                            {pm.type === 'paypal' ? 'Plataforma *' : pm.type === 'otro' ? 'Plataforma / Servicio *' : 'Banco *'}
                          </label>
                          <input
                            type="text"
                            value={pm.bankName}
                            onChange={(e) => handlePaymentMethodChange(index, 'bankName', e.target.value)}
                            placeholder={pm.type === 'paypal' ? 'PayPal' : pm.type === 'otro' ? 'Ej. Binance Pay' : 'Ej. Banco Popular'}
                            className="w-full px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-neon-purple text-xs text-white disabled:opacity-50"
                            required
                            disabled={pm.type === 'paypal'}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-white/30">
                            {pm.type === 'paypal' ? 'Nombre del Titular *' : 'Titular de Cuenta *'}
                          </label>
                          <input
                            type="text"
                            value={pm.accountHolder}
                            onChange={(e) => handlePaymentMethodChange(index, 'accountHolder', e.target.value)}
                            placeholder="Nombre completo"
                            className="w-full px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-neon-purple text-xs text-white"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-white/30">
                            {pm.type === 'paypal' ? 'Enlace de Pago o Correo *' : pm.type === 'otro' ? 'Enlace o ID *' : 'No. Cuenta *'}
                          </label>
                          <input
                            type="text"
                            value={pm.bankId}
                            onChange={(e) => handlePaymentMethodChange(index, 'bankId', e.target.value)}
                            placeholder={pm.type === 'paypal' ? 'Ej. https://paypal.me/tu_usuario' : pm.type === 'otro' ? 'Ej. https://... o ID' : 'Ej. 792-348293-1'}
                            className="w-full px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-neon-purple text-xs text-white"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-white/30">Instrucciones Adicionales</label>
                          <input
                            type="text"
                            value={pm.instructions}
                            onChange={(e) => handlePaymentMethodChange(index, 'instructions', e.target.value)}
                            placeholder="Ej. Colocar cédula en concepto"
                            className="w-full px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-neon-purple text-xs text-white"
                          />
                        </div>

                        {(pm.type === 'paypal' || pm.type === 'otro') && (
                          <div className="space-y-1 sm:col-span-2 mt-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-white/30">Código QR de Pago (Opcional)</label>
                            <div className="flex flex-wrap items-center gap-3">
                              {(qrPreviews[index] || pm.qrUrl) ? (
                                <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-lg p-2 pr-4 shrink-0">
                                  <img
                                    src={qrPreviews[index] || pm.qrUrl}
                                    alt="Código QR"
                                    className="w-10 h-10 object-contain rounded bg-white border border-white/10"
                                  />
                                  <div>
                                    <span className="text-[8px] font-bold text-white/40 uppercase block">QR Cargado</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedPreviews = { ...qrPreviews }
                                        delete updatedPreviews[index]
                                        setQrPreviews(updatedPreviews)

                                        const updatedFiles = { ...qrFiles }
                                        delete updatedFiles[index]
                                        setQrFiles(updatedFiles)

                                        const updated = [...paymentMethods]
                                        delete updated[index].qrUrl
                                        setPaymentMethods(updated)
                                      }}
                                      className="text-[8px] font-black text-red-400 hover:underline uppercase tracking-wider block text-left"
                                    >
                                      Eliminar QR
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-white/10 hover:border-white/20 rounded-lg cursor-pointer bg-white/[0.01] hover:bg-white/[0.02] transition-all">
                                  <Upload size={12} className="text-white/20" />
                                  <span className="text-[9px] text-white/40 font-semibold">Subir Imagen de QR</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (file) {
                                        const updatedFiles = { ...qrFiles, [index]: file }
                                        setQrFiles(updatedFiles)

                                        const updatedPreviews = { ...qrPreviews, [index]: URL.createObjectURL(file) }
                                        setQrPreviews(updatedPreviews)
                                      }
                                    }}
                                    className="hidden"
                                  />
                                </label>
                              )}
                              <span className="text-[8px] text-white/20 leading-normal max-w-xs">
                                Sube una imagen de tu código QR de PayPal o pago móvil para que los usuarios puedan escanearlo y transferir más rápido.
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
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
                  disabled={isPending || isUploadingFile}
                  className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-neon-cyan to-neon-purple hover:opacity-90 transition-all disabled:opacity-40 uppercase tracking-wider"
                >
                  {(isPending || isUploadingFile) ? (
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
