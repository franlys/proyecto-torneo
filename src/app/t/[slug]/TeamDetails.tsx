'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts'
import { motion, AnimatePresence, animate } from 'framer-motion'
import { Match, Submission, ScoringRule, Participant } from '@/types'

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setDisplay(v),
    })
    return controls.stop
  }, [value])
  return <>{display.toFixed(decimals)}</>
}

interface TeamDetailsProps {
  teamId: string
  teamName: string
  matches: Match[]
  submissions: Submission[]
  scoringRule: ScoringRule
  participants: Participant[]
  primaryColor: string
}

export function TeamDetails({
  teamId,
  teamName,
  matches,
  submissions,
  scoringRule,
  participants,
  primaryColor,
}: TeamDetailsProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // 1. Filter approved submissions for this team
  const teamSubmissions = useMemo(
    () => submissions.filter((s) => s.teamId === teamId && s.status === 'approved'),
    [submissions, teamId]
  )

  // 2. Filter participants for this team
  const teamParticipants = useMemo(
    () => participants.filter((p) => p.teamId === teamId),
    [participants, teamId]
  )

  const selectedPlayer = useMemo(
    () => teamParticipants.find(p => p.id === selectedPlayerId),
    [teamParticipants, selectedPlayerId]
  )

  // NUEVO: Mapa de bajas calculado desde los envíos actuales (Fuente de Verdad)
  const calculatedPlayerKillsMap = useMemo(() => {
    const map: Record<string, number> = {}
    teamSubmissions.forEach(sub => {
      const breakdown = sub.playerKills as any || {}
      Object.entries(breakdown).forEach(([pId, k]) => {
        map[pId] = (map[pId] || 0) + (Number(k) || 0)
      })
    })
    return map
  }, [teamSubmissions])

  // 3. Prepare Chart Data (Cumulative for Team, Per-Round for Player)
  const chartData = useMemo(() => {
    const sortedMatches = [...matches].sort((a, b) => a.matchNumber - b.matchNumber)
    
    let cumulativePoints = 0
    let cumulativeKills = 0

    return sortedMatches.map((m) => {
      const sub = teamSubmissions.find((s) => String(s.matchId) === String(m.id))
      const kills = sub?.killCount || 0
      
      // Individual player kills for this match
      let playerKillsInMatch = 0
      if (selectedPlayerId && sub?.playerKills) {
        playerKillsInMatch = (sub.playerKills as any)[selectedPlayerId] || 0
      }
      
      // Points calculation
      const killPoints = kills * (scoringRule?.killPoints || 0)
      
      // NEW: Use rank for placement points
      const pos = sub?.rank || (sub?.potTop ? 1 : 0)
      const placementPoints = pos > 0 ? (scoringRule?.placementPoints?.[String(pos)] || 0) : 0
      
      const roundPoints = killPoints + placementPoints

      cumulativePoints += roundPoints
      cumulativeKills += kills

      return {
        name: m.mapName || `Match ${m.matchNumber}`,
        points: cumulativePoints,
        kills: cumulativeKills,
        roundPoints: roundPoints,
        roundKills: kills,
        playerKills: playerKillsInMatch
      }
    })
  }, [matches, teamSubmissions, scoringRule, selectedPlayerId])

  // 4. Calculate Metrics
  const teamKD = useMemo(() => {
    const totalKills = teamSubmissions.reduce((acc, sub) => acc + (sub.killCount || 0), 0)
    // KD in this context is AVG Kills per match
    const matchesWithData = teamSubmissions.length || 1
    return (totalKills / matchesWithData).toFixed(2)
  }, [teamSubmissions])

  const kd = useMemo(() => {
    if (!selectedPlayer) return "0.00"
    // Calculate AVG kills for this specific player across all team submissions
    const playerKillsTotal = teamSubmissions.reduce((acc, sub) => {
      const breakdown = sub.playerKills as any || {}
      return acc + (breakdown[selectedPlayer.id] || 0)
    }, 0)
    const matchesPlayed = teamSubmissions.length || 1
    return (playerKillsTotal / matchesPlayed).toFixed(2)
  }, [selectedPlayer, teamSubmissions])

  const avgPlacement = useMemo(() => {
    const subsWithRank = teamSubmissions.filter(s => s.rank || s.potTop)
    if (subsWithRank.length === 0) return '—'
    const sum = subsWithRank.reduce((acc, s) => acc + (s.rank || 1), 0)
    return (sum / subsWithRank.length).toFixed(1)
  }, [teamSubmissions])

  const bestPlacement = useMemo(() => {
    const ranks = teamSubmissions.map(s => s.rank || (s.potTop ? 1 : Infinity)).filter(r => r !== Infinity)
    if (ranks.length === 0) return '—'
    return Math.min(...ranks)
  }, [teamSubmissions])

  if (!isMounted) {
    return (
      <div className="p-4 sm:p-8 bg-white/[0.01] border-t border-white/5 h-[600px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/10 border-t-neon-cyan rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 bg-white/[0.01] border-t border-white/5 space-y-8">
      {/* Analytics Grid */}
      <AnimatePresence mode="wait">
      {selectedPlayerId && selectedPlayer ? (
        /* ── ESPORTS PLAYER SHOWCASE ─────────────────────────────────────── */
        <motion.div
          key={`showcase-${selectedPlayer.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden rounded-3xl"
          style={{ minHeight: '420px', background: 'rgba(0,0,0,0.6)' }}
        >
          {/* Background radial glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: `radial-gradient(ellipse 60% 80% at 25% 60%, ${primaryColor}22 0%, transparent 70%)`,
            }}
          />
          {/* Scanlines overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.03,
            backgroundImage: 'repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 4px)',
          }} />
          {/* Top bar */}
          <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-0">
            <button
              onClick={() => setSelectedPlayerId(null)}
              className="flex items-center gap-2 text-white/30 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20">{teamName}</span>
          </div>

          {/* Main showcase layout */}
          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-stretch gap-0 px-4 sm:px-6 pb-6 pt-2">

            {/* ── LEFT: Player image ── */}
            <motion.div
              initial={{ opacity: 0, x: -40, y: 20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex-shrink-0 flex items-center justify-center"
              style={{ width: '220px', height: '300px' }}
            >
              {/* Glow pool — centered */}
              <div style={{
                position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
                width: '200px', height: '80px',
                background: `radial-gradient(ellipse, ${primaryColor}55 0%, transparent 70%)`,
                filter: 'blur(16px)', pointerEvents: 'none',
              }} />
              {/* Outer ring — wrapper handles centering, motion div handles rotation only */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', marginTop: '-110px', marginLeft: '-110px', width: '220px', height: '220px', pointerEvents: 'none' }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                  style={{ width: '100%', height: '100%', borderRadius: '50%', border: `1px dashed ${primaryColor}40` }}
                />
              </div>
              {/* Inner ring */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', marginTop: '-80px', marginLeft: '-80px', width: '160px', height: '160px', pointerEvents: 'none' }}>
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                  style={{ width: '100%', height: '100%', borderRadius: '50%', border: `1px solid ${primaryColor}20` }}
                />
              </div>

              {/* Image or placeholder */}
              {selectedPlayer.avatarUrl ? (
                <motion.img
                  src={selectedPlayer.avatarUrl}
                  alt={selectedPlayer.displayName}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    width: '180px', height: '260px',
                    objectFit: 'contain',
                    filter: `drop-shadow(0 0 28px ${primaryColor}99) drop-shadow(0 12px 40px rgba(0,0,0,0.9))`,
                    position: 'relative', zIndex: 2,
                  }}
                />
              ) : (
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'relative', zIndex: 2,
                    width: '160px', height: '220px', borderRadius: '24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '5rem',
                    background: `linear-gradient(135deg, ${primaryColor}15, rgba(0,0,0,0.3))`,
                    border: `1px solid ${primaryColor}30`,
                  }}
                >
                  👤
                </motion.div>
              )}
            </motion.div>

            {/* ── RIGHT: Stats panel ── */}
            <div className="flex-1 flex flex-col justify-center pl-0 sm:pl-8 pt-4 sm:pt-8">
              {/* Name + Role */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
              >
                <div className="flex items-center gap-2 mb-1">
                  {selectedPlayer.isCaptain && (
                    <span style={{
                      background: `linear-gradient(90deg, ${primaryColor}33, transparent)`,
                      border: `1px solid ${primaryColor}50`,
                      color: primaryColor, fontSize: '0.5rem',
                      fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.2em',
                      padding: '2px 8px', borderRadius: '4px',
                    }}>CAPITÁN</span>
                  )}
                </div>
                <h2 style={{
                  fontFamily: 'Orbitron, sans-serif', fontSize: 'clamp(1.6rem, 4vw, 2.8rem)',
                  fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em',
                  textShadow: `0 0 40px ${primaryColor}66`,
                }}>
                  {selectedPlayer.displayName.toUpperCase()}
                </h2>
              </motion.div>

              {/* Divider */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                style={{ height: '1px', background: `linear-gradient(90deg, ${primaryColor}80, transparent)`, marginTop: '1rem', marginBottom: '1rem', transformOrigin: 'left' }}
              />

              {/* Torneo stats row */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.35 }}
                className="flex gap-6 mb-4"
              >
                {[
                  { label: 'KD Torneo', value: Number(kd), decimals: 2, color: '#67e8f9' },
                  { label: 'Kills', value: calculatedPlayerKillsMap[selectedPlayer.id] || 0, decimals: 0, color: '#fff' },
                ].map((stat, i) => (
                  <div key={stat.label}>
                    <p style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.2em', marginBottom: '2px' }}>{stat.label}</p>
                    <p style={{ fontSize: '1.8rem', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: stat.color, lineHeight: 1 }}>
                      <AnimatedNumber value={stat.value} decimals={stat.decimals} />
                    </p>
                  </div>
                ))}
              </motion.div>

              {/* Pre-tournament stats */}
              {(selectedPlayer.kdRatio != null || selectedPlayer.avgKills != null || selectedPlayer.classificationRank || selectedPlayer.brAvgPlacement != null) && (
                <>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.45 }}
                    style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.2em', marginBottom: '0.6rem' }}
                  >
                    STATS PREVIOS
                  </motion.p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      selectedPlayer.kdRatio != null && { label: 'K/D PROM.', value: `${Number(selectedPlayer.kdRatio).toFixed(2)}`, color: '#67e8f9', bar: Math.min(Number(selectedPlayer.kdRatio) / 5, 1) },
                      selectedPlayer.avgKills != null && { label: 'AVG KILLS', value: `${Number(selectedPlayer.avgKills).toFixed(1)}`, color: '#a78bfa', bar: Math.min(Number(selectedPlayer.avgKills) / 15, 1) },
                      selectedPlayer.classificationRank && { label: 'RANGO', value: selectedPlayer.classificationRank, color: '#fbbf24', bar: null },
                      selectedPlayer.brAvgPlacement != null && { label: 'POS. BR', value: `#${Number(selectedPlayer.brAvgPlacement).toFixed(0)}`, color: 'rgba(255,255,255,0.7)', bar: null },
                    ].filter(Boolean).map((stat: any, i) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${stat.color}22`,
                          borderRadius: '12px', padding: '0.75rem',
                        }}
                      >
                        <p style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.15em', marginBottom: '4px' }}>{stat.label}</p>
                        <p style={{ fontSize: '1.1rem', fontFamily: 'Orbitron, sans-serif', fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</p>
                        {stat.bar != null && (
                          <div style={{ marginTop: '6px', height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${stat.bar * 100}%` }}
                              transition={{ duration: 1, delay: 0.6 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                              style={{ height: '100%', background: stat.color, borderRadius: '2px' }}
                            />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      ) : (
      <div key="analytics" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div>
                <h3 className="text-[10px] font-orbitron font-black text-white/40 uppercase tracking-[0.3em] mb-1">
                  {selectedPlayerId ? `Rendimiento: ${selectedPlayer?.displayName}` : 'Progreso de Equipo'}
                </h3>
                <p className="text-[9px] text-white/20 uppercase font-bold tracking-widest">
                  {selectedPlayerId ? 'Bajas confirmadas por ronda' : 'Puntos y bajas acumuladas'}
                </p>
             </div>
             
             <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                {!selectedPlayerId ? (
                  <>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-neon-cyan" /> Puntos</div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-neon-purple" /> Kills</div>
                  </>
                ) : (
                  <button 
                    onClick={() => setSelectedPlayerId(null)}
                    className="px-3 py-1 rounded-full border border-white/10 hover:border-white/30 transition-colors text-white/40 hover:text-white"
                  >
                    Volver a Equipo
                  </button>
                )}
             </div>
          </div>
          
          <div className="h-[300px] w-full bg-black/20 rounded-3xl p-6 border border-white/5 shadow-inner relative group">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
                 <div className="px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/5 flex flex-col items-center">
                    <span className="text-[7px] font-black text-white/30 uppercase tracking-widest leading-none mb-1">Mejor Pos.</span>
                    <span className="text-sm font-orbitron font-black text-neon-cyan leading-none">#{bestPlacement}</span>
                 </div>
                 <div className="px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-neon-cyan/20 flex flex-col items-center">
                    <span className="text-[7px] font-black text-neon-cyan uppercase tracking-widest leading-none mb-1">Pos. Media</span>
                    <span className="text-sm font-orbitron font-black text-white leading-none">#{avgPlacement}</span>
                 </div>
              </div>

            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={primaryColor} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0A0A0B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="points" stroke={primaryColor} strokeWidth={3} fillOpacity={1} fill="url(#colorPoints)" animationDuration={1500} />
                  <Area type="monotone" dataKey="kills" stroke="#B400FF" strokeWidth={2} fill="transparent" animationDuration={2000} />
                </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Individual Stats Column */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-orbitron font-black text-white/40 uppercase tracking-[0.3em]">
            Estadísticas de Jugadores
          </h3>

          <div className="space-y-2">
            {teamParticipants.length === 0 ? (
              <p className="text-[10px] text-white/20 uppercase tracking-widest italic py-4 text-center">No hay jugadores registrados</p>
            ) : (
              teamParticipants.map((p, idx) => (
                <motion.div
                  key={p.id}
                  onClick={() => setSelectedPlayerId(p.id)}
                  whileHover={{ x: 4 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-white/20 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt="" className="w-8 h-8 rounded-lg object-contain shrink-0" style={{ background: 'transparent' }} />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] text-white/40 font-black group-hover:bg-neon-cyan group-hover:text-black transition-colors">
                        {p.isCaptain ? '👑' : idx + 1}
                      </div>
                    )}
                    <span className="text-sm font-medium text-white group-hover:text-neon-cyan transition-colors">{p.displayName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-lg font-orbitron font-black text-white block leading-none">{calculatedPlayerKillsMap[p.id] || 0}</span>
                      <span className="text-[8px] text-white/30 uppercase font-bold tracking-tighter">Kills</span>
                    </div>
                    <svg className="w-3 h-3 text-white/20 group-hover:text-neon-cyan transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-transparent border border-neon-purple/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-neon-purple animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white font-orbitron">IA Verified</span>
            </div>
            <p className="text-[9px] text-white/40 leading-relaxed uppercase tracking-widest font-bold">
              Detección automática de OCR activada para este equipo.
            </p>
          </div>
        </div>
      </div>
      )}
      </AnimatePresence>
    </div>
  )
}
