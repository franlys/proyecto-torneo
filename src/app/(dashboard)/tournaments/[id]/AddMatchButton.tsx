'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addDynamicMatch } from '@/lib/actions/tournaments'

interface AddMatchButtonProps {
  id: string
  disabled?: boolean
}

export function AddMatchButton({ id, disabled = false }: AddMatchButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleAddMatch() {
    if (disabled) return
    if (!confirm('¿Estás seguro de que deseas agregar una nueva partida a este torneo en vivo?')) {
      return
    }

    startTransition(async () => {
      const res = await addDynamicMatch(id)
      if ('error' in res) {
        alert(res.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <button
      onClick={handleAddMatch}
      disabled={isPending || disabled}
      className="px-5 py-2.5 rounded-xl bg-neon-cyan text-black text-sm font-bold
        hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-1.5 disabled:cursor-not-allowed"
    >
      {isPending ? (
        'Agregando...'
      ) : disabled ? (
        <>
          <span>🔒</span>
          <span>Bloqueado: Validar Match Point</span>
        </>
      ) : (
        <>
          <span>➕</span>
          <span>Agregar Siguiente Partida</span>
        </>
      )}
    </button>
  )
}
