'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendDiscordEmbed } from '@/lib/services/discord'

export async function notifySubmissionToDiscord(submissionId: string) {
  const supabase = await createClient()

  try {
    // 1. Get submission, team name, and match details
    const { data: sub } = await supabase
      .from('submissions')
      .select('id, match_id, tournament_id, kill_count, rank, team_id, teams(name)')
      .eq('id', submissionId)
      .single()

    if (!sub) return

    const teamName = (sub.teams as any)?.name || 'Equipo Desconocido'

    // 2. Get tournament details
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('name, discord_integration_enabled, discord_announcement_channel_id, total_matches')
      .eq('id', sub.tournament_id)
      .single()

    if (!tournament || !tournament.discord_integration_enabled || !tournament.discord_announcement_channel_id) {
      return
    }

    // 3. Get match sequence number
    const { data: allMatches } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', sub.tournament_id)
      .order('created_at', { ascending: true })

    const matchIndex = (allMatches || []).findIndex((m: any) => m.id === sub.match_id)
    const matchNumber = matchIndex !== -1 ? matchIndex + 1 : 'Desconocida'

    // 4. Get all teams in tournament
    const { data: allTeams } = await supabase
      .from('teams')
      .select('id, name')
      .eq('tournament_id', sub.tournament_id)

    const totalTeamsCount = allTeams?.length || 0

    // 5. Get submissions for this match
    const { data: matchSubs } = await supabase
      .from('submissions')
      .select('team_id')
      .eq('match_id', sub.match_id)

    const submittedTeamIds = new Set((matchSubs || []).map((s: any) => s.team_id))
    const submittedCount = submittedTeamIds.size

    // Determine pending teams
    const pendingTeams = (allTeams || []).filter((t: any) => !submittedTeamIds.has(t.id))
    const pendingNames = pendingTeams.map((t: any) => t.name)

    // 6. Build the Discord Embed message
    const embed: any = {
      title: `📸 Evidencia Recibida - ${teamName}`,
      description: `El equipo **${teamName}** ha enviado sus reportes para la **Partida ${matchNumber}** del torneo **${tournament.name}**.`,
      color: 5814783, // Purple color
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
          name: 'Avance de Reportes de la Sala',
          value: `${submittedCount} / ${totalTeamsCount} Equipos`,
          inline: false
        }
      ],
      timestamp: new Date().toISOString()
    }

    if (pendingNames.length > 0) {
      embed.fields.push({
        name: `Equipos Pendientes (${pendingNames.length})`,
        value: pendingNames.join(', '),
        inline: false
      })
    } else {
      embed.fields.push({
        name: 'Estado de la Partida',
        value: `✅ **¡Todos los equipos han enviado sus evidencias!**\nLos administradores ya pueden iniciar la siguiente partida.`,
        inline: false
      })
      embed.color = 3066993 // Green color
    }

    await sendDiscordEmbed(tournament.discord_announcement_channel_id, embed)
  } catch (error) {
    console.error('[Discord Notification] Error sending submission notice:', error)
  }
}
