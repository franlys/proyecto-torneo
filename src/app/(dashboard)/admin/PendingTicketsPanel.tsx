'use client'

import { useState, useTransition } from 'react'
import { Check, X, FileText, Loader2, Ticket, User, Phone, Mail } from 'lucide-react'
import { verifyTicketAction } from '@/lib/actions/raffles'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface PendingGroup {
  raffleId: string
  raffleTitle: string
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  receiptUrl: string
  createdAt: string
  ticketNumbers: string[]
}

interface PendingTicketsPanelProps {
  groups: PendingGroup[]
}

export function PendingTicketsPanel({ groups }: PendingTicketsPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [processingKey, setProcessingKey] = useState<string | null>(null)

  const handleAction = async (group: PendingGroup, action: 'verify' | 'reject') => {
    const key = `${group.raffleId}-${group.buyerEmail}-${group.receiptUrl}`
    setProcessingKey(key)

    startTransition(async () => {
      try {
        const res = await verifyTicketAction(
          group.raffleId,
          group.buyerEmail,
          group.receiptUrl,
          action
        )

        if ('error' in res && res.error) {
          toast.error(res.error)
        } else {
          toast.success(
            action === 'verify'
              ? `Boletos aprobados con éxito para ${group.buyerName}`
              : `Boletos rechazados para ${group.buyerName}`
          )
          router.refresh()
        }
      } catch (err: any) {
        toast.error('Error al procesar la acción: ' + err.message)
      } finally {
        setProcessingKey(null)
      }
    })
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center space-y-2">
        <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto text-white/30">
          <Check size={20} />
        </div>
        <p className="text-sm font-bold text-white/60">No hay validaciones de sorteos pendientes</p>
        <p className="text-xs text-white/30">Todos los pagos de boletos han sido verificados.</p>
      </div>
    )
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-white font-orbitron font-bold text-sm uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" /> Validaciones Pendientes de Sorteos
          </h2>
          <p className="text-[10px] text-white/40 mt-0.5">Valida depósitos y aprueba boletos para la ruleta en vivo.</p>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold font-orbitron">
          {groups.length} pendiente(s)
        </span>
      </div>

      <div className="divide-y divide-white/5">
        {groups.map((group) => {
          const key = `${group.raffleId}-${group.buyerEmail}-${group.receiptUrl}`
          const isCurrentProcessing = processingKey === key && isPending

          return (
            <div key={key} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.005] transition-all">
              {/* Left detail Column */}
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-neon-purple/10 border border-neon-purple/20 text-neon-purple text-[9px] font-orbitron font-bold uppercase tracking-wider">
                    Sorteo
                  </span>
                  <h3 className="text-white text-xs font-black font-orbitron uppercase line-clamp-1">
                    {group.raffleTitle}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-1.5 gap-x-4 text-xs">
                  <div className="flex items-center gap-1.5 text-white/70">
                    <User size={13} className="text-white/30 shrink-0" />
                    <span className="font-semibold truncate">{group.buyerName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/50">
                    <Mail size={13} className="text-white/30 shrink-0" />
                    <span className="truncate">{group.buyerEmail}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/50">
                    <Phone size={13} className="text-white/30 shrink-0" />
                    <span>{group.buyerPhone || 'No registrado'}</span>
                  </div>
                </div>

                {/* Ticket list */}
                <div className="flex items-start gap-1.5 text-xs">
                  <Ticket size={13} className="text-neon-cyan shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    <span className="text-white/40 mr-1 font-semibold uppercase text-[10px]">Boletos:</span>
                    {group.ticketNumbers.map((num) => (
                      <span key={num} className="px-1.5 py-0.5 bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan rounded text-[10px] font-bold font-orbitron">
                        #{num}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right action controls */}
              <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                {/* Proof button */}
                <a
                  href={group.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all"
                >
                  <FileText size={14} className="text-white/40" />
                  Comprobante
                </a>

                {/* Approve / Reject buttons */}
                <button
                  onClick={() => handleAction(group, 'verify')}
                  disabled={isPending}
                  className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all flex items-center justify-center disabled:opacity-40"
                  title="Aprobar pago"
                >
                  {isCurrentProcessing && processingKey === key ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Check size={15} />
                  )}
                </button>

                <button
                  onClick={() => handleAction(group, 'reject')}
                  disabled={isPending}
                  className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center disabled:opacity-40"
                  title="Rechazar pago"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
