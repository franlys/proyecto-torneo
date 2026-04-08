'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import { motion } from 'framer-motion'
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

  // 3. Prepare Chart Data (Cumulative)
  const chartData = useMemo(() => {
    // Sort matches by number/type
    const sortedMatches = [...matches].sort((a, b) => a.matchNumber - b.matchNumber)
    
    let cumulativePoints = 0
    let cumulativeKills = 0

    return sortedMatches.map((m) => {
      const sub = teamSubmissions.find((s) => s.matchId === m.id)
      const kills = sub?.killCount || 0
      
      // Points calculation
      const killPoints = kills * (scoringRule?.killPoints || 0)
      const placementPoints = sub?.potTop ? (scoringRule?.placementPoints?.['1'] || 0) : 0
      const roundPoints = killPoints + placementPoints

      cumulativePoints += roundPoints
      cumulativeKills += kills

      return {
        name: m.mapName || `R${m.matchNumber}`,
        points: cumulativePoints,
        kills: cumulativeKills,
        roundPoints: roundPoints,
        roundKills: kills,
      }
    })
  }, [matches, teamSubmissions, scoringRule])

  return (
    <div className="p-4 sm:p-8 bg-white/[0.01] border-t border-white/5 space-y-8">
      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
             <h3 className="text-[10px] font-orbitron font-black text-white/40 uppercase tracking-[0.3em]">Progreso Acumulado</h3>
             <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-neon-cyan" /> Puntos</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-neon-purple" /> Kills</div>
             </div>
          </div>
          
          <div className="h-[250px] w-full bg-black/20 rounded-2xl p-4 border border-white/5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00F5FF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00F5FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="rgba(255,255,255,0.3)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                   stroke="rgba(255,255,255,0.3)" 
                   fontSize={10} 
                   tickLine={false} 
                   axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0A0A0B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="points" 
                  stroke="#00F5FF" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorPoints)" 
                  animationDuration={1500}
                />
                <Line 
                  type="monotone" 
                  dataKey="kills" 
                  stroke="#B400FF" 
                  strokeWidth={2} 
                  dot={{ r: 4, fill: '#B400FF', strokeWidth: 0 }}
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Individual Stats Column */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-orbitron font-black text-white/40 uppercase tracking-[0.3em]">Estadísticas de Jugadores</h3>
          <div className="space-y-2">
            {teamParticipants.length === 0 ? (
              <p className="text-[10px] text-white/20 uppercase tracking-widest italic py-4">No hay jugadores registrados</p>
            ) : (
              teamParticipants.map((p, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={p.id} 
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all group"
                >
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] text-white/40 font-black">
                        {p.isCaptain ? '👑' : idx + 1}
                      </div>
                      <span className="text-sm font-medium text-white group-hover:text-neon-cyan transition-colors">{p.displayName}</span>
                   </div>
                   <div className="text-right">
                      <span className="text-lg font-orbitron font-black text-white">{p.totalKills || 0}</span>
                      <span className="text-[8px] text-white/30 uppercase block font-bold tracking-tighter">Kills Totales</span>
                   </div>
                </motion.div>
              ))
            )}
          </div>
          
          {/* AI Banner */}
          <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-transparent border border-neon-purple/30">
             <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-neon-purple animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">IA Vision Verified</span>
             </div>
             <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-tighter font-medium">
                Los datos de este equipo han sido validados automáticamente mediante el escaneo de capturas de pantalla de resultados oficiales.
             </p>
          </div>
        </div>
      </div>
    </div>
  )
}
