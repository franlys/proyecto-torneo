'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { TeamStanding } from '@/types'
import { MatchRecap } from './MatchRecap'

export function LeaderboardClient({
  tournamentId,
  tournamentName,
  description,
  format,
  status,
  initialStandings,
  teams,
  theme,
  matches,
  submissions,
}: {
  tournamentId: string
  tournamentName: string
  description?: string
  format: string
  status: string
  initialStandings: any[]
  teams?: any[]
  theme?: any
  matches?: any[]
  submissions?: any[]
}) {
  const [standings, setStandings] = useState(initialStandings)
  const [activeTab, setActiveTab] = useState<'ranking' | 'participants' | 'matches'>('ranking')
  const [watchingStream, setWatchingStream] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase.channel(`public:team_standings:tournament_id=eq.${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_standings',
          filter: `tournament_id=eq.${tournamentId}`
        },
        async (payload) => {
          const { data } = await supabase
            .from('team_standings')
            .select('*, teams(name, avatar_url, vip_score, stream_url, participants(display_name, stream_url))')
            .eq('tournament_id', tournamentId)
            .order('rank', { ascending: true })

          if (data) {
            // Fetch teams to merge in stream info
            const { data: teamsData } = await supabase
              .from('teams')
              .select('id, name, avatar_url, stream_url, participants(display_name, stream_url)')
              .eq('tournament_id', tournamentId)

            const standingsMap = new Map(data.map((s: any) => [s.team_id, s]))

            const merged = (teamsData || []).map((t: any, idx: number) => {
              const s = standingsMap.get(t.id)
              const teamStreams: { name: string; url: string }[] = []
              if (t.stream_url) teamStreams.push({ name: 'Equipo', url: t.stream_url })
              ;(t.participants || []).forEach((p: any) => {
                if (p.stream_url) teamStreams.push({ name: p.display_name, url: p.stream_url })
              })

              return {
                teamId: t.id,
                teamName: t.name,
                avatarUrl: t.avatar_url,
                streamUrl: t.stream_url,
                streams: teamStreams,
                totalPoints: s ? Number(s.total_points) : 0,
                totalKills: s ? (s.total_kills ?? 0) : 0,
                killRate: s ? Number(s.kill_rate) : 0,
                potTopCount: s ? (s.pot_top_count ?? 0) : 0,
                vipScore: s ? Number(s.vip_score) : 0,
                rank: s ? s.rank : (idx + 1),
                previousRank: s ? s.previous_rank : (idx + 1),
              }
            }).sort((a: any, b: any) => {
              if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
              if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills
              return a.rank - b.rank
            })

            setStandings(merged)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentId, supabase])

  const primaryColor = theme?.primary_color || '#00F5FF'
  const backgroundValue = theme?.background_value
  const logoUrl = theme?.logo_url

  const isVideoBackground = backgroundValue?.toLowerCase().match(/\.(mp4|webm|ogg)$/)
  
  // YouTube Detection
  const youtubeId = backgroundValue?.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w\-]{11})/)?.[1]
  
  // Twitch Detection
  const twitchUser = backgroundValue?.match(/(?:twitch\.tv\/)([\w\-]+)/)?.[1]

  // Kick Detection
  const kickUser = backgroundValue?.match(/(?:kick\.com\/)([\w\-]+)/)?.[1]

  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'

  const handleWatchTeam = (streamUrl: string) => {
    setWatchingStream(streamUrl)
  }

  const renderStreamPlayer = (url: string) => {
    const ytId = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w\-]{11})/)?.[1]
    const twitchU = url.match(/(?:twitch\.tv\/)([\w\-]+)/)?.[1]
    const kickU = url.match(/(?:kick\.com\/)([\w\-]+)/)?.[1]

    if (ytId) return <iframe src={`https://www.youtube.com/embed/${ytId}?autoplay=1`} className="w-full h-full border-0" allow="autoplay; encrypted-media" allowFullScreen />
    if (twitchU) return <iframe src={`https://player.twitch.tv/?channel=${twitchU}&parent=${host}&autoplay=true`} className="w-full h-full border-0" allowFullScreen />
    if (kickU) return <iframe src={`https://player.kick.com/${kickU}?autoplay=true`} className="w-full h-full border-0" />
    
    return <div className="flex items-center justify-center h-full text-white/40">URL de stream no soportada</div>
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 relative z-10">
      
      {/* Background Handler */}
      {backgroundValue && (
        <div className="fixed inset-0 w-full h-full -z-10 bg-black overflow-hidden">
          {youtubeId ? (
            <div className="absolute inset-0 w-full h-full scale-125 pointer-events-none opacity-50">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&modestbranding=1&rel=0&showinfo=0`}
                className="w-full h-full border-0"
                allow="autoplay; encrypted-media"
              />
            </div>
          ) : twitchUser ? (
             <div className="absolute inset-0 w-full h-full scale-110 pointer-events-none opacity-50">
               <iframe
                 src={`https://player.twitch.tv/?channel=${twitchUser}&parent=${host}&muted=true&autoplay=true&controls=false`}
                 className="w-full h-full border-0"
                 allowFullScreen
               />
             </div>
          ) : kickUser ? (
             <div className="absolute inset-0 w-full h-full scale-110 pointer-events-none opacity-50">
               <iframe
                 src={`https://player.kick.com/${kickUser}?muted=true&autoplay=true`}
                 className="w-full h-full border-0"
               />
             </div>
          ) : isVideoBackground ? (
            <video 
              src={backgroundValue} 
              autoPlay loop muted playsInline 
              className="w-full h-full object-cover opacity-50 block" 
            />
          ) : (
            <div 
              className="w-full h-full bg-cover bg-center opacity-40 block" 
              style={{ backgroundImage: `url(${backgroundValue})` }} 
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/80 to-transparent" />
        </div>
      )}

      {/* Stream Modal */}
      <AnimatePresence>
        {watchingStream && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
            onClick={() => setWatchingStream(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-dark-card w-full max-w-5xl aspect-video rounded-2xl overflow-hidden border border-white/10 relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <a
                  href={watchingStream}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-neon-cyan/20 hover:bg-neon-cyan/40 text-neon-cyan rounded-lg transition-colors text-sm font-medium border border-neon-cyan/50 backdrop-blur-md flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  Ver en sitio original
                </a>
                <button 
                  onClick={() => setWatchingStream(null)}
                  className="p-2 bg-black/50 hover:bg-black/80 rounded-lg text-white/50 hover:text-white transition-all backdrop-blur-md border border-white/10"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {renderStreamPlayer(watchingStream)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-center mb-12 flex flex-col items-center">
        {logoUrl && (
          <img src={logoUrl} alt="Torneo Logo" className="h-24 object-contain mb-4 drop-shadow-2xl" />
        )}
        <h1 className="font-orbitron font-bold text-4xl md:text-5xl uppercase tracking-wider mb-4"
            style={{ color: primaryColor, textShadow: `0 0 20px ${primaryColor}40` }}>
          {tournamentName}
        </h1>
        {description && <p className="text-white/60 text-lg max-w-2xl mx-auto">{description}</p>}
        {/* Status badge */}
        {status === 'draft' && <span className="inline-block mt-4 text-xs font-bold bg-white/10 px-3 py-1 rounded text-white/50 uppercase">Pre-torneo</span>}
        {status === 'active' && <span className="inline-block mt-4 text-xs font-bold bg-red-500/20 border border-red-500/30 px-3 py-1 rounded text-red-400 uppercase animate-pulse">● En Vivo</span>}
        {status === 'ended' && <span className="inline-block mt-4 text-xs font-bold bg-white/10 px-3 py-1 rounded text-white/50 uppercase">Torneo Finalizado</span>}
      </div>

      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        <button
          onClick={() => setActiveTab('ranking')}
          className={`px-5 py-2.5 rounded-xl font-orbitron text-sm transition-all shadow-lg ${
            activeTab === 'ranking' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'ranking' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Posiciones
        </button>
        <button
          onClick={() => setActiveTab('participants')}
          className={`px-5 py-2.5 rounded-xl font-orbitron text-sm transition-all shadow-lg ${
            activeTab === 'participants' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'participants' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Participantes
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`px-5 py-2.5 rounded-xl font-orbitron text-sm transition-all shadow-lg ${
            activeTab === 'matches' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'matches' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Resumen de Partidas
        </button>
      </div>

      {activeTab === 'ranking' ? (
        <div className="bg-dark-card/80 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5 text-xs text-white/40 uppercase tracking-widest font-semibold">
                  <th className="px-6 py-4 w-20 text-center">Rank</th>
                  <th className="px-6 py-4">Equipo</th>
                  <th className="px-6 py-4 text-center">PTS</th>
                  <th className="px-6 py-4 text-center">Kills</th>
                  <th className="px-6 py-4 text-center">Top 1</th>
                  <th className="px-6 py-4 text-center">Kill Rate</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {standings.map((s) => {
                    const rankDiff = (s.previousRank || s.rank) - s.rank
                    return (
                      <motion.tr
                        key={s.teamId}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="border-b border-white/5 hover:bg-white/[0.02] group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`font-orbitron font-bold text-xl ${
                              s.rank === 1 ? 'text-gold' : 
                              s.rank === 2 ? 'text-gray-300' : 
                              s.rank === 3 ? 'text-orange-400' : 'text-white/60'
                            }`}>
                              #{s.rank}
                            </span>
                            {rankDiff > 0 && <span className="text-[10px] text-green-400">▲{rankDiff}</span>}
                            {rankDiff < 0 && <span className="text-[10px] text-red-400">▼{Math.abs(rankDiff)}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {s.avatarUrl && <img src={s.avatarUrl} alt="" className="w-8 h-8 rounded-full" />}
                            <div>
                               <div className="flex items-center gap-2">
                                 <span className="font-orbitron font-medium text-lg tracking-wide text-white">{s.teamName}</span>
                                 {s.streams && s.streams.length > 0 && (
                                   <button
                                     onClick={() => setActiveTab('participants')}
                                     title={`Ver streams de ${s.teamName} en tab Participantes`}
                                     className="ml-2 text-red-500/60 hover:text-red-400 transition-colors"
                                   >
                                     <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                       <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/>
                                     </svg>
                                   </button>
                                 )}
                               </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-orbitron font-bold text-2xl text-neon-cyan">
                          {s.totalPoints}
                        </td>
                        <td className="px-6 py-4 text-center text-white/80 font-medium">
                          {s.totalKills}
                        </td>
                        <td className="px-6 py-4 text-center text-white/60">
                          {s.potTopCount}
                        </td>
                        <td className="px-6 py-4 text-center text-white/60">
                          {s.killRate.toFixed(1)}
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
                {standings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-white/40">
                      Aún no hay posiciones registradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'participants' ? (
        <div className="space-y-4">
          {(!teams || teams.length === 0) ? (
            <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl">
              <p className="text-white/40">No hay participantes registrados aún</p>
            </div>
          ) : (
            teams.map((team: any) => (
              <div key={team.id} className="bg-dark-card/80 backdrop-blur-md border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {team.avatarUrl ? (
                      <img src={team.avatarUrl} alt={team.name} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg">🎮</div>
                    )}
                    <h3 className="font-orbitron font-bold text-white text-lg">{team.name}</h3>
                  </div>
                  {/* Team stream buttons */}
                  <div className="flex gap-2">
                    {team.streamUrl && (
                      <>
                        <button
                          onClick={() => handleWatchTeam(team.streamUrl)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold hover:bg-red-600/30 transition-all"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Ver en app
                        </button>
                        <a
                          href={team.streamUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-white/60 rounded-lg text-xs font-medium hover:bg-white/10 transition-all"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          Ir al canal
                        </a>
                      </>
                    )}
                  </div>
                </div>
                {/* Participants list */}
                {team.participants && team.participants.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {team.participants.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${p.streamUrl ? 'bg-red-500 animate-pulse' : 'bg-white/20'}`} />
                          <span className="text-sm text-white/80">{p.displayName}</span>
                          {p.isCaptain && <span className="text-[9px] font-bold text-neon-cyan uppercase tracking-wider border border-neon-cyan/30 px-1 py-0.5 rounded">Cap</span>}
                        </div>
                        {p.streamUrl && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleWatchTeam(p.streamUrl)}
                              title="Ver stream en app"
                              className="p-1 bg-red-600/20 hover:bg-red-600/40 rounded text-red-400 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </button>
                            <a
                              href={p.streamUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Ir al canal"
                              className="p-1 bg-white/5 hover:bg-white/10 rounded text-white/40 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <MatchRecap matches={matches || []} submissions={submissions || []} primaryColor={primaryColor} />
      )}
    </div>
  )
}
