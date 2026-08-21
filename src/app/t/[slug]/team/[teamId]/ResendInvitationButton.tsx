'use client'

import { useState } from 'react'
import { resendTeammateInvitation } from '@/lib/actions/registration'
import { toast } from 'sonner'
import { Mail } from 'lucide-react'

export function ResendInvitationButton({ participantId }: { participantId: string }) {
  const [loading, setLoading] = useState(false)

  const handleResend = async () => {
    const toastId = toast.loading('Re-enviando invitación por correo...')
    try {
      setLoading(true)
      const res = await resendTeammateInvitation(participantId)
      if (res && 'success' in res) {
        toast.success('¡Invitación enviada con éxito!', { id: toastId })
      } else if (res && 'error' in res) {
        toast.error(res.error, { id: toastId })
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al reenviar', { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      disabled={loading}
      onClick={handleResend}
      className="p-1.5 px-2 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10 hover:border-white/20 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
      title="Re-enviar correo de invitación"
    >
      <Mail className="w-3.5 h-3.5" />
      <span>{loading ? 'Enviando...' : 'Re-enviar'}</span>
    </button>
  )
}
