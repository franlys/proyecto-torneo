'use client'

import { useState } from 'react'
import { cleanupTournamentDiscordChannels } from '@/lib/actions/tournaments'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function CleanupDiscordButton({ id }: { id: string }) {
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  const handleCleanup = async () => {
    if (!confirm('¿Estás seguro de eliminar todos los canales de voz, chat y categoría creados en Discord para este torneo?')) {
      return
    }

    setIsPending(true)
    try {
      const res = await cleanupTournamentDiscordChannels(id)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success(res.message)
        router.refresh()
      }
    } catch (err: any) {
      toast.error('Error al limpiar canales de Discord: ' + (err.message || err))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <button
      onClick={handleCleanup}
      disabled={isPending}
      title="Elimina todos los canales temporales de voz, chat y categoría creados para este torneo en Discord"
      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold
        text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40
        active:scale-[0.98] transition-all duration-150 shadow-lg shadow-red-500/5
        disabled:opacity-50 disabled:cursor-not-allowed font-orbitron"
    >
      {isPending ? (
        <div className="w-3.5 h-3.5 border-2 border-red-400/20 border-t-red-400 rounded-full animate-spin shrink-0" />
      ) : (
        <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      )}
      <span>{isPending ? 'Borrando...' : 'Borrar Canales Discord'}</span>
    </button>
  )
}
