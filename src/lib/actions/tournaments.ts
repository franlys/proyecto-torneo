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
    .select('status, creator_id, collaborator_id, format, kill_race_time_limit_minutes, name, discord_integration_enabled, discord_announcement_channel_id')
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

  // Configuración de Canales de Discord si está habilitado
  if (tournament.discord_integration_enabled) {
    try {
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('discord_guild_id')
        .eq('id', tournament.creator_id)
        .single()

      const guildId = creatorProfile?.discord_guild_id
      if (guildId) {
        const { createDiscordCategory, createPrivateVoiceChannel, sendDiscordEmbed } = await import('@/lib/services/discord')
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
            for (const team of teams) {
              // Consultar los participantes del equipo
              const { data: participants } = await supabase
                .from('participants')
                .select('user_id')
                .eq('team_id', team.id)
                .not('user_id', 'is', null)

              const teamUserIds = (participants || []).map((p) => p.user_id).filter(Boolean) as string[]

              // Consultar IDs de Discord desde auth.identities
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

              // Crear canal de voz privado para este equipo
              console.log(`[Discord Setup] Creando canal de voz para equipo: ${team.name} con ${teamDiscordIds.length} integrantes.`)
              const voiceRes = await createPrivateVoiceChannel(guildId, `🔊 ${team.name}`, categoryId, teamDiscordIds)
              if (voiceRes.success && voiceRes.id) {
                // Guardar el id del canal en el equipo
                await supabase
                  .from('teams')
                  .update({ discord_voice_channel_id: voiceRes.id })
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

  // Enviar notificaciones in-app y simulación de correos electrónicos
  try {
    const { data: participants } = await supabase
      .from('participants')
      .select('display_name, user_id')
      .eq('tournament_id', id)
      .not('user_id', 'is', null)

    if (participants && participants.length > 0) {
      const adminSupabase = await createAdminClient()
      const userIds = Array.from(new Set(participants.map(p => p.user_id).filter(Boolean)))

      if (userIds.length > 0) {
        // 1. Insertar notificaciones in-app
        const notificationsToInsert = userIds.map(uId => ({
          user_id: uId,
          title: `¡El torneo ${tournament.name} ha comenzado!`,
          message: `El torneo '${tournament.name}' al que te inscribiste ha iniciado oficialmente. ¡Buena suerte!`,
          is_read: false
        }))

        await adminSupabase.from('notifications').insert(notificationsToInsert)

        // 2. Consultar emails de auth y simular correos por consola
        const { data: authUsers } = await adminSupabase
          .schema('auth')
          .from('users')
          .select('id, email')
          .in('id', userIds)

        if (authUsers) {
          authUsers.forEach(u => {
            console.log(`\n================================================================================`);
            console.log(`[EMAIL ENVIADO - SIMULACIÓN]`);
            console.log(`Destinatario: ${u.email}`);
            console.log(`Asunto: ¡El torneo "${tournament.name}" ha comenzado!`);
            console.log(`Mensaje: Hola, el torneo al que te inscribiste ya está activo. ¡Buena suerte en la arena!`);
            console.log(`================================================================================\n`);
          })
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
    .select('creator_id, collaborator_id, status, slug, is_sanctioned, mode, discipline, badge_url, name, discord_integration_enabled, discord_voice_category_id, discord_announcement_channel_id')
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

  // Discord Autocleanup
  if (tournament.discord_integration_enabled && tournament.creator_id) {
    try {
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('discord_guild_id')
        .eq('id', tournament.creator_id)
        .single()

      const guildId = creatorProfile?.discord_guild_id
      if (guildId) {
        const { deleteDiscordChannel, sendDiscordEmbed } = await import('@/lib/services/discord')

        // 1. Delete all team voice channels
        const { data: teams } = await supabase
          .from('teams')
          .select('discord_voice_channel_id')
          .eq('tournament_id', id)

        if (teams) {
          for (const team of teams) {
            if (team.discord_voice_channel_id) {
              console.log(`[Discord Cleanup] Eliminando canal de voz: ${team.discord_voice_channel_id}`)
              await deleteDiscordChannel(team.discord_voice_channel_id)
            }
          }
        }

        // 2. Delete the category
        if (tournament.discord_voice_category_id) {
          console.log(`[Discord Cleanup] Eliminando categoría de torneo: ${tournament.discord_voice_category_id}`)
          await deleteDiscordChannel(tournament.discord_voice_category_id)
        }

        // 3. Send final announcement
        if (tournament.discord_announcement_channel_id) {
          await sendDiscordEmbed(tournament.discord_announcement_channel_id, {
            title: `🏁 ¡El torneo ${tournament.name} ha finalizado!`,
            description: `El torneo ha concluido oficialmente. Gracias a todos por participar. Las salas de voz temporales han sido eliminadas.`,
            color: 16766720, // Gold color equivalent #FFD700 in dec
            timestamp: new Date().toISOString(),
          })
        }
      }
    } catch (cleanErr: any) {
      console.error('[Discord Cleanup] Error al limpiar canales de Discord:', cleanErr.message || cleanErr)
    }
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
                const { data: pProfile } = await adminSupabase.from('profiles').select('balance').eq('id', userId).single()
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
        const { data: mvpProfile } = await adminSupabase.from('profiles').select('balance').eq('id', mvpUserId).single()
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
      }
    }

    // 4. Auto-resolve tournament-wide betting markets
    try {
      const { data: tournamentMarkets } = await adminSupabase
        .from('bet_markets')
        .select('*')
        .eq('tournament_id', id)
        .is('match_id', null)
        .eq('status', 'open')

      if (tournamentMarkets && tournamentMarkets.length > 0) {
        // Fetch the champion team
        const { data: championStanding } = await adminSupabase
          .from('team_standings')
          .select('team_id, teams(name)')
          .eq('tournament_id', id)
          .eq('rank', 1)
          .single()

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
          let winningOptionId: string | null = null
          const opts = market.options as any[]

          if (market.market_type === 'winner' && championStanding?.teams) {
            const rawTeam = championStanding.teams as any
            const champName = (Array.isArray(rawTeam) ? rawTeam[0]?.name : rawTeam?.name) || ''
            const opt = opts.find(o => o.name.toLowerCase().trim() === champName.toLowerCase().trim())
            if (opt) winningOptionId = opt.id
          } else if (market.market_type === 'most_kills' && maxKillsTeamName) {
            const opt = opts.find(o => o.name.toLowerCase().trim() === maxKillsTeamName.toLowerCase().trim())
            if (opt) winningOptionId = opt.id
          }

          if (winningOptionId) {
            await adminSupabase
              .from('bet_markets')
              .update({
                status: 'resolved',
                winning_option_id: winningOptionId
              })
              .eq('id', market.id)

            const { data: bets } = await adminSupabase
              .from('user_bets')
              .select('*')
              .eq('market_id', market.id)
              .eq('status', 'pending')

            if (bets && bets.length > 0) {
              for (const bet of bets) {
                const isWinner = bet.selected_option_id === winningOptionId
                const status = isWinner ? 'won' : 'lost'

                await adminSupabase
                  .from('user_bets')
                  .update({ status })
                  .eq('id', bet.id)

                if (isWinner) {
                  const winAmount = parseFloat(bet.potential_payout)
                  const { data: userProfile } = await adminSupabase
                    .from('profiles')
                    .select('balance')
                    .eq('id', bet.user_id)
                    .single()

                  const newBal = parseFloat((Number(userProfile?.balance || 0) + winAmount).toFixed(2))
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
    .select('id, name, slug, creator_id, collaborator_id, discord_integration_enabled, discord_announcement_channel_id, discord_voice_category_id, discord_url')
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

  const { extractDiscordGuildId, createDiscordCategory, createPrivateVoiceChannel, sendDiscordEmbed } = await import('@/lib/services/discord')

  let guildId = creatorProfile?.discord_guild_id
  if (!guildId && tournament.discord_url) {
    guildId = extractDiscordGuildId(tournament.discord_url)
  }

  if (!guildId) {
    return {
      error: 'No se encontró el ID de Servidor de Discord (Guild ID). Por favor configúralo en tu Perfil (Ajustes) o pega el enlace del canal/servidor en el torneo.',
    }
  }

  const cleanGuildId = extractDiscordGuildId(guildId) || guildId
  const adminSupabase = await createAdminClient()

  // 3. Create or reuse category
  let categoryId = tournament.discord_voice_category_id
  if (!categoryId) {
    console.log(`[Discord Sync] Creando categoría para el torneo: ${tournament.name} en guild ${cleanGuildId}`)
    const categoryRes = await createDiscordCategory(cleanGuildId, `🏆 Torneo: ${tournament.name}`)
    if ('error' in categoryRes || !categoryRes.id) {
      return { error: categoryRes.error || 'No se pudo crear la categoría en Discord. Verifica que el bot esté en el servidor y tenga permisos.' }
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

  // 4. Fetch teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, discord_voice_channel_id')
    .eq('tournament_id', tournamentId)

  if (!teams || teams.length === 0) {
    return {
      success: true,
      message: 'Categoría de Discord configurada. No hay equipos inscritos aún para crear canales de voz.',
    }
  }

  let createdCount = 0
  for (const team of teams) {
    // Check participants
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

    const voiceRes = await createPrivateVoiceChannel(cleanGuildId, `🔊 ${team.name}`, categoryId, teamDiscordIds)
    if (voiceRes.success && voiceRes.id) {
      createdCount++
      await supabase
        .from('teams')
        .update({ discord_voice_channel_id: voiceRes.id })
        .eq('id', team.id)
    } else if ('error' in voiceRes) {
      console.warn(`[Discord Sync] Error al crear canal para ${team.name}:`, voiceRes.error)
    }
  }

  // Optional announcement
  if (tournament.discord_announcement_channel_id) {
    await sendDiscordEmbed(tournament.discord_announcement_channel_id, {
      title: `🏆 ¡Salas de Discord sincronizadas!`,
      description: `Se han configurado las salas de voz para el torneo **${tournament.name}**.`,
      color: 62909,
      timestamp: new Date().toISOString(),
    })
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  if (tournament.slug) {
    revalidatePath(`/t/${tournament.slug}`)
  }

  return {
    success: true,
    message: `¡Sincronización exitosa! Se configuraron ${createdCount} salas de voz en tu servidor de Discord.`,
  }
}



