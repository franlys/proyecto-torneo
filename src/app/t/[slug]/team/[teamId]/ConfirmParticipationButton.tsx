'use client'

import { useState } from 'react'
import { confirmTeamParticipation } from '@/lib/actions/registration'
import { toast } from 'sonner'

export function ConfirmParticipationButton({ participantId }: { participantId: string }) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    const toastId = toast.loading('Confirmando tu participación...')
    try {
      setLoading(true)
      const res = await confirmTeamParticipation(participantId)
      if (res && 'success' in res) {
        toast.success('¡Participación confirmada con éxito!', { id: toastId })
        window.location.reload()
      } else if (res && 'error' in res) {
        if ((res as any).discordUrl) {
          toast.error(
            <div className="space-y-2">
              <p>{res.error}</p>
              <a 
                href={(res as any).discordUrl} 
                target="_blank" 
                rel="noreferrer"
                className="inline-block px-3 py-1 bg-[#5865F2] hover:bg-[#4752C4] text-white text-[10px] uppercase font-bold rounded-lg tracking-wider"
              >
                Unirse al Servidor de Discord
              </a>
            </div>,
            { id: toastId, duration: 8000 }
          )
        } else {
          toast.error(res.error, { id: toastId })
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al confirmar', { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      disabled={loading}
      onClick={handleConfirm}
      className="px-2.5 py-1 bg-neon-cyan hover:bg-neon-cyan/80 text-black text-[9px] font-black uppercase tracking-wider rounded-lg transition-all disabled:opacity-50"
    >
      {loading ? '...' : 'Confirmar'}
    </button>
  )
}
