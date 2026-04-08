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
import { motion, AnimatePresence } from 'framer-motion'
import { Match, Submission, ScoringRule, Participant } from '@/types'

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

  // 3. Prepare Chart Data (Cumulative for Team, Per-Round for Player)
  const chartData = useMemo(() => {
    const sortedMatches = [...matches].sort((a, b) => a.matchNumber - b.matchNumber)
    
    let cumulativePoints = 0
    let cumulativeKills = 0

    return sortedMatches.map((m) => {
      const sub = teamSubmissions.find((s) => s.matchId === m.id)
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
    const matchesPlayed = teamSubmissions.length || 1
    const totalKills = teamSubmissions.reduce((acc, sub) => acc + (sub.killCount || 0), 0)
    return (totalKills / matchesPlayed).toFixed(2)
  }, [teamSubmissions])

  const kd = useMemo(() => {
    if (!selectedPlayer) return 0
    const matchesPlayed = teamSubmissions.length || 1
    return ((selectedPlayer.totalKills || 0) / matchesPlayed).toFixed(2)
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
            {/* Team Summary Overlay (Only when no player selected) */}
            {!selectedPlayerId && (
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
            )}

            <ResponsiveContainer width="100%" height="100%">
              {selectedPlayerId ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{ backgroundColor: '#0A0A0B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="playerKills" radius={[4, 4, 0, 0]} animationDuration={1000}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={primaryColor} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
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
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Individual Stats Column */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-orbitron font-black text-white/40 uppercase tracking-[0.3em]">
            {selectedPlayerId ? 'Perfil de Jugador' : 'Estadísticas de Jugadores'}
          </h3>
          
          <AnimatePresence mode="wait">
            {selectedPlayerId && selectedPlayer ? (
              <motion.div
                key="player-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6 rounded-2xl bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10"
              >
                 <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
                      👤
                    </div>
                    <div>
                       <h4 className="font-orbitron font-bold text-white text-xl leading-none mb-1">{selectedPlayer.displayName}</h4>
                       <p className="text-[10px] text-neon-cyan uppercase font-black tracking-widest">{selectedPlayer.isCaptain ? 'Capitán de Equipo' : 'Operador'}</p>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                       <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">KD (AVG Kills)</p>
                       <p className="text-2xl font-orbitron font-black text-white">{kd}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                       <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Kills Totales</p>
                       <p className="text-2xl font-orbitron font-black text-white">{selectedPlayer.totalKills || 0}</p>
                    </div>
                 </div>

                 <button 
                  onClick={() => setSelectedPlayerId(null)}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition-all border border-white/5"
                 >
                   Cerrar Perfil
                 </button>
              </motion.div>
            ) : (
              <div className="space-y-2">
                {teamParticipants.length === 0 ? (
                  <p className="text-[10px] text-white/20 uppercase tracking-widest italic py-4 text-center">No hay jugadores registrados</p>
                ) : (
                  teamParticipants.map((p, idx) => (
                    <motion.div 
                      key={p.id} 
                      onClick={() => setSelectedPlayerId(p.id)}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-white/20 cursor-pointer transition-all group"
                    >
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] text-white/40 font-black group-hover:bg-neon-cyan group-hover:text-black transition-colors">
                            {p.isCaptain ? '👑' : idx + 1}
                          </div>
                          <span className="text-sm font-medium text-white group-hover:text-neon-cyan transition-colors">{p.displayName}</span>
                       </div>
                       <div className="text-right flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-lg font-orbitron font-black text-white block leading-none">{p.totalKills || 0}</span>
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
            )}
          </AnimatePresence>
          
          {/* AI Banner */}
          {!selectedPlayerId && (
            <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-transparent border border-neon-purple/30">
               <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-neon-purple animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white font-orbitron">IA Verified</span>
               </div>
               <p className="text-[9px] text-white/40 leading-relaxed uppercase tracking-widest font-bold">
                  Detección automática de OCR activada para este equipo.
               </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
