'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  authorizePartnerAction,
  updatePartnerFlagsAction,
  revokePartnerAction,
} from '@/lib/actions/kick-partners'
import { KickStreamerPartner } from '@/types'

interface KickUserOption {
  id: string
  user_id: string
  kick_user_id: string
  kick_username: string | null
  created_at: string
  profiles: { id: string; username: string | null; role: string } | null
}

interface KickPartnersClientProps {
  kickUsers: KickUserOption[]
  initialPartners: KickStreamerPartner[]
}

export default function KickPartnersClient({
  kickUsers,
  initialPartners,
}: KickPartnersClientProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  // Map partners list
  const partnerUserIds = new Set(
    initialPartners
      .filter((p) => !p.revokedAt)
      .map((p) => p.userId)
  )

  // Users with Kick connected who are not yet active partners
  const availableUsers = kickUsers.filter((u) => !partnerUserIds.has(u.user_id))

  const handleAuthorize = async () => {
    if (!selectedUserId) {
      toast.error('Selecciona un usuario para autorizar')
      return
    }

    setLoadingId('authorize')
    const res = await authorizePartnerAction(selectedUserId)
    setLoadingId(null)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Partner autorizado exitosamente')
      setSelectedUserId('')
      router.refresh()
    }
  }

  const handleToggleIntegration = async (partner: KickStreamerPartner) => {
    setLoadingId(partner.id)
    const newIntegration = !partner.integrationEnabled
    const newSubscriber = newIntegration ? partner.subscriberTournamentsEnabled : false

    const res = await updatePartnerFlagsAction(partner.id, newIntegration, newSubscriber)
    setLoadingId(null)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(`Integración Kick ${newIntegration ? 'activada' : 'desactivada'}`)
      router.refresh()
    }
  }

  const handleToggleSubTournaments = async (partner: KickStreamerPartner) => {
    if (!partner.integrationEnabled) {
      toast.error('Debes activar primero la integración Kick para habilitar torneos de suscriptores')
      return
    }

    setLoadingId(partner.id)
    const newSubscriber = !partner.subscriberTournamentsEnabled

    const res = await updatePartnerFlagsAction(partner.id, partner.integrationEnabled, newSubscriber)
    setLoadingId(null)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(`Torneos para suscriptores ${newSubscriber ? 'activados' : 'desactivados'}`)
      router.refresh()
    }
  }

  const handleRevoke = async (partnerId: string) => {
    if (!confirm('¿Estás seguro de revocar los permisos de este Streamer Partner?')) {
      return
    }

    setLoadingId(partnerId)
    const res = await revokePartnerAction(partnerId)
    setLoadingId(null)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Partner revocado exitosamente')
      router.refresh()
    }
  }

  const filteredPartners = initialPartners.filter((p) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const username = p.username?.toLowerCase() || ''
    const kickUsername = p.kickUsername?.toLowerCase() || ''
    const kickId = p.kickUserId.toLowerCase()
    return username.includes(q) || kickUsername.includes(q) || kickId.includes(q)
  })

  return (
    <div className="space-y-8">
      {/* ── Section 1: Authorize New Partner ── */}
      <section className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="text-neon-cyan">➕</span>
          <span>Autorizar Nuevo Kick Streamer Partner</span>
        </div>
        <p className="text-xs text-white/50">
          Selecciona un usuario que tenga una cuenta de Kick conectada en Kronix para otorgarle el estado de Partner.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="flex-1 bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-cyan"
          >
            <option value="">Seleccionar usuario con Kick vinculado...</option>
            {availableUsers.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.profiles?.username || 'Sin username'} (Kick: {u.kick_username || u.kick_user_id})
              </option>
            ))}
          </select>

          <button
            onClick={handleAuthorize}
            disabled={!selectedUserId || loadingId === 'authorize'}
            className="px-5 py-2.5 rounded-xl bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {loadingId === 'authorize' ? 'Autorizando...' : 'Autorizar Partner'}
          </button>
        </div>
      </section>

      {/* ── Section 2: Streamer Partners List ── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>Partners Registrados</span>
            <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-white/10 text-white/60">
              {filteredPartners.length}
            </span>
          </h2>

          <input
            type="text"
            placeholder="Buscar por usuario o Kick handle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-black/40 border border-white/15 rounded-xl px-4 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-neon-purple w-full sm:w-64"
          />
        </div>

        {filteredPartners.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 text-sm text-white/40">
            No se encontraron Streamer Partners registrados.
          </div>
        ) : (
          <div className="overflow-x-auto border border-white/10 rounded-2xl bg-black/20">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-white/50 font-medium uppercase tracking-wider">
                  <th className="py-3.5 px-4">Usuario Kronix</th>
                  <th className="py-3.5 px-4">Cuenta Kick</th>
                  <th className="py-3.5 px-4 text-center">Integración Kick</th>
                  <th className="py-3.5 px-4 text-center">Torneos Subs</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPartners.map((partner) => {
                  const isRevoked = Boolean(partner.revokedAt)
                  const isLoading = loadingId === partner.id

                  return (
                    <tr
                      key={partner.id}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        isRevoked ? 'opacity-50 bg-red-950/10' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-medium text-white">
                        {partner.username || partner.userId}
                      </td>

                      <td className="py-3.5 px-4 text-white/70">
                        <span className="font-mono text-emerald-400">
                          {partner.kickUsername
                            ? `@${partner.kickUsername}`
                            : partner.kickUserId}
                        </span>
                      </td>

                      {/* Integration Enabled Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          disabled={isRevoked || isLoading}
                          onClick={() => handleToggleIntegration(partner)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold transition-all ${
                            partner.integrationEnabled
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-white/5 border-white/15 text-white/40'
                          } ${isRevoked ? 'cursor-not-allowed' : 'hover:scale-105'}`}
                        >
                          <span>{partner.integrationEnabled ? '🟢 ON' : '🔴 OFF'}</span>
                        </button>
                      </td>

                      {/* Subs Tournaments Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          disabled={isRevoked || !partner.integrationEnabled || isLoading}
                          onClick={() => handleToggleSubTournaments(partner)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold transition-all ${
                            partner.subscriberTournamentsEnabled
                              ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                              : 'bg-white/5 border-white/15 text-white/40'
                          } ${isRevoked || !partner.integrationEnabled ? 'cursor-not-allowed opacity-50' : 'hover:scale-105'}`}
                        >
                          <span>{partner.subscriberTournamentsEnabled ? '🟢 ON' : '🔴 OFF'}</span>
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {isRevoked ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold uppercase">
                            Revocado
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase">
                            Activo
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {!isRevoked && (
                          <button
                            disabled={isLoading}
                            onClick={() => handleRevoke(partner.id)}
                            className="px-3 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-[11px] font-medium transition-all"
                          >
                            Revocar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
