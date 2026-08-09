'use client'

import { useState } from 'react'
import { syncTournamentDiscordChannels } from '@/lib/actions/tournaments'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function SyncDiscordButton({ id }: { id: string }) {
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  const handleSync = async () => {
    setIsPending(true)
    try {
      const result = await syncTournamentDiscordChannels(id)
      if (result && 'error' in result) {
        toast.error(result.error)
      } else if (result && 'message' in result) {
        toast.success(result.message)
        router.refresh()
      }
    } catch (err: any) {
      toast.error('Error al sincronizar con Discord: ' + (err.message || err))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={isPending}
      title="Crea o actualiza la categoría y canales de voz de Discord para este torneo"
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold
        text-white bg-[#5865F2]/20 border border-[#5865F2]/40 hover:bg-[#5865F2]/30 hover:border-[#5865F2]
        active:scale-[0.98] transition-all duration-150 shadow-lg shadow-[#5865F2]/10
        disabled:opacity-50 disabled:cursor-not-allowed font-orbitron"
    >
      {isPending ? (
        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin shrink-0" />
      ) : (
        <svg className="w-4 h-4 text-[#5865F2] shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0c-.172-.386-.412-.875-.623-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.873-.894a.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.894a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.156-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.156-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.156 2.418z"/>
        </svg>
      )}
      {isPending ? 'Sincronizando...' : 'Sincronizar Discord'}
    </button>
  )
}
