'use client'

import { useState } from 'react'
import { activateTournament } from '@/lib/actions/tournaments'
import { useRouter } from 'next/navigation'

export function ActivateTournamentButton({ id }: { id: string }) {
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  const handleActivate = async () => {
    if (!confirm('¿Estás seguro de que deseas activar el torneo? Esto bloqueará los cambios en la configuración.')) {
      return
    }

    setIsPending(true)
    try {
      const result = await activateTournament(id)
      if (result && 'error' in result) {
        alert(result.error)
      } else {
        router.refresh()
      }
    } catch (err) {
      alert('Error inesperado al activar el torneo')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <button
      onClick={handleActivate}
      disabled={isPending}
      className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl
        font-semibold text-sm text-white bg-gradient-to-r from-neon-cyan to-neon-purple
        hover:opacity-90 active:scale-[0.97] transition-all duration-150
        shadow-lg shadow-neon-cyan/10 disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isPending ? (
        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M5 3l14 9-14 9V3z" />
        </svg>
      )}
      {isPending ? 'Activando...' : 'Activar Torneo'}
    </button>
  )
}
