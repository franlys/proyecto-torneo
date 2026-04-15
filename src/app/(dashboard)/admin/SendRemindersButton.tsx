'use client'

import { useTransition, useState } from 'react'
import { sendSubscriptionReminders } from '@/lib/actions/admin'

export function SendRemindersButton() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ sent?: number; error?: string } | null>(null)

  function handleClick() {
    startTransition(async () => {
      const res = await sendSubscriptionReminders()
      setResult(res)
      setTimeout(() => setResult(null), 5000)
    })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/60 text-sm rounded-lg hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        {isPending ? 'Enviando...' : 'Enviar recordatorios de renovación'}
      </button>
      {result && (
        <span className={`text-xs ${result.error ? 'text-red-400' : 'text-green-400'}`}>
          {result.error ?? `✓ ${result.sent} recordatorio${(result.sent ?? 0) !== 1 ? 's' : ''} enviado${(result.sent ?? 0) !== 1 ? 's' : ''}`}
        </span>
      )}
    </div>
  )
}
