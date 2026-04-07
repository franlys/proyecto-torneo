'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function MatchRecap({ matches, submissions, primaryColor }: { matches: any[], submissions: any[], primaryColor: string }) {
  const [activeMatch, setActiveMatch] = useState<string | null>(matches[0]?.id || null)

  return (
    <div className="w-full">
      {/* Selector de Partidas horizontales tipo pills */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
        {matches.map(m => (
          <button
            key={m.id}
            onClick={() => setActiveMatch(m.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-full font-orbitron text-sm transition-all border ${
              activeMatch === m.id 
                ? 'bg-white/10 text-white' 
                : 'border-white/5 text-white/40 hover:text-white/80 hover:bg-white/[0.02]'
            }`}
            style={{ borderColor: activeMatch === m.id ? primaryColor : undefined }}
          >
            {m.name || `Partida ${m.match_number}`}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeMatch && (
          <motion.div
            key={activeMatch}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {submissions.filter(s => s.match_id === activeMatch).length === 0 ? (
               <div className="col-span-full py-12 text-center text-white/30 border border-dashed border-white/10 rounded-2xl">
                 No hay resultados ni evidencias publicadas para esta partida.
               </div>
            ) : (
                submissions.filter(s => s.match_id === activeMatch).map(sub => {
                  const media = sub.evidence_files && sub.evidence_files.length > 0 ? sub.evidence_files[0] : null
                  const isVideo = media && media.mime_type?.startsWith('video/')
                  // Supabase public URL construct
                  const mediaUrl = media ? `https://otssvwinchttedisfqtr.supabase.co/storage/v1/object/public/evidences/${media.storage_path}` : null

                  return (
                    <div key={sub.id} className="bg-dark-card border border-white/5 rounded-2xl overflow-hidden hover:border-white/20 transition-all shadow-xl group">
                      {/* Media Header */}
                      <div className="w-full h-48 bg-black/50 relative overflow-hidden flex items-center justify-center">
                        {mediaUrl ? (
                          isVideo ? (
                             <video src={mediaUrl} className="w-full h-full object-cover" controls preload="metadata" />
                          ) : (
                             <img src={mediaUrl} alt="Evidencia" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          )
                        ) : (
                          <span className="text-white/20 text-xs uppercase tracking-widest font-orbitron">Sin Evidencia</span>
                        )}
                      </div>

                      {/* Content Footer */}
                      <div className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                          {sub.teams?.avatar_url && (
                             <img src={sub.teams.avatar_url} className="w-8 h-8 rounded-md" alt="" />
                          )}
                          <h3 className="font-orbitron text-lg font-bold text-white tracking-wide">{sub.teams?.name}</h3>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm">
                          <div className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                            <span className="text-white/40 block text-[10px] uppercase">Kills</span>
                            <span className="text-white font-bold">{sub.kill_count}</span>
                          </div>
                          {sub.pot_top && (
                            <div className="bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-500/20">
                              <span className="text-orange-400 block text-[10px] uppercase">Placement</span>
                              <span className="text-orange-500 font-bold">Top 1 🏆</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
