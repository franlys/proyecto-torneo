'use client'

import { useTransition, useState } from 'react'
import { approveSubscription, rejectSubscription } from '@/lib/actions/subscriptions'

interface SubscriptionActionsProps {
  requestId: string
  userId: string
}

export function SubscriptionActions({ requestId, userId }: SubscriptionActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState(false)

  if (done) {
    return <p className="text-white/30 text-xs italic">Acción completada — recarga para ver cambios</p>
  }

  function handleApprove() {
    startTransition(async () => {
      await approveSubscription(requestId, userId)
      setDone(true)
    })
  }

  function handleReject() {
    startTransition(async () => {
      await rejectSubscription(requestId, userId, notes)
      setDone(true)
    })
  }

  return (
    <div className="space-y-3">
      {!showRejectForm ? (
        <div className="flex items-center gap-3">
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="flex-1 py-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-40 font-medium"
          >
            {isPending ? 'Procesando...' : '✓ Aprobar suscripción'}
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            disabled={isPending}
            className="flex-1 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-40 font-medium"
          >
            ✕ Rechazar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Motivo del rechazo (opcional)..."
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/70 text-sm placeholder-white/20 focus:outline-none focus:border-red-500/30 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={isPending}
              className="flex-1 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-40"
            >
              {isPending ? 'Rechazando...' : 'Confirmar rechazo'}
            </button>
            <button
              onClick={() => setShowRejectForm(false)}
              className="px-4 py-2 text-white/40 text-sm hover:text-white/60 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
