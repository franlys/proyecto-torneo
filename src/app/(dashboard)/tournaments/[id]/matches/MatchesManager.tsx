'use client'

import { useState } from 'react'
import { Match } from '@/types'
import { updateMatch } from '@/lib/actions/matches'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

export function MatchesManager({
  tournamentId,
  initialMatches,
}: {
  tournamentId: string
  initialMatches: Match[]
}) {
  const [matches, setMatches] = useState(initialMatches)
  const [saving, setSaving] = useState<string | null>(null)

  // Group by Encounter (parentMatchId is null)
  const encounters = matches.filter(m => !m.parentMatchId)
  const getRounds = (parentId: string) => matches.filter(m => m.parentMatchId === parentId)

  const handleUpdate = async (matchId: string, data: any) => {
    setSaving(matchId)
    const res = await updateMatch(tournamentId, matchId, data)
    if ('error' in res) {
      toast.error(res.error)
    } else {
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, ...data } : m))
      toast.success('Cambios guardados')
    }
    setSaving(null)
  }

  return (
    <div className="space-y-6 pb-20">
      {encounters.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
          <p className="text-white/40 font-orbitron text-sm uppercase tracking-widest">No hay encuentros generados</p>
        </div>
      ) : (
        encounters.map((encounter, idx) => {
          const rounds = getRounds(encounter.id)
          const hasRounds = rounds.length > 0

          return (
            <motion.div
              key={encounter.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-dark-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Encounter Header */}
              <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-neon-purple/10 border border-neon-purple/30 flex items-center justify-center text-neon-purple font-orbitron font-black shadow-[0_0_15px_rgba(180,0,255,0.1)]">
                    {encounter.matchNumber}
                  </div>
                  <div>
                    <input
                      className="bg-transparent border-none text-xl font-orbitron font-black text-white p-0 focus:ring-0 w-64 hover:bg-white/5 transition-colors rounded px-2 -ml-2"
                      defaultValue={encounter.name}
                      onBlur={(e) => {
                        if (e.target.value !== encounter.name) {
                          handleUpdate(encounter.id, { name: e.target.value })
                        }
                      }}
                    />
                    <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold mt-1">Encuentro Principal</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleUpdate(encounter.id, { isWarmup: !encounter.isWarmup })}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                      encounter.isWarmup 
                      ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/40' 
                      : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {encounter.isWarmup ? '🔥 Warmup Activo' : 'Warmup?'}
                  </button>
                  {saving === encounter.id && (
                    <div className="animate-spin w-4 h-4 border-2 border-neon-purple border-t-transparent rounded-full" />
                  )}
                </div>
              </div>

              {/* Rounds List */}
              <div className="p-4 sm:p-8 space-y-4">
                {!hasRounds ? (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-black ml-1">Mapa Actual</label>
                        <input
                          placeholder="Ej. Erangel, Miramar..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/50 transition-all outline-none"
                          defaultValue={encounter.mapName}
                          onBlur={(e) => handleUpdate(encounter.id, { mapName: e.target.value })}
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => handleUpdate(encounter.id, { isCompleted: !encounter.isCompleted })}
                          className={`w-full py-3 rounded-xl text-xs font-orbitron font-bold uppercase transition-all border ${
                            encounter.isCompleted 
                            ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40 shadow-[0_0_15px_rgba(0,245,255,0.1)]' 
                            : 'bg-white/5 text-white/40 border-white/5 hover:border-white/10'
                          }`}
                        >
                          {encounter.isCompleted ? '✓ Finalizada' : 'Marcar Finalizada'}
                        </button>
                      </div>
                   </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {rounds.map((round) => (
                      <div key={round.id} className="group bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 rounded-2xl p-6 transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                           <div className="flex-1 space-y-4">
                              <div className="flex items-center gap-3">
                                <span className="bg-white/10 text-white/60 text-[10px] font-black px-2 py-0.5 rounded shadow-sm">R{round.roundNumber}</span>
                                <input
                                  className="bg-transparent border-none text-white font-bold p-0 focus:ring-0 text-lg hover:bg-white/5 transition-colors rounded px-1 -ml-1 w-full"
                                  defaultValue={round.name}
                                  onBlur={(e) => {
                                    if (e.target.value !== round.name) {
                                      handleUpdate(round.id, { name: e.target.value })
                                    }
                                  }}
                                />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <input
                                  placeholder="Nombre del Mapa (Opcional)"
                                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/50 transition-all outline-none"
                                  defaultValue={round.mapName}
                                  onBlur={(e) => handleUpdate(round.id, { mapName: e.target.value })}
                                />
                                <button
                                  onClick={() => handleUpdate(round.id, { isCompleted: !round.isCompleted })}
                                  className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                    round.isCompleted 
                                    ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40 shadow-[0_0_10px_rgba(0,245,255,0.1)]' 
                                    : 'bg-transparent text-white/30 border-white/10 hover:border-white/20'
                                  }`}
                                >
                                  {round.isCompleted ? '✓ Finalizada' : 'Marcar Finalizada'}
                                </button>
                              </div>
                           </div>
                           {saving === round.id && (
                             <div className="animate-spin w-4 h-4 border-2 border-neon-purple border-t-transparent rounded-full" />
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )
        })
      )}
    </div>
  )
}
