'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { requestAnonymousRefundAction } from '@/lib/actions/raffles'

export function RefundRequestClient() {
  const [transactionId, setTransactionId] = useState('')
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [quantity, setQuantity] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transactionId.trim() || !email.trim() || !reason.trim()) {
      setError('Por favor completa todos los campos obligatorios.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await requestAnonymousRefundAction({
        transactionId: transactionId.trim(),
        email: email.trim(),
        reason: reason.trim(),
        quantity: quantity ? parseInt(quantity) : undefined
      })

      if (res && 'error' in res) {
        setError(res.error || 'Error desconocido')
      } else {
        setSuccess(res.message || 'Tu solicitud de reembolso ha sido enviada o procesada.')
        setTransactionId('')
        setEmail('')
        setReason('')
        setQuantity('')
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-dark-card/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-neon-cyan/5 blur-[80px] rounded-full pointer-events-none" />

      <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-white/60">
            ID de Transacción de PayPal *
          </label>
          <input
            type="text"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="Ej: 8J9243..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/50 focus:outline-none transition-all placeholder:text-white/20"
            required
          />
          <p className="text-[10px] text-white/40">
            Puedes encontrar este código en tu recibo de PayPal.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-white/60">
            Correo Electrónico de Compra *
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/50 focus:outline-none transition-all placeholder:text-white/20"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-white/60">
            Cantidad de Boletos (Opcional)
          </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Ej: 2 (Vacío para todos)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/50 focus:outline-none transition-all placeholder:text-white/20"
          />
          <p className="text-[10px] text-white/40">
            Si deseas devolver solo una parte de tu compra, indícalo aquí.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-white/60">
            Motivo del Reembolso *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Por favor explica brevemente..."
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/50 focus:outline-none transition-all resize-none placeholder:text-white/20"
            required
          />
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl font-bold"
            >
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm p-4 rounded-xl font-bold flex items-center gap-2"
            >
              <span className="text-xl">✓</span>
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={loading || !!success}
          className="w-full h-14 bg-neon-cyan hover:bg-neon-cyan/90 text-black font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 flex items-center justify-center hover:shadow-[0_0_30px_rgba(0,245,255,0.3)] active:scale-[0.98]"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            'Solicitar Reembolso'
          )}
        </button>
      </form>
    </div>
  )
}
