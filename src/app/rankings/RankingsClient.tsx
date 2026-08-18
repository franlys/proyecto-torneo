'use client'

import React, { useState, useEffect, useMemo, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Orbitron } from 'next/font/google'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { getPlayerDetails } from '@/lib/actions/profile'
import { Trophy, Award, Activity, Flame, TrendingUp, Coins, Gamepad2, Users, Calendar, X, Crown } from 'lucide-react'
import { RankBadge } from '@/components/ui/RankBadge'

const orbitron = Orbitron({ subsets: ['latin'] })

interface RankingsClientProps {
  communityRankings: any[]
  nationalRankings: any[]
  disciplinesWithTournaments: string[]
}

const GAME_NAMES: Record<string, string> = {
  warzone: 'Call of Duty: Warzone',
  clash_royale: 'Clash Royale',
  fortnite: 'Fortnite',
  free_fire: 'Free Fire',
  call_of_duty_mobile: 'Call of Duty Mobile',
  street_fighter_6: 'Street Fighter 6',
  super_smash_bros_ultimate: 'Super Smash Bros Ultimate',
  league_of_legends: 'League of Legends',
  valorant: 'Valorant',
}

const getRankBadge = (rank: number | null) => {
  if (rank === 1) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 font-orbitron uppercase">
        1º Lugar (Campeón)
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-300/10 border border-slate-300/30 text-slate-300 font-orbitron uppercase">
        2º Lugar
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-700/10 border border-amber-700/30 text-amber-600 font-orbitron uppercase">
        3º Lugar
      </span>
    )
  }
  if (rank && rank <= 5) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-orbitron uppercase">
        Top 5 (#{rank})
      </span>
    )
  }
  if (rank) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 border border-white/10 text-white/50 font-orbitron">
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


const DISCIPLINES = [
  { value: 'warzone', label: 'Warzone' },
  { value: 'clash_royale', label: 'Clash Royale' },
  { value: 'fortnite', label: 'Fortnite' },
  { value: 'free_fire', label: 'Free Fire' },
  { value: 'call_of_duty_mobile', label: 'COD Mobile' },
  { value: 'street_fighter_6', label: 'SF6' },
  { value: 'super_smash_bros_ultimate', label: 'Smash Bros' },
  { value: 'league_of_legends', label: 'League of Legends' },
  { value: 'valorant', label: 'Valorant' },
]

export function RankingsClient({ communityRankings, nationalRankings, disciplinesWithTournaments }: RankingsClientProps) {
  const [rankingType, setRankingType] = useState<'community' | 'national'>('community')
  const [selectedDiscipline, setSelectedDiscipline] = useState('clash_royale')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null)
  const [playerDetails, setPlayerDetails] = useState<any | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Filter visible disciplines tab list to only show categories with tournaments
  const visibleDisciplines = useMemo(() => {
    let list = DISCIPLINES
    if (rankingType === 'national') {
      const allowed = ['clash_royale', 'street_fighter_6', 'super_smash_bros_ultimate', 'free_fire', 'fortnite', 'call_of_duty_mobile']
      list = DISCIPLINES.filter(d => allowed.includes(d.value))
    }
    return list.filter(d => disciplinesWithTournaments.includes(d.value))
  }, [rankingType, disciplinesWithTournaments])

  // Enforce correct selected discipline when switching ranking type or when visible list updates
  useEffect(() => {
    if (visibleDisciplines.length > 0) {
      const isSelectedVisible = visibleDisciplines.some(d => d.value === selectedDiscipline)
      if (!isSelectedVisible) {
        setSelectedDiscipline(visibleDisciplines[0].value)
      }
    }
  }, [visibleDisciplines, selectedDiscipline])

  // Filter rankings by discipline and search query
  const filteredRankings = useMemo(() => {
    const list = rankingType === 'community' ? communityRankings : nationalRankings
    return list
      .filter((r) => r.discipline === selectedDiscipline)
      .filter((r) => {
        const name = rankingType === 'community'
          ? (r.profiles?.username || '')
          : (r.display_name || '')
        return name.toLowerCase().includes(searchQuery.toLowerCase())
      })
      .map((r, index) => ({
        ...r,
        rank: index + 1,
      }))
  }, [rankingType, communityRankings, nationalRankings, selectedDiscipline, searchQuery])

  const topThree = useMemo(() => {
    return filteredRankings.slice(0, 3)
  }, [filteredRankings])

  const remainingRankings = useMemo(() => {
    return filteredRankings.slice(3)
  }, [filteredRankings])

  const listToRender = useMemo(() => {
    return (searchQuery === '') ? remainingRankings : filteredRankings
  }, [searchQuery, filteredRankings, remainingRankings])
  const stats = useMemo(() => {
    if (!playerDetails) return null
    const totalTournaments = playerDetails.nationalPlayer 
      ? (playerDetails.tournamentsPlayed || 0)
      : (playerDetails.participations?.length || 0)
    
    let podiums = 0
    let totalKills = 0
    let top5 = 0
    let winRate = 0

    if (playerDetails.nationalPlayer) {
      podiums = playerDetails.podiumsCount || 0
      winRate = playerDetails.winRate || 0
    }

    if (playerDetails.participations) {
      playerDetails.participations.forEach((p: any) => {
        const standing = p.teams?.team_standings?.[0] || p.teams?.team_standings
        const rank = standing?.rank
        if (rank) {
          if (rank === 1 || rank === 2 || rank === 3) {
            podiums++
          }
          if (rank <= 5) {
            top5++
          }
        }
        totalKills += p.total_kills || p.teams?.team_standings?.[0]?.total_kills || 0
      })
      
      if (totalTournaments > 0 && !playerDetails.nationalPlayer) {
        winRate = Math.round((playerDetails.participations.filter((p: any) => {
          const standing = p.teams?.team_standings?.[0] || p.teams?.team_standings
          return standing?.rank === 1
        }).length / totalTournaments) * 100)
      }
    }

    const avgKills = totalTournaments > 0 ? (totalKills / totalTournaments).toFixed(1) : '0'

    return {
      totalTournaments,
      podiums,
      totalKills,
      avgKills,
      winRate,
      top5,
      mvpCount: playerDetails.mvpCount || 0
    }
  }, [playerDetails])

  // Handle clicking on a player to view details
  const handlePlayerClick = async (player: any) => {
    setSelectedPlayer(player)
    if (rankingType === 'national') {
      setLoadingDetails(false)
      // For national players, details are stored directly inside the player national stats record
      setPlayerDetails({
        nationalPlayer: true,
        realName: player.real_name,
        tournamentsPlayed: player.tournaments_played,
        podiumsCount: player.podiums_count,
        winRate: player.win_rate,
        socialTwitch: player.social_twitch,
        socialTwitter: player.social_twitter,
        isNationalSelected: player.is_national_selected,
        avatarUrl: player.avatar_url
      })
      return
    }
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
      {/* Ranking Type Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-px overflow-x-auto scrollbar-hide relative">
        <button
          onClick={() => setRankingType('community')}
          className="px-5 py-3 text-xs font-black uppercase tracking-widest relative group"
        >
          {rankingType === 'community' && (
            <motion.div
              layoutId="activeRankingTabLine"
              className="absolute bottom-0 left-0 right-0 h-[2px] bg-neon-cyan"
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
            />
          )}
          <span className={rankingType === 'community' ? 'text-white font-bold' : 'text-white/40 group-hover:text-white/80 transition-colors'}>
            Ranking Kronix (Comunidad)
          </span>
        </button>
        <button
          onClick={() => setRankingType('national')}
          className="px-5 py-3 text-xs font-black uppercase tracking-widest relative group"
        >
          {rankingType === 'national' && (
            <motion.div
              layoutId="activeRankingTabLine"
              className="absolute bottom-0 left-0 right-0 h-[2px] bg-neon-cyan"
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
            />
          )}
          <span className={rankingType === 'national' ? 'text-white font-bold' : 'text-white/40 group-hover:text-white/80 transition-colors'}>
            Rankings Nacionales (FED / Pro)
          </span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 scrollbar-none">
          {visibleDisciplines.map((d) => (
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

      {/* Podium Layout */}
      {searchQuery === '' && topThree.length > 0 && (
        <div className="grid grid-cols-3 gap-4 items-end max-w-2xl mx-auto py-8 select-none">
          {/* 2nd Place */}
          {topThree[1] ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => handlePlayerClick(topThree[1])}
              className="flex flex-col items-center cursor-pointer group"
            >
              <div className="relative mb-3">
                <div className="w-16 h-16 rounded-2xl border-2 border-slate-400/30 overflow-hidden shadow-[0_0_15px_rgba(200,200,200,0.05)] group-hover:border-neon-cyan transition-colors shrink-0">
                  {(topThree[1].profiles?.avatar_url || topThree[1].avatar_url) ? (
                    <img src={topThree[1].profiles?.avatar_url || topThree[1].avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-black/40 flex items-center justify-center font-orbitron font-bold text-lg text-slate-400">
                      {rankingType === 'community' ? (topThree[1].profiles?.username?.[0] || '?').toUpperCase() : (topThree[1].display_name?.[0] || '?').toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-slate-400 text-black text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center font-orbitron">
                  2
                </div>
              </div>
              <span className="text-xs font-bold text-white/80 group-hover:text-neon-cyan transition-colors truncate max-w-[100px] block">
                {rankingType === 'community' ? topThree[1].profiles?.username : topThree[1].display_name}
              </span>
              <div className="mt-1">
                <RankBadge points={Number(topThree[1].points)} size="sm" />
              </div>
              <span className="text-[10px] font-orbitron font-black text-neon-cyan mt-1">
                {Number(topThree[1].points).toFixed(1)} pts
              </span>
              <div className="w-full bg-white/[0.02] border-t border-x border-white/5 rounded-t-xl h-12 mt-3 flex items-center justify-center shadow-inner">
                <span className="text-white/20 font-orbitron font-bold text-xs">II</span>
              </div>
            </motion.div>
          ) : (
            <div className="h-1" />
          )}

          {/* 1st Place */}
          {topThree[0] ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => handlePlayerClick(topThree[0])}
              className="flex flex-col items-center cursor-pointer group z-10"
            >
              <div className="relative mb-3">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-400 animate-bounce">
                  <Crown className="w-5 h-5 text-yellow-450 fill-yellow-400/10 shrink-0" />
                </div>
                <div className="w-20 h-20 rounded-2xl border-2 border-gold overflow-hidden shadow-[0_0_25px_rgba(226,194,34,0.15)] group-hover:border-neon-cyan transition-colors shrink-0">
                  {(topThree[0].profiles?.avatar_url || topThree[0].avatar_url) ? (
                    <img src={topThree[0].profiles?.avatar_url || topThree[0].avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-black/40 flex items-center justify-center font-orbitron font-bold text-2xl text-gold">
                      {rankingType === 'community' ? (topThree[0].profiles?.username?.[0] || '?').toUpperCase() : (topThree[0].display_name?.[0] || '?').toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-gold text-black text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center font-orbitron">
                  1
                </div>
              </div>
              <span className="text-sm font-black text-white group-hover:text-neon-cyan transition-colors truncate max-w-[120px] block">
                {rankingType === 'community' ? topThree[0].profiles?.username : topThree[0].display_name}
              </span>
              <div className="mt-1">
                <RankBadge points={Number(topThree[0].points)} size="md" />
              </div>
              <span className="text-xs font-orbitron font-black text-neon-cyan mt-1">
                {Number(topThree[0].points).toFixed(1)} pts
              </span>
              <div className="w-full bg-gradient-to-b from-white/[0.04] to-transparent border-t border-x border-neon-cyan/20 rounded-t-xl h-20 mt-3 flex items-center justify-center shadow-lg">
                <span className="text-gold font-orbitron font-bold text-base">I</span>
              </div>
            </motion.div>
          ) : (
            <div className="h-1" />
          )}

          {/* 3rd Place */}
          {topThree[2] ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => handlePlayerClick(topThree[2])}
              className="flex flex-col items-center cursor-pointer group"
            >
              <div className="relative mb-3">
                <div className="w-16 h-16 rounded-2xl border-2 border-[#CD7F32]/60 overflow-hidden shadow-[0_0_15px_rgba(205,127,50,0.1)] group-hover:border-neon-cyan transition-colors shrink-0">
                  {(topThree[2].profiles?.avatar_url || topThree[2].avatar_url) ? (
                    <img src={topThree[2].profiles?.avatar_url || topThree[2].avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-black/40 flex items-center justify-center font-orbitron font-bold text-lg text-[#CD7F32]">
                      {rankingType === 'community' ? (topThree[2].profiles?.username?.[0] || '?').toUpperCase() : (topThree[2].display_name?.[0] || '?').toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-[#CD7F32] text-black text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center font-orbitron">
                  3
                </div>
              </div>
              <span className="text-xs font-bold text-white/80 group-hover:text-neon-cyan transition-colors truncate max-w-[100px] block">
                {rankingType === 'community' ? topThree[2].profiles?.username : topThree[2].display_name}
              </span>
              <div className="mt-1">
                <RankBadge points={Number(topThree[2].points)} size="sm" />
              </div>
              <span className="text-[10px] font-orbitron font-black text-neon-cyan mt-1">
                {Number(topThree[2].points).toFixed(1)} pts
              </span>
              <div className="w-full bg-white/[0.02] border-t border-x border-white/5 rounded-t-xl h-8 mt-3 flex items-center justify-center shadow-inner">
                <span className="text-white/20 font-orbitron font-bold text-xs">III</span>
              </div>
            </motion.div>
          ) : (
            <div className="h-1" />
          )}
        </div>
      )}

      {/* Leaderboard Table */}
      {filteredRankings.length === 0 ? (
        <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl overflow-hidden shadow-2xl text-center py-20 text-white/30 text-sm">
          Aún no hay puntuaciones en esta disciplina.
        </div>
      ) : listToRender.length > 0 ? (
        <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="text-white/40 text-[10px] uppercase font-black tracking-widest border-b border-white/5 bg-white/[0.01]">
                    <th className="px-6 py-5 text-center w-20">Rank</th>
                    <th className="px-6 py-5">Jugador</th>
                    {rankingType === 'national' && (
                      <>
                        <th className="px-6 py-5 text-center">Torneos</th>
                        <th className="px-6 py-5 text-center">Podios</th>
                        <th className="px-6 py-5 text-center">Win Rate</th>
                      </>
                    )}
                    <th className="px-6 py-5 text-right">Puntos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {listToRender.map((r) => (
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
                        <div className="w-8 h-8 rounded-lg border border-white/10 overflow-hidden shrink-0 bg-white/5">
                          {(r.profiles?.avatar_url || r.avatar_url) ? (
                            <img src={r.profiles?.avatar_url || r.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-xs uppercase text-white/40">
                              {rankingType === 'community' ? (r.profiles?.username?.[0] || '?').toUpperCase() : (r.display_name?.[0] || '?').toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white group-hover:text-neon-cyan transition-colors">
                              {rankingType === 'community' ? r.profiles?.username : r.display_name}
                            </span>
                            <RankBadge points={Number(r.points)} size="sm" />
                            {rankingType === 'national' && r.is_national_selected && (
                              <span className="text-[8px] bg-neon-cyan/15 text-neon-cyan px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                Selección Nacional 🇩🇴
                              </span>
                            )}
                          </div>
                          {rankingType === 'national' && r.real_name && (
                            <span className="text-[10px] text-white/30 block mt-0.5">{r.real_name}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    {rankingType === 'national' && (
                      <>
                        <td className="px-6 py-5 text-center font-orbitron text-white/60 font-bold">{r.tournaments_played}</td>
                        <td className="px-6 py-5 text-center font-orbitron text-yellow-500 font-bold">{r.podiums_count}</td>
                        <td className="px-6 py-5 text-center font-orbitron text-purple-400 font-bold">{r.win_rate}%</td>
                      </>
                    )}
                    <td className="px-6 py-5 text-right font-orbitron font-black text-neon-cyan text-base">
                      {Number(r.points).toFixed(1)} <span className="text-xs text-white/50">pts</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Player Detail Modal */}
      <AnimatePresence>
        {selectedPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayer(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-xl bg-[#0d0d0f] border border-white/10 rounded-3xl p-6 shadow-2xl relative z-10 max-h-[85vh] overflow-y-auto space-y-6 scrollbar-none"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  {/* Avatar with photo if available */}
                  {(() => {
                    const avatarSrc = playerDetails?.avatarUrl || selectedPlayer.profiles?.avatar_url || null
                    const initials = rankingType === 'community'
                      ? (selectedPlayer.profiles?.username?.[0] || '?').toUpperCase()
                      : (selectedPlayer.display_name?.[0] || '?').toUpperCase()
                    return avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt="Avatar"
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-neon-cyan/40 shadow-lg shadow-neon-cyan/10 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center font-bold font-orbitron text-xl text-neon-cyan shrink-0">
                        {initials}
                      </div>
                    )
                  })()}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-orbitron font-bold text-lg uppercase tracking-wider">
                        {rankingType === 'community' ? selectedPlayer.profiles?.username : selectedPlayer.display_name}
                      </h3>
                      <RankBadge points={Number(selectedPlayer.points)} size="md" />
                    </div>
                    <p className="text-white/40 text-xs">Top #{selectedPlayer.rank} en {GAME_NAMES[selectedDiscipline]}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {loadingDetails ? (
                <div className="text-center py-20 text-white/30 text-sm animate-pulse">
                  Cargando estadísticas del jugador...
                </div>
              ) : (
                playerDetails && (
                  <div className="space-y-6">
                    {stats && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Copas Jugadas */}
                        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                          <div className="flex items-center justify-between text-white/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Copas Jugadas</span>
                            <Trophy size={14} className="text-yellow-500" />
                          </div>
                          <div className="text-xl font-black font-orbitron text-white">
                            {stats.totalTournaments}
                          </div>
                          <p className="text-[10px] text-white/45">Torneos registrados</p>
                        </div>

                        {/* Podios (Top 3) */}
                        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                          <div className="flex items-center justify-between text-white/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Podios (Top 3)</span>
                            <Award size={14} className="text-neon-cyan" />
                          </div>
                          <div className="text-xl font-black font-orbitron text-neon-cyan">
                            {stats.podiums}
                          </div>
                          <p className="text-[10px] text-white/45">1º, 2º y 3º lugares</p>
                        </div>

                        {/* Kills Históricas */}
                        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                          <div className="flex items-center justify-between text-white/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Bajas Totales</span>
                            <Activity size={14} className="text-red-400" />
                          </div>
                          <div className="text-xl font-black font-orbitron text-red-400">
                            {stats.totalKills}
                          </div>
                          <p className="text-[10px] text-white/45">Bajas acumuladas</p>
                        </div>

                        {/* Promedio Bajas */}
                        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                          <div className="flex items-center justify-between text-white/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Promedio Bajas</span>
                            <Flame size={14} className="text-orange-400" />
                          </div>
                          <div className="text-xl font-black font-orbitron text-white">
                            {stats.avgKills}
                          </div>
                          <p className="text-[10px] text-white/45">Kills / torneo</p>
                        </div>

                        {/* Win Rate */}
                        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                          <div className="flex items-center justify-between text-white/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Win Rate</span>
                            <TrendingUp size={14} className="text-green-400" />
                          </div>
                          <div className="text-xl font-black font-orbitron text-green-400">
                            {stats.winRate}%
                          </div>
                          <p className="text-[10px] text-white/45">% de victorias #1</p>
                        </div>

                        {/* Llegadas Top 5 */}
                        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                          <div className="flex items-center justify-between text-white/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Top 5</span>
                            <Award size={14} className="text-purple-400" />
                          </div>
                          <div className="text-xl font-black font-orbitron text-purple-400">
                            {stats.top5}
                          </div>
                          <p className="text-[10px] text-white/45">Clasificaciones altas</p>
                        </div>

                        {/* MVPs Ganados */}
                        <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 space-y-1 col-span-2 sm:col-span-2">
                          <div className="flex items-center justify-between text-white/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">MVPs Ganados</span>
                            <Crown size={14} className="text-amber-400 fill-amber-400/10 animate-pulse" />
                          </div>
                          <div className="text-xl font-black font-orbitron text-amber-405">
                            {stats.mvpCount}
                          </div>
                          <p className="text-[10px] text-amber-500/80">Galardonado al mejor jugador</p>
                        </div>
                      </div>
                    )}

                    {/* National Player Details */}
                    {playerDetails.nationalPlayer && (
                      <div className="space-y-4">
                        {playerDetails.realName && (
                          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                            <p className="text-white/45 text-[9px] uppercase tracking-widest font-bold">Nombre Real</p>
                            <p className="text-sm font-semibold text-white mt-1">
                              {playerDetails.realName}
                            </p>
                          </div>
                        )}

                        {playerDetails.isNationalSelected && (
                          <div className="bg-neon-cyan/5 border border-neon-cyan/20 rounded-2xl p-4 text-center">
                            <p className="text-neon-cyan font-bold text-xs uppercase tracking-widest">Atleta de Selección Nacional 🇩🇴</p>
                            <p className="text-white/60 text-xs mt-1">Este jugador representa oficialmente al país en competencias internacionales.</p>
                          </div>
                        )}

                        {(playerDetails.socialTwitch || playerDetails.socialTwitter) && (
                          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2">
                            <p className="text-white/45 text-[9px] uppercase tracking-widest font-bold">Redes Sociales</p>
                            <div className="flex gap-4">
                              {playerDetails.socialTwitch && (
                                <a href={playerDetails.socialTwitch} target="_blank" rel="noreferrer" className="text-xs text-neon-cyan hover:underline">
                                  Twitch
                                </a>
                              )}
                              {playerDetails.socialTwitter && (
                                <a href={playerDetails.socialTwitter} target="_blank" rel="noreferrer" className="text-xs text-neon-cyan hover:underline">
                                  Twitter / X
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Charts & Historial Section */}
                    {!playerDetails.nationalPlayer && (
                      <>
                        {/* Chart 1: Points progression */}
                        {chartData.length >= 2 && (
                          <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-4">
                            <h4 className="text-white font-orbitron text-xs uppercase tracking-wider mb-3">Evolución de Puntos</h4>
                            <div className="h-40 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" />
                                  <XAxis dataKey="name" stroke="#ffffff20" style={{ fontSize: '9px' }} />
                                  <YAxis stroke="#ffffff20" style={{ fontSize: '9px' }} />
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: '#0d0d0f', border: 'none' }} 
                                    formatter={(value: any, name: any) => [
                                      typeof value === 'number' ? Math.round(value * 100) / 100 : value,
                                      String(name)
                                    ]}
                                  />
                                  <Line type="monotone" dataKey="puntos" stroke="#00F5FF" strokeWidth={2.5} dot={{ fill: '#00F5FF', r: 3 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                        {/* Chart 2: Placement distribution */}
                        {playerDetails.participations?.length > 0 && (
                          <div className="bg-[#0d0d0f] border border-white/5 rounded-2xl p-4">
                            <h4 className="text-white font-orbitron text-xs uppercase tracking-wider mb-3">Distribución de Posiciones</h4>
                            <div className="h-40 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={placementChartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" />
                                  <XAxis dataKey="name" stroke="#ffffff20" style={{ fontSize: '9px' }} />
                                  <YAxis stroke="#ffffff20" style={{ fontSize: '9px' }} />
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: '#0d0d0f', border: 'none' }} 
                                    formatter={(value: any, name: any) => [
                                      typeof value === 'number' ? Math.round(value * 100) / 100 : value,
                                      String(name)
                                    ]}
                                  />
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
                            <h4 className="text-white font-orbitron text-xs uppercase tracking-wider flex items-center gap-2">
                              <Award className="w-4 h-4 text-neon-cyan shrink-0" />
                              <span>Góndola de Medallas</span>
                            </h4>
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

                        {/* Recent Tournaments History - Expediente style */}
                        {playerDetails.participations && playerDetails.participations.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-white font-orbitron text-xs uppercase tracking-wider flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-neon-cyan shrink-0" />
                              <span>Historial de Copas & Torneos Anteriores</span>
                            </h4>
                            <div className="space-y-2">
                              {playerDetails.participations.map((p: any) => {
                                const standing = p.teams?.team_standings?.[0] || p.teams?.team_standings
                                const rank = standing?.rank
                                return (
                                  <div key={p.id} className="flex justify-between items-center bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
                                    <div>
                                      <p className="text-xs text-white font-bold">{p.tournaments?.name}</p>
                                      <p className="text-[9px] text-white/30 uppercase mt-0.5">{GAME_NAMES[p.tournaments?.discipline] || p.tournaments?.discipline}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {getRankBadge(rank)}
                                      {(p.total_kills || p.teams?.team_standings?.[0]?.total_kills) !== undefined && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 font-orbitron flex items-center gap-1">
                                          <Flame size={10} />
                                          {p.total_kills || p.teams?.team_standings?.[0]?.total_kills} Kills
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
