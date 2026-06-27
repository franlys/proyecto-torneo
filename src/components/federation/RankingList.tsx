'use client'

import { useState } from 'react'
import type { NationalPlayerStats, GameDiscipline } from '@/lib/actions/federation'
import { Orbitron } from 'next/font/google'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar
} from 'recharts'

const orbitron = Orbitron({ subsets: ['latin'] })

const DISCIPLINES: { value: GameDiscipline | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'Todos los Juegos', icon: '🎮' },
  { value: 'clash_royale', label: 'Clash Royale', icon: '👑' },
  { value: 'street_fighter_6', label: 'Street Fighter 6', icon: '🥊' },
  { value: 'super_smash_bros_ultimate', label: 'Super Smash Bros', icon: '💥' },
  { value: 'free_fire', label: 'Free Fire', icon: '🔥' },
  { value: 'fortnite', label: 'Fortnite', icon: '⛏️' },
  { value: 'call_of_duty_mobile', label: 'Call of Duty Mobile', icon: '🔫' },
  { value: 'league_of_legends', label: 'League of Legends', icon: '🏆' },
  { value: 'valorant', label: 'Valorant', icon: '🎯' },
]

interface RankingListProps {
  initialPlayers: NationalPlayerStats[]
}

export function RankingList({ initialPlayers }: RankingListProps) {
  const [selectedDiscipline, setSelectedDiscipline] = useState<GameDiscipline | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<NationalPlayerStats | null>(null)
  const [activeTab, setActiveTab] = useState<'radar' | 'history'>('radar')

  const filteredPlayers = initialPlayers.filter((player) => {
    const matchesDiscipline = selectedDiscipline === 'all' || player.discipline === selectedDiscipline
    const matchesSearch = player.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (player.realName && player.realName.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesDiscipline && matchesSearch
  })

  const gameNames: Record<GameDiscipline, string> = {
    clash_royale: 'Clash Royale',
    street_fighter_6: 'Street Fighter 6',
    super_smash_bros_ultimate: 'Super Smash Bros Ultimate',
    free_fire: 'Free Fire',
    fortnite: 'Fortnite',
    call_of_duty_mobile: 'Call of Duty Mobile',
    league_of_legends: 'League of Legends',
    valorant: 'Valorant'
  }

  // 1. Radar Skill Data Calculation
  const getRadarData = (player: NationalPlayerStats) => {
    return [
      { subject: 'Puntos', value: Math.round(Math.min(100, (player.points / 5500) * 100)) },
      { subject: 'Consistencia', value: Math.round(player.tournamentsPlayed > 0 ? (player.podiumsCount / player.tournamentsPlayed) * 100 : 0) },
      { subject: 'Win Rate', value: Math.round(player.winRate) },
      { subject: 'Experiencia', value: Math.round(Math.min(100, (player.tournamentsPlayed / 15) * 100)) },
      { subject: 'Podios', value: Math.round(Math.min(100, (player.podiumsCount / 8) * 100)) },
    ]
  }

  // 2. Mock Points Progress History
  const getHistoryData = (player: NationalPlayerStats) => {
    return [
      { cup: 'Fase 1', puntos: Math.round(player.points * 0.35) },
      { cup: 'Fase 2', puntos: Math.round(player.points * 0.55) },
      { cup: 'Fase 3', puntos: Math.round(player.points * 0.70) },
      { cup: 'Copa Nal.', puntos: Math.round(player.points * 0.88) },
      { cup: 'Actual', puntos: player.points }
    ]
  }

  return (
    <div className="space-y-8 relative">
      {/* Search Bar & Game Selector */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar jugador nacional por Nickname..."
            className="w-full bg-white/[0.02] border border-white/10 rounded-2xl pl-12 pr-6 py-4 outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/20 text-white text-sm transition-all"
          />
        </div>

        {/* Quick Info */}
        <div className="text-right text-xs text-white/40 uppercase tracking-widest font-bold hidden md:block">
          Actualizado en tiempo real
        </div>
      </div>

      {/* Game Filters */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
        {DISCIPLINES.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setSelectedDiscipline(d.value)}
            className={`flex items-center gap-2 px-5 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all shrink-0 border
              ${selectedDiscipline === d.value
                ? 'bg-neon-cyan border-neon-cyan text-black shadow-[0_0_15px_rgba(0,245,255,0.2)]'
                : 'bg-white/5 border-white/5 text-white/60 hover:border-white/20 hover:text-white'
              }`}
          >
            <span>{d.icon}</span>
            <span>{d.label}</span>
          </button>
        ))}
      </div>

      {/* Ranking Table */}
      <div className="overflow-hidden rounded-[30px] border border-white/5 bg-[#121219]/60 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-widest text-white/40">
                <th className="px-6 py-5 text-center w-16">Rank</th>
                <th className="px-6 py-5">Jugador / Nickname</th>
                <th className="px-6 py-5">Disciplina</th>
                <th className="px-6 py-5 text-center">Torneos</th>
                <th className="px-6 py-5 text-center">Podios</th>
                <th className="px-6 py-5 text-center">Win Rate</th>
                <th className="px-6 py-5 text-right">Puntos de Ranking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-white/30 text-sm">
                    No se encontraron jugadores nacionales en este rango.
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player, idx) => (
                  <tr 
                    key={player.id} 
                    onClick={() => {
                      setSelectedPlayer(player)
                      setActiveTab('radar')
                    }}
                    className="group hover:bg-white/[0.02] cursor-pointer transition-all"
                  >
                    {/* Rank Position */}
                    <td className="px-6 py-5 text-center">
                      <span className={`font-orbitron font-black text-lg ${
                        idx === 0 ? 'text-gold drop-shadow-[0_0_8px_rgba(255,215,0,0.4)]' :
                        idx === 1 ? 'text-slate-300' :
                        idx === 2 ? 'text-amber-600' : 'text-white/40'
                      }`}>
                        #{idx + 1}
                      </span>
                    </td>
                    
                    {/* Player profile */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm font-bold uppercase shrink-0 overflow-hidden">
                          {player.avatarUrl ? (
                            <img src={player.avatarUrl} alt={player.displayName} className="w-full h-full object-cover" />
                          ) : (
                            player.displayName.substring(0, 2)
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white group-hover:text-neon-cyan transition-colors">{player.displayName}</span>
                            {player.isNationalSelected && (
                              <span className="text-[9px] bg-neon-purple/20 text-neon-purple border border-neon-purple/30 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                                Selección Nacional 🇩🇴
                              </span>
                            )}
                          </div>
                          {player.realName && <span className="text-xs text-white/30 block mt-0.5">{player.realName}</span>}
                        </div>
                      </div>
                    </td>
                    
                    {/* Discipline */}
                    <td className="px-6 py-5">
                      <span className="text-xs text-white/60 font-semibold">{gameNames[player.discipline]}</span>
                    </td>

                    {/* Torneos Jugados */}
                    <td className="px-6 py-5 text-center text-sm font-semibold text-white/70">
                      {player.tournamentsPlayed}
                    </td>

                    {/* Podios */}
                    <td className="px-6 py-5 text-center">
                      <span className="text-sm font-semibold text-gold">🥇 {player.podiumsCount}</span>
                    </td>

                    {/* Win Rate */}
                    <td className="px-6 py-5 text-center text-sm font-mono text-white/60">
                      {player.winRate}%
                    </td>

                    {/* Points */}
                    <td className="px-6 py-5 text-right">
                      <span className={`${orbitron.className} font-black text-base text-neon-cyan neon-text-cyan`}>
                        {player.points.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advanced Full Modal overlay for Player Details and charts */}
      <AnimatePresence>
        {selectedPlayer && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayer(null)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            >
              {/* Modal Container */}
              <motion.div
                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 20, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-4xl bg-[#0b0b0f] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row text-white h-[90vh] md:h-auto max-h-[680px]"
              >
                
                {/* Left Side: Profile Card */}
                <div className="w-full md:w-80 bg-gradient-to-b from-[#13131d] to-[#0b0b0f] p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/5 shrink-0 overflow-y-auto">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-neon-cyan">Perfil Nacional</span>
                      <span className="text-white/20 font-mono text-[10px]">ID: {selectedPlayer.id.substring(0, 8)}</span>
                    </div>

                    <div className="flex flex-col items-center text-center space-y-4 pt-2">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-neon-cyan/20 rounded-3xl blur-md" />
                        <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl font-black uppercase overflow-hidden relative">
                          {selectedPlayer.avatarUrl ? (
                            <img src={selectedPlayer.avatarUrl} alt={selectedPlayer.displayName} className="w-full h-full object-cover" />
                          ) : (
                            selectedPlayer.displayName.substring(0, 2)
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className={`${orbitron.className} text-2xl font-black uppercase tracking-tight text-white`}>
                          {selectedPlayer.displayName}
                        </h3>
                        {selectedPlayer.realName && (
                          <p className="text-xs text-white/40 font-bold mt-0.5">{selectedPlayer.realName}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 justify-center">
                        <span className="text-[9px] bg-white/5 border border-white/10 text-white/80 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                          {gameNames[selectedPlayer.discipline]}
                        </span>
                        {selectedPlayer.isNationalSelected && (
                          <span className="text-[9px] bg-neon-purple/20 text-neon-purple border border-neon-purple/30 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                            Selección RD 🇩🇴
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 pt-6 border-t border-white/5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/40 font-bold uppercase">Rank Nacional</span>
                        <span className="font-bold font-orbitron text-white text-base">#{selectedPlayer.rankPosition}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/40 font-bold uppercase">Puntos de Ranking</span>
                        <span className="font-black font-orbitron text-neon-cyan text-base">{selectedPlayer.points.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/40 font-bold uppercase">Win Rate</span>
                        <span className="font-bold font-mono text-white">{selectedPlayer.winRate}%</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/40 font-bold uppercase">Torneos</span>
                        <span className="font-bold text-white">{selectedPlayer.tournamentsPlayed}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 flex items-center gap-3 justify-center text-gold">
                    <span className="text-xl">🥇</span>
                    <span className="text-sm font-black uppercase tracking-wider">{selectedPlayer.podiumsCount} Podios de 1.er lugar</span>
                  </div>
                </div>

                {/* Right Side: Charts & Tabs */}
                <div className="flex-1 p-8 flex flex-col justify-between overflow-y-auto">
                  <div className="space-y-6">
                    {/* Header Tabs & Close */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                        <button
                          onClick={() => setActiveTab('radar')}
                          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                            activeTab === 'radar' ? 'bg-white text-black' : 'text-white/40 hover:text-white'
                          }`}
                        >
                          Análisis de Habilidad
                        </button>
                        <button
                          onClick={() => setActiveTab('history')}
                          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                            activeTab === 'history' ? 'bg-white text-black' : 'text-white/40 hover:text-white'
                          }`}
                        >
                          Evolución de Puntos
                        </button>
                      </div>
                      <button
                        onClick={() => setSelectedPlayer(null)}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all border border-white/5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Chart Content rendering based on Active Tab */}
                    <div className="bg-[#121219]/40 border border-white/5 rounded-3xl p-6 h-80 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/5 to-transparent pointer-events-none" />
                      
                      {activeTab === 'radar' ? (
                        <div className="w-full h-full flex flex-col justify-between">
                          <div className="text-[10px] text-white/30 uppercase tracking-widest font-black mb-2">Atributos del Deportista (Radar)</div>
                          <div className="flex-1 w-full min-h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={getRadarData(selectedPlayer)}>
                                <PolarGrid stroke="rgba(255, 255, 255, 0.05)" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 10, fontWeight: 'bold' }} />
                                <Radar
                                  name={selectedPlayer.displayName}
                                  dataKey="value"
                                  stroke="#00f5ff"
                                  fill="#00f5ff"
                                  fillOpacity={0.2}
                                />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col justify-between">
                          <div className="text-[10px] text-white/30 uppercase tracking-widest font-black mb-2">Desempeño Acumulado de Puntos</div>
                          <div className="flex-1 w-full min-h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={getHistoryData(selectedPlayer)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="cup" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 'bold' }} stroke="rgba(255,255,255,0.1)" />
                                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} stroke="rgba(255,255,255,0.1)" />
                                <Tooltip
                                  contentStyle={{ backgroundColor: '#0e0e13', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                  labelStyle={{ color: 'rgba(255,255,255,0.6)', fontWeight: 'bold', fontSize: 11 }}
                                  itemStyle={{ color: '#00f5ff', fontSize: 12 }}
                                  formatter={(value: any, name: any) => [
                                    typeof value === 'number' ? Math.round(value * 100) / 100 : value,
                                    String(name)
                                  ]}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="puntos"
                                  stroke="#00f5ff"
                                  strokeWidth={3}
                                  dot={{ fill: '#0b0b0f', stroke: '#00f5ff', strokeWidth: 2, r: 4 }}
                                  activeDot={{ r: 6 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Achievements List */}
                    <div className="space-y-3">
                      <div className="text-[10px] text-white/30 uppercase tracking-widest font-black">Condecoraciones Oficiales</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {selectedPlayer.isNationalSelected && (
                          <div className="flex items-center gap-3 bg-[#171124] border border-neon-purple/20 rounded-2xl p-4">
                            <span className="text-2xl">🇩🇴</span>
                            <div>
                              <p className="text-xs font-bold text-white">Selección Nacional</p>
                              <p className="text-[10px] text-white/40">Representante oficial en eSports.</p>
                            </div>
                          </div>
                        )}
                        {selectedPlayer.points >= 3000 && (
                          <div className="flex items-center gap-3 bg-[#0a1b24] border border-neon-cyan/20 rounded-2xl p-4">
                            <span className="text-2xl">🏆</span>
                            <div>
                              <p className="text-xs font-bold text-white">Rendimiento Leyenda</p>
                              <p className="text-[10px] text-white/40">Puntaje estelar de 3,000+ pts.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4 text-center opacity-30 select-none pointer-events-none mt-6">
                    <span className="text-[8px] uppercase tracking-widest block font-orbitron">Certificado Oficial por KRONIX</span>
                  </div>
                </div>

              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
