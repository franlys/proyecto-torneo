'use client'

import React, { useState, useMemo, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Orbitron } from 'next/font/google'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { getPlayerDetails } from '@/lib/actions/profile'

const orbitron = Orbitron({ subsets: ['latin'] })

interface RankingsClientProps {
  initialRankings: any[]
}

const GAME_NAMES: Record<string, string> = {
  warzone: 'Call of Duty: Warzone 🪂',
  clash_royale: 'Clash Royale 👑',
  fortnite: 'Fortnite ⛏️',
  free_fire: 'Free Fire 🔥',
  call_of_duty_mobile: 'Call of Duty Mobile 🔫',
  street_fighter_6: 'Street Fighter 6 👊',
  super_smash_bros_ultimate: 'Super Smash Bros Ultimate 💥',
}

const DISCIPLINES = [
  { value: 'warzone', label: 'Warzone' },
  { value: 'clash_royale', label: 'Clash Royale' },
  { value: 'fortnite', label: 'Fortnite' },
  { value: 'free_fire', label: 'Free Fire' },
  { value: 'call_of_duty_mobile', label: 'COD Mobile' },
  { value: 'street_fighter_6', label: 'SF6' },
  { value: 'super_smash_bros_ultimate', label: 'Smash Bros' },
]

export function RankingsClient({ initialRankings }: RankingsClientProps) {
  const [selectedDiscipline, setSelectedDiscipline] = useState('warzone')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null)
  const [playerDetails, setPlayerDetails] = useState<any | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Filter rankings by discipline and search query
  const filteredRankings = useMemo(() => {
    return initialRankings
      .filter((r) => r.discipline === selectedDiscipline)
      .filter((r) => {
        const username = r.profiles?.username || ''
        return username.toLowerCase().includes(searchQuery.toLowerCase())
      })
      .map((r, index) => ({
        ...r,
        rank: index + 1,
      }))
  }, [initialRankings, selectedDiscipline, searchQuery])

  // Handle clicking on a player to view details
  const handlePlayerClick = async (player: any) => {
    setSelectedPlayer(player)
    setLoadingDetails(true)
    setPlayerDetails(null)
    try {
      const details = await getPlayerDetails(player.user_id)
      setPlayerDetails(details)
    } catch (err) {
      console.error('Error fetching player details:', err)
    } finally {
      setLoadingDetails(false)
    }
  }

  // Chart data formatting
  const chartData = useMemo(() => {
    if (!playerDetails?.pointsHistory) return []
    let acc = 0
    return playerDetails.pointsHistory.map((h: any, i: number) => {
      acc += Number(h.points_awarded)
      return {
        name: `T${i + 1}`,
        puntos: acc,
      }
    })
  }, [playerDetails])

  const placementChartData = useMemo(() => {
    if (!playerDetails?.participations) return []
    const dist: Record<string, number> = { '1er': 0, '2do': 0, '3er': 0, 'Otro': 0 }
    playerDetails.participations.forEach((p: any) => {
      const standing = p.teams?.team_standings?.[0] || p.teams?.team_standings
      const rank = standing?.rank
      if (rank === 1) dist['1er']++
      else if (rank === 2) dist['2do']++
      else if (rank === 3) dist['3er']++
      else if (rank !== undefined) dist['Otro']++
    })
    return Object.entries(dist).map(([name, cantidad]) => ({ name, cantidad }))
  }, [playerDetails])

  return (
    <div className="space-y-8">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 scrollbar-none">
          {DISCIPLINES.map((d) => (
            <button
              key={d.value}
              onClick={() => setSelectedDiscipline(d.value)}
              className={`px-4 py-2 rounded-xl text-xs uppercase font-bold tracking-widest border transition-all duration-150 shrink-0 ${
                selectedDiscipline === d.value
                  ? 'border-neon-cyan bg-neon-cyan/10 text-neon-cyan font-black'
                  : 'border-white/5 bg-[#0d0d0f]/60 text-white/40 hover:text-white/60'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar jugador..."
            className="w-full bg-[#0d0d0f]/60 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-cyan/50"
          />
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        {filteredRankings.length === 0 ? (
          <div className="text-center py-20 text-white/30 text-sm">
            Aún no hay puntuaciones en esta disciplina.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-white/40 text-[10px] uppercase font-black tracking-widest border-b border-white/5 bg-white/[0.01]">
                  <th className="px-6 py-5 text-center w-20">Rank</th>
                  <th className="px-6 py-5">Jugador</th>
                  <th className="px-6 py-5 text-right">Puntos Acumulados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredRankings.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => handlePlayerClick(r)}
                    className="hover:bg-white/[0.02] cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-5 text-center font-orbitron font-black text-base">
                      <span className={r.rank === 1 ? 'text-gold' : r.rank === 2 ? 'text-white/80' : r.rank === 3 ? 'text-orange-400' : 'text-white/30'}>
                        #{r.rank}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs uppercase text-white/40">
                          {r.profiles?.username?.[0] || '?'}
                        </div>
                        <span className="font-bold text-white group-hover:text-neon-cyan transition-colors">
                          {r.profiles?.username || 'Usuario'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right font-orbitron font-black text-neon-cyan text-base">
                      {Number(r.points).toFixed(1)} <span className="text-xs text-white/50">pts</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Player Detail Modal */}
      <AnimatePresence>
        {selectedPlayer && (
          <Fragment>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayer(null)}
              className="fixed inset-0 bg-black z-50 cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-y-12 inset-x-6 md:inset-x-auto md:right-12 md:w-[500px] bg-[#0d0d0f] border border-white/5 rounded-3xl p-6 shadow-2xl z-50 overflow-y-auto space-y-6 scrollbar-none"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center font-bold font-orbitron text-xl text-neon-cyan shrink-0">
                    {selectedPlayer.profiles?.username?.[0] || '?'}
                  </div>
                  <div>
                    <h3 className="text-white font-orbitron font-bold text-lg uppercase tracking-wider">
                      {selectedPlayer.profiles?.username}
                    </h3>
                    <p className="text-white/40 text-xs">Top #{selectedPlayer.rank} en {GAME_NAMES[selectedDiscipline]}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {loadingDetails ? (
                <div className="text-center py-20 text-white/30 text-sm animate-pulse">
                  Cargando estadísticas del jugador...
                </div>
              ) : (
                playerDetails && (
                  <div className="space-y-6">
                    {/* Stats Highlights */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                        <p className="text-white/40 text-[9px] uppercase tracking-widest font-bold">Puntos Totales</p>
                        <p className="text-2xl font-black font-orbitron text-neon-cyan mt-1">
                          {Number(selectedPlayer.points).toFixed(1)}
                        </p>
                      </div>
                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                        <p className="text-white/40 text-[9px] uppercase tracking-widest font-bold">Torneos Jugados</p>
                        <p className="text-2xl font-black font-orbitron text-white mt-1">
                          {playerDetails.participations?.length || 0}
                        </p>
                      </div>
                    </div>

                    {/* Chart 1: Points progression */}
                    {chartData.length >= 2 && (
                      <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                        <h4 className="text-white font-orbitron text-xs uppercase tracking-wider mb-3">Evolución de Puntos</h4>
                        <div className="h-40 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" />
                              <XAxis dataKey="name" stroke="#ffffff20" style={{ fontSize: '9px' }} />
                              <YAxis stroke="#ffffff20" style={{ fontSize: '9px' }} />
                              <Tooltip contentStyle={{ backgroundColor: '#0d0d0f', border: 'none' }} />
                              <Line type="monotone" dataKey="puntos" stroke="#00F5FF" strokeWidth={2.5} dot={{ fill: '#00F5FF', r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Chart 2: Placement distribution */}
                    {playerDetails.participations?.length > 0 && (
                      <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                        <h4 className="text-white font-orbitron text-xs uppercase tracking-wider mb-3">Distribución de Posiciones</h4>
                        <div className="h-40 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={placementChartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" />
                              <XAxis dataKey="name" stroke="#ffffff20" style={{ fontSize: '9px' }} />
                              <YAxis stroke="#ffffff20" style={{ fontSize: '9px' }} />
                              <Tooltip contentStyle={{ backgroundColor: '#0d0d0f', border: 'none' }} />
                              <Bar dataKey="cantidad" fill="#a855f7" radius={[4, 4, 0, 0]}>
                                {placementChartData.map((entry: any, index: number) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={index === 0 ? '#E2C222' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#a855f7'}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Badges Cabinet */}
                    {playerDetails.badges && playerDetails.badges.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-white font-orbitron text-xs uppercase tracking-wider">Góndola de Medallas</h4>
                        <div className="grid grid-cols-3 gap-3">
                          {playerDetails.badges.map((b: any) => (
                            <div
                              key={b.id}
                              className="flex flex-col items-center text-center p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group"
                            >
                              <img src={b.badge_url} alt={b.name} className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(0,245,255,0.1)] mb-2" />
                              <span className="text-[10px] text-white font-medium truncate max-w-full">{b.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Tournaments History */}
                    {playerDetails.participations && playerDetails.participations.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-white font-orbitron text-xs uppercase tracking-wider">Últimas Participaciones</h4>
                        <div className="space-y-2">
                          {playerDetails.participations.slice(0, 3).map((p: any) => {
                            const standing = p.teams?.team_standings?.[0] || p.teams?.team_standings
                            const rank = standing?.rank
                            return (
                              <div key={p.id} className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
                                <div>
                                  <p className="text-xs text-white font-bold">{p.tournaments?.name}</p>
                                  <p className="text-[9px] text-white/30 uppercase mt-0.5">{GAME_NAMES[p.tournaments?.discipline] || p.tournaments?.discipline}</p>
                                </div>
                                <div className="text-right">
                                  <span className={`text-xs font-black font-orbitron ${rank === 1 ? 'text-gold' : rank === 2 ? 'text-white/80' : rank === 3 ? 'text-orange-400' : 'text-white/30'}`}>
                                    #{rank || '?'}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </motion.div>
          </Fragment>
        )}
      </AnimatePresence>
    </div>
  )
}
