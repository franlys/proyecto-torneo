'use client'

import { useState } from 'react'
import type { NationalPlayerStats, GameDiscipline } from '@/lib/actions/federation'
import { Orbitron } from 'next/font/google'
import { motion, AnimatePresence } from 'framer-motion'

const orbitron = Orbitron({ subsets: ['latin'] })

const DISCIPLINES: { value: GameDiscipline | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'Todos los Juegos', icon: '🎮' },
  { value: 'clash_royale', label: 'Clash Royale', icon: '👑' },
  { value: 'street_fighter_6', label: 'Street Fighter 6', icon: '🥊' },
  { value: 'super_smash_bros_ultimate', label: 'Super Smash Bros', icon: '💥' },
  { value: 'free_fire', label: 'Free Fire', icon: '🔥' },
  { value: 'fortnite', label: 'Fortnite', icon: '⛏️' },
  { value: 'call_of_duty_mobile', label: 'Call of Duty Mobile', icon: '🔫' },
]

interface RankingListProps {
  initialPlayers: NationalPlayerStats[]
}

export function RankingList({ initialPlayers }: RankingListProps) {
  const [selectedDiscipline, setSelectedDiscipline] = useState<GameDiscipline | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<NationalPlayerStats | null>(null)

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
    call_of_duty_mobile: 'Call of Duty Mobile'
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
          Actualizado en tiempo real por <span className="text-neon-cyan">FDDE</span>
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
                <th className="px-6 py-5 text-right">Puntos FDDE</th>
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
                    onClick={() => setSelectedPlayer(player)}
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

      {/* Side Drawer for Player Details */}
      <AnimatePresence>
        {selectedPlayer && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayer(null)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            {/* Slide-out Sheet */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-[#0e0e13] border-l border-white/10 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto text-white"
            >
              {/* Header */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Ficha del Atleta FDDE</span>
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Avatar & Identifiers */}
                <div className="flex flex-col items-center text-center space-y-4 pt-4">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-neon-cyan/20 rounded-2xl blur-lg group-hover:bg-neon-cyan/30 transition-all" />
                    <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl font-black uppercase relative overflow-hidden">
                      {selectedPlayer.avatarUrl ? (
                        <img src={selectedPlayer.avatarUrl} alt={selectedPlayer.displayName} className="w-full h-full object-cover" />
                      ) : (
                        selectedPlayer.displayName.substring(0, 2)
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className={`${orbitron.className} text-2xl font-black uppercase text-white flex items-center justify-center gap-2`}>
                      {selectedPlayer.displayName}
                    </h3>
                    {selectedPlayer.realName && (
                      <p className="text-xs text-white/40 font-semibold mt-1">{selectedPlayer.realName}</p>
                    )}
                    
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                      <span className="text-[10px] bg-white/5 border border-white/10 text-white/80 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                        {gameNames[selectedPlayer.discipline]}
                      </span>
                      {selectedPlayer.isNationalSelected && (
                        <span className="text-[10px] bg-neon-purple/20 text-neon-purple border border-neon-purple/30 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                          Selección RD 🇩🇴
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3 pt-6 border-t border-white/5">
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
                    <span className="block text-[9px] uppercase font-black tracking-widest text-white/40 mb-1">Rank Nacional</span>
                    <span className={`${orbitron.className} text-2xl font-black text-white`}>
                      #{selectedPlayer.rankPosition}
                    </span>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
                    <span className="block text-[9px] uppercase font-black tracking-widest text-white/40 mb-1">Puntos FDDE</span>
                    <span className={`${orbitron.className} text-2xl font-black text-neon-cyan neon-text-cyan`}>
                      {selectedPlayer.points.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
                    <span className="block text-[9px] uppercase font-black tracking-widest text-white/40 mb-1">Torneos Jugados</span>
                    <span className="text-xl font-bold text-white/90">
                      {selectedPlayer.tournamentsPlayed}
                    </span>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
                    <span className="block text-[9px] uppercase font-black tracking-widest text-white/40 mb-1">Victorias / WR</span>
                    <span className="text-xl font-bold text-white/90">
                      {selectedPlayer.winRate}%
                    </span>
                  </div>
                </div>

                {/* Medallero */}
                <div className="bg-[#121219]/60 border border-white/5 rounded-2xl p-5 space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Palmarés de Podios</h4>
                  <div className="flex items-center justify-around text-center pt-2">
                    <div>
                      <span className="block text-2xl">🥇</span>
                      <span className="block text-sm font-bold text-white mt-1">{selectedPlayer.podiumsCount}</span>
                      <span className="block text-[9px] text-white/30 uppercase tracking-wider font-bold">1.er Puesto</span>
                    </div>
                    <div>
                      <span className="block text-2xl">🥈</span>
                      <span className="block text-sm font-bold text-white mt-1">—</span>
                      <span className="block text-[9px] text-white/30 uppercase tracking-wider font-bold">2.º Puesto</span>
                    </div>
                    <div>
                      <span className="block text-2xl">🥉</span>
                      <span className="block text-sm font-bold text-white mt-1">—</span>
                      <span className="block text-[9px] text-white/30 uppercase tracking-wider font-bold">3.er Puesto</span>
                    </div>
                  </div>
                </div>

                {/* Achievements / Logros */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Logros Obtenidos</h4>
                  <div className="space-y-2">
                    {selectedPlayer.isNationalSelected && (
                      <div className="flex items-center gap-3 bg-neon-purple/5 border border-neon-purple/10 rounded-xl p-3">
                        <span className="text-lg">🇩🇴</span>
                        <div>
                          <p className="text-xs font-bold text-white">Patriota de Élite</p>
                          <p className="text-[10px] text-white/40">Miembro oficial de la Selección Nacional de eSports de RD.</p>
                        </div>
                      </div>
                    )}
                    {selectedPlayer.points >= 3000 && (
                      <div className="flex items-center gap-3 bg-neon-cyan/5 border border-neon-cyan/10 rounded-xl p-3">
                        <span className="text-lg">⚡</span>
                        <div>
                          <p className="text-xs font-bold text-white">Leyenda FDDE</p>
                          <p className="text-[10px] text-white/40">Superó los 3,000 puntos en torneos nacionales oficiales.</p>
                        </div>
                      </div>
                    )}
                    {selectedPlayer.tournamentsPlayed >= 10 && (
                      <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-xl p-3">
                        <span className="text-lg">⚔️</span>
                        <div>
                          <p className="text-xs font-bold text-white">Veterano de la Arena</p>
                          <p className="text-[10px] text-white/40">Ha disputado más de 10 torneos oficiales avalados.</p>
                        </div>
                      </div>
                    )}
                    {selectedPlayer.winRate >= 70 && (
                      <div className="flex items-center gap-3 bg-green-500/5 border border-green-500/10 rounded-xl p-3">
                        <span className="text-lg">🎯</span>
                        <div>
                          <p className="text-xs font-bold text-white">Imbatible</p>
                          <p className="text-[10px] text-white/40">Mantiene una efectividad (Win Rate) mayor al 70%.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer / Federation seal */}
              <div className="border-t border-white/5 pt-4 text-center opacity-30 select-none pointer-events-none mt-6">
                <span className="text-[8px] uppercase tracking-widest block font-orbitron">Certificado por</span>
                <span className="text-xs font-bold uppercase tracking-wider mt-0.5 block font-orbitron text-neon-cyan">Federación de eSports</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
