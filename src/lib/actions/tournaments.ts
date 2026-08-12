'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createTournamentSchema, updateTournamentSchema } from '@/lib/validations/schemas'
import type { Tournament, ScoringRule } from '@/types'
import type { CreateTournamentInput, UpdateTournamentInput } from '@/lib/validations/schemas'
import { isActiveStreamer, isAdmin, getProfile } from './auth-helpers'
import { pushToAC } from './ac-push'
import { mapTournamentRow } from '@/lib/utils'
import { getUsdToDopRate } from '@/lib/services/exchange-rate'

// ─── helpers ────────────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)

  const shortId = Math.random().toString(36).slice(2, 8)
  return `${base}-${shortId}`
}

export async function checkTournamentAccess(creatorId: string, userId: string, collaboratorId?: string | null): Promise<boolean> {
  if (creatorId === userId || (collaboratorId && collaboratorId === userId)) return true
  
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
    
  if (
    profile?.role === 'SUPER_ADMIN' ||
    profile?.role === 'ADMIN' ||
    profile?.role === 'KRONIX_STAFF' ||
    profile?.role === 'FEDERATION'
  ) {
    // Si es admin del sistema, permitimos acceso total solo si el torneo es oficial de Kronix
    // (el creador tiene un rol de staff/admin) o es una colaboración (el colaborador tiene rol de staff/admin).
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', creatorId)
      .single()

    if (
      creatorProfile?.role === 'SUPER_ADMIN' ||
      creatorProfile?.role === 'ADMIN' ||
      creatorProfile?.role === 'KRONIX_STAFF'
    ) {
      return true
    }

    if (collaboratorId) {
      const { data: collabProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', collaboratorId)
        .single()

      if (
        collabProfile?.role === 'SUPER_ADMIN' ||
        collabProfile?.role === 'ADMIN' ||
        collabProfile?.role === 'KRONIX_STAFF'
      ) {
        return true
      }
    }

    return false
  }

  const { data: staff } = await supabase
    .from('streamer_staff')
    .select('id')
    .eq('streamer_id', creatorId)
    .eq('staff_id', userId)
    .maybeSingle()

  if (staff) return true

  if (collaboratorId) {
    const { data: staffColab } = await supabase
      .from('streamer_staff')
      .select('id')
      .eq('streamer_id', collaboratorId)
      .eq('staff_id', userId)
      .maybeSingle()
    if (staffColab) return true
  }

  return false
}

function mapScoringRuleRow(row: Record<string, unknown>): ScoringRule {
  return {
    id: row.id as string,
    tournamentId: row.tournament_id as string,
    killPoints: Number(row.kill_points),
    placementPoints: row.placement_points as Record<string, number>,
    useMultiplier: !!row.use_multiplier,
  }
}

// ─── actions ────────────────────────────────────────────────────────────────

export async function createTournament(
  data: CreateTournamentInput
): Promise<{ data: Tournament } | { error: string }> {
  // 1. Authorization check
  const isAllowed = await isActiveStreamer()
  if (!isAllowed) {
    return { error: 'Requerido: Suscripción Streamer Pro activa ($15/mes) para crear torneos.' }
  }

  const parsed = createTournamentSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    return { error: first?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const profile = await getProfile()
  if (!profile) return { error: 'No autenticado' }

  const isSuperAdminOrAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(profile.role)

  const input = parsed.data
  const slug = generateSlug(input.name)

  // Splits & Collaborator logic based on roles
  let arenaBettingEnabled = input.arenaBettingEnabled || false
  let collaboratorId = input.collaboratorId || null
  let organizerSplit = input.organizerSplit ?? 50
  let streamerSplit = input.streamerSplit ?? 50

  if (!isSuperAdminOrAdmin) {
    if (arenaBettingEnabled) {
      return { error: 'La integración de apuestas requiere el add-on Apuestas Kronix. Por favor, actualiza tu plan o contacta a Kronix.' }
    }
    collaboratorId = null
    organizerSplit = 0
    streamerSplit = 100
  } else {
    if (!collaboratorId) {
      organizerSplit = 100
      streamerSplit = 0
    }
  }

  // Insert tournament
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .insert({
      creator_id: user.id,
      name: input.name,
      description: input.description ?? null,
      rules_text: input.rulesText ?? null,
      slug,
      mode: input.mode,
      format: input.format,
      level: input.level,
      status: 'draft',
      total_matches: input.totalMatches,
      kill_rate_enabled: input.killRateEnabled,
      pot_top_enabled: input.potTopEnabled,
      vip_enabled: input.vipEnabled,
      tiebreaker_match_enabled: input.tiebreakerMatchEnabled,
      kill_race_time_limit_minutes: input.killRaceTimeLimitMinutes ?? null,
      default_rounds_per_match: input.defaultRoundsPerMatch,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      is_private: input.isPrivate || false,
      registration_password: input.registrationPassword || null,
      max_teams: input.maxTeams || null,
      registration_start_date: input.registrationStartDate || new Date().toISOString(),
      registration_end_date: input.registrationEndDate || null,
      hide_logo_in_leaderboard: input.hideLogoInLeaderboard || false,
      clash_royale_tag: input.clashRoyaleTag || null,
      discipline: input.discipline || 'warzone',
      badge_url: input.badgeUrl || null,
      stream_url: input.streamUrl || null,
      max_points_limit: input.maxPointsLimit || null,
      collaborator_id: collaboratorId,
      discord_url: input.discordUrl || null,
      // Finance Model
      entry_fee: input.entryFee || 0,
      prize_1st: input.prize1st || 0,
      prize_2nd: input.prize2nd || 0,
      prize_3rd: input.prize3rd || 0,
      prize_mvp: input.prizeMvp || 0,
      organizer_split: organizerSplit,
      streamer_split: streamerSplit,
      // Arena Betting
      arena_betting_enabled: arenaBettingEnabled,
      arena_betting_status: 'closed',
    })
    .select()
    .single()

  if (tErr || !tournament) {
    return { error: tErr?.message ?? 'Error al crear el torneo' }
  }

  // Insert scoring rule
  const { error: srErr } = await supabase.from('scoring_rules').insert({
    tournament_id: tournament.id,
    kill_points: input.scoringRule.killPoints,
    placement_points: input.scoringRule.placementPoints,
    use_multiplier: input.scoringRule.useMultiplier || false,
  })

  if (srErr) {
    // Rollback tournament
    await supabase.from('tournaments').delete().eq('id', tournament.id)
    return { error: srErr.message }
  }

  // Create matches and rounds automatically
  for (let i = 0; i < input.totalMatches; i++) {
    const matchNumber = i + 1;
    // 1. Create Parent Match (Encounter)
    const { data: parentMatch, error: pmErr } = await supabase
      .from('matches')
      .insert({
        tournament_id: tournament.id,
        match_number: matchNumber,
        name: `Encuentro ${matchNumber}`,
      })
      .select()
      .single();

    if (pmErr) {
      await supabase.from('tournaments').delete().eq('id', tournament.id);
      return { error: pmErr.message };
    }

    // 2. Create Rounds (Child Matches) if more than 1 round is configured
    if (input.defaultRoundsPerMatch > 1) {
      const rounds = Array.from({ length: input.defaultRoundsPerMatch }, (_, rIdx) => ({
        tournament_id: tournament.id,
        parent_match_id: parentMatch.id,
        match_number: matchNumber,
        round_number: rIdx + 1,
        name: `Ronda ${rIdx + 1}`,
      }));

      const { error: rErr } = await supabase.from('matches').insert(rounds);
      if (rErr) {
        await supabase.from('tournaments').delete().eq('id', tournament.id);
        return { error: rErr.message };
      }
    }
  }

  const mapped = mapTournamentRow(tournament as Record<string, unknown>)

  // Push tournament + all matches to AC mirror (fire-and-forget)
  pushToAC('tournaments', 'upsert', mapped as unknown as Record<string, unknown>)
  const { data: createdMatches } = await supabase
    .from('matches').select('*').eq('tournament_id', tournament.id)
  for (const m of createdMatches ?? []) {
    pushToAC('matches', 'upsert', m)
  }

  return { data: mapped }
}

export async function updateTournament(
  id: string,
  data: UpdateTournamentInput
): Promise<{ data: Tournament } | { error: string }> {
  const parsed = updateTournamentSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.errors[0]
    return { error: first?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const profile = await getProfile()
  if (!profile) return { error: 'No autenticado' }

  const isSuperAdminOrAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(profile.role)

  // Verify ownership and draft status
  const { data: existing, error: fetchErr } = await supabase
    .from('tournaments')
    .select('status, creator_id, collaborator_id')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) return { error: 'Torneo no encontrado' }
  if (!(await checkTournamentAccess(existing.creator_id, user.id, existing.collaborator_id))) return { error: 'Sin permisos' }
  if (existing.status !== 'draft' && existing.status !== 'pending') {
    return { error: 'No se puede modificar un torneo activo o finalizado' }
  }

  const input = parsed.data
  const updatePayload: Record<string, unknown> = {}

  if (input.name !== undefined) updatePayload.name = input.name
  if (input.description !== undefined) updatePayload.description = input.description
  if (input.rulesText !== undefined) updatePayload.rules_text = input.rulesText
  if (input.mode !== undefined) updatePayload.mode = input.mode
  if (input.format !== undefined) updatePayload.format = input.format
  if (input.level !== undefined) updatePayload.level = input.level
  if (input.totalMatches !== undefined) updatePayload.total_matches = input.totalMatches
  if (input.killRateEnabled !== undefined) updatePayload.kill_rate_enabled = input.killRateEnabled
  if (input.potTopEnabled !== undefined) updatePayload.pot_top_enabled = input.potTopEnabled
  if (input.vipEnabled !== undefined) updatePayload.vip_enabled = input.vipEnabled
  if (input.tiebreakerMatchEnabled !== undefined)
    updatePayload.tiebreaker_match_enabled = input.tiebreakerMatchEnabled
  if (input.killRaceTimeLimitMinutes !== undefined)
    updatePayload.kill_race_time_limit_minutes = input.killRaceTimeLimitMinutes
  if (input.defaultRoundsPerMatch !== undefined)
    updatePayload.default_rounds_per_match = input.defaultRoundsPerMatch
  if (input.startDate !== undefined) updatePayload.start_date = input.startDate || null
  if (input.endDate !== undefined) updatePayload.end_date = input.endDate || null
  if (input.logoUrl !== undefined) updatePayload.logo_url = input.logoUrl || null
  if (input.hideLogoInLeaderboard !== undefined)
    updatePayload.hide_logo_in_leaderboard = input.hideLogoInLeaderboard
  if (input.clashRoyaleTag !== undefined)
    updatePayload.clash_royale_tag = input.clashRoyaleTag
  if (input.discipline !== undefined)
    updatePayload.discipline = input.discipline
  if (input.badgeUrl !== undefined)
    updatePayload.badge_url = input.badgeUrl
  if (input.streamUrl !== undefined)
    updatePayload.stream_url = input.streamUrl || null
  if (input.maxTeams !== undefined)
    updatePayload.max_teams = input.maxTeams
  if (input.isPrivate !== undefined)
    updatePayload.is_private = input.isPrivate
  if (input.registrationPassword !== undefined)
    updatePayload.registration_password = input.registrationPassword
  if (input.registrationStartDate !== undefined)
    updatePayload.registration_start_date = input.registrationStartDate || null
  if (input.registrationEndDate !== undefined)
    updatePayload.registration_end_date = input.registrationEndDate || null
  if (input.maxPointsLimit !== undefined)
    updatePayload.max_points_limit = input.maxPointsLimit || null
  if (input.collaboratorId !== undefined) {
    updatePayload.collaborator_id = isSuperAdminOrAdmin ? (input.collaboratorId || null) : null
  }
  if (input.discordUrl !== undefined) {
    updatePayload.discord_url = input.discordUrl || null
  }

  // Finance Model
  if (input.entryFee !== undefined) updatePayload.entry_fee = input.entryFee
  if (input.prize1st !== undefined) updatePayload.prize_1st = input.prize1st
  if (input.prize2nd !== undefined) updatePayload.prize_2nd = input.prize2nd
  if (input.prize3rd !== undefined) updatePayload.prize_3rd = input.prize3rd
  if (input.prizeMvp !== undefined) updatePayload.prize_mvp = input.prizeMvp

  // Splits business rules
  if (!isSuperAdminOrAdmin) {
    updatePayload.organizer_split = 0
    updatePayload.streamer_split = 100
  } else {
    const finalCollaboratorId = input.collaboratorId !== undefined ? input.collaboratorId : existing.collaborator_id
    if (!finalCollaboratorId) {
      updatePayload.organizer_split = 100
      updatePayload.streamer_split = 0
    } else {
      if (input.organizerSplit !== undefined) updatePayload.organizer_split = input.organizerSplit
      if (input.streamerSplit !== undefined) updatePayload.streamer_split = input.streamerSplit
    }
  }

  // Arena Betting
  if (input.arenaBettingEnabled !== undefined) {
    if (input.arenaBettingEnabled && !isSuperAdminOrAdmin) {
      return { error: 'La integración de apuestas requiere el add-on Apuestas Kronix. Por favor, actualiza tu plan o contacta a Kronix.' }
    }
    updatePayload.arena_betting_enabled = input.arenaBettingEnabled
  }

  const { data: updated, error: updateErr } = await supabase
    .from('tournaments')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (updateErr || !updated) {
    return { error: updateErr?.message ?? 'Error al actualizar' }
  }

  // Update scoring rule if provided
  if (input.scoringRule) {
    await supabase
      .from('scoring_rules')
      .update({
        kill_points: input.scoringRule.killPoints,
        placement_points: input.scoringRule.placementPoints,
        use_multiplier: input.scoringRule.useMultiplier || false,
      })
      .eq('tournament_id', id)
  }

  const mappedUpdated = mapTournamentRow(updated as Record<string, unknown>)
  pushToAC('tournaments', 'upsert', mappedUpdated as unknown as Record<string, unknown>)

  // Invalidate all relevant caches so the frontend reflects changes immediately
  revalidatePath(`/tournaments/${id}`)
  revalidatePath(`/tournaments/${id}/edit`)
  revalidatePath('/tournaments')
  revalidatePath('/torneos')
  revalidatePath(`/t/${(updated as any).slug}`)
  revalidatePath('/')

  return { data: mappedUpdated }
}

export async function publishTournament(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('status, creator_id, collaborator_id, arena_betting_enabled')
    .eq('id', id)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }

  if (!(await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id))) return { error: 'Sin permisos' }

  if (tournament.status !== 'draft') {
    return { error: 'Solo se puede publicar un torneo en estado Borrador' }
  }

  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'pending' })
    .eq('id', id)

  if (error) return { error: error.message }

  // Push updated status to AC mirror
  const { data: updated } = await supabase.from('tournaments').select('*').eq('id', id).single()
  if (updated) pushToAC('tournaments', 'upsert', mapTournamentRow(updated as Record<string, unknown>) as unknown as Record<string, unknown>)

  revalidatePath(`/tournaments/${id}`)
  revalidatePath('/tournaments')
  revalidatePath('/torneos')
  return { success: true }
}

export async function activateTournament(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('status, creator_id, collaborator_id, format, mode, kill_race_time_limit_minutes, name, slug, discord_integration_enabled, discord_announcement_channel_id, discord_url')
    .eq('id', id)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }
  if (!(await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id))) return { error: 'Sin permisos' }
  if (tournament.status !== 'draft' && tournament.status !== 'pending') {
    return { error: 'El torneo ya está activo o finalizado' }
  }

  // Verify scoring rule exists
  const { data: rule, error: ruleErr } = await supabase
    .from('scoring_rules')
    .select('id')
    .eq('tournament_id', id)
    .single()

  if (ruleErr || !rule) {
    return { error: 'El torneo debe tener una regla de puntuación antes de activarse' }
  }

  // Kill Race requires time limit
  if (tournament.format === 'kill_race' && !tournament.kill_race_time_limit_minutes) {
    return { error: 'Kill Race requiere un límite de tiempo configurado' }
  }

  const { error: activateErr } = await supabase
    .from('tournaments')
    .update({ status: 'active' })
    .eq('id', id)

  if (activateErr) return { error: activateErr.message }

  // Configuración de Canales de Discord si está habilitado o tiene enlace
  if (tournament.discord_integration_enabled || tournament.discord_url) {
    try {
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('discord_guild_id')
        .eq('id', tournament.creator_id)
        .single()

      const { resolveDiscordGuildId, createDiscordCategory, createPrivateVoiceChannel, sendDiscordEmbed } = await import('@/lib/services/discord')

      let guildId = await resolveDiscordGuildId(creatorProfile?.discord_guild_id)
      if (!guildId && tournament.discord_url) {
        guildId = await resolveDiscordGuildId(tournament.discord_url)
        if (guildId && tournament.creator_id) {
          await supabase.from('profiles').update({ discord_guild_id: guildId, discord_connected: true }).eq('id', tournament.creator_id)
        }
      }

      if (guildId) {
        const adminSupabase = await createAdminClient()

        console.log(`[Discord Setup] Creando categoría para el torneo: ${tournament.name}`)
        const categoryRes = await createDiscordCategory(guildId, `🏆 Torneo: ${tournament.name}`)

        if (categoryRes.success && categoryRes.id) {
          const categoryId = categoryRes.id

          // Guardar el id de la categoría en el torneo
          await supabase
            .from('tournaments')
            .update({ discord_voice_category_id: categoryId })
            .eq('id', id)

          // Obtener los equipos registrados en el torneo
          const { data: teams } = await supabase
            .from('teams')
            .select('id, name')
            .eq('tournament_id', id)

          if (teams && teams.length > 0) {
            const { getGuildChannels, createPrivateTextChannel } = await import('@/lib/services/discord')
            const existingChannelsRes = await getGuildChannels(guildId)
            const existingInCategory = (existingChannelsRes.data || []).filter((c: any) => c.parent_id === categoryId)

            for (const team of teams as any[]) {
              // Consultar los participantes del equipo
              const { data: participants } = await supabase
                .from('participants')
                .select('user_id')
                .eq('team_id', team.id)
                .not('user_id', 'is', null)

              const teamUserIds = (participants || []).map((p) => p.user_id).filter(Boolean) as string[]

              let teamDiscordIds: string[] = []
              if (teamUserIds.length > 0) {
                const { data: identities } = await adminSupabase
                  .schema('auth')
                  .from('identities')
                  .select('user_id, provider_id')
                  .eq('provider', 'discord')
                  .in('user_id', teamUserIds)

                if (identities) {
                  teamDiscordIds = identities.map((i) => i.provider_id).filter(Boolean)
                }
              }

              const voiceChannelName = `🔊 ${team.name}`
              const textChannelName = `chat-${team.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'equipo'}`

              const modeLimits: Record<string, number> = { solo: 1, duo: 2, trio: 3, squad: 4, solos: 1, duos: 2, trios: 3, squads: 4 }
              const userLimit = modeLimits[tournament.mode?.toLowerCase()] || 0

              let voiceId = team.discord_voice_channel_id
              const existingVoice = existingInCategory.find((c: any) => c.type === 2 && (c.id === voiceId || c.name === voiceChannelName))
              if (existingVoice) {
                voiceId = existingVoice.id
              } else {
                const voiceRes = await createPrivateVoiceChannel(guildId, voiceChannelName, categoryId, teamDiscordIds, userLimit)
                if (voiceRes.success && voiceRes.id) voiceId = voiceRes.id
              }

              let textId = team.discord_text_channel_id
              const existingText = existingInCategory.find((c: any) => c.type === 0 && (c.id === textId || c.name === textChannelName))
              if (existingText) {
                textId = existingText.id
              } else {
                const textRes = await createPrivateTextChannel(guildId, team.name, categoryId, teamDiscordIds)
                if (textRes.success && textRes.id) {
                  textId = textRes.id
                  await sendDiscordEmbed(textRes.id, {
                    title: `🎮 Sala Oficial: ${team.name}`,
                    description: `¡Hola equipo **${team.name}**!\n\nEste es su canal de comunicaciones privado para el torneo.\n\n📌 **Aquí recibirán:**\n• 🏁 Avisos de inicio y fin de cada ronda.\n• 📸 Recordatorios de carga de evidencia.\n• ⚠️ Notificaciones de Match Point o sanciones.\n\n🔊 **Voz:** Únanse al canal de voz de su equipo para coordinar durante la partida.`,
                    color: 5793266,
                    timestamp: new Date().toISOString(),
                  })
                }
              }

              const updatePayload: any = {}
              if (voiceId) updatePayload.discord_voice_channel_id = voiceId
              if (textId) updatePayload.discord_text_channel_id = textId

              if (Object.keys(updatePayload).length > 0) {
                await supabase
                  .from('teams')
                  .update(updatePayload)
                  .eq('id', team.id)
              }
            }
          }
        }

        // Anunciar inicio en el canal de texto configurado
        if (tournament.discord_announcement_channel_id) {
          await sendDiscordEmbed(tournament.discord_announcement_channel_id, {
            title: `🏆 ¡El torneo ${tournament.name} ha comenzado!`,
            description: `El torneo ha iniciado oficialmente. Las salas de voz de los equipos han sido creadas. ¡Buena suerte a todos los competidores!`,
            color: 62909, // Neon cyan color equivalent #00F5FF in dec
            timestamp: new Date().toISOString(),
          })
        }
      }
    } catch (discordErr: any) {
      console.error('[Discord Setup] Error al configurar canales de Discord:', discordErr.message || discordErr)
    }
  }

  // Enviar notificaciones in-app y correos electrónicos reales a todos los competidores
  try {
    const adminSupabase = await createAdminClient()
    const { data: participants } = await adminSupabase
      .from('participants')
      .select('id, display_name, user_id, team_id, teams:team_id(id, name)')
      .eq('tournament_id', id)
      .not('user_id', 'is', null)

    if (participants && participants.length > 0) {
      const userIds = Array.from(new Set(participants.map(p => p.user_id).filter(Boolean)))

      if (userIds.length > 0) {
        // 1. Insertar notificaciones in-app
        const notificationsToInsert = userIds.map(uId => ({
          user_id: uId,
          title: `¡El torneo ${tournament.name} ha comenzado! 🏁`,
          message: `El torneo '${tournament.name}' al que te inscribiste ha iniciado oficialmente. Las salas de juego y subida de evidencias están habilitadas.`,
          is_read: false
        }))

        await adminSupabase.from('notifications').insert(notificationsToInsert)

        // 2. Consultar emails de los usuarios
        const { data: profiles } = await adminSupabase
          .from('profiles')
          .select('id, email, username')
          .in('id', userIds)

        const profileMap = new Map((profiles || []).map(pr => [pr.id, pr]))
        const { sendTournamentStartedEmail } = await import('@/lib/services/email')

        // 3. Enviar correo oficial a cada participante registrado
        for (const p of participants as any[]) {
          const userProf = p.user_id ? profileMap.get(p.user_id) : null
          const email = userProf?.email
          if (email) {
            const teamName = p.teams?.name || 'Tu Equipo'
            const teamId = p.team_id || p.teams?.id
            const portalUrl = tournament.slug && teamId 
              ? `https://www.kronix.do/t/${tournament.slug}/team/${teamId}`
              : `https://www.kronix.do/t/${tournament.slug || id}`

            sendTournamentStartedEmail({
              email,
              username: userProf?.username || p.display_name || 'Competidor',
              tournamentName: tournament.name,
              teamName,
              portalUrl,
              tournamentSlug: tournament.slug,
            }).catch(err => console.error('[Tournament Activation] Error sending tournament start email:', err))
          }
        }
      }
    }
  } catch (notifyErr: any) {
    console.error('Error al enviar alertas del torneo:', notifyErr.message || notifyErr)
  }

  // Push updated status to AC mirror
  const { data: activated } = await supabase.from('tournaments').select('*').eq('id', id).single()
  if (activated) pushToAC('tournaments', 'upsert', mapTournamentRow(activated as Record<string, unknown>) as unknown as Record<string, unknown>)

  revalidatePath(`/tournaments/${id}`)
  revalidatePath('/tournaments')
  revalidatePath('/torneos')

  return { success: true }
}

async function broadcastTournamentFinishDiscord(supabase: any, tournamentId: string) {
  try {
    const { data: tourney } = await supabase
      .from('tournaments')
      .select('id, name, slug, creator_id, discord_url, discord_voice_category_id, discord_announcement_channel_id, prize_1st, prize_2nd, prize_3rd, prize_mvp')
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

    if (!guildId) return

    // 1. Fetch Standings (podium)
    const { data: standings } = await supabase
      .from('team_standings')
      .select('*, teams(id, name, avatar_url)')
      .eq('tournament_id', tournamentId)
      .order('total_points', { ascending: false })
      .order('total_kills', { ascending: false })

    // 2. Fetch Top MVP Player
    const { data: participants } = await supabase
      .from('participants')
      .select('*, teams(name)')
      .eq('tournament_id', tournamentId)
      .order('total_kills', { ascending: false })

    const team1 = standings?.[0]
    const team2 = standings?.[1]
    const team3 = standings?.[2]
    const mvp = participants?.[0]

    const prize1 = tourney.prize_1st ? ` — 💵 Premio: $${tourney.prize_1st} USD` : ''
    const prize2 = tourney.prize_2nd ? ` — 💵 Premio: $${tourney.prize_2nd} USD` : ''
    const prize3 = tourney.prize_3rd ? ` — 💵 Premio: $${tourney.prize_3rd} USD` : ''
    const prizeMvp = tourney.prize_mvp ? ` — 💵 Premio: $${tourney.prize_mvp} USD` : ''

    let podiumText = ''
    if (team1) {
      podiumText += `🥇 **1ER LUGAR (CAMPEÓN):**\n👑 **${team1.teams?.name || 'Equipo 1'}** — **${team1.total_points} PTS** (${team1.total_kills} Kills)${prize1}\n\n`
    }
    if (team2) {
      podiumText += `🥈 **2DO LUGAR (SUBCAMPEÓN):**\n🥈 **${team2.teams?.name || 'Equipo 2'}** — **${team2.total_points} PTS** (${team2.total_kills} Kills)${prize2}\n\n`
    }
    if (team3) {
      podiumText += `🥉 **3ER LUGAR:**\n🥉 **${team3.teams?.name || 'Equipo 3'}** — **${team3.total_points} PTS** (${team3.total_kills} Kills)${prize3}\n\n`
    }

    let mvpText = ''
    if (mvp && (mvp.total_kills || 0) > 0) {
      mvpText = `🔥 **MVP DEL TORNEO (TOP FRAGGER):**\n👑 **${mvp.display_name}** (${mvp.teams?.name || 'Equipo'}) — **${mvp.total_kills} Kills**${prizeMvp}\n\n━━━━━━━━━━━━━━━━━━━━\n\n`
    }

    const embed = {
      title: `🏆 ¡TORNEO FINALIZADO — CUADRO DE HONOR Y GANADORES! 👑`,
      description: `El torneo **${tourney.name}** ha concluido oficialmente.\n¡Felicitaciones a todos los equipos y participantes por su gran desempeño!\n\n━━━━━━━━━━━━━━━━━━━━\n\n${podiumText}${mvpText}📊 **Leaderboard Completo y Estadísticas:**\nhttps://kronix.do/t/${tourney.slug}`,
      color: 16766720, // Gold #FFD700
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Kronix Esports • Podio y Resultados Oficiales'
      }
    }

    // 3. Find Discord Channels
    const channelsRes = await getGuildChannels(guildId)
    if (channelsRes.success && Array.isArray(channelsRes.data)) {
      const allChannels = channelsRes.data

      // Send to category team text channels
      const categoryTextChannels = allChannels.filter(
        (c: any) => c.type === 0 && c.parent_id === tourney.discord_voice_category_id
      )
      for (const ch of categoryTextChannels) {
        await sendDiscordEmbed(ch.id, embed)
      }

      // Send to announcement / general channel
      let annChannelId = tourney.discord_announcement_channel_id
      if (!annChannelId) {
        const generalCh = allChannels.find(
          (c: any) => c.type === 0 && (c.name === 'general' || c.name.includes('anuncio') || c.name === 'bienvenida')
        )
        if (generalCh) annChannelId = generalCh.id
      }
      if (annChannelId) {
        await sendDiscordEmbed(annChannelId, embed)
      }
    }
  } catch (err) {
    console.error('[broadcastTournamentFinishDiscord] Error:', err)
  }
}

export async function finishTournament(
  id: string,
  championImageUrl?: string,
  mvpParticipantId?: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('id, creator_id, collaborator_id, status, slug, is_sanctioned, mode, discipline, badge_url, name, discord_url, discord_integration_enabled, discord_voice_category_id, discord_announcement_channel_id, prize_1st, prize_2nd, prize_3rd, prize_mvp')
    .eq('id', id)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }
  if (!(await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id))) return { error: 'Sin permisos' }
  if (tournament.status !== 'active') {
    return { error: 'Solo se pueden finalizar torneos activos' }
  }

  const { error: finishErr } = await supabase
    .from('tournaments')
    .update({
      status: 'finished',
      arena_betting_status: 'closed',
      champion_image_url: championImageUrl || null,
      end_date: new Date().toISOString()
    })
    .eq('id', id)

  if (finishErr) return { error: finishErr.message }

  // Announce Tournament End, Winners & Podium in Discord
  try {
    await broadcastTournamentFinishDiscord(supabase, id)
  } catch (discErr) {
    console.error('[finishTournament] Error enviando anuncio de fin de torneo a Discord:', discErr)
  }

  // --- Close all matches and resolve/cancel their betting markets ---
  try {
    const adminSupabase = await createAdminClient()
    const { data: matches } = await adminSupabase
      .from('matches')
      .select('id, is_completed, name, match_number, round_number, map_name, parent_match_id, is_warmup')
      .eq('tournament_id', id)

    const { autoResolveMatchMarketsAction, cancelPredictionMarketInternal } = await import('./predictions')

    for (const match of (matches || [])) {
      // 1. Mark match as completed if not already completed
      if (!match.is_completed) {
        await adminSupabase
          .from('matches')
          .update({ is_completed: true, is_active: false })
          .eq('id', match.id)

        // Push to AC
        pushToAC('matches', 'upsert', {
          id: match.id,
          tournamentId: id,
          name: match.name,
          matchNumber: match.match_number,
          roundNumber: match.round_number,
          mapName: match.map_name,
          isCompleted: true,
          isActive: false,
          isWarmup: match.is_warmup,
          parentMatchId: match.parent_match_id,
        })
      }

      // 2. Fetch approved submissions count for this match
      const { count: approvedCount } = await adminSupabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', match.id)
        .eq('status', 'approved')

      if ((approvedCount || 0) > 0) {
        // Resolve match-specific betting markets
        await autoResolveMatchMarketsAction(match.id)
      } else {
        // Cancel and refund open prediction markets for this unplayed match
        const { data: matchMarkets } = await adminSupabase
          .from('bet_markets')
          .select('id')
          .eq('match_id', match.id)
          .eq('status', 'open')

        for (const market of (matchMarkets || [])) {
          await cancelPredictionMarketInternal(adminSupabase, market.id)
        }
      }
    }
  } catch (err) {
    console.error('[finishTournament] Error closing matches & resolving/refunding bets:', err)
  }

  // --- Financial Calculation ---
  const { count: teamsCount } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', id)

  const totalTeams = teamsCount || 0
  const tournamentDetails = await supabase
    .from('tournaments')
    .select('entry_fee, prize_1st, prize_2nd, prize_3rd, prize_mvp, organizer_split, streamer_split')
    .eq('id', id)
    .single()

  if (tournamentDetails.data) {
    const t = tournamentDetails.data
    const totalRevenue = totalTeams * Number(t.entry_fee)
    const totalPrizes = Number(t.prize_1st) + Number(t.prize_2nd) + Number(t.prize_3rd) + Number(t.prize_mvp)
    const remainder = totalRevenue - totalPrizes
    
    const organizerPayout = parseFloat((remainder * (Number(t.organizer_split) / 100)).toFixed(2))
    const streamerPayout = parseFloat((remainder * (Number(t.streamer_split) / 100)).toFixed(2))

    await supabase.from('tournament_financials').upsert(
      {
        tournament_id: id,
        total_revenue: totalRevenue,
        total_prizes: totalPrizes,
        remainder: remainder,
        organizer_payout: organizerPayout,
        streamer_payout: streamerPayout,
      },
      { onConflict: 'tournament_id' }
    )

    const adminSupabase = await createAdminClient()
    const rate = await getUsdToDopRate()

    const organizerPayoutInKCoins = parseFloat((organizerPayout * rate).toFixed(2))
    const streamerPayoutInKCoins = parseFloat((streamerPayout * rate).toFixed(2))

    // 1. Distribuir a Streamer / Organizador
    const organizerId = tournament.collaborator_id || tournament.creator_id
    if (organizerPayout > 0 && organizerId) {
      const { data: orgProfile } = await adminSupabase.from('profiles').select('balance').eq('id', organizerId).single()
      const newBal = parseFloat((Number(orgProfile?.balance || 0) + organizerPayoutInKCoins).toFixed(2))
      await adminSupabase.from('profiles').update({ balance: newBal }).eq('id', organizerId)
      await adminSupabase.from('coin_transactions').insert({
        user_id: organizerId,
        amount: organizerPayoutInKCoins,
        type: 'deposit',
        reference_id: id
      })
      await adminSupabase.from('notifications').insert({
        user_id: organizerId,
        title: 'Beneficios del Torneo 🪙',
        message: `Has recibido ${organizerPayoutInKCoins.toLocaleString('es-ES')} K-Coins (equivalente a $${organizerPayout.toFixed(2)} USD) en comisiones por la finalización del torneo "${tournament.name}".`
      })
    }

    if (streamerPayout > 0 && tournament.collaborator_id && tournament.creator_id) {
      const { data: strProfile } = await adminSupabase.from('profiles').select('balance').eq('id', tournament.creator_id).single()
      const newBal = parseFloat((Number(strProfile?.balance || 0) + streamerPayoutInKCoins).toFixed(2))
      await adminSupabase.from('profiles').update({ balance: newBal }).eq('id', tournament.creator_id)
      await adminSupabase.from('coin_transactions').insert({
        user_id: tournament.creator_id,
        amount: streamerPayoutInKCoins,
        type: 'deposit',
        reference_id: id
      })
      await adminSupabase.from('notifications').insert({
        user_id: tournament.creator_id,
        title: 'Beneficios del Torneo 🪙',
        message: `Has recibido ${streamerPayoutInKCoins.toLocaleString('es-ES')} K-Coins (equivalente a $${streamerPayout.toFixed(2)} USD) en comisiones por la finalización del torneo "${tournament.name}".`
      })
    }

    // 2. Distribuir a Ganadores (1st, 2nd, 3rd)
    const { data: teamStandings } = await adminSupabase
      .from('team_standings')
      .select('rank, team_id')
      .eq('tournament_id', id)
      .in('rank', [1, 2, 3])

    if (teamStandings && teamStandings.length > 0) {
      for (const standing of teamStandings) {
        const rank = standing.rank
        const prizePool = rank === 1 ? Number(t.prize_1st) : rank === 2 ? Number(t.prize_2nd) : Number(t.prize_3rd)
        
        if (prizePool > 0) {
          const prizePoolInKCoins = prizePool * rate
          // Obtener los participantes del equipo con cuenta de usuario
          const { data: participants } = await adminSupabase
            .from('participants')
            .select('user_id')
            .eq('team_id', standing.team_id)
            .not('user_id', 'is', null)

          if (participants && participants.length > 0) {
            const splitPrizeUsd = parseFloat((prizePool / participants.length).toFixed(2))
            const splitPrizeKCoins = parseFloat((prizePoolInKCoins / participants.length).toFixed(2))
            
            // Obtener el nombre del equipo para el mensaje
            const { data: teamInfo } = await adminSupabase.from('teams').select('name').eq('id', standing.team_id).single()
            const teamName = teamInfo?.name || 'tu equipo'

            for (const part of participants) {
              const userId = part.user_id
              if (userId) {
                const { data: pProfile } = await adminSupabase.from('profiles').select('balance, email, username').eq('id', userId).single()
                const newBal = parseFloat((Number(pProfile?.balance || 0) + splitPrizeKCoins).toFixed(2))
                await adminSupabase.from('profiles').update({ balance: newBal }).eq('id', userId)
                await adminSupabase.from('coin_transactions').insert({
                  user_id: userId,
                  amount: splitPrizeKCoins,
                  type: 'bet_won',
                  reference_id: id
                })
                await adminSupabase.from('notifications').insert({
                  user_id: userId,
                  title: '¡Premio de Podio! 🏆',
                  message: `¡Felicidades! Has ganado ${splitPrizeKCoins.toLocaleString('es-ES')} K-Coins (equivalente a $${splitPrizeUsd.toFixed(2)} USD) por obtener el lugar #${rank} con tu equipo "${teamName}" en el torneo "${tournament.name}".`
                })

                if (pProfile?.email) {
                  const { sendTournamentPrizeEmail } = await import('@/lib/services/email')
                  sendTournamentPrizeEmail({
                    email: pProfile.email,
                    username: pProfile.username || 'Competidor',
                    tournamentName: tournament.name,
                    prizeTitle: `Podio #${rank} Lugar 🏆 (${teamName})`,
                    amountCoins: splitPrizeKCoins,
                    amountUsd: splitPrizeUsd,
                  }).catch(e => console.error('Error sending podium prize email:', e))
                }
              }
            }
          }
        }
      }
    }

    // 3. Distribuir Premio MVP
    let finalMvpParticipantId = mvpParticipantId
    if (!finalMvpParticipantId && Number(t.prize_mvp) > 0) {
      const { data: subs } = await adminSupabase
        .from('submissions')
        .select('player_kills')
        .eq('tournament_id', id)
        .eq('status', 'approved')

      const killsMap: Record<string, number> = {}
      if (subs) {
        subs.forEach((s: any) => {
          if (s.player_kills && typeof s.player_kills === 'object') {
            Object.entries(s.player_kills).forEach(([pId, kills]) => {
              killsMap[pId] = (killsMap[pId] || 0) + (Number(kills) || 0)
            })
          }
        })
      }

      let maxKills = -1
      let bestParticipantId = null
      Object.entries(killsMap).forEach(([pId, kills]) => {
        if (kills > maxKills) {
          maxKills = kills
          bestParticipantId = pId
        }
      })

      if (bestParticipantId) {
        finalMvpParticipantId = bestParticipantId
      }
    }

    if (finalMvpParticipantId && Number(t.prize_mvp) > 0) {
      const { data: mvpPart } = await adminSupabase
        .from('participants')
        .select('user_id')
        .eq('id', finalMvpParticipantId)
        .single()

      const mvpUserId = mvpPart?.user_id
      if (mvpUserId) {
        const mvpPrizeUsd = Number(t.prize_mvp)
        const mvpPrizeKCoins = parseFloat((mvpPrizeUsd * rate).toFixed(2))
        const { data: mvpProfile } = await adminSupabase.from('profiles').select('balance, email, username').eq('id', mvpUserId).single()
        const newBal = parseFloat((Number(mvpProfile?.balance || 0) + mvpPrizeKCoins).toFixed(2))
        await adminSupabase.from('profiles').update({ balance: newBal }).eq('id', mvpUserId)
        await adminSupabase.from('coin_transactions').insert({
          user_id: mvpUserId,
          amount: mvpPrizeKCoins,
          type: 'bet_won',
          reference_id: id
        })
        await adminSupabase.from('notifications').insert({
          user_id: mvpUserId,
          title: '¡Elegido MVP! ⭐',
          message: `¡Felicidades! Has sido galardonado como el MVP del torneo "${tournament.name}" y recibiste ${mvpPrizeKCoins.toLocaleString('es-ES')} K-Coins (equivalente a $${mvpPrizeUsd.toFixed(2)} USD).`
        })

        if (mvpProfile?.email) {
          const { sendTournamentPrizeEmail } = await import('@/lib/services/email')
          sendTournamentPrizeEmail({
            email: mvpProfile.email,
            username: mvpProfile.username || 'Competidor',
            tournamentName: tournament.name,
            prizeTitle: `MVP del Torneo ⭐`,
            amountCoins: mvpPrizeKCoins,
            amountUsd: mvpPrizeUsd,
          }).catch(e => console.error('Error sending MVP prize email:', e))
        }
      }
    }

    // 4. Auto-resolve tournament-wide betting markets (both open and closed pre-tournament markets)
    try {
      const { data: tournamentMarkets } = await adminSupabase
        .from('bet_markets')
        .select('*')
        .eq('tournament_id', id)
        .is('match_id', null)
        .in('status', ['open', 'closed'])

      if (tournamentMarkets && tournamentMarkets.length > 0) {
        // Fetch the champion team
        const { data: championStanding } = await adminSupabase
          .from('team_standings')
          .select('team_id, teams(name)')
          .eq('tournament_id', id)
          .eq('rank', 1)
          .single()

        // Fetch Top 5 and Top 3 standings
        const { data: topStandings } = await adminSupabase
          .from('team_standings')
          .select('rank, team_id, teams(name)')
          .eq('tournament_id', id)
          .lte('rank', 5)
          .order('rank', { ascending: true })

        const top5TeamNames = (topStandings || []).map((s: any) => {
          const rawTeam = s.teams
          return (Array.isArray(rawTeam) ? rawTeam[0]?.name : rawTeam?.name)?.toLowerCase().trim()
        }).filter(Boolean)

        const top3TeamNames = (topStandings || []).filter((s: any) => s.rank <= 3).map((s: any) => {
          const rawTeam = s.teams
          return (Array.isArray(rawTeam) ? rawTeam[0]?.name : rawTeam?.name)?.toLowerCase().trim()
        }).filter(Boolean)

        // Fetch the team with the most kills
        const { data: killsSum } = await adminSupabase
          .from('submissions')
          .select('team_id, kill_count, teams(name)')
          .eq('tournament_id', id)
          .eq('status', 'approved')

        const teamKillsMap: Record<string, { name: string; kills: number }> = {}
        killsSum?.forEach(sub => {
          const rawTeam = sub.teams as any
          const tName = (Array.isArray(rawTeam) ? rawTeam[0]?.name : rawTeam?.name) || 'Unknown'
          if (!teamKillsMap[sub.team_id]) {
            teamKillsMap[sub.team_id] = { name: tName, kills: 0 }
          }
          teamKillsMap[sub.team_id].kills += Number(sub.kill_count) || 0
        })

        let maxKillsTeamName = ''
        let maxKillsVal = -1
        Object.values(teamKillsMap).forEach(t => {
          if (t.kills > maxKillsVal) {
            maxKillsVal = t.kills
            maxKillsTeamName = t.name
          }
        })

        for (const market of tournamentMarkets) {
          const opts = market.options as any[]
          const winningOptionIds: string[] = []

          if (market.market_type === 'winner' && championStanding?.teams) {
            const rawTeam = championStanding.teams as any
            const champName = (Array.isArray(rawTeam) ? rawTeam[0]?.name : rawTeam?.name) || ''
            const opt = opts.find(o => o.name.toLowerCase().trim() === champName.toLowerCase().trim())
            if (opt) winningOptionIds.push(opt.id)
          } else if (market.market_type === 'top_5') {
            const winningOpts = opts.filter(o => top5TeamNames.includes(o.name.toLowerCase().trim()))
            winningOptionIds.push(...winningOpts.map(o => o.id))
          } else if (market.market_type === 'top_3') {
            const winningOpts = opts.filter(o => top3TeamNames.includes(o.name.toLowerCase().trim()))
            winningOptionIds.push(...winningOpts.map(o => o.id))
          } else if (market.market_type === 'most_kills' && maxKillsTeamName) {
            const opt = opts.find(o => o.name.toLowerCase().trim() === maxKillsTeamName.toLowerCase().trim())
            if (opt) winningOptionIds.push(opt.id)
          }

          if (winningOptionIds.length > 0) {
            await adminSupabase
              .from('bet_markets')
              .update({
                status: 'resolved',
                winning_option_id: winningOptionIds[0]
              })
              .eq('id', market.id)

            const { data: bets } = await adminSupabase
              .from('user_bets')
              .select('*')
              .eq('market_id', market.id)
              .eq('status', 'pending')

            if (bets && bets.length > 0) {
              for (const bet of bets) {
                const pickedIds = (bet.selected_option_id || '').split(',').map((id: string) => id.trim()).filter(Boolean)
                const isWinner = pickedIds.length > 0 && pickedIds.every((id: string) => winningOptionIds.includes(id))
                const status = isWinner ? 'won' : 'lost'

                await adminSupabase
                  .from('user_bets')
                  .update({ status })
                  .eq('id', bet.id)

                if (isWinner) {
                  const winAmount = parseFloat(bet.potential_payout)
                  const { data: userProfile } = await adminSupabase
                    .from('profiles')
                    .select('balance, email, username')
                    .eq('id', bet.user_id)
                    .single()

                  const currentBal = Number(userProfile?.balance || 0)
                  const newBal = parseFloat((currentBal + winAmount).toFixed(2))
                  await adminSupabase
                    .from('profiles')
                    .update({ balance: newBal })
                    .eq('id', bet.user_id)

                  await adminSupabase.from('coin_transactions').insert({
                    user_id: bet.user_id,
                    amount: winAmount,
                    type: 'bet_won',
                    reference_id: bet.id
                  })

                  if (userProfile?.email) {
                    const { sendTransactionReceiptEmail } = await import('@/lib/services/email')
                    sendTransactionReceiptEmail({
                      email: userProfile.email,
                      username: userProfile.username || 'Competidor',
                      amount: winAmount,
                      type: 'deposit',
                      referenceId: bet.id,
                      balanceBefore: currentBal,
                      balanceAfter: newBal,
                      description: `Ganancia por predicción en torneo: "${market.question || market.title || 'Torneo General'}"`
                    }).catch(e => console.error('Error sending bet win email:', e))
                  }
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Error auto-resolving tournament markets:", err)
    }
  }

  // --- FEDERATION AUTO RANKING UPDATE ---
  if (tournament.is_sanctioned) {
    const adminSupabase = await createAdminClient()

    // 1. Get the discipline of the cup (if exists, or default to clash_royale)
    const { data: sanctionedCup } = await adminSupabase
      .from('sanctioned_cups')
      .select('discipline')
      .eq('tournament_id', id)
      .maybeSingle()

    const discipline = sanctionedCup?.discipline || 'clash_royale'

    // Update the corresponding sanctioned cup status to 'finished'
    await adminSupabase
      .from('sanctioned_cups')
      .update({ status: 'finished', end_date: new Date().toISOString() })
      .eq('tournament_id', id)

    // 2. Fetch all team standings with their participants
    const { data: standings } = await adminSupabase
      .from('team_standings')
      .select(`
        rank,
        total_points,
        total_kills,
        team_id,
        teams (
          name,
          participants (
            display_name
          )
        )
      `)
      .eq('tournament_id', id)

    if (standings && standings.length > 0) {
      const pointsScale: Record<number, number> = {
        1: 1000,
        2: 600,
        3: 400,
        4: 200,
        5: 100,
        6: 100,
        7: 100,
        8: 100,
      }

      for (const standing of standings) {
        const rank = standing.rank || 99
        const pointsToAward = pointsScale[rank] || 50
        const isPodium = rank <= 3 ? 1 : 0
        const isWinner = rank === 1 ? 100.00 : 0.00

        const team = standing.teams as any
        const participants = team?.participants || []

        for (const p of participants) {
          const displayName = p.display_name
          if (!displayName) continue

          // Fetch existing player stats
          const { data: existingPlayer } = await adminSupabase
            .from('player_national_stats')
            .select('*')
            .eq('display_name', displayName)
            .eq('discipline', discipline)
            .maybeSingle()

          if (existingPlayer) {
            const newTournamentsPlayed = existingPlayer.tournaments_played + 1
            const newWinRate = Number((((Number(existingPlayer.win_rate) * existingPlayer.tournaments_played) + isWinner) / newTournamentsPlayed).toFixed(2))

            await adminSupabase
              .from('player_national_stats')
              .update({
                points: existingPlayer.points + pointsToAward,
                tournaments_played: newTournamentsPlayed,
                podiums_count: existingPlayer.podiums_count + isPodium,
                win_rate: newWinRate,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingPlayer.id)
          } else {
            await adminSupabase
              .from('player_national_stats')
              .insert({
                display_name: displayName,
                discipline,
                points: pointsToAward,
                tournaments_played: 1,
                podiums_count: isPodium,
                win_rate: isWinner,
                updated_at: new Date().toISOString(),
              })
          }
        }
      }

      // Recalculate rank positions in player_national_stats for this discipline
      const { data: allPlayers } = await adminSupabase
        .from('player_national_stats')
        .select('id, points')
        .eq('discipline', discipline)
        .order('points', { ascending: false })

      if (allPlayers) {
        const rankUpdates = allPlayers.map((player: any, index: number) => ({
          id: player.id,
          rank_position: index + 1
        }))
        await adminSupabase.from('player_national_stats').upsert(rankUpdates)
      }
    }
  }

  // --- PLATFORM-WIDE PUBLIC USER RANKINGS AND BADGES UPDATE ---
  try {
    const adminSupabase = await createAdminClient()
    
    // Fetch standings again using admin client to get team participants
    const { data: standings } = await adminSupabase
      .from('team_standings')
      .select(`
        rank,
        team_id,
        teams (
          name,
          participants (
            user_id,
            display_name
          )
        )
      `)
      .eq('tournament_id', id)

    if (standings && standings.length > 0) {
      const getPlatformRankingPoints = (modeStr: string, r: number): number => {
        const m = (modeStr || 'individual').toLowerCase()
        if (r === 1) {
          if (m === 'individual') return 6.0
          if (m === 'duos') return 4.0
          if (m === 'trios') return 2.0
          return 1.0 // cuartetos / default
        }
        if (r === 2) {
          if (m === 'individual') return 4.0
          if (m === 'duos') return 3.0
          if (m === 'trios') return 1.5
          return 0.75
        }
        if (r === 3) {
          if (m === 'individual') return 3.0
          if (m === 'duos') return 2.0
          if (m === 'trios') return 1.0
          return 0.5
        }
        if (r === 4) {
          if (m === 'individual') return 2.0
          if (m === 'duos') return 1.0
          if (m === 'trios') return 0.5
          return 0.25
        }
        if (r === 5) {
          if (m === 'individual') return 1.0
          if (m === 'duos') return 0.5
          if (m === 'trios') return 0.25
          return 0.1
        }
        return 0
      }

      for (const standing of standings) {
        const rank = standing.rank || 99
        const pointsToAward = getPlatformRankingPoints(tournament.mode || 'individual', rank)
        
        const team = standing.teams as any
        const participants = team?.participants || []

        for (const p of participants) {
          if (!p.user_id) continue

          // A. Insert history record for time-series charts
          await adminSupabase.from('user_points_history').insert({
            user_id: p.user_id,
            tournament_id: id,
            discipline: tournament.discipline || 'warzone',
            points_awarded: pointsToAward,
            rank_achieved: rank
          })

          // B. Update/Upsert aggregate points
          const { data: existingRank } = await adminSupabase
            .from('user_discipline_rankings')
            .select('points')
            .eq('user_id', p.user_id)
            .eq('discipline', tournament.discipline || 'warzone')
            .maybeSingle()

          if (existingRank) {
            await adminSupabase
              .from('user_discipline_rankings')
              .update({
                points: Number(existingRank.points) + pointsToAward,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', p.user_id)
              .eq('discipline', tournament.discipline || 'warzone')
          } else {
            await adminSupabase
              .from('user_discipline_rankings')
              .insert({
                user_id: p.user_id,
                discipline: tournament.discipline || 'warzone',
                points: pointsToAward,
                updated_at: new Date().toISOString()
              })
          }

          // C. Award badge if tournament has a badge_url and user finished in top 3
          if (tournament.badge_url && rank <= 3) {
            await adminSupabase.from('user_badges').insert({
              user_id: p.user_id,
              tournament_id: id,
              badge_url: tournament.badge_url,
              name: `${tournament.name} - Top ${rank}`,
              rank_achieved: rank
            })
          }
        }
      }
    }
  } catch (rankingErr) {
    console.error('[RANKINGS] Error processing platform rankings update:', rankingErr)
  }

  // Push finished status to AC mirror
  const { data: finished } = await supabase.from('tournaments').select('*').eq('id', id).single()
  if (finished) pushToAC('tournaments', 'upsert', mapTournamentRow(finished as Record<string, unknown>) as unknown as Record<string, unknown>)

  revalidatePath(`/tournaments/${id}`)
  revalidatePath('/tournaments')
  revalidatePath('/torneos')
  revalidatePath('/hall-of-fame')
  // Invalidate the public leaderboard page so the next visit gets fresh status
  if (tournament.slug) revalidatePath(`/t/${tournament.slug}`)

  return { success: true }
}

export async function reactivateTournament(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('creator_id, collaborator_id, status, slug, arena_betting_enabled, is_sanctioned')
    .eq('id', id)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }
  if (!(await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id))) return { error: 'Sin permisos' }
  if (tournament.status !== 'finished') {
    return { error: 'Solo se pueden reactivar torneos finalizados' }
  }

  const { error: reactivateErr } = await supabase
    .from('tournaments')
    .update({
      status: 'active',
      end_date: null,
      arena_betting_status: tournament.arena_betting_enabled ? 'open' : 'closed',
    })
    .eq('id', id)

  if (reactivateErr) return { error: reactivateErr.message }

  if (tournament.is_sanctioned) {
    const adminSupabase = await createAdminClient()
    await adminSupabase
      .from('sanctioned_cups')
      .update({ status: 'active', end_date: null })
      .eq('tournament_id', id)
  }

  const { data: reactivated } = await supabase.from('tournaments').select('*').eq('id', id).single()
  if (reactivated) {
    pushToAC('tournaments', 'upsert', mapTournamentRow(reactivated as Record<string, unknown>) as unknown as Record<string, unknown>)
  }

  revalidatePath(`/tournaments/${id}`)
  revalidatePath('/tournaments')
  revalidatePath('/torneos')
  revalidatePath('/hall-of-fame')
  if (tournament.slug) revalidatePath(`/t/${tournament.slug}`)

  return { success: true }
}

export async function getTournaments(): Promise<
  { data: Tournament[] } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const admin = await isAdmin()

  // Fetch participated tournaments and their status for this user
  const { data: participations } = await supabase
    .from('participants')
    .select('tournament_id, team:teams(registration_status)')
    .eq('user_id', user.id)

  const participationMap: Record<string, 'pending_approval' | 'approved_to_pay' | 'pending_payment_validation' | 'confirmed'> = {}
  participations?.forEach((p: any) => {
    if (p.tournament_id && p.team?.registration_status) {
      participationMap[p.tournament_id] = p.team.registration_status
    }
  })

  let query = supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })

  if (!admin) {
    const { data: staffData } = await supabase
      .from('streamer_staff')
      .select('streamer_id')
      .eq('staff_id', user.id)
    const streamerIds = staffData?.map((s: any) => s.streamer_id) || []

    const orParts = [
      `creator_id.eq.${user.id}`,
      `collaborator_id.eq.${user.id}`
    ]
    if (streamerIds.length > 0) {
      const formattedIds = streamerIds.map(id => `"${id}"`).join(',')
      orParts.push(`creator_id.in.(${formattedIds})`)
      orParts.push(`collaborator_id.in.(${formattedIds})`)
    }
    const participatedIds = Object.keys(participationMap)
    if (participatedIds.length > 0) {
      const formattedTourneyIds = participatedIds.map(id => `"${id}"`).join(',')
      orParts.push(`id.in.(${formattedTourneyIds})`)
    }
    query = query.or(orParts.join(','))
  }

  const { data, error } = await query

  if (error) return { error: error.message }
  return {
    data: (data ?? []).map((row) => {
      const tourney = mapTournamentRow(row as Record<string, unknown>)
      return {
        ...tourney,
        registrationStatus: participationMap[tourney.id] || undefined
      }
    }),
  }
}

export async function getTournament(
  id: string
): Promise<{ data: Tournament & { scoringRule?: ScoringRule } } | { error: string; message?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const admin = await isAdmin()

  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single()

  if (tErr || !tournament) return { error: 'Torneo no encontrado' }

  if (!(await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id))) {
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', tournament.creator_id)
      .single()
    const ownerName = creatorProfile?.username || 'otro streamer'
    return {
      error: 'access_denied',
      message: `No tienes acceso a este torneo porque pertenece a ${ownerName}`,
    }
  }

  const { data: rule } = await supabase
    .from('scoring_rules')
    .select('*')
    .eq('tournament_id', id)
    .single()

  return {
    data: {
      ...mapTournamentRow(tournament as Record<string, unknown>),
      scoringRule: rule
        ? mapScoringRuleRow(rule as Record<string, unknown>)
        : undefined,
    },
  }
}

export async function deleteTournament(
  id: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership before deleting
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('creator_id, collaborator_id, name, status')
    .eq('id', id)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }

  if (!(await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id))) {
    return { error: 'Sin permisos para eliminar este torneo' }
  }

  // Delete tournament — using admin client to bypass creator-only RLS constraints
  const adminSupabase = await createAdminClient()

  // Si el torneo aún no había empezado (status === 'pending'), reembolsar las cuotas pagadas a cada equipo
  if (tournament.status === 'pending') {
    try {
      const { data: teamsWithPayments } = await adminSupabase
        .from('teams')
        .select(`
          id,
          name,
          amount_paid,
          participants (
            user_id,
            is_captain
          )
        `)
        .eq('tournament_id', id)

      for (const t of (teamsWithPayments || [])) {
        const refundAmount = Number(t.amount_paid || 0)
        if (refundAmount > 0) {
          const cap = (t.participants || []).find((p: any) => p.is_captain) || (t.participants || [])[0]
          if (cap?.user_id) {
            const { data: capProfile } = await adminSupabase
              .from('profiles')
              .select('balance')
              .eq('id', cap.user_id)
              .single()

            const newBal = Number(capProfile?.balance || 0) + refundAmount
            await adminSupabase.from('profiles').update({ balance: newBal }).eq('id', cap.user_id)

            await adminSupabase.from('coin_transactions').insert({
              user_id: cap.user_id,
              amount: refundAmount,
              type: 'deposit',
              description: `Reembolso de inscripción por cancelación del torneo: ${tournament.name}`,
              reference_id: id,
            })

            await adminSupabase.from('notifications').insert({
              user_id: cap.user_id,
              title: `🚫 Torneo Cancelado: ${tournament.name}`,
              message: `El torneo "${tournament.name}" ha sido cancelado antes de comenzar. Se han reembolsado ${refundAmount.toFixed(2)} K-Coins a tu billetera.`,
              is_read: false,
            })
          }
        }
      }
    } catch (refundBatchErr) {
      console.error('Error procesando reembolsos por cancelación de torneo:', refundBatchErr)
    }
  }

  const { error: deleteErr } = await adminSupabase
    .from('tournaments')
    .delete()
    .eq('id', id)

  if (deleteErr) return { error: deleteErr.message }

  // Notify AC to remove from mirror
  pushToAC('tournaments', 'delete', { id })

  return { success: true }
}

export async function getHallOfFame(): Promise<
  { data: any[] } | { error: string }
> {
  const supabase = await createClient()

  // 1. Get finished tournaments
  const { data: tournaments, error: tErr } = await supabase
    .from('tournaments')
    .select(`
      *,
      team_standings (
        team_id,
        rank,
        total_points,
        total_kills,
        teams (
          name,
          avatar_url
        )
      )
    `)
    .eq('status', 'finished')
    .order('end_date', { ascending: false })

  if (tErr) return { error: tErr.message }

  // 2. Map and filter only the winner for each
  const result = (tournaments || []).map(t => {
    const winner = t.team_standings?.find((s: any) => s.rank === 1)
    return {
      ...mapTournamentRow(t as Record<string, unknown>),
      winner: winner ? {
        teamId: winner.team_id,
        name: winner.teams?.name,
        avatarUrl: winner.teams?.avatar_url,
        totalPoints: winner.total_points,
        totalKills: winner.total_kills
      } : null
    }
  })

  return { data: result }
}

export async function updateBettingStatus(
  id: string,
  status: 'open' | 'closed' | 'paused'
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tournaments')
    .update({ arena_betting_status: status })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(`/tournaments/${id}`)
  return { success: true }
}

export async function toggleTournamentPrivacy(
  id: string,
  isPrivate: boolean
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('creator_id, collaborator_id')
    .eq('id', id)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }

  if (!(await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id))) return { error: 'Sin permisos' }

  const { error } = await supabase
    .from('tournaments')
    .update({ is_private: isPrivate })
    .eq('id', id)

  if (error) return { error: error.message }

  // Push updated status to AC mirror
  const { data: updated } = await supabase.from('tournaments').select('*').eq('id', id).single()
  if (updated) {
    pushToAC(
      'tournaments',
      'upsert',
      mapTournamentRow(updated as Record<string, unknown>) as unknown as Record<string, unknown>
    )
  }

  revalidatePath(`/tournaments/${id}`)
  revalidatePath('/tournaments')
  revalidatePath('/torneos')
  revalidatePath('/')
  return { success: true }
}

export async function addDynamicMatch(
  tournamentId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verify ownership and fetch details
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('creator_id, collaborator_id, total_matches, default_rounds_per_match, status')
    .eq('id', tournamentId)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }

  if (!(await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id))) return { error: 'Sin permisos' }
  if (tournament.status !== 'active') return { error: 'El torneo debe estar activo para agregar partidas' }

  const { getMatchPointWinner } = await import('./submissions')
  const mpWinner = await getMatchPointWinner(supabase, tournamentId)
  if (mpWinner) {
    return { error: `No se pueden agregar más partidas. El equipo "${mpWinner.teamName}" ha ganado por Match Point y requiere validación del administrador.` }
  }

  const nextMatchNumber = (tournament.total_matches || 0) + 1

  // 1. Increment total_matches on tournaments
  const { error: updateErr } = await supabase
    .from('tournaments')
    .update({ total_matches: nextMatchNumber })
    .eq('id', tournamentId)

  if (updateErr) return { error: updateErr.message }

  // 2. Create Parent Match (Encounter)
  const { data: parentMatch, error: pmErr } = await supabase
    .from('matches')
    .insert({
      tournament_id: tournamentId,
      match_number: nextMatchNumber,
      name: `Encuentro ${nextMatchNumber}`,
    })
    .select()
    .single()

  if (pmErr || !parentMatch) {
    // Rollback total_matches
    await supabase.from('tournaments').update({ total_matches: tournament.total_matches }).eq('id', tournamentId)
    return { error: pmErr?.message ?? 'Error al crear la partida' }
  }

  // 3. Create Rounds (Child Matches) if default_rounds_per_match > 1
  if ((tournament.default_rounds_per_match || 1) > 1) {
    const rounds = Array.from({ length: tournament.default_rounds_per_match }, (_, rIdx) => ({
      tournament_id: tournamentId,
      parent_match_id: parentMatch.id,
      match_number: nextMatchNumber,
      round_number: rIdx + 1,
      name: `Ronda ${rIdx + 1}`,
    }))

    const { error: rErr } = await supabase.from('matches').insert(rounds)
    if (rErr) {
      // Clean up parent match and rollback
      await supabase.from('matches').delete().eq('id', parentMatch.id)
      await supabase.from('tournaments').update({ total_matches: tournament.total_matches }).eq('id', tournamentId)
      return { error: rErr.message }
    }
  }

  // 4. Mirror updates to Apuestas Kronix
  const { data: updatedTourney } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single()
  if (updatedTourney) {
    pushToAC(
      'tournaments',
      'upsert',
      mapTournamentRow(updatedTourney as Record<string, unknown>) as unknown as Record<string, unknown>
    )
  }

  pushToAC('matches', 'upsert', parentMatch)

  const { data: createdRounds } = await supabase
    .from('matches')
    .select('*')
    .eq('parent_match_id', parentMatch.id)
  for (const r of createdRounds ?? []) {
    pushToAC('matches', 'upsert', r)
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  revalidatePath(`/t/${updatedTourney?.slug}`)
  revalidatePath('/tournaments')
  revalidatePath('/torneos')
  return { success: true }
}

export async function announceTournamentToAllUsersAction(
  tournamentId: string
): Promise<{ success: boolean } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // 1. Fetch tournament
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('id, name, slug, creator_id, collaborator_id')
    .eq('id', tournamentId)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }

  // 2. Check access using checkTournamentAccess
  const hasAccess = await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id)
  if (!hasAccess) {
    return { error: 'Sin permisos para anunciar este torneo' }
  }

  // 3. Fetch organizer profile name
  const adminSupabase = await createAdminClient()
  const { data: creatorProfile } = await adminSupabase
    .from('profiles')
    .select('username')
    .eq('id', tournament.creator_id)
    .single()

  const creatorName = creatorProfile?.username || 'Organizador'

  // 4. Fetch all player profiles that have an email
  const { data: profiles, error: profilesErr } = await adminSupabase
    .from('profiles')
    .select('email')
    .not('email', 'is', null)

  if (profilesErr) return { error: profilesErr.message }

  const emails = profiles
    ?.map((p: any) => p.email?.trim())
    .filter((email: any) => email && email.includes('@')) || []

  if (emails.length === 0) {
    return { error: 'No hay usuarios con correo registrado en la plataforma.' }
  }

  // 5. Send emails
  const { sendTournamentAnnouncementEmail } = await import('@/lib/services/email')
  const emailRes = await sendTournamentAnnouncementEmail({
    emails,
    tournamentName: tournament.name,
    creatorName,
    slug: tournament.slug,
  })

  if (!emailRes.success) {
    return { error: emailRes.error || 'Error al enviar los correos.' }
  }

  return { success: true }
}

export async function syncTournamentDiscordChannels(
  tournamentId: string
): Promise<{ success: true; message: string } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // 1. Fetch tournament
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('id, name, slug, mode, creator_id, collaborator_id, discord_integration_enabled, discord_announcement_channel_id, discord_voice_category_id, discord_url')
    .eq('id', tournamentId)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }
  if (!(await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id))) {
    return { error: 'Sin permisos de administrador para este torneo' }
  }

  // 2. Resolve Discord Guild ID (from creator profile or from tournament.discord_url)
  const { data: creatorProfile } = await supabase
    .from('profiles')
    .select('discord_guild_id')
    .eq('id', tournament.creator_id)
    .single()

  const { resolveDiscordGuildId, sendDiscordEmbed } = await import('@/lib/services/discord')

  let guildId = await resolveDiscordGuildId(creatorProfile?.discord_guild_id)
  if (!guildId && tournament.discord_url) {
    guildId = await resolveDiscordGuildId(tournament.discord_url)
    if (guildId && tournament.creator_id) {
      await supabase.from('profiles').update({ discord_guild_id: guildId, discord_connected: true }).eq('id', tournament.creator_id)
    }
  }

  if (!guildId) {
    return {
      error: 'No se pudo detectar el servidor de Discord. Asegúrate de colocar tu enlace de invitación (ej: https://discord.gg/...) o ID de servidor en los Ajustes del Torneo o de tu Perfil.',
    }
  }

  const cleanGuildId = guildId
  const adminSupabase = await createAdminClient()

  // 3. Resolve all guild channels to check category existence
  const { getGuildChannels, createDiscordCategory, createGuildTextChannel, createPrivateTextChannel, createPrivateVoiceChannel, deleteDiscordChannel } = await import('@/lib/services/discord')
  const existingChannelsRes = await getGuildChannels(cleanGuildId)
  if (!existingChannelsRes.success || !Array.isArray(existingChannelsRes.data)) {
    return { error: existingChannelsRes.error || 'No se pudieron consultar los canales del servidor de Discord.' }
  }

  const allGuildChannels = existingChannelsRes.data

  // Verify if category actually exists on Discord
  let categoryId = tournament.discord_voice_category_id
  const categoryExists = categoryId ? allGuildChannels.some((c: any) => c.id === categoryId && c.type === 4) : false

  if (!categoryExists) {
    console.log(`[Discord Sync] Creando nueva categoría para el torneo: ${tournament.name} en guild ${cleanGuildId}`)
    const categoryRes = await createDiscordCategory(cleanGuildId, `🏆 TORNEO: ${tournament.name.toUpperCase()}`)
    if ('error' in categoryRes || !categoryRes.id) {
      return { error: categoryRes.error || 'No se pudo crear la categoría en Discord. Verifica los permisos de Administrador del bot.' }
    }
    categoryId = categoryRes.id
    await supabase
      .from('tournaments')
      .update({
        discord_voice_category_id: categoryId,
        discord_integration_enabled: true,
      })
      .eq('id', tournamentId)
  }

  // 4. Create/Verify Default Organizational Channels under Category
  const existingInCategory = allGuildChannels.filter((c: any) => c.parent_id === categoryId)

  // 4.1. Canal Oficial de Anuncios
  let announcementChannelId = tournament.discord_announcement_channel_id
  const existingAnn = existingInCategory.find((c: any) => c.type === 0 && (c.id === announcementChannelId || c.name === 'anuncios-torneo' || c.name.includes('anuncio')))
  if (existingAnn) {
    announcementChannelId = existingAnn.id
  } else {
    const annRes = await createGuildTextChannel(cleanGuildId, '📢-anuncios-torneo', categoryId, `Anuncios oficiales y resultados en vivo para ${tournament.name}`)
    if (annRes.success && annRes.id) {
      announcementChannelId = annRes.id
      await sendDiscordEmbed(annRes.id, {
        title: `📢 ¡Canal Oficial de Anuncios — ${tournament.name}!`,
        description: `¡Bienvenidos a la arena oficial!\n\nEn este canal el bot y los jueces publicarán en tiempo real:\n• 🏁 Inicios y cierres de partida.\n• 📸 Solicitudes y recordatorios de subida de evidencias.\n• 📊 Actualizaciones de posiciones y podio final.\n\n🌐 **Leaderboard en vivo:** https://kronix.do/t/${tournament.slug}`,
        color: 62909,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Guardar ID de canal de anuncios en la base de datos si se creó o actualizó
  if (announcementChannelId && announcementChannelId !== tournament.discord_announcement_channel_id) {
    await supabase.from('tournaments').update({ discord_announcement_channel_id: announcementChannelId }).eq('id', tournamentId)
  }

  // 4.2. Canal de Chat General del Torneo
  const existingGeneral = existingInCategory.find((c: any) => c.type === 0 && (c.name === 'chat-general' || c.name === 'general-torneo'))
  if (!existingGeneral) {
    const genRes = await createGuildTextChannel(cleanGuildId, '💬-chat-general', categoryId, `Chat general para todos los participantes del torneo ${tournament.name}`)
    if (genRes.success && genRes.id) {
      await sendDiscordEmbed(genRes.id, {
        title: `💬 Chat General del Torneo`,
        description: `¡Bienvenidos a todos los competidores, capitanes y streamers!\n\nUtilicen este espacio para conversar, coordinar y compartir sus mejores jugadas. Mantengan el respeto y el espíritu deportivo. 🏆`,
        color: 16753920,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // 4.3. Canal de Soporte y Mesa de Jueces
  const existingSupport = existingInCategory.find((c: any) => c.type === 0 && (c.name === 'soporte-jueces' || c.name === 'soporte-torneo' || c.name.includes('soporte')))
  if (!existingSupport) {
    const supRes = await createGuildTextChannel(cleanGuildId, '🆘-soporte-jueces', categoryId, `Mesa de ayuda y arbitraje para ${tournament.name}`)
    if (supRes.success && supRes.id) {
      await sendDiscordEmbed(supRes.id, {
        title: `🆘 Soporte Técnico y Mesa de Jueces`,
        description: `¿Tienes dudas con las reglas, problemas de conexión o discrepancias en las evidencias?\n\nEscribe en este canal describiendo tu caso con capturas y mencionando a los árbitros u organizadores del torneo.`,
        color: 16711680,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // 5. Fetch teams and configure team voice/chat channels
  const { data: teams, error: teamsError } = await adminSupabase
    .from('teams')
    .select('id, name, discord_voice_channel_id')
    .eq('tournament_id', tournamentId)

  if (teamsError) {
    console.error('[Discord Sync] Error al obtener equipos del torneo:', teamsError)
  }

  let createdCount = 0
  if (teams && teams.length > 0) {
    for (const team of teams as any[]) {
      // Check participants
      const { data: participants } = await adminSupabase
        .from('participants')
        .select('user_id')
        .eq('team_id', team.id)
        .not('user_id', 'is', null)

      const teamUserIds = (participants || []).map((p) => p.user_id).filter(Boolean) as string[]

      let teamDiscordIds: string[] = []
      if (teamUserIds.length > 0) {
        const { data: identities } = await adminSupabase
          .schema('auth')
          .from('identities')
          .select('user_id, provider_id')
          .eq('provider', 'discord')
          .in('user_id', teamUserIds)

        if (identities) {
          teamDiscordIds = identities.map((i) => i.provider_id).filter(Boolean)
        }
      }

      const voiceChannelName = `🔊 ${team.name}`
      const textChannelName = `chat-${team.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'equipo'}`

      const modeLimits: Record<string, number> = { solo: 1, duo: 2, trio: 3, squad: 4, solos: 1, duos: 2, trios: 3, squads: 4 }
      const userLimit = modeLimits[tournament.mode?.toLowerCase()] || 0

      let voiceId = team.discord_voice_channel_id
      const existingVoice = existingInCategory.find((c: any) => c.type === 2 && (c.id === voiceId || c.name === voiceChannelName || c.name === team.name))
      if (existingVoice) {
        voiceId = existingVoice.id
      } else {
        const voiceRes = await createPrivateVoiceChannel(cleanGuildId, voiceChannelName, categoryId, teamDiscordIds, userLimit)
        if (voiceRes.success && voiceRes.id) voiceId = voiceRes.id
      }

      const existingText = existingInCategory.find((c: any) => c.type === 0 && (c.name === textChannelName || c.name.includes(team.name.toLowerCase())))
      if (!existingText) {
        const textRes = await createPrivateTextChannel(cleanGuildId, team.name, categoryId, teamDiscordIds)
        if (textRes.success && textRes.id) {
          await sendDiscordEmbed(textRes.id, {
            title: `🎮 Sala Oficial: ${team.name}`,
            description: `¡Hola equipo **${team.name}**!\n\nEste es su canal de comunicaciones oficial para el torneo.\n\n📌 **Aquí recibirán:**\n• 🏁 Avisos de inicio y fin de cada ronda.\n• 📸 Recordatorios de carga de evidencia.\n• ⚠️ Notificaciones de Match Point o sanciones.\n\n🔊 **Voz:** Únanse al canal de voz de su equipo para coordinar durante la partida.`,
            color: 5793266,
            timestamp: new Date().toISOString(),
          })
        }
      }

      if (voiceId) {
        createdCount++
        await adminSupabase
          .from('teams')
          .update({ discord_voice_channel_id: voiceId })
          .eq('id', team.id)
      }
    }
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  if (tournament.slug) {
    revalidatePath(`/t/${tournament.slug}`)
  }

  return {
    success: true,
    message: `¡Sincronización exitosa! Se configuraron los canales generales (#anuncios, #chat-general, #soporte) y las salas de voz/chat para ${createdCount} equipos bajo la categoría del torneo.`,
  }
}

export async function cleanupTournamentDiscordChannels(
  tournamentId: string
): Promise<{ success: true; message: string } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // 1. Fetch tournament
  const { data: tournament, error: fetchErr } = await supabase
    .from('tournaments')
    .select('id, name, creator_id, collaborator_id, discord_voice_category_id, discord_url')
    .eq('id', tournamentId)
    .single()

  if (fetchErr || !tournament) return { error: 'Torneo no encontrado' }
  if (!(await checkTournamentAccess(tournament.creator_id, user.id, tournament.collaborator_id))) {
    return { error: 'Sin permisos para gestionar este torneo' }
  }

  const { resolveDiscordGuildId, getGuildChannels, deleteDiscordChannel } = await import('@/lib/services/discord')

  let guildId = await resolveDiscordGuildId(tournament.discord_url)
  if (!guildId && tournament.creator_id) {
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('discord_guild_id')
      .eq('id', tournament.creator_id)
      .single()
    if (creatorProfile?.discord_guild_id) {
      guildId = creatorProfile.discord_guild_id
    }
  }

  let deletedCount = 0

  if (guildId) {
    try {
      const channelsRes = await getGuildChannels(guildId)
      if (channelsRes.success && Array.isArray(channelsRes.data)) {
        const allChannels = channelsRes.data

        // 1. Get all teams for this tournament
        const { data: teams } = await supabase
          .from('teams')
          .select('name, discord_voice_channel_id, discord_text_channel_id')
          .eq('tournament_id', tournamentId)

        const teamNames = (teams || []).map(t =>
          t.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
        ).filter(Boolean)

        const recordedIds = new Set(
          (teams || []).flatMap(t => [t.discord_voice_channel_id, t.discord_text_channel_id]).filter(Boolean)
        )

        // Find all tournament categories
        const tournamentCategories = allChannels.filter(
          (c: any) =>
            c.type === 4 &&
            (c.id === tournament.discord_voice_category_id ||
             c.name.toLowerCase().includes('torneo') ||
             c.name.toLowerCase().includes(tournament.name.toLowerCase()))
        )
        const tournamentCategoryIds = new Set(tournamentCategories.map((c: any) => c.id))
        if (tournament.discord_voice_category_id) {
          tournamentCategoryIds.add(tournament.discord_voice_category_id)
        }

        // Channels to delete:
        const channelsToDelete: any[] = []

        for (const ch of allChannels) {
          // Skip essential server channels
          const chNameLower = ch.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
          if (
            chNameLower === 'general' ||
            chNameLower === 'bienvenida' ||
            chNameLower.startsWith('reglas') ||
            chNameLower.includes('trading') ||
            chNameLower.includes('aprendizaje') ||
            chNameLower.includes('planificacion') ||
            chNameLower.includes('estudio')
          ) {
            continue
          }

          // Check if child of tournament category
          if (ch.parent_id && tournamentCategoryIds.has(ch.parent_id)) {
            channelsToDelete.push(ch)
            continue
          }

          // Check if recorded ID
          if (recordedIds.has(ch.id)) {
            channelsToDelete.push(ch)
            continue
          }

          // Check team text chats: "chat-makakp", "chat-...", "📢-anuncios-torneo", "💬-chat-general", "🆘-soporte-jueces"
          const isTournamentOrgChat =
            chNameLower.includes('anuncios-torneo') ||
            chNameLower.includes('soporte-jueces') ||
            chNameLower === 'chat-general' ||
            chNameLower.includes('chat-general')

          const isTeamChat =
            chNameLower.startsWith('chat-') &&
            (teamNames.length === 0 || teamNames.some(t => chNameLower.includes(t)))

          const isTeamVoice =
            ch.type === 2 &&
            (chNameLower.includes('🔊') || teamNames.some(t => chNameLower.includes(t)))

          if (isTournamentOrgChat || isTeamChat || isTeamVoice) {
            channelsToDelete.push(ch)
            continue
          }
        }

        // Delete all matched channels
        for (const ch of channelsToDelete) {
          console.log(`[Discord Cleanup] Eliminando canal: ${ch.name} (${ch.id})`)
          await deleteDiscordChannel(ch.id)
          deletedCount++
          await new Promise(r => setTimeout(r, 250)) // Delay to respect rate limits
        }

        // Delete the categories
        for (const cat of tournamentCategories) {
          console.log(`[Discord Cleanup] Eliminando categoría: ${cat.name} (${cat.id})`)
          await deleteDiscordChannel(cat.id)
          deletedCount++
          await new Promise(r => setTimeout(r, 250))
        }
      }
    } catch (err: any) {
      console.error('[Discord Cleanup] Error al eliminar canales:', err)
    }
  }

  // Reset IDs in DB
  await supabase
    .from('tournaments')
    .update({
      discord_voice_category_id: null,
      discord_announcement_channel_id: null,
    })
    .eq('id', tournamentId)

  await supabase
    .from('teams')
    .update({
      discord_voice_channel_id: null,
      discord_text_channel_id: null,
    })
    .eq('tournament_id', tournamentId)

  revalidatePath(`/tournaments/${tournamentId}`)
  return {
    success: true,
    message: `¡Limpieza completada! Se eliminaron ${deletedCount} canales duplicados/antiguos en Discord.`,
  }
}



