'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInvitation, rejectInvitation } from '@/lib/actions/streamer-staff'
import { toast } from 'sonner'
import { Check, X, Shield } from 'lucide-react'

interface StaffInviteBannerProps {
  myInvites: any[]
}

export function StaffInviteBanner({ myInvites }: StaffInviteBannerProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleAction = async (id: string, accept: boolean) => {
    setLoadingId(id)
    try {
      const res = accept ? await acceptInvitation(id) : await rejectInvitation(id)
      if ('error' in res) {
        toast.error(`Error: ${res.error}`)
      } else {
        toast.success(accept ? 'Invitación aceptada con éxito' : 'Invitación rechazada')
        router.refresh()
      }
    } catch (err: any) {
      toast.error('Ocurrió un error al procesar la invitación')
    } finally {
      setLoadingId(null)
    }
  }

  if (!myInvites || myInvites.length === 0) return null

  return (
    <div className="space-y-3 mb-6">
      {myInvites.map((invite) => {
        const streamerName = invite.streamer?.organization_name || invite.streamer?.username || 'Streamer'
        const roleLabels: Record<string, string> = {
          editor: 'Editor',
          referee: 'Árbitro',
          analyst: 'Analista'
        }
        const roleLabel = roleLabels[invite.role] || invite.role

        return (
          <div
            key={invite.id}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-neon-purple/20 to-purple-500/5 border border-neon-purple/35 shadow-[0_0_15px_rgba(176,38,255,0.1)] transition-all duration-300"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center text-neon-purple shrink-0 mt-0.5">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Invitación de Staff Pendiente</h3>
                <p className="text-xs text-white/60 mt-1 leading-relaxed">
                  El streamer <strong className="text-neon-purple">@{streamerName}</strong> te ha invitado a formar parte de su staff con el rol de <strong className="text-white">{roleLabel}</strong>. Al aceptar, podrás colaborar en la gestión de sus torneos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
              <button
                disabled={loadingId !== null}
                onClick={() => handleAction(invite.id, false)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 disabled:opacity-50 transition-all duration-150"
              >
                <X className="w-3.5 h-3.5" /> Rechazar
              </button>
              <button
                disabled={loadingId !== null}
                onClick={() => handleAction(invite.id, true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-black bg-neon-purple hover:bg-[#b026ff]/90 active:scale-95 disabled:opacity-50 transition-all duration-150 shadow-[0_0_15px_rgba(176,38,255,0.2)]"
              >
                <Check className="w-3.5 h-3.5" /> {loadingId === invite.id ? 'Aceptando...' : 'Aceptar'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
