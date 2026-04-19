'use client'

import { useState } from 'react'

interface Props {
  balance: number
  pendingWithdrawal: number
  acUrl: string
  acSecret: string
}

export default function WithdrawalButton({ balance, pendingWithdrawal, acUrl, acSecret }: Props) {
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState('')

  const disabled = balance <= 0 || pendingWithdrawal > 0 || loading || success

  async function handleRequest() {
    if (disabled) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${acUrl}/api/admin/withdrawals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ac-secret': acSecret },
        body: JSON.stringify({ amount: balance }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Error')
      setSuccess(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleRequest}
        disabled={disabled}
        className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
          success
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
            : disabled
            ? 'bg-white/5 text-white/20 border border-white/10 cursor-not-allowed'
            : 'bg-emerald-500 text-black hover:bg-emerald-400 active:scale-95'
        }`}
      >
        {loading ? 'Enviando...' : success ? 'Solicitud enviada' : 'Solicitar retiro'}
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {pendingWithdrawal > 0 && !success && (
        <p className="text-yellow-400/60 text-xs">Solicitud pendiente de aprobación</p>
      )}
    </div>
  )
}
