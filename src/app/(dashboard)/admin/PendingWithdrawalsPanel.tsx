'use client'

import React, { useState } from 'react'
import { ArrowDownLeft, ExternalLink, Check, X, Loader2 } from 'lucide-react'
import { approveWithdrawalAction, rejectWithdrawalAction } from '@/lib/actions/withdrawals'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface PendingWithdrawal {
  id: string
  user_id: string
  amount: number
  usd_amount: number
  paypal_email: string
  status: string
  created_at: string
  profiles?: {
    username?: string | null
    email?: string | null
  } | null
}

export function PendingWithdrawalsPanel({ withdrawals }: { withdrawals: PendingWithdrawal[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const router = useRouter()

  if (!withdrawals || withdrawals.length === 0) return null

  const handleApprove = async (w: PendingWithdrawal) => {
    if (!confirm(`¿Confirmas que ya enviaste $${w.usd_amount} USD a ${w.paypal_email} o deseas aprobar este retiro?`)) return
    setLoadingId(w.id)
    try {
      const res = await approveWithdrawalAction(w.id)
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success('¡Retiro completado y notificado al usuario!')
        router.refresh()
      }
    } catch (err: any) {
      toast.error('Error al aprobar retiro')
    } finally {
      setLoadingId(null)
    }
  }

  const handleReject = async (w: PendingWithdrawal) => {
    const reason = prompt('Motivo del rechazo (se reembolsarán los K-Coins al usuario):')
    if (!reason) return
    setLoadingId(w.id)
    try {
      const res = await rejectWithdrawalAction(w.id, reason)
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success('Retiro rechazado y K-Coins reembolsados al usuario.')
        router.refresh()
      }
    } catch (err: any) {
      toast.error('Error al rechazar retiro')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#121217] to-[#0d0d12] border border-amber-500/30 p-6 space-y-4 shadow-[0_0_40px_rgba(245,158,11,0.08)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <ArrowDownLeft size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-orbitron uppercase tracking-wider flex items-center gap-2">
              Solicitudes de Retiro Pendientes
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold font-mono">
                {withdrawals.length}
              </span>
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Usuarios esperando transferencia de fondos a su cuenta PayPal
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {withdrawals.map((w) => (
          <div
            key={w.id}
            className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {w.profiles?.username || 'Usuario'}
                </span>
                <span className="text-[11px] text-white/40">({w.profiles?.email || '-'})</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-white/60">
                  PayPal:{' '}
                  <strong className="text-neon-cyan font-mono text-xs">{w.paypal_email}</strong>
                </span>
                <span className="text-white/30">•</span>
                <span className="font-orbitron font-bold text-yellow-400">
                  🪙 {Number(w.amount).toFixed(2)} K-Coins
                </span>
                <span className="text-white/30">•</span>
                <span className="font-orbitron font-bold text-green-400">
                  ${Number(w.usd_amount).toFixed(2)} USD
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center">
              <a
                href="https://www.paypal.com/myaccount/transfer/homepage/buy/preview"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-[#0070ba]/20 hover:bg-[#0070ba]/40 border border-[#0070ba]/40 text-[#009cde] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                title={`Enviar $${w.usd_amount} USD a ${w.paypal_email}`}
              >
                <span>Pagar en PayPal</span>
                <ExternalLink size={12} />
              </a>

              <button
                disabled={loadingId === w.id}
                onClick={() => handleApprove(w)}
                className="px-3.5 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50"
              >
                {loadingId === w.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <>
                    <Check size={14} />
                    <span>Aprobar</span>
                  </>
                )}
              </button>

              <button
                disabled={loadingId === w.id}
                onClick={() => handleReject(w)}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50"
              >
                <X size={14} />
                <span>Rechazar</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
