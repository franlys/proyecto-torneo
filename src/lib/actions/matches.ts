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

async function broadcastTournamentDiscordAlert(
  supabase: any,
  tournamentId: string,
  embed: any
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

    const channelIdsToSend = new Set<string>()

    // 1. Canal de anuncios público
    if (tourney.discord_announcement_channel_id) {
      channelIdsToSend.add(tourney.discord_announcement_channel_id)
    }

    // 2. Canales de texto bajo la categoría del torneo en Discord
    if (guildId && tourney.discord_voice_category_id) {
      const channelsRes = await getGuildChannels(guildId)
      if (channelsRes.success && Array.isArray(channelsRes.data)) {
        channelsRes.data
          .filter((c: any) => c.type === 0 && c.parent_id === tourney.discord_voice_category_id)
          .forEach((c: any) => channelIdsToSend.add(c.id))
      }
    }

    // 3. Enviar a todos los canales detectados
    for (const chId of Array.from(channelIdsToSend)) {
      await sendDiscordEmbed(chId, embed)
    }
  } catch (err) {
    console.error('[broadcastTournamentDiscordAlert] Error enviando alerta a Discord:', err)
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

  // Send Discord Announcements for Match Start or Match Completed
  try {
    const matchName = data.name || updatedMatch?.name || 'Partida'

    if (data.isActive === true) {
      await broadcastTournamentDiscordAlert(supabase, tournamentId, {
        title: `🏁 ¡${matchName} EN CURSO! ⚔️`,
        description: `La partida ha comenzado oficialmente.\n\n🎮 **Equipos:** Conéctense a sus salas de voz y prepárense para el combate. ¡Mucho éxito!`,
        color: 65280, // Green
        timestamp: new Date().toISOString(),
      })
    } else if (data.isCompleted === true) {
      await broadcastTournamentDiscordAlert(supabase, tournamentId, {
        title: `🏁 ¡${matchName} FINALIZADA! 🏆`,
        description: `La partida **${matchName}** ha finalizado.\n\n📸 Los capitanes ya pueden subir sus evidencias en el Portal de Equipo para el conteo de puntos.`,
        color: 16766720, // Gold
        timestamp: new Date().toISOString(),
      })
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

  // 2. Send Discord announcements to announcement channel and all team private channels
  try {
    await broadcastTournamentDiscordAlert(supabase, tournamentId, {
      title: `📸 ¡RECEPCIÓN DE EVIDENCIAS ABIERTA - ${matchName}! 🚨`,
      description: `¡Atención equipos!\n\nLa partida **${matchName}** ha concluido.\n\n👉 **Acción Requerida:** Entren a su **Portal de Equipo** y suban la captura de pantalla clara de su partida (tabla de puntuación y bajas).\n\n⚠️ *Eviten sanciones enviando su evidencia a tiempo.*`,
      color: 16753920, // Orange/Gold
      timestamp: new Date().toISOString(),
    })
  } catch (discordErr) {
    console.error('Error sending Discord Evidence Window announcement:', discordErr)
  }

  revalidatePath(`/tournaments/${tournamentId}/matches`)
  revalidatePath(`/t/[slug]`, 'page')
  return { success: true }
}
