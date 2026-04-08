'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTournament } from '@/lib/actions/tournaments'

interface DeleteTournamentButtonProps {
  id: string
  name: string
}

export function DeleteTournamentButton({ id, name }: DeleteTournamentButtonProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    const confirmed = window.confirm(
      `¿Eliminar "${name}"?\n\nEsta acción es permanente y borrará todos los equipos, partidas, estadísticas y puntuaciones. No se puede deshacer.`
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      const result = await deleteTournament(id)
      if ('error' in result) {
        alert(`Error: ${result.error}`)
        setDeleting(false)
        return
      }
      // Navigate back to tournaments list after successful delete
      router.push('/tournaments')
      router.refresh()
    } catch {
      alert('Error inesperado al eliminar el torneo.')
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
        text-red-400 border border-red-500/20 bg-red-500/5
        hover:bg-red-500/10 hover:border-red-500/40
        active:scale-[0.97]
        transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {deleting ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Eliminando...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Eliminar torneo permanentemente
        </>
      )}
    </button>
  )
}
