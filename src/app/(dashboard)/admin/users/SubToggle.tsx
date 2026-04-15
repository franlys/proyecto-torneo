'use client'

import { useTransition } from 'react'
import { approveSubscription, deactivateSubscription } from '@/lib/actions/subscriptions'
import { useRouter } from 'next/navigation'

interface SubToggleProps {
  userId: string
  status: string
}

export function SubToggle({ userId, status }: SubToggleProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (status === 'ACTIVE') {
    return (
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await deactivateSubscription(userId)
            router.refresh()
          })
        }
        className="text-xs text-red-400/70 border border-red-500/20 hover:border-red-500/40 hover:text-red-400 bg-red-500/5 px-2 py-0.5 rounded-full transition-colors disabled:opacity-40"
      >
        {isPending ? '...' : 'Desactivar'}
      </button>
    )
  }

  if (status === 'PENDING') {
    return (
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            // Approve without a specific requestId — create a synthetic approval
            const res = await approveDirectly(userId)
            if (res) router.refresh()
          })
        }
        className="text-xs text-green-400/70 border border-green-500/20 hover:border-green-500/40 hover:text-green-400 bg-green-500/5 px-2 py-0.5 rounded-full transition-colors disabled:opacity-40"
      >
        {isPending ? '...' : 'Aprobar'}
      </button>
    )
  }

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await activateSubscription(userId)
          router.refresh()
        })
      }
      className="text-xs text-neon-cyan/60 border border-neon-cyan/20 hover:border-neon-cyan/40 hover:text-neon-cyan bg-neon-cyan/5 px-2 py-0.5 rounded-full transition-colors disabled:opacity-40"
    >
      {isPending ? '...' : 'Activar'}
    </button>
  )
}

// Import here to avoid circular in server actions file
import { activateSubscription, approveDirectly } from '@/lib/actions/subscriptions'
