'use client'

import { Tournament } from '@/types'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface HallOfFameCardProps {
  tournament: Tournament & {
    winner: {
      teamId: string
      name: string
      avatarUrl?: string
      totalPoints: number
      totalKills: number
    } | null
  }
}

export function HallOfFameCard({ tournament }: HallOfFameCardProps) {
  const { winner } = tournament
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group relative h-[400px] w-full rounded-3xl overflow-hidden border border-white/10 bg-dark-card shadow-2xl"
    >
      {/* Background Image / Champion Photo */}
      <div className="absolute inset-0">
        {tournament.championImageUrl ? (
          <img 
            src={tournament.championImageUrl} 
            alt={tournament.name} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-60"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neon-purple/20 to-neon-cyan/20 opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-card via-dark-card/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="absolute inset-0 p-8 flex flex-col justify-end">
        <div className="mb-6">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gold mb-2 drop-shadow-lg">
            Torneo Finalizado
          </p>
          <h2 className="font-orbitron font-black text-2xl sm:text-3xl text-white tracking-tighter uppercase leading-none drop-shadow-xl">
            {tournament.name}
          </h2>
          <div className="w-12 h-1 bg-gold mt-4 rounded-full group-hover:w-24 transition-all duration-500" />
        </div>

        {winner ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <div className="relative">
                {winner.avatarUrl ? (
                  <img src={winner.avatarUrl} alt={winner.name} className="w-14 h-14 rounded-xl object-cover border-2 border-gold shadow-lg" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gold/20 border-2 border-gold flex items-center justify-center text-gold text-2xl">🏆</div>
                )}
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gold flex items-center justify-center shadow-lg">
                  <span className="text-[10px] font-black text-black">#1</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase font-black tracking-widest text-white/40 mb-1">Campeón Indiscutible</p>
                <h3 className="font-orbitron font-bold text-lg text-white truncate">{winner.name}</h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                <p className="text-[9px] font-bold text-white/30 uppercase tracking-tighter mb-1">Puntos Finales</p>
                <p className="font-orbitron font-black text-xl text-gold">{winner.totalPoints}</p>
              </div>
              <div className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                <p className="text-[9px] font-bold text-white/30 uppercase tracking-tighter mb-1">Kills Totales</p>
                <p className="font-orbitron font-black text-xl text-white">{winner.totalKills}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-white/40 text-sm italic">Resultados finales procesándose...</p>
        )}

        <Link 
          href={`/t/${tournament.slug}`}
          className="mt-6 w-full py-3 rounded-xl border border-white/10 bg-white/5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all active:scale-[0.98]"
        >
          Ver Leaderboard Histórico
        </Link>
      </div>
    </motion.div>
  )
}
