'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SubmissionData {
  id: string
  match_id: string
  kill_count: number
  pot_top: boolean
  teams?: {
    name?: string
    avatar_url?: string
  }
  evidence_files?: Array<{
    storage_path: string
    mime_type: string
  }>
}

interface MatchData {
  id: string
  name?: string
  match_number: number
  is_warmup?: boolean
}

interface MatchRecapProps {
  matches: MatchData[]
  submissions: SubmissionData[]
  primaryColor: string
}

export function MatchRecap({ matches, submissions, primaryColor }: MatchRecapProps) {
  const [activeMatch, setActiveMatch] = useState<string | null>(matches[0]?.id || null)

  const activeMatchData = matches.find(m => m.id === activeMatch)
  const activeSubmissions = submissions.filter(s => s.match_id === activeMatch)

  // Top Fragger de ESTA partida específica: la persona con más kills en esta ronda.
  // No tiene relación con el acumulado del torneo ni con la tabla de equipos.
  const matchTopFragger = activeSubmissions.length > 0
    ? activeSubmissions.reduce((best, s) =>
        s.kill_count > (best?.kill_count ?? -1) ? s : best
      , activeSubmissions[0])
    : null

  const totalKillsInMatch = activeSubmissions.reduce((sum, s) => sum + (s.kill_count ?? 0), 0)

  return (
    <div className="w-full space-y-5">

      {/* ── Selector de Partidas ─────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {matches.map(m => (
          <button
            key={m.id}
            onClick={() => setActiveMatch(m.id)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full font-orbitron text-xs sm:text-sm transition-all border ${
              activeMatch === m.id
                ? 'bg-white/10 text-white'
                : 'border-white/5 text-white/40 hover:text-white/80 hover:bg-white/[0.02]'
            }`}
            style={{ borderColor: activeMatch === m.id ? primaryColor : undefined }}
          >
            {m.is_warmup && (
              <span className="text-[8px] uppercase tracking-wider text-orange-400/80 font-bold border border-orange-400/30 px-1 py-0.5 rounded">
                Warm-up
              </span>
            )}
            {m.name || `Partida ${m.match_number}`}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeMatch && (
          <motion.div
            key={activeMatch}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* ── Header de la partida activa ──────────────────────────── */}
            {activeMatchData && (
              <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/30 mb-0.5">
                    Resultados de
                  </p>
                  <h2 className="font-orbitron font-bold text-lg sm:text-xl text-white tracking-wide flex items-center gap-2">
                    {activeMatchData.name || `Partida ${activeMatchData.match_number}`}
                    {activeMatchData.is_warmup && (
                      <span className="text-[9px] uppercase tracking-wider text-orange-400 font-bold border border-orange-400/30 px-1.5 py-0.5 rounded">
                        Calentamiento
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-white/30 mt-0.5">
                    {activeSubmissions.length} equipos registrados · {totalKillsInMatch} kills totales en esta ronda
                  </p>
                </div>

                {/* Top Fragger de ESTA partida — contexto: solo esta ronda */}
                {matchTopFragger && (matchTopFragger.kill_count ?? 0) > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neon-purple/10 border border-neon-purple/30 shrink-0">
                    <span className="text-sm">🎯</span>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-neon-purple/70 font-bold">
                        Top Fragger — Esta Partida
                      </p>
                      <p className="font-orbitron font-bold text-sm text-white">
                        {matchTopFragger.teams?.name ?? '—'}
                      </p>
                      <p className="text-[10px] text-neon-purple/80">
                        {matchTopFragger.kill_count} kills en esta ronda
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Cards de resultados ────────────────────────────────── */}
            {activeSubmissions.length === 0 ? (
              <div className="col-span-full py-12 text-center text-white/30 border border-dashed border-white/10 rounded-2xl">
                No hay resultados ni evidencias publicadas para esta partida.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {activeSubmissions
                  .slice()
                  .sort((a, b) => (b.kill_count ?? 0) - (a.kill_count ?? 0))
                  .map((sub, idx) => {
                    const media = sub.evidence_files && sub.evidence_files.length > 0
                      ? sub.evidence_files[0]
                      : null
                    const isVideo = media?.mime_type?.startsWith('video/')
                    const mediaUrl = media
                      ? `https://otssvwinchttedisfqtr.supabase.co/storage/v1/object/public/evidences/${media.storage_path}`
                      : null
                    const isMatchMvp = matchTopFragger?.id === sub.id && (sub.kill_count ?? 0) > 0

                    return (
                      <div
                        key={sub.id}
                        className={`bg-dark-card border rounded-2xl overflow-hidden shadow-xl group transition-all ${
                          isMatchMvp
                            ? 'border-neon-purple/50 shadow-neon-purple/10'
                            : 'border-white/5 hover:border-white/20'
                        }`}
                      >
                        {/* MVP ribbon */}
                        {isMatchMvp && (
                          <div className="bg-gradient-to-r from-neon-purple/30 to-transparent px-4 py-1.5 flex items-center gap-2 border-b border-neon-purple/20">
                            <span className="text-xs">🎯</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neon-purple">
                              Top Fragger — Partida {activeMatchData?.match_number}
                            </span>
                          </div>
                        )}

                        {/* Kill rank badge (solo contextual de esta partida) */}
                        {!isMatchMvp && idx === 0 && (
                          <div className="absolute hidden" />
                        )}

                        {/* Media Header */}
                        <div className="w-full h-44 bg-black/50 relative overflow-hidden flex items-center justify-center">
                          {mediaUrl ? (
                            isVideo ? (
                              <video
                                src={mediaUrl}
                                className="w-full h-full object-cover"
                                controls
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={mediaUrl}
                                alt="Evidencia"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            )
                          ) : (
                            <span className="text-white/20 text-xs uppercase tracking-widest font-orbitron">
                              Sin Evidencia
                            </span>
                          )}
                          {/* Rank overlay */}
                          <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/70 border border-white/10 flex items-center justify-center">
                            <span className="font-orbitron font-bold text-xs text-white/60">
                              {idx + 1}
                            </span>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            {sub.teams?.avatar_url && (
                              <img
                                src={sub.teams.avatar_url}
                                className="w-8 h-8 rounded-md"
                                alt=""
                              />
                            )}
                            <h3 className="font-orbitron text-base font-bold text-white tracking-wide truncate">
                              {sub.teams?.name}
                            </h3>
                          </div>

                          <div className="flex items-center gap-3 text-sm">
                            {/* Kills de esta partida */}
                            <div className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                              <span className="text-white/40 block text-[10px] uppercase">
                                Kills esta ronda
                              </span>
                              <span className="text-white font-bold font-orbitron">
                                {sub.kill_count}
                              </span>
                            </div>
                            {sub.pot_top && (
                              <div className="bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-500/20">
                                <span className="text-orange-400 block text-[10px] uppercase">
                                  Placement
                                </span>
                                <span className="text-orange-500 font-bold">Top 1 🏆</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
