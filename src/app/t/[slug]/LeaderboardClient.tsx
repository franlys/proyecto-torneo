'use client'

import React, { useEffect, useState, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Orbitron } from 'next/font/google'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { TeamStanding, Participant, Match, Submission, ScoringRule } from '@/types'
import { MatchRecap } from './MatchRecap'
import { TeamDetails } from './TeamDetails'
import { NumberTicker } from '@/components/ui/NumberTicker'

const orbitron = Orbitron({ subsets: ['latin'] })

export function LeaderboardClient({
  tournamentId,
  tournamentName,
  tournamentLogoUrl,
  description,
  format,
  status,
  initialStandings,
  teams,
  theme,
  matches,
  submissions,
  killRateEnabled,
  potTopEnabled,
  vipEnabled,
  rulesText,
  scoringRule,
  participants,
}: {
  tournamentId: string
  tournamentName: string
  tournamentLogoUrl?: string
  description?: string
  format: string
  status: string
  initialStandings: any[]
  teams?: any[]
  theme?: any
  matches?: Match[]
  submissions?: Submission[]
  killRateEnabled?: boolean
  potTopEnabled?: boolean
  vipEnabled?: boolean
  rulesText?: string
  scoringRule?: ScoringRule
  participants: Participant[]
}) {
  const [isMounted, setIsMounted] = useState(false)
  const [host, setHost] = useState('localhost')
  const primaryColor = theme?.primary_color || theme?.primaryColor || '#00F5FF'
  const [standings, setStandings] = useState(initialStandings)
  const [activeTab, setActiveTab] = useState<'ranking' | 'participants' | 'matches' | 'rules' | 'statistics'>('ranking')
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null)
  const [watchingStream, setWatchingStream] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    setHost(window.location.hostname)
  }, [])
  const supabase = createClient()

  // Top Fragger Individual: Calculado comparando cada jugador de manera individual
  const allParticipants = (teams || []).flatMap((t: any) => 
    (t.participants || []).map((p: Participant) => ({
      ...p,
      teamId: t.id,
      teamName: t.name,
      teamAvatar: t.avatarUrl
    }))
  )
  
  const topFraggers = [...allParticipants]
    .sort((a, b) => (b.totalKills || 0) - (a.totalKills || 0))
    .filter(p => (p.totalKills || 0) > 0)
    .slice(0, 5)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
            .select('*, teams(name, avatar_url, vip_score, stream_url, participants(id, display_name, stream_url, total_kills))')
            .eq('tournament_id', tournamentId)
            .order('rank', { ascending: true })

          if (data) {
            // Fetch teams to merge in stream info
            const { data: teamsData } = await supabase
              .from('teams')
              .select('id, name, avatar_url, stream_url, participants(id, display_name, stream_url, total_kills)')
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

  const backgroundValue = theme?.background_value
  const backgroundMobileValue = theme?.background_mobile_value
  const activeBackground = (isMobile && backgroundMobileValue) ? backgroundMobileValue : backgroundValue
  const logoUrl = theme?.logo_url

  const isVideoBackground = activeBackground?.toLowerCase().match(/\.(mp4|webm|ogg)$/)
  
  // YouTube Detection
  const youtubeId = activeBackground?.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w\-]{11})/)?.[1]
  
  // Twitch Detection
  const twitchUser = activeBackground?.match(/(?:twitch\.tv\/)([\w\-]+)/)?.[1]

  // Kick Detection
  const kickUser = activeBackground?.match(/(?:kick\.com\/)([\w\-]+)/)?.[1]

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/10 border-t-neon-cyan rounded-full animate-spin" />
      </div>
    )
  }


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
    <>
      {/* ── Background Handler (Root Level) ─────────────────────────── */}
      {activeBackground && (
        <div className="fixed inset-0 w-full h-full -z-10 overflow-hidden pointer-events-none">
          {youtubeId ? (
            <div 
              className="absolute top-1/2 left-1/2 min-w-full min-h-full w-[177.77vh] h-[56.25vw] -translate-x-1/2 -translate-y-1/2"
              style={{ opacity: (theme?.background_opacity ?? 40) / 100 }}
            >
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&modestbranding=1&rel=0&showinfo=0`}
                className="w-full h-full border-0 pointer-events-none scale-[1.05]"
                allow="autoplay; encrypted-media"
              />
            </div>
          ) : (
            <>
              {twitchUser ? (
                <div 
                  className="absolute top-1/2 left-1/2 min-w-full min-h-full w-[177.77vh] h-[56.25vw] -translate-x-1/2 -translate-y-1/2"
                  style={{ opacity: (theme?.background_opacity ?? 40) / 100 }}
                >
                  <iframe
                    src={`https://player.twitch.tv/?channel=${twitchUser}&parent=${host}&muted=true&autoplay=true&controls=false`}
                    className="w-full h-full border-0 pointer-events-none scale-[1.05]"
                    allowFullScreen
                  />
                </div>
              ) : kickUser ? (
                <div 
                  className="absolute top-1/2 left-1/2 min-w-full min-h-full w-[177.77vh] h-[56.25vw] -translate-x-1/2 -translate-y-1/2"
                  style={{ opacity: (theme?.background_opacity ?? 40) / 100 }}
                >
                  <iframe
                    src={`https://player.kick.com/${kickUser}?muted=true&autoplay=true`}
                    className="w-full h-full border-0 pointer-events-none scale-[1.1]"
                  />
                </div>
              ) : isVideoBackground ? (
                <video 
                  key={activeBackground}
                  src={activeBackground} 
                  autoPlay loop muted playsInline 
                  className="w-full h-full object-cover block absolute inset-0" 
                  style={{ opacity: (theme?.background_opacity ?? 40) / 100 }}
                />
              ) : (
                <div 
                  key={activeBackground}
                  className="w-full h-full bg-cover bg-center block" 
                  style={{ 
                    backgroundImage: `url(${activeBackground})`,
                    opacity: (theme?.background_opacity ?? 40) / 100 
                  }} 
                />
              )}
            </>
          )}
          {/* Subtle vignette for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
        </div>
      )}

      {/* ── Main UI Content (With Glow Effect) ──────────────────────── */}
      <div 
        className="w-full max-w-7xl mx-auto p-4 md:p-8 relative z-10 min-h-[90vh] flex flex-col justify-center py-10"
        style={{ 
          filter: `drop-shadow(0 0 50px ${primaryColor}15)`,
        }}
      >
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
        <Link 
          href="/hall-of-fame"
          className="mb-8 px-4 py-1.5 rounded-full border border-gold/30 bg-gold/5 text-[9px] font-black uppercase tracking-[0.3em] text-gold hover:bg-gold/10 transition-all flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
          Ver Hall of Fame
        </Link>
        
        {tournamentLogoUrl ? (
          <div className="mb-6">
            <img 
              src={tournamentLogoUrl} 
              alt={tournamentName} 
              className="max-h-32 md:max-h-48 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]" 
            />
            {/* Hidden h1 for SEO while showing logo */}
            <h1 className="sr-only">{tournamentName}</h1>
          </div>
        ) : (
          <h1 className="font-orbitron font-bold text-2xl sm:text-4xl md:text-5xl uppercase tracking-wider mb-4 px-4"
              style={{ color: primaryColor, textShadow: `0 0 20px ${primaryColor}40` }}>
            {tournamentName}
          </h1>
        )}

        {description && <p className="text-white/60 text-lg max-w-2xl mx-auto">{description}</p>}
        {/* Status badge */}
        {status === 'draft' && <span className="inline-block mt-4 text-xs font-bold bg-white/10 px-3 py-1 rounded text-white/50 uppercase">Pre-torneo</span>}
        {status === 'active' && <span className="inline-block mt-4 text-xs font-bold bg-red-500/20 border border-red-500/30 px-3 py-1 rounded text-red-400 uppercase animate-pulse">● En Vivo</span>}
        {status === 'ended' && <span className="inline-block mt-4 text-xs font-bold bg-white/10 px-3 py-1 rounded text-white/50 uppercase">Torneo Finalizado</span>}
      </div>

      {/* Top Fragger Hero Section (Individual) */}
      {topFraggers.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />
            <h2 className={`${orbitron.className} text-xl font-black text-neon-cyan uppercase tracking-widest flex items-center gap-3`}>
              <span className="p-1 px-2 rounded bg-neon-cyan/20 text-[10px] sm:text-xs font-sans">Individual</span>
              Top Fragger MVP
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topFraggers.slice(0, 3).map((player, idx) => (
              <motion.div
                key={player.id}
                whileHover={{ scale: 1.02, y: -5 }}
                className={`relative group bg-dark-card/40 backdrop-blur-xl border rounded-2xl p-5 overflow-hidden transition-all duration-300 ${
                  idx === 0 ? 'border-neon-cyan/50 shadow-[0_0_20px_rgba(0,245,255,0.15)]' : 'border-white/5'
                }`}
              >
                {/* Accent background */}
                <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-20 ${
                  idx === 0 ? 'bg-neon-cyan' : 'bg-neon-purple'
                }`} />

                <div className="flex items-center gap-4 relative z-10">
                  <div className="relative">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl border-2 ${
                      idx === 0 ? 'bg-neon-cyan/10 border-neon-cyan/50' : 'bg-white/5 border-white/10'
                    }`}>
                      {idx === 0 ? '👑' : idx === 1 ? '🥈' : '🥉'}
                    </div>
                    {idx === 0 && (
                      <div className="absolute -top-2 -left-2 bg-neon-cyan text-black font-black text-[10px] px-1.5 py-0.5 rounded-full animate-bounce">
                        MVP
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-orbitron font-bold text-white text-lg truncate group-hover:text-neon-cyan transition-colors">
                      {player.displayName}
                    </h4>
                    <p className="text-white/40 text-xs truncate">Equipo: {(player as any).teamName}</p>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-black text-white leading-none">{(player as any).totalKills || 0}</div>
                    <div className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">Kills</div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-3">
                  {player.streamUrl ? (
                    <button
                      onClick={() => handleWatchTeam(player.streamUrl!)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold hover:bg-red-600/30 transition-all shadow-lg shadow-red-500/5 group/btn"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      Live Stream
                      <svg className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  ) : (
                    <div className="flex-1 py-2 text-center text-[10px] text-white/20 font-medium uppercase tracking-widest border border-dashed border-white/10 rounded-lg">
                      Sin Stream Live
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Tabs — scrollable on mobile */}
      <div className="flex gap-1 mb-6 sm:mb-8 sm:justify-center overflow-x-auto pb-1 px-2 sm:px-0 scrollbar-hide">
        <button
          onClick={() => setActiveTab('ranking')}
          className={`shrink-0 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg ${
            activeTab === 'ranking' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'ranking' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Posiciones
        </button>
        <button
          onClick={() => setActiveTab('participants')}
          className={`shrink-0 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg ${
            activeTab === 'participants' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'participants' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Participantes
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`shrink-0 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg ${
            activeTab === 'matches' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'matches' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Partidas
        </button>
        <button
          onClick={() => setActiveTab('statistics')}
          className={`shrink-0 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg ${
            activeTab === 'statistics' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'statistics' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Estadísticas
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`shrink-0 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-orbitron text-xs sm:text-sm transition-all shadow-lg ${
            activeTab === 'rules' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'
          }`}
          style={{ borderColor: activeTab === 'rules' ? primaryColor : 'transparent', borderWidth: 1 }}
        >
          Reglas
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
                  {potTopEnabled && <th className="hidden md:table-cell px-6 py-4 text-center">Top 1</th>}
                  {killRateEnabled && <th className="hidden md:table-cell px-6 py-4 text-center">Kill Rate</th>}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {standings.map((s) => {
                    const rankDiff = (s.previousRank || s.rank) - s.rank
                    return (
                      <Fragment key={s.teamId}>
                      <motion.tr
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ 
                          type: 'spring', 
                          stiffness: 400, 
                          damping: 40,
                          opacity: { duration: 0.2 },
                          layout: { duration: 0.6 }
                        }}
                        className={`border-b border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer group ${
                          expandedTeamId === s.teamId ? 'bg-white/[0.03]' : ''
                        }`}
                        onClick={() => setExpandedTeamId(expandedTeamId === s.teamId ? null : s.teamId)}
                      >
                        <td className="px-3 sm:px-6 py-4 sm:py-6">
                          <div className="flex items-center justify-center gap-1 sm:gap-2">
                             <div className="flex flex-col items-center">
                                <span className={`font-orbitron font-black text-base sm:text-2xl ${
                                  s.rank === 1 ? 'text-gold drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]' : 
                                  s.rank === 2 ? 'text-gray-300' : 
                                  s.rank === 3 ? 'text-orange-400' : 'text-white/40'
                                }`}>
                                  {s.rank}
                                </span>
                                <div className="flex items-center gap-1 mt-1 h-3">
                                   <AnimatePresence mode="wait">
                                     {rankDiff > 0 && (
                                       <motion.span 
                                         key="up"
                                         initial={{ opacity: 0, y: 5 }}
                                         animate={{ opacity: 1, y: 0 }}
                                         exit={{ opacity: 0, y: -5 }}
                                         className="text-[9px] font-bold text-green-400 flex items-center"
                                       >
                                         ▲{rankDiff}
                                       </motion.span>
                                     )}
                                     {rankDiff < 0 && (
                                       <motion.span 
                                         key="down"
                                         initial={{ opacity: 0, y: -5 }}
                                         animate={{ opacity: 1, y: 0 }}
                                         exit={{ opacity: 0, y: 5 }}
                                         className="text-[9px] font-bold text-red-400 flex items-center"
                                       >
                                         ▼{Math.abs(rankDiff)}
                                       </motion.span>
                                     )}
                                   </AnimatePresence>
                                </div>
                             </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 sm:py-6">
                          <div className="flex items-center gap-3 sm:gap-5">
                            <div className="relative">
                               {s.avatarUrl ? (
                                 <img src={s.avatarUrl} alt="" className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 border-white/10 shadow-xl" />
                               ) : (
                                 <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 font-orbitron font-black text-xl italic">
                                   {s.teamName.substring(0, 1)}
                                 </div>
                               )}
                               {expandedTeamId === s.teamId && (
                                 <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-neon-cyan border-2 border-dark-card flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                 </div>
                               )}
                            </div>
                            <div className="flex-1">
                               <div className="flex items-center gap-3">
                                 <span className="font-orbitron font-black text-sm sm:text-xl tracking-tight text-white group-hover:text-neon-cyan transition-colors">{s.teamName}</span>
                                 {s.streams && s.streams.length > 0 && (
                                   <div className="flex items-center gap-1 text-[8px] bg-red-500/20 text-red-500 font-bold px-1.5 py-0.5 rounded border border-red-500/30 uppercase tracking-tighter">
                                      LIVE
                                   </div>
                                 )}
                               </div>
                               <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Ver Detalles</span>
                                  <svg className={`w-3 h-3 text-white/20 transition-transform ${expandedTeamId === s.teamId ? 'rotate-90 text-neon-cyan' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                  </svg>
                               </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 sm:py-6 text-center font-orbitron font-black text-2xl sm:text-4xl text-neon-cyan">
                          <NumberTicker value={s.totalPoints} />
                        </td>
                        <td className="px-3 sm:px-6 py-4 sm:py-6 text-center">
                           <div className="flex flex-col items-center">
                              <span className="text-white font-black text-lg sm:text-xl">
                                <NumberTicker value={s.totalKills} />
                              </span>
                              <span className="text-[8px] text-white/40 uppercase font-black tracking-widest mt-1">TOTAL KILLS</span>
                           </div>
                        </td>
                        {potTopEnabled && (
                          <td className="hidden md:table-cell px-6 py-4 text-center">
                             <div className="flex flex-col items-center">
                                <span className="text-gold font-black text-lg">{s.potTopCount}</span>
                                <span className="text-[8px] text-white/40 uppercase font-black tracking-widest mt-1">VICTORIAS</span>
                             </div>
                          </td>
                        )}
                        {killRateEnabled && (
                          <td className="hidden md:table-cell px-6 py-4 text-center">
                             <div className="flex flex-col items-center">
                                <span className="text-white/60 font-mono text-xs">
                                  <NumberTicker value={s.killRate} precision={1} />
                                </span>
                                <span className="text-[8px] text-white/20 uppercase font-black tracking-tighter mt-1">AVG K/M</span>
                             </div>
                          </td>
                        )}
                      </motion.tr>

                      {/* Expansion Row */}
                      <AnimatePresence>
                        {expandedTeamId === s.teamId && (
                          <motion.tr
                            key={`details-${s.teamId}`}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-black/40 overflow-hidden"
                          >
                            <td colSpan={6} className="p-0">
                               <TeamDetails 
                                 teamId={s.teamId}
                                 teamName={s.teamName}
                                 matches={matches || []}
                                 submissions={submissions || []}
                                 scoringRule={scoringRule!}
                                 participants={participants}
                                 primaryColor={primaryColor}
                               />
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                      </Fragment>
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
                        <div className="flex items-center gap-2 max-w-[60%]">
                          <div className={`w-2 h-2 rounded-full ${p.streamUrl ? 'bg-red-500 animate-pulse' : 'bg-white/20'}`} />
                          <span className="text-sm text-white/80 truncate">{p.displayName}</span>
                          {p.isCaptain && <span className="text-[9px] font-bold text-neon-cyan uppercase tracking-wider border border-neon-cyan/30 px-1 py-0.5 rounded shrink-0">Cap</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                             <span className="text-xs font-orbitron font-bold text-white block leading-none">{p.totalKills || 0}</span>
                             <span className="text-[7px] text-white/30 uppercase font-black tracking-tighter">Kills</span>
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'statistics' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {standings.map((team, idx) => (
                <div 
                  key={team.teamId}
                  className={`group relative overflow-hidden rounded-2xl border transition-all cursor-pointer ${
                    expandedTeamId === team.teamId 
                      ? 'border-neon-cyan bg-white/[0.05] ring-1 ring-neon-cyan/20' 
                      : 'border-white/5 bg-white/[0.02] hover:border-white/20'
                  }`}
                  onClick={() => setExpandedTeamId(expandedTeamId === team.teamId ? null : team.teamId)}
                >
                  <div className="p-6 flex items-center justify-between relative z-10">
                     <div className="flex items-center gap-4">
                        <div className="relative">
                           <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden shadow-inner">
                              {team.avatarUrl ? (
                                <img src={team.avatarUrl} alt={team.teamName} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xl bg-gradient-to-br from-white/5 to-transparent">🛡️</div>
                              )}
                           </div>
                           <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-[10px] font-black text-white">
                              {idx + 1}
                           </div>
                        </div>
                        <div>
                           <h4 className="font-orbitron font-bold text-white group-hover:text-neon-cyan transition-colors truncate max-w-[150px]">{team.teamName}</h4>
                           <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">Analizar Equipo</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <div className="text-xl font-black text-white leading-none">{team.total_points}</div>
                        <div className="text-[8px] text-white/30 uppercase font-bold tracking-tighter">Puntos</div>
                     </div>
                  </div>
                  
                  {/* Small progress bar */}
                  <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-neon-cyan to-transparent w-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
             ))}
          </div>

          <AnimatePresence>
            {expandedTeamId && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden bg-dark-card/50 backdrop-blur-xl border border-neon-cyan/20 rounded-[32px] shadow-2xl"
              >
                {standings
                  .filter(s => s.teamId === expandedTeamId)
                  .map(s => (
                    <TeamDetails
                      key={s.teamId}
                      teamId={s.teamId}
                      teamName={s.teamName}
                      matches={matches || []}
                      submissions={submissions || []}
                      scoringRule={scoringRule!}
                      participants={participants}
                      primaryColor={primaryColor}
                    />
                  ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : activeTab === 'matches' ? (
        <MatchRecap 
          matches={matches || []} 
          submissions={submissions || []} 
          participants={participants}
          primaryColor={primaryColor} 
        />
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dark-card/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(0,245,255,0.1)]">
              📜
            </div>
            <div>
              <h2 className={`${orbitron.className} text-2xl font-black text-white uppercase tracking-tighter`}>
                Reglamento Oficial
              </h2>
              <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Normativas y Conducta del Torneo</p>
            </div>
          </div>
          
          <div className="prose prose-invert max-w-none">
            {rulesText ? (
              <p className="text-white/70 leading-relaxed whitespace-pre-wrap font-sans text-base sm:text-lg bg-white/[0.02] p-6 rounded-2xl border border-white/5">
                {rulesText}
              </p>
            ) : (
              <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl">
                <p className="text-white/20 italic">No se han definido reglas específicas para este torneo aún.</p>
              </div>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5">
              <span className="text-[10px] font-black text-neon-cyan uppercase tracking-[0.2em] block mb-2">Formato de Juego</span>
              <span className="text-white font-orbitron font-bold text-sm uppercase">{format.replace(/_/g, ' ')}</span>
            </div>
            <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5">
              <span className="text-[10px] font-black text-neon-cyan uppercase tracking-[0.2em] block mb-2">Estado del Torneo</span>
              <span className="text-white font-orbitron font-bold text-sm uppercase">{status}</span>
            </div>
          </div>
        </motion.div>
      )}
      </div>
    </>
  )
}
