'use server'

import { createClient } from '@/lib/supabase/server'
import type { Match } from '@/types'
import { revalidatePath } from 'next/cache'
import { pushToAC } from './ac-push'

export async function getTournamentMatches(tournamentId: string): Promise<{ data: Match[] } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('match_number', { ascending: true })
    .order('round_number', { ascending: true })

  if (error) return { error: error.message }

  const mapped: Match[] = (data || []).map(m => ({
    id: m.id,
    tournamentId: m.tournament_id,
    name: m.name,
    matchNumber: m.match_number,
    isCompleted: m.is_completed,
    isWarmup: m.is_warmup,
    isActive: m.is_active ?? false,
    parentMatchId: m.parent_match_id,
    roundNumber: m.round_number,
    mapName: m.map_name,
    createdAt: m.created_at,
  }))

  return { data: mapped }
}

async function broadcastMatchTeamNotifications(
  supabase: any,
  tournamentId: string,
  matchId: string,
  matchName: string,
  eventType: 'start' | 'evidence_open' | 'completed'
) {
  try {
    const { data: tourney } = await supabase
      .from('tournaments')
      .select('name, creator_id, discord_url, discord_announcement_channel_id, discord_voice_category_id')
      .eq('id', tournamentId)
      .single()

    if (!tourney) return

    const { resolveDiscordGuildId, getGuildChannels, sendDiscordEmbed } = await import('@/lib/services/discord')

    let guildId: string | null = null
    if (tourney.discord_url) {
      guildId = await resolveDiscordGuildId(tourney.discord_url)
    }
    if (!guildId && tourney.creator_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('discord_guild_id')
        .eq('id', tourney.creator_id)
        .single()
      if (prof?.discord_guild_id) {
        guildId = prof.discord_guild_id
      }
    }

    // 1. Fetch all teams in tournament
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name')
      .eq('tournament_id', tournamentId)

    // 2. Fetch submissions for this match
    const { data: submissions } = await supabase
      .from('submissions')
      .select('team_id, status')
      .eq('match_id', matchId)

    const submittedTeamIds = new Set((submissions || []).map((s: any) => s.team_id))

    // 3. Query Discord category text channels
    let textChannels: any[] = []
    if (guildId && tourney.discord_voice_category_id) {
      const channelsRes = await getGuildChannels(guildId)
      if (channelsRes.success && Array.isArray(channelsRes.data)) {
        textChannels = channelsRes.data.filter((c: any) => c.type === 0 && c.parent_id === tourney.discord_voice_category_id)
      }
    }

    // Helper to find a team's discord channel
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

    // 4. Send per-team personalized messages
    if (teams && teams.length > 0) {
      for (const team of teams) {
        const chId = findTeamChannelId(team.name)
        if (!chId) continue

        const hasSubmitted = submittedTeamIds.has(team.id)

        if (eventType === 'start') {
          await sendDiscordEmbed(chId, {
            title: `🏁 ¡${matchName} EN CURSO! ⚔️`,
            description: `¡Hola equipo **${team.name}**!\n\nLa partida está **EN JUEGO**. Conéctense a su canal de voz para coordinar.\n\n📸 Recuerden tomar captura clara de la tabla de puntuación/bajas al terminar.`,
            color: 65280, // Green
            timestamp: new Date().toISOString(),
          })
        } else if (eventType === 'evidence_open') {
          if (hasSubmitted) {
            await sendDiscordEmbed(chId, {
              title: `✅ EVIDENCIA RECIBIDA - ${matchName}`,
              description: `Equipo **${team.name}**: Su captura de evidencia ya fue recibida y está en proceso de revisión por los jueces. ¡Gracias!`,
              color: 65280, // Green
              timestamp: new Date().toISOString(),
            })
          } else {
            await sendDiscordEmbed(chId, {
              title: `🚨 ¡SUBAN SU EVIDENCIA - ${matchName}! 📸`,
              description: `¡Atención equipo **${team.name}**!\n\nLa partida **${matchName}** ha concluido y **aún no han subido su evidencia**.\n\n👉 **Acción Requerida:** Entren de inmediato al **Portal de Equipo** y suban la captura de pantalla de su partida (tabla de puntuación y bajas).\n\n⚠️ *Tienen pocos minutos antes de que el organizador cierre la partida. Eviten recibir 0 puntos o sanciones en la ronda.*`,
              color: 16753920, // Orange
              timestamp: new Date().toISOString(),
            })
          }
        } else if (eventType === 'completed') {
          if (hasSubmitted) {
            await sendDiscordEmbed(chId, {
              title: `🏆 ¡${matchName} FINALIZADA Y COMPUTADA!`,
              description: `Equipo **${team.name}**: La partida **${matchName}** ha concluido y sus resultados han sido computados en la tabla de posiciones oficial.`,
              color: 65280, // Green
              timestamp: new Date().toISOString(),
            })
          } else {
            await sendDiscordEmbed(chId, {
              title: `⚠️ PARTIDA CERRADA — SIN EVIDENCIA REGISTRADA`,
              description: `¡Atención equipo **${team.name}**!\n\nLa partida **${matchName}** ha sido finalizada y **no se recibió su evidencia** dentro del tiempo reglamentario.\n\n• **Puntuación:** Se les computará **0 bajas / 0 puntos** en esta partida por falta de reporte.\n• **¿Tuviste un problema técnico justificado?** Contacten de inmediato con el soporte u organizador del torneo antes de la siguiente partida.`,
              color: 16711680, // Red
              timestamp: new Date().toISOString(),
            })
          }
        }
      }
    }

    // 5. Send public announcement if announcement channel exists
    if (tourney.discord_announcement_channel_id) {
      if (eventType === 'start') {
        await sendDiscordEmbed(tourney.discord_announcement_channel_id, {
          title: `🏁 ¡${matchName} EN CURSO! ⚔️`,
          description: `La partida del torneo **${tourney.name}** ha comenzado oficialmente. ¡Mucho éxito a todos los escuadrones!`,
          color: 65280,
          timestamp: new Date().toISOString(),
        })
      } else if (eventType === 'evidence_open') {
        const missingCount = teams ? teams.length - submittedTeamIds.size : 0
        await sendDiscordEmbed(tourney.discord_announcement_channel_id, {
          title: `📸 ¡RECEPCIÓN DE EVIDENCIAS ABIERTA - ${matchName}! ⏳`,
          description: `La partida **${matchName}** ha concluido.\n\n👉 **Capitanes:** Suban sus capturas de pantalla en el Portal de Equipo.\n\n📊 **Estado:** ${submittedTeamIds.size}/${teams?.length || 0} equipos han subido evidencia.${missingCount > 0 ? ` (Faltan ${missingCount} equipos)` : ''}`,
          color: 16753920,
          timestamp: new Date().toISOString(),
        })
      } else if (eventType === 'completed') {
        await sendDiscordEmbed(tourney.discord_announcement_channel_id, {
          title: `🏁 ¡${matchName} FINALIZADA! 🏆`,
          description: `La recepción de evidencias para **${matchName}** ha cerrado. La tabla de posiciones acumulada ha sido actualizada.`,
          color: 16766720,
          timestamp: new Date().toISOString(),
        })
      }
    }
  } catch (err) {
    console.error('[broadcastMatchTeamNotifications] Error:', err)
  }
}

export async function updateMatch(
  tournamentId: string,
  matchId: string,
  data: Partial<Pick<Match, 'name' | 'mapName' | 'isCompleted' | 'isWarmup' | 'isActive'>>
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership or admin
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('creator_id, collaborator_id')
    .eq('id', tournamentId)
    .single()

  if (!tournament) return { error: 'Torneo no encontrado' }

  const { checkTournamentAccess } = await import('./tournaments')
  const hasAccess = await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id)
  if (!hasAccess) {
    return { error: 'Sin permisos' }
  }

  const updatePayload: Record<string, unknown> = {}
  if (data.name !== undefined) updatePayload.name = data.name
  if (data.mapName !== undefined) updatePayload.map_name = data.mapName
  if (data.isCompleted !== undefined) updatePayload.is_completed = data.isCompleted
  if (data.isWarmup !== undefined) updatePayload.is_warmup = data.isWarmup
  if (data.isActive !== undefined) updatePayload.is_active = data.isActive

  // If activating this match, deactivate all others in the tournament first
  if (data.isActive === true) {
    await supabase
      .from('matches')
      .update({ is_active: false })
      .eq('tournament_id', tournamentId)
      .neq('id', matchId)

    // Notify all participants in this tournament that the match is active
    try {
      const { data: tourney } = await supabase
        .from('tournaments')
        .select('name')
        .eq('id', tournamentId)
        .single()

      if (tourney) {
        const { data: players } = await supabase
          .from('participants')
          .select('user_id')
          .eq('tournament_id', tournamentId)
          .not('user_id', 'is', null)

        if (players && players.length > 0) {
          // Keep unique user IDs
          const uniqueUserIds = Array.from(new Set(players.map((p: any) => p.user_id)))
          const notificationsToInsert = uniqueUserIds.map((uId) => ({
            user_id: uId,
            title: '¡Partida Lista! ⚔️',
            message: `La partida del torneo "${tourney.name}" ya está activa. ¡Entra a jugar!`
          }))
          await supabase.from('notifications').insert(notificationsToInsert)
        }
      }
    } catch (notifErr) {
      console.error('Error sending Match Active notifications:', notifErr)
    }
  }

  const { error } = await supabase
    .from('matches')
    .update(updatePayload)
    .eq('id', matchId)
    .eq('tournament_id', tournamentId)

  if (error) return { error: error.message }

  // Push updated match to AC mirror
  const { data: updatedMatch } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single()
  if (updatedMatch) {
    pushToAC('matches', 'upsert', {
      id: updatedMatch.id,
      tournamentId: updatedMatch.tournament_id,
      name: updatedMatch.name,
      matchNumber: updatedMatch.match_number,
      roundNumber: updatedMatch.round_number,
      mapName: updatedMatch.map_name,
      isCompleted: updatedMatch.is_completed,
      isActive: updatedMatch.is_active,
      isWarmup: updatedMatch.is_warmup,
      parentMatchId: updatedMatch.parent_match_id,
    })
  }

  // Auto-resolve betting markets when match is marked as completed
  if (data.isCompleted === true) {
    const { autoResolveMatchMarketsAction } = await import('./predictions')
    try {
      await autoResolveMatchMarketsAction(matchId)
    } catch (err: any) {
      console.error('[autoResolve] Error al liquidar mercados del match:', err)
    }
  }

  // Send Discord Announcements with per-team intelligence
  try {
    const matchName = data.name || updatedMatch?.name || 'Partida'

    if (data.isActive === true) {
      await broadcastMatchTeamNotifications(supabase, tournamentId, matchId, matchName, 'start')
    } else if (data.isCompleted === true) {
      await broadcastMatchTeamNotifications(supabase, tournamentId, matchId, matchName, 'completed')
    }
  } catch (discordErr) {
    console.error('Error sending Discord Match announcement:', discordErr)
  }

  revalidatePath(`/t/[slug]`, 'page')
  revalidatePath(`/tournaments/${tournamentId}/matches`)
  return { success: true }
}

export async function createMatch(
  tournamentId: string,
  data: { name: string; matchNumber: number; isWarmup?: boolean; mapName?: string }
): Promise<{ data: Match } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership or admin
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('creator_id, collaborator_id')
    .eq('id', tournamentId)
    .single()

  if (!tournament) return { error: 'Torneo no encontrado' }

  const { checkTournamentAccess } = await import('./tournaments')
  const hasAccess = await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id)
  if (!hasAccess) {
    return { error: 'Sin permisos' }
  }

  const { data: newMatch, error } = await supabase
    .from('matches')
    .insert({
      tournament_id: tournamentId,
      name: data.name,
      match_number: data.matchNumber,
      is_warmup: data.isWarmup ?? false,
      map_name: data.mapName || null,
      is_completed: false,
      is_active: false,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  const mapped: Match = {
    id: newMatch.id,
    tournamentId: newMatch.tournament_id,
    name: newMatch.name,
    matchNumber: newMatch.match_number,
    isCompleted: newMatch.is_completed,
    isWarmup: newMatch.is_warmup,
    isActive: newMatch.is_active ?? false,
    parentMatchId: newMatch.parent_match_id,
    roundNumber: newMatch.round_number,
    mapName: newMatch.map_name,
    createdAt: newMatch.created_at,
  }

  // Push to AC
  pushToAC('matches', 'upsert', {
    id: newMatch.id,
    tournamentId: newMatch.tournament_id,
    name: newMatch.name,
    matchNumber: newMatch.match_number,
    roundNumber: newMatch.round_number,
    mapName: newMatch.map_name,
    isCompleted: newMatch.is_completed,
    isActive: newMatch.is_active,
    isWarmup: newMatch.is_warmup,
    parentMatchId: newMatch.parent_match_id,
  })

  revalidatePath(`/t/[slug]`, 'page')
  revalidatePath(`/tournaments/${tournamentId}/matches`)
  
  return { data: mapped }
}

export async function notifyEvidenceWindowAction(
  tournamentId: string,
  matchId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership or admin
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('name, creator_id, collaborator_id, discord_announcement_channel_id')
    .eq('id', tournamentId)
    .single()

  if (!tournament) return { error: 'Torneo no encontrado' }

  const { checkTournamentAccess } = await import('./tournaments')
  const hasAccess = await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id)
  if (!hasAccess) return { error: 'Sin permisos' }

  const { data: match } = await supabase
    .from('matches')
    .select('name')
    .eq('id', matchId)
    .single()

  const matchName = match?.name || 'Partida'

  // 1. Send in-app notifications to all players
  try {
    const { data: players } = await supabase
      .from('participants')
      .select('user_id')
      .eq('tournament_id', tournamentId)
      .not('user_id', 'is', null)

    if (players && players.length > 0) {
      const uniqueUserIds = Array.from(new Set(players.map((p: any) => p.user_id)))
      const notificationsToInsert = uniqueUserIds.map((uId) => ({
        user_id: uId,
        title: '📸 ¡Sube tus Evidencias! 🏆',
        message: `La ${matchName} del torneo "${tournament.name}" ha concluido. Sube tu captura de pantalla en el Portal de Equipo.`
      }))
      await supabase.from('notifications').insert(notificationsToInsert)
    }
  } catch (err) {
    console.error('Error sending evidence in-app notifications:', err)
  }

  // 2. Send Discord announcements to announcement channel and all team private channels with per-team submission intelligence
  try {
    await broadcastMatchTeamNotifications(supabase, tournamentId, matchId, matchName, 'evidence_open')
  } catch (discordErr) {
    console.error('Error sending Discord Evidence Window announcement:', discordErr)
  }

  revalidatePath(`/tournaments/${tournamentId}/matches`)
  revalidatePath(`/t/[slug]`, 'page')
  return { success: true }
}
