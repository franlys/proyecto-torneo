export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TeamPortalClient } from './TeamPortalClient'

export default async function TeamPortalPage({
  params,
}: {
  params: Promise<{ slug: string; teamId: string }>
}) {
  const { slug, teamId } = await params
  const normalizedSlug = slug.trim().toLowerCase()
  const normalizedTeamId = teamId.trim().toLowerCase()
  const supabase = await createClient()

  // Fetch the tournament
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('id, name, status, kill_rate_enabled, pot_top_enabled, discipline, clash_royale_tag, creator_id, discord_integration_enabled, discord_url')
    .eq('slug', normalizedSlug)
    .single()

  if (tErr || !tournament) notFound()

  // Fetch discord_guild_id from the tournament creator's profile
  let discordGuildId: string | null = null
  if (tournament.creator_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('discord_guild_id')
      .eq('id', tournament.creator_id)
      .single()
    if (profile?.discord_guild_id) {
      discordGuildId = profile.discord_guild_id
    }
  }

  // Fallback: extract guild ID if tournament.discord_url is a channel/guild URL
  if (!discordGuildId && tournament.discord_url) {
    const { extractDiscordGuildId } = await import('@/lib/services/discord')
    discordGuildId = extractDiscordGuildId(tournament.discord_url)
  }

  // Fetch the team
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('*')
    .eq('id', normalizedTeamId)
    .eq('tournament_id', tournament.id)
    .single()

  if (teamErr || !team) notFound()

  // Fetch the team's participants
  const { data: participants } = await supabase
    .from('participants')
    .select('id, display_name, is_captain')
    .eq('team_id', teamId)
    .order('is_captain', { ascending: false })

  // Fetch all matches for the tournament
  const { data: matches } = await supabase
    .from('matches')
    .select('id, name, match_number, is_active, parent_match_id, round_number, map_name')
    .eq('tournament_id', tournament.id)
    .eq('is_completed', false)
    .order('match_number', { ascending: true })

  // Active check if tournament is running
  const isTournamentActive = tournament.status === 'active'
  const isAutoSynced = tournament.discipline === 'clash_royale' || !!tournament.clash_royale_tag

  return (
    <main className="min-h-screen bg-dark-bg text-white font-inter flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
           <h1 className="font-orbitron text-2xl font-bold text-neon-cyan uppercase tracking-widest">{tournament.name}</h1>
           <p className="text-white/40 uppercase tracking-widest text-xs mt-2">Portal de Equipo</p>
        </div>

        <div className="bg-dark-card border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-purple to-neon-cyan"></div>
          
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
            {team.avatar_url ? (
               <img src={team.avatar_url} alt={team.name} className="w-16 h-16 rounded-xl object-cover border border-white/10" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
                🎮
              </div>
            )}
            <div>
              <h2 className="text-2xl font-orbitron font-bold text-white">{team.name}</h2>
              <p className="text-sm text-white/50">{isAutoSynced ? 'Sincronización Automática' : 'Subida de Evidencia'}</p>
            </div>
          </div>

          {/* Hub de Discord para el Equipo (Siempre visible para coordinar) */}
          {(team.discord_voice_channel_id || team.discord_text_channel_id || tournament.discord_url) && (
            <div className="mb-6 bg-[#5865F2]/10 border border-[#5865F2]/25 rounded-2xl p-4 space-y-3 shadow-[0_0_20px_rgba(88,101,242,0.12)] animate-in fade-in duration-300">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center text-white shrink-0">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0c-.172-.386-.412-.875-.623-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.873-.894a.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.894a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.156-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.156-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.156 2.418z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-orbitron font-bold text-white uppercase tracking-wider">Discord de la Partida</h4>
                  <p className="text-[10px] text-white/50 leading-tight">
                    Canales oficiales y salas privadas de tu equipo
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {team.discord_voice_channel_id && discordGuildId && (
                  <a 
                    href={`https://discord.com/channels/${discordGuildId}/${team.discord_voice_channel_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-orbitron font-bold text-[11px] uppercase tracking-wider transition-all shadow-[0_4px_12px_rgba(88,101,242,0.35)] active:scale-[0.98]"
                  >
                    <span>🔊</span>
                    <span>Voz de Equipo</span>
                  </a>
                )}
                {team.discord_text_channel_id && discordGuildId && (
                  <a 
                    href={`https://discord.com/channels/${discordGuildId}/${team.discord_text_channel_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-neon-purple/20 hover:bg-neon-purple/30 border border-neon-purple/40 text-white font-orbitron font-bold text-[11px] uppercase tracking-wider transition-all"
                  >
                    <span>💬</span>
                    <span>Chat de Equipo</span>
                  </a>
                )}
                {tournament.discord_url && (
                  <a 
                    href={tournament.discord_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-orbitron font-bold text-[11px] uppercase tracking-wider transition-all ${
                      team.discord_voice_channel_id && team.discord_text_channel_id ? 'sm:col-span-2' : ''
                    }`}
                  >
                    <span>🌐</span>
                    <span>Servidor Discord</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {isAutoSynced ? (
            <div className="text-center py-8 px-4 space-y-4">
              <span className="text-5xl block animate-pulse">⚡</span>
              <h3 className="text-lg text-white font-orbitron font-bold uppercase tracking-wider">Marcador Sincronizado por API</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Este torneo se actualiza automáticamente a través de la API de Clash Royale.
              </p>
              <div className="p-3 bg-neon-cyan/5 border border-neon-cyan/25 rounded-xl text-xs text-neon-cyan/85 font-medium leading-relaxed">
                No necesitas subir capturas de pantalla ni reportar resultados manualmente. Juega tus partidas en el torneo dentro del juego y los resultados se reflejarán en el marcador general.
              </div>
            </div>
          ) : !isTournamentActive ? (
            <div className="text-center py-8">
              <span className="text-4xl mb-4 block">⏳</span>
              <h3 className="text-lg text-white font-medium mb-2">El torneo no está activo</h3>
              <p className="text-sm text-white/50">No puedes subir evidencia hasta que el organizador inicie el torneo.</p>
            </div>
          ) : (matches || []).length === 0 ? (
             <div className="text-center py-8">
              <h3 className="text-lg text-white font-medium mb-2">Sin partidas disponibles</h3>
              <p className="text-sm text-white/50">No hay rondas configuradas o ya finalizaron todas.</p>
            </div>
          ) : (
            <TeamPortalClient 
              tournament={tournament}
              team={team}
              participants={participants || []}
              matches={matches || []}
              discordGuildId={discordGuildId}
            />
          )}
        </div>
      </div>
    </main>
  )
}
