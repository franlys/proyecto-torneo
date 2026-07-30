'use client'

import { useState } from 'react'
import { Coins, Loader2 } from 'lucide-react'
import { grantKCoinsAction } from '@/lib/actions/admin'

interface GrantKCoinsButtonProps {
  userId: string
  currentBalance: number
}

export function GrantKCoinsButton({ userId, currentBalance }: GrantKCoinsButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [amount, setAmount] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleGrant = async () => {
    if (!amount || amount <= 0) return
    
    setLoading(true)
    setError('')
    setSuccess(false)
    
    try {
      const res = await grantKCoinsAction(userId, amount)
      if (res.error) {
        setError(res.error)
      } else {
        setSuccess(true)
        setAmount('')
        setTimeout(() => setIsOpen(false), 2000)
      }
    } catch (e: any) {
      setError(e.message || 'Error al enviar fondos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true)
          setSuccess(false)
          setError('')
        }}
        className="p-1.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 transition-colors"
        title="Enviar K-Coins (Sandbox / Test)"
      >
        <Coins size={14} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#121219] border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Coins className="text-yellow-500" />
              Enviar K-Coins
            </h3>
            
            <div className="text-xs text-white/50 bg-white/5 p-3 rounded-xl border border-white/5">
              <p>Balance actual del usuario:</p>
              <p className="font-mono text-yellow-400 font-bold text-lg mt-1">{currentBalance.toFixed(2)}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-white/40 uppercase tracking-widest font-bold">Cantidad a enviar</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="Ej. 100"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-yellow-500 font-mono"
              />
            </div>

            {error && <p className="text-xs text-red-400 font-bold">{error}</p>}
            {success && <p className="text-xs text-green-400 font-bold">¡Fondos enviados correctamente!</p>}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white/60 bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleGrant}
                disabled={loading || !amount}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-black bg-yellow-500 hover:bg-yellow-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar Envío'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
