'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Trophy,
  Target,
  Flame,
  TrendingUp,
  Award,
  Medal,
  Calendar,
  Gamepad2,
  Loader2,
  ShieldAlert,
  Users
} from 'lucide-react'
import { getParticipantCareerStatsAction, type PlayerCareerProfile } from '@/lib/actions/participants'

interface ParticipantProfileModalProps {
  isOpen: boolean
  onClose: () => void
  participant: {
    id: string
    displayName: string
    userId?: string | null
    avatarUrl?: string | null
    teamName?: string | null
  } | null
}

export function ParticipantProfileModal({
  isOpen,
  onClose,
  participant,
}: ParticipantProfileModalProps) {
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState<PlayerCareerProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !participant) return

    let isMounted = true
    setLoading(true)
    setError(null)

    getParticipantCareerStatsAction({
      userId: participant.userId,
      displayName: participant.displayName,
    })
      .then((res) => {
        if (!isMounted) return
        if ('error' in res) {
          setError(res.error)
        } else {
          setProfileData(res.data)
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err.message || 'Error al cargar estadísticas')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, participant])

  if (!isOpen || !participant) return null

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('es-DO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const getRankBadge = (rank: number | null) => {
    if (rank === 1) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 font-orbitron">
          🥇 1º Lugar (Campeón)
        </span>
      )
    }
    if (rank === 2) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-300/20 border border-slate-300/40 text-slate-300 font-orbitron">
          🥈 2º Lugar
        </span>
      )
    }
    if (rank === 3) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-700/20 border border-amber-700/40 text-amber-500 font-orbitron">
          🥉 3º Lugar
        </span>
      )
    }
    if (rank && rank <= 5) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-orbitron">
          Top 5 (#{rank})
        </span>
      )
    }
    if (rank) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 border border-white/10 text-white/60 font-orbitron">
          #{rank} Lugar
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] text-white/30 italic">
        En progreso
      </span>
    )
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative w-full max-w-2xl bg-[#0b0d12] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,245,255,0.15)] overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header Gradient Stripe */}
          <div className="h-1.5 w-full bg-gradient-to-r from-neon-cyan via-neon-purple to-yellow-400" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all z-20"
          >
            <X size={18} />
          </button>

          {/* Top Banner & Player Info */}
          <div className="p-6 pb-4 border-b border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                {profileData?.avatarUrl || participant.avatarUrl ? (
                  <img
                    src={profileData?.avatarUrl || participant.avatarUrl || ''}
                    alt={participant.displayName}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-neon-cyan/40 shadow-lg shadow-neon-cyan/10"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-neon-cyan/10 border-2 border-neon-cyan/30 flex items-center justify-center text-2xl font-bold font-orbitron text-neon-cyan">
                    {participant.displayName.substring(0, 2).toUpperCase()}
                  </div>
                )}
                {profileData && profileData.firstPlaces > 0 && (
                  <span className="absolute -top-2 -right-2 text-xl" title="Campeón de Torneo">
                    👑
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h2 className="text-xl sm:text-2xl font-black font-orbitron text-white tracking-wide truncate">
                    {participant.displayName}
                  </h2>
                  {profileData?.federationPoints != null && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-neon-cyan/15 border border-neon-cyan/30 text-neon-cyan font-orbitron">
                      ⚡ FED {profileData.federationPoints} PTS
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                  {participant.teamName && (
                    <span className="flex items-center gap-1 text-white/80 font-medium">
                      <Users size={13} className="text-neon-cyan" />
                      {participant.teamName}
                    </span>
                  )}
                  <span>•</span>
                  <span className="flex items-center gap-1 uppercase tracking-wider text-[11px] text-white/40">
                    <Gamepad2 size={13} />
                    {profileData?.dominantDiscipline || 'E-Sports'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Body / Stats */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {loading ? (
              <div className="py-16 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-neon-cyan animate-spin mx-auto" />
                <p className="text-xs text-white/40 font-orbitron tracking-wider uppercase">
                  Cargando expediente histórico del jugador...
                </p>
              </div>
            ) : error ? (
              <div className="py-12 text-center space-y-2">
                <ShieldAlert className="w-8 h-8 text-red-400 mx-auto" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            ) : (
              <>
                {/* 6 Key Historical Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Torneos Jugados */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-white/40">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Copas Jugadas</span>
                      <Trophy size={14} className="text-yellow-400" />
                    </div>
                    <div className="text-xl font-black font-orbitron text-white">
                      {profileData?.totalTournaments ?? 0}
                    </div>
                    <p className="text-[10px] text-white/40">Torneos registrados</p>
                  </div>

                  {/* Podios Totales */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-white/40">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Podios (Top 3)</span>
                      <Medal size={14} className="text-neon-cyan" />
                    </div>
                    <div className="text-xl font-black font-orbitron text-neon-cyan">
                      {profileData?.podiumsCount ?? 0}
                    </div>
                    <p className="text-[10px] text-white/40">1º, 2º y 3º lugares</p>
                  </div>

                  {/* Kills Totales */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-white/40">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Kills Históricas</span>
                      <Target size={14} className="text-red-400" />
                    </div>
                    <div className="text-xl font-black font-orbitron text-red-400">
                      {profileData?.totalKills ?? 0}
                    </div>
                    <p className="text-[10px] text-white/40">Bajas acumuladas</p>
                  </div>

                  {/* Promedio de Kills */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-white/40">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Promedio Kills</span>
                      <Flame size={14} className="text-orange-400" />
                    </div>
                    <div className="text-xl font-black font-orbitron text-orange-400">
                      {profileData?.avgKillsPerTournament ?? 0}
                    </div>
                    <p className="text-[10px] text-white/40">Kills / torneo</p>
                  </div>

                  {/* Win Rate */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-white/40">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Win Rate</span>
                      <TrendingUp size={14} className="text-emerald-400" />
                    </div>
                    <div className="text-xl font-black font-orbitron text-emerald-400">
                      {profileData?.winRate ?? 0}%
                    </div>
                    <p className="text-[10px] text-white/40">% de victorias #1</p>
                  </div>

                  {/* Top 5 Finish */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-white/40">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Llegadas Top 5</span>
                      <Award size={14} className="text-purple-400" />
                    </div>
                    <div className="text-xl font-black font-orbitron text-purple-400">
                      {profileData?.top5Count ?? 0}
                    </div>
                    <p className="text-[10px] text-white/40">Clasificaciones altas</p>
                  </div>
                </div>

                {/* Tournament History Log */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white font-orbitron flex items-center gap-2">
                      <Calendar size={14} className="text-neon-cyan" />
                      Historial de Copas & Torneos Anteriores
                    </h3>
                    <span className="text-[11px] text-white/40">
                      {profileData?.tournamentsHistory.length || 0} registros
                    </span>
                  </div>

                  {(!profileData?.tournamentsHistory || profileData.tournamentsHistory.length === 0) ? (
                    <div className="p-6 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center space-y-1">
                      <p className="text-xs font-semibold text-white/60">
                        ¡Este es el torneo debut de {participant.displayName}!
                      </p>
                      <p className="text-[11px] text-white/30">
                        Sus estadísticas se irán registrando conforme dispute partidas en la plataforma.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {profileData.tournamentsHistory.map((tourney) => (
                        <div
                          key={tourney.id}
                          className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-white truncate max-w-[240px] sm:max-w-[320px]">
                                {tourney.name}
                              </h4>
                              {getRankBadge(tourney.rank)}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-white/40">
                              <span>Equipo: <strong className="text-white/70">{tourney.teamName}</strong></span>
                              <span>•</span>
                              <span>{formatDate(tourney.date)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                            {tourney.kills > 0 && (
                              <div className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-orbitron font-bold text-[11px]">
                                🎯 {tourney.kills} Kills
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/5 bg-black/40 flex justify-between items-center text-xs">
            <span className="text-[10px] text-white/30 font-orbitron uppercase">
              Expediente Kronix E-Sports
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold uppercase text-[11px] transition-all"
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
