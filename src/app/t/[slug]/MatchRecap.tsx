'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Participant } from '@/types'

interface SubmissionData {
  id: string
  matchId: string
  killCount: number
  rank?: number
  potTop: boolean
  teams?: {
    name?: string
    avatarUrl?: string
  }
  evidenceFiles?: Array<{
    storagePath: string
    mimeType: string
  }>
  playerKills?: Record<string, number>
}

interface MatchData {
  id: string
  name?: string
  matchNumber: number
  isWarmup?: boolean
  parentMatchId?: string
  roundNumber?: number
  mapName?: string
}

interface MatchRecapProps {
  matches: MatchData[]
  submissions: SubmissionData[]
  participants: Participant[]
  primaryColor: string
}

export function MatchRecap({ matches, submissions, participants, primaryColor }: MatchRecapProps) {
  // 1. Identify Encounters (Parents)
  const encounters = (matches || []).filter(m => !m.parentMatchId).sort((a, b) => a.matchNumber - b.matchNumber)
  
  const [isMounted, setIsMounted] = useState(false)
  const [activeEncounterId, setActiveEncounterId] = useState<string | null>(encounters[0]?.id || null)

  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // 2. Identify Rounds for the active encounter
  const rounds = (matches || [])
    .filter(m => m.parentMatchId === activeEncounterId)
    .sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0))
    
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null)

  // Effectively active match (either the round or the parent if no rounds)
  const currentMatchId = activeRoundId || rounds[0]?.id || activeEncounterId
  const activeMatchData = (matches || []).find(m => m.id === currentMatchId)
  
  // Submissions for the current selection
  const activeSubmissions = (submissions || []).filter(s => s.matchId === currentMatchId)

  // Top Fragger of this specific round
  const matchTopFragger = activeSubmissions.length > 0
    ? activeSubmissions.reduce((best, s) =>
        s.killCount > (best?.killCount ?? -1) ? s : best
      , activeSubmissions[0])
    : null

  const totalKillsInSelection = activeSubmissions.reduce((sum, s) => sum + (s.killCount ?? 0), 0)

  // Reset active round when encounter changes
  const handleEncounterChange = (id: string) => {
    setActiveEncounterId(id)
    setActiveRoundId(null)
  }

  if (!isMounted) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-white/[0.02] rounded-3xl border border-dashed border-white/5">
        <div className="w-6 h-6 border-2 border-white/10 border-t-neon-cyan rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">

      {/* ── Selector de Encuentros (Principales) ─────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {encounters.map(m => (
          <button
            key={m.id}
            onClick={() => handleEncounterChange(m.id)}
            className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl font-orbitron text-xs sm:text-sm transition-all border-2 ${
              activeEncounterId === m.id
                ? 'bg-white/10 text-white'
                : 'border-transparent bg-white/5 text-white/40 hover:text-white/80 hover:bg-white/[0.02]'
            }`}
            style={{ borderColor: activeEncounterId === m.id ? primaryColor : undefined }}
          >
            {m.isWarmup && (
              <span className="text-[9px] uppercase tracking-wider text-orange-400 font-black px-1.5 py-0.5 bg-orange-400/10 rounded">
                Warm-up
              </span>
            )}
            {m.name || `Encuentro ${m.matchNumber}`}
          </button>
        ))}
      </div>

      {/* ── Selector de Rondas (Sub-menu) — Solo si hay rondas ────────── */}
      {rounds.length > 0 && (
        <div className="flex items-center gap-4 px-2">
           <span className="text-[10px] font-bold uppercase tracking-widest text-white/20 whitespace-nowrap">Rondas del Encuentro:</span>
           <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
             {rounds.map(r => (
               <button
                 key={r.id}
                 onClick={() => setActiveRoundId(r.id)}
                 className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all border ${
                   (activeRoundId === r.id || (!activeRoundId && r === rounds[0]))
                     ? 'bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan'
                     : 'bg-white/5 border-white/5 text-white/30 hover:text-white/60'
                 }`}
               >
                 {r.name} {r.mapName ? `(${r.mapName})` : ''}
               </button>
             ))}
           </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {currentMatchId && (
          <motion.div
            key={currentMatchId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* ── Header Detallado ────────────────────────────────────── */}
            {activeMatchData && (
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.03] p-5 rounded-2xl border border-white/5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-neon-cyan font-bold">
                      {activeMatchData.parentMatchId ? 'Análisis de Ronda' : 'Resumen Global'}
                    </p>
                    {activeMatchData.isWarmup && (
                      <span className="text-[9px] uppercase tracking-wider text-orange-400 font-bold bg-orange-400/20 px-1.5 py-0.5 rounded">
                        Calentamiento
                      </span>
                    )}
                  </div>
                  <h2 className="font-orbitron font-bold text-xl sm:text-2xl text-white tracking-wide">
                    {activeMatchData.name}
                  </h2>
                  <p className="text-xs text-white/40 mt-1.5">
                    <span className="text-white font-medium">{activeSubmissions.length}</span> equipos registraron datos · 
                    <span className="text-white font-medium ml-1">{totalKillsInSelection}</span> kills acumuladas
                  </p>
                </div>

                {/* Top Fragger de ESTA selección */}
                {matchTopFragger && (matchTopFragger.killCount ?? 0) > 0 && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-neon-purple/10 border border-neon-purple/20 shadow-lg shadow-neon-purple/5">
                    <div className="w-10 h-10 rounded-xl bg-neon-purple/20 border border-neon-purple/40 flex items-center justify-center text-xl">🎯</div>
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-neon-purple/80 font-black">
                        Top Fragger de la Ronda
                      </p>
                      <p className="font-orbitron font-bold text-base text-white truncate max-w-[150px]">
                        {matchTopFragger.teams?.name ?? '—'}
                      </p>
                      <p className="text-[10px] text-white/40">
                         Logró <span className="text-neon-purple font-bold">{matchTopFragger.killCount}</span> bajas
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Cards de resultados ────────────────────────────────── */}
            {activeSubmissions.length === 0 ? (
              <div className="col-span-full py-16 text-center text-white/20 border-2 border-dashed border-white/5 rounded-3xl">
                <div className="text-4xl mb-4 opacity-20">📊</div>
                <p className="font-medium">No hay evidencias aprobadas aún para esta selección.</p>
                <p className="text-xs mt-1 text-white/10 italic">Los resultados aparecerán apenas el organizador los valide.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeSubmissions
                  .slice()
                  .sort((a, b) => (b.killCount ?? 0) - (a.killCount ?? 0))
                  .map((sub, idx) => {
                    const media = sub.evidenceFiles && sub.evidenceFiles.length > 0
                      ? sub.evidenceFiles[0]
                      : null
                    const isVideo = media?.mimeType?.startsWith('video/')
                    const mediaUrl = media
                      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/evidences/${media.storagePath}`
                      : null
                    const isMatchMvp = matchTopFragger?.id === sub.id && (sub.killCount ?? 0) > 0

                    return (
                      <motion.div
                        key={sub.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`relative group bg-dark-card/60 backdrop-blur-xl border rounded-3xl overflow-hidden transition-all duration-300 ${
                          isMatchMvp
                            ? 'border-neon-purple/50 shadow-[0_0_20px_rgba(157,0,255,0.1)] ring-1 ring-neon-purple/20'
                            : 'border-white/5 hover:border-white/20 hover:shadow-2xl hover:bg-dark-card/80'
                        }`}
                      >
                        {/* MVP Glow */}
                        {isMatchMvp && (
                          <div className="absolute top-0 right-0 w-24 h-24 bg-neon-purple/20 blur-3xl pointer-events-none" />
                        )}

                        {/* Media Header */}
                        <div className="w-full h-48 bg-black/40 relative overflow-hidden flex items-center justify-center">
                          {mediaUrl ? (
                            isVideo ? (
                              <video src={mediaUrl} className="w-full h-full object-cover" controls preload="metadata" />
                            ) : (
                              <img src={mediaUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" title="Ver evidencia" />
                            )
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                               <span className="text-white/10 text-4xl">📸</span>
                               <span className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold">Sin Multimedia</span>
                            </div>
                          )}
                          
                          {/* Position Badge */}
                          <div className="absolute top-4 left-4 min-w-[32px] h-8 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 flex items-center justify-center px-2">
                            <span className="font-orbitron font-black text-xs text-white/80">#{idx + 1}</span>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-5">
                          <div className="flex items-center gap-3 mb-4">
                            {sub.teams?.avatarUrl ? (
                              <img src={sub.teams.avatarUrl} className="w-10 h-10 rounded-xl border border-white/10 shadow-lg" alt="" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg">🛡️</div>
                            )}
                            <div className="min-w-0">
                               <h3 className="font-orbitron text-base font-bold text-white tracking-wide truncate pr-2">
                                 {sub.teams?.name}
                               </h3>
                               {isMatchMvp && <p className="text-[9px] font-black text-neon-purple uppercase tracking-widest">🔥 Top Fragger</p>}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/[0.04] p-3 rounded-2xl border border-white/5 transition-colors group-hover:bg-white/[0.08]">
                              <span className="text-white/30 block text-[9px] font-black uppercase tracking-tighter mb-1">Kills Ronda</span>
                              <span className="text-white text-xl font-black font-orbitron leading-none">
                                {sub.killCount}
                              </span>
                            </div>
                            
                            {sub.rank || sub.potTop ? (
                              <div className={`p-3 rounded-2xl border flex flex-col justify-center ${
                                sub.rank === 1 || sub.potTop 
                                  ? 'bg-gold/10 border-gold/20' 
                                  : sub.rank === 2 
                                    ? 'bg-slate-300/10 border-slate-300/20'
                                    : sub.rank === 3
                                      ? 'bg-orange-500/10 border-orange-500/20'
                                      : 'bg-white/[0.04] border-white/5'
                              }`}>
                                <span className={`block text-[9px] font-black uppercase tracking-tighter mb-0.5 ${
                                  sub.rank === 1 || sub.potTop ? 'text-gold' : 'text-white/40'
                                }`}>Posición</span>
                                <span className={`font-black text-sm uppercase flex items-center gap-1.5 ${
                                  sub.rank === 1 || sub.potTop ? 'text-gold' : 'text-white/80'
                                }`}>
                                  Top {sub.rank || 1} 
                                  <span className="text-lg">
                                    {sub.rank === 1 || sub.potTop ? '🏆' : sub.rank === 2 ? '🥈' : sub.rank === 3 ? '🥉' : '🎖️'}
                                  </span>
                                </span>
                              </div>
                            ) : (
                              <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/5 flex flex-col justify-center opacity-40">
                                <span className="text-white/30 block text-[9px] font-black uppercase tracking-tighter mb-1">Posición</span>
                                <span className="text-white/60 font-bold text-xs uppercase">—</span>
                              </div>
                            )}
                          </div>

                          {/* Individual breakdown if available */}
                          {sub.playerKills && Object.keys(sub.playerKills).length > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/5">
                               <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-2">Contribución Individual</p>
                               <div className="flex flex-wrap gap-2">
                                  {Object.entries(sub.playerKills).map(([pId, kills]) => (
                                    <div key={pId} className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/[0.03] border border-white/5">
                                       <span className="text-[9px] font-bold text-white/50">
                                          {participants.find(p => p.id === pId)?.displayName || 'Jugador'}
                                       </span>
                                       <span className="text-[9px] font-black text-neon-cyan">{kills}</span>
                                    </div>
                                  ))}
                               </div>
                            </div>
                          )}

                          {/* Evidence View (Admin/Check) */}
                          {sub.evidenceFiles && sub.evidenceFiles.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/5">
                               <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-2">Evidencia Adjunta</p>
                               <div className="flex gap-2">
                                  {sub.evidenceFiles.map((ef, idx) => (
                                    <a 
                                      key={idx}
                                      href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/evidences/${ef.storagePath}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="group relative w-full h-24 rounded-xl overflow-hidden border border-white/5 hover:border-neon-cyan/50 transition-all bg-black/40 flex items-center justify-center p-1"
                                    >
                                      <img 
                                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/evidences/${ef.storagePath}`} 
                                        alt="Evidencia"
                                        className="w-full h-full object-cover rounded-lg opacity-60 group-hover:opacity-100 transition-opacity"
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                                        <span className="text-[10px] font-black text-neon-cyan uppercase tracking-tighter shadow-lg">Ver Foto Completa</span>
                                      </div>
                                    </a>
                                  ))}
                               </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
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
