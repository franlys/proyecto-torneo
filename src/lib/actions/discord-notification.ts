'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { sendDiscordEmbed, resolveDiscordGuildId, getGuildChannels } from '@/lib/services/discord'

export async function notifySubmissionToDiscord(submissionId: string) {
  try {
    const adminSupabase = await createAdminClient()

    // 1. Get submission, team name, and match details
    const { data: sub, error: subErr } = await adminSupabase
      .from('submissions')
      .select('id, match_id, tournament_id, kill_count, rank, team_id, teams(id, name)')
      .eq('id', submissionId)
      .single()

    if (subErr || !sub) return

    const teamName = (sub.teams as any)?.name || 'Equipo'

    // 2. Get tournament details
    const { data: tournament } = await adminSupabase
      .from('tournaments')
      .select('id, name, status, creator_id, discord_url, discord_integration_enabled, discord_announcement_channel_id, discord_voice_category_id')
      .eq('id', sub.tournament_id)
      .single()

    if (!tournament || tournament.status !== 'active') return

    // 3. Get match details
    const { data: match } = await adminSupabase
      .from('matches')
      .select('id, name, match_number')
      .eq('id', sub.match_id)
      .single()

    const matchName = match?.name || (match?.match_number ? `Encuentro ${match.match_number}` : 'Partida')

    // 4. Resolve Discord guild ID
    let guildId: string | null = null
    if (tournament.discord_url) {
      guildId = await resolveDiscordGuildId(tournament.discord_url)
    }
    if (!guildId && tournament.creator_id) {
      const { data: prof } = await adminSupabase
        .from('profiles')
        .select('discord_guild_id')
        .eq('id', tournament.creator_id)
        .single()
      if (prof?.discord_guild_id) {
        guildId = prof.discord_guild_id
      }
    }

    // 5. Query Discord category text channels to find team's private channel
    let textChannels: any[] = []
    if (guildId && tournament.discord_voice_category_id) {
      const channelsRes = await getGuildChannels(guildId)
      if (channelsRes.success && Array.isArray(channelsRes.data)) {
        textChannels = channelsRes.data.filter((c: any) => c.type === 0 && c.parent_id === tournament.discord_voice_category_id)
      }
    }

    const sanitized = teamName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    const target = `chat-${sanitized}`
    const teamChannel = textChannels.find((c: any) => c.name === target || c.name.includes(sanitized) || sanitized.includes(c.name.replace(/^chat-/, '')))

    // 6. Send confirmation message directly into the team's Discord channel
    if (teamChannel) {
      await sendDiscordEmbed(teamChannel.id, {
        title: `✅ ¡EVIDENCIA RECIBIDA! - ${matchName} 📸`,
        description: `¡Hola equipo **${teamName}**!\n\nSu evidencia para **${matchName}** ha sido **recibida y registrada exitosamente** en la plataforma.\n\n• **Bajas reportadas:** ${sub.kill_count} Kills\n• **Posición obtenida:** ${sub.rank ? `#${sub.rank}` : 'Registrada'}\n• **Estado:** En cola de revisión y cómputo.\n\n¡Gracias por reportar a tiempo!`,
        color: 65280, // Green
        timestamp: new Date().toISOString()
      })
    }

    // 7. If public announcement channel exists, post room progress embed
    if (tournament.discord_announcement_channel_id) {
      const { data: allTeams } = await adminSupabase
        .from('teams')
        .select('id, name')
        .eq('tournament_id', sub.tournament_id)

      const totalTeamsCount = allTeams?.length || 0

      const { data: matchSubs } = await adminSupabase
        .from('submissions')
        .select('team_id')
        .eq('match_id', sub.match_id)

      const submittedTeamIds = new Set((matchSubs || []).map((s: any) => s.team_id))
      const submittedCount = submittedTeamIds.size
      const pendingTeams = (allTeams || []).filter((t: any) => !submittedTeamIds.has(t.id))
      const pendingNames = pendingTeams.map((t: any) => t.name)

      const announcementEmbed: any = {
        title: `📸 Evidencia Recibida - ${teamName}`,
        description: `El equipo **${teamName}** ha enviado sus reportes para **${matchName}** del torneo **${tournament.name}**.`,
        color: 5814783,
        fields: [
          {
            name: 'Kills Reportadas',
            value: `${sub.kill_count} Kills`,
            inline: true
          },
          {
            name: 'Posición Obtenida',
            value: sub.rank ? `#${sub.rank}` : 'No especificado',
            inline: true
          },
          {
            name: 'Avance de Reportes',
            value: `${submittedCount} / ${totalTeamsCount} Equipos`,
            inline: false
          }
        ],
        timestamp: new Date().toISOString()
      }

      if (pendingNames.length > 0) {
        announcementEmbed.fields.push({
          name: `Equipos Pendientes (${pendingNames.length})`,
          value: pendingNames.join(', '),
          inline: false
        })
      } else {
        announcementEmbed.fields.push({
          name: 'Estado de la Partida',
          value: `✅ **¡Todos los equipos han enviado sus evidencias!**\nLos administradores ya pueden procesar la partida.`,
          inline: false
        })
        announcementEmbed.color = 3066993
      }

      await sendDiscordEmbed(tournament.discord_announcement_channel_id, announcementEmbed)
    }
  } catch (error) {
    console.error('[Discord Notification] Error sending submission notice:', error)
  }
}

export async function broadcastMatchPointAlerts(
  tournamentId: string,
  matchPointTeams: { teamId: string; teamName: string; totalPoints: number }[],
  limit: number
) {
  try {
    const adminSupabase = await createAdminClient()

    const { data: tournament } = await adminSupabase
      .from('tournaments')
      .select('id, name, status, creator_id, discord_url, discord_integration_enabled, discord_announcement_channel_id, discord_voice_category_id')
      .eq('id', tournamentId)
      .single()

    if (!tournament || tournament.status !== 'active' || matchPointTeams.length === 0) return

    // Resolve Discord guild ID
    let guildId: string | null = null
    if (tournament.discord_url) {
      guildId = await resolveDiscordGuildId(tournament.discord_url)
    }
    if (!guildId && tournament.creator_id) {
      const { data: prof } = await adminSupabase
        .from('profiles')
        .select('discord_guild_id')
        .eq('id', tournament.creator_id)
        .single()
      if (prof?.discord_guild_id) {
        guildId = prof.discord_guild_id
      }
    }

    // Get Discord category text channels
    let textChannels: any[] = []
    if (guildId && tournament.discord_voice_category_id) {
      const channelsRes = await getGuildChannels(guildId)
      if (channelsRes.success && Array.isArray(channelsRes.data)) {
        textChannels = channelsRes.data.filter((c: any) => c.type === 0 && c.parent_id === tournament.discord_voice_category_id)
      }
    }

    const { data: allTeams } = await adminSupabase
      .from('teams')
      .select('id, name')
      .eq('tournament_id', tournamentId)

    const findTeamChannelId = (teamName: string) => {
      const sanitized = teamName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

      const target = `chat-${sanitized}`
      const match = textChannels.find((c: any) => c.name === target || c.name.includes(sanitized) || sanitized.includes(c.name.replace(/^chat-/, '')))
      return match ? match.id : null
    }

    const mpTeamNames = matchPointTeams.map(t => `👑 **${t.teamName}** (${t.totalPoints} pts)`).join(', ')

    // 1. Send to public announcement channel
    if (tournament.discord_announcement_channel_id) {
      await sendDiscordEmbed(tournament.discord_announcement_channel_id, {
        title: `🚨 ¡ALERTA DE MATCH POINT ALCANZADO! 👑`,
        description: `¡Atención a todos los competidores del torneo **${tournament.name}**!\n\nLos siguientes equipos han alcanzado el umbral de **MATCH POINT** (Objetivo: **${limit} Pts**):\n\n${mpTeamNames}\n\n🏆 **Condición de Victoria Inmediata:**\nSi cualquiera de estos equipos gana la siguiente partida (1º Lugar / Top 1), ¡se coronará automáticamente **CAMPEÓN DEL TORNEO**!`,
        color: 16753920, // Dorado/Naranja
        fields: [
          {
            name: 'Regla Match Point',
            value: `Alcanzar ${limit} puntos + Ganar 1 partida adicional (Top 1) para finalizar el torneo.`,
            inline: false
          }
        ],
        timestamp: new Date().toISOString()
      })
    }

    // 2. Send per-team private alerts
    const mpTeamIds = new Set(matchPointTeams.map(t => t.teamId))
    for (const team of allTeams || []) {
      const chId = findTeamChannelId(team.name)
      if (!chId) continue

      if (mpTeamIds.has(team.id)) {
        const myMp = matchPointTeams.find(t => t.teamId === team.id)
        await sendDiscordEmbed(chId, {
          title: `🔥 ¡ESTÁN OFICIALMENTE EN MATCH POINT! 👑`,
          description: `¡Felicidades equipo **${team.name}**!\n\nHan acumulado **${myMp?.totalPoints || limit} Puntos**, superando el límite de **${limit} Pts** del torneo.\n\n🎯 **Misión de Campeonato:** ¡Sólo necesitan ganar (Top 1) la próxima partida que jueguen para ser coronados **CAMPEONES**! ¡Todo o nada!`,
          color: 65280, // Verde brillante
          timestamp: new Date().toISOString()
        })
      } else {
        await sendDiscordEmbed(chId, {
          title: `⚠️ ¡RIVAL EN MATCH POINT! 🛑`,
          description: `¡Atención equipo **${team.name}**!\n\nLos siguientes rivales entraron en **MATCH POINT**:\n${mpTeamNames}\n\n🛡️ **Misión Táctica:** ¡Deben evitar a toda costa que estos equipos ganen la próxima partida (Top 1) o el torneo finalizará de inmediato!`,
          color: 16711680, // Rojo Alerta
          timestamp: new Date().toISOString()
        })
      }
    }
  } catch (err) {
    console.error('[broadcastMatchPointAlerts] Error:', err)
  }
}
