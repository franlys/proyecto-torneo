'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { pushToAC } from './ac-push'
import { getUsdToDopRate } from '@/lib/services/exchange-rate'
import { revalidatePath } from 'next/cache'

export async function registerTournament(
  tournamentId: string,
  formData: {
    teamName: string
    streamUrl?: string
    participants: { displayName: string; contactId?: string; streamUrl?: string; userId?: string; gameId?: string; gameUsername?: string }[]
    password?: string
  }
): Promise<{ success: boolean } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado. Por favor, inicia sesión.' }

    const adminSupabase = await createAdminClient()

    // 1. Obtener detalles del torneo
    const { data: tournament, error: tourneyErr } = await adminSupabase
      .from('tournaments')
      .select('id, name, slug, mode, status, is_private, registration_password, max_teams, creator_id, collaborator_id, created_at, registration_start_date, registration_end_date, entry_fee, discipline, start_date')
      .eq('id', tournamentId)
      .single()

    if (tourneyErr || !tournament) {
      return { error: 'No se encontró el torneo.' }
    }

    if (tournament.status !== 'pending' && tournament.status !== 'active') {
      return { error: 'Las inscripciones están cerradas para este torneo.' }
    }

    // 1.2. Verificar ventana de inscripciones por fecha/hora exacta
    const now = new Date()
    if (tournament.registration_start_date && now < new Date(tournament.registration_start_date)) {
      const opens = new Date(tournament.registration_start_date).toLocaleString('es-ES', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
      return { error: `Las inscripciones aún no han abierto. Abren el ${opens}.` }
    }
    if (tournament.registration_end_date && now > new Date(tournament.registration_end_date)) {
      const closed = new Date(tournament.registration_end_date).toLocaleString('es-ES', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
      return { error: `Las inscripciones cerraron el ${closed}.` }
    }

    // 1.5. Verificar si hay un baneo activo por abandono
    const pListTemp = (formData.participants || []).filter(p => p.displayName.trim() !== '')
    const userIdsToCheckTemp = pListTemp
      .map(p => p.userId)
      .filter((id): id is string => !!id)
    
    const allUserIds = [user.id, ...userIdsToCheckTemp]
    const allDisplayNames = pListTemp.map(p => p.displayName.trim())
    const allGameIds = pListTemp.map(p => p.gameId?.trim()).filter(Boolean) as string[]

    let banQuery = adminSupabase
      .from('creator_bans')
      .select('user_id, display_name, game_id, banned_at')
      .eq('creator_id', tournament.creator_id)

    const orConditions = []
    if (allUserIds.length > 0) orConditions.push(`user_id.in.(${allUserIds.join(',')})`)
    if (allDisplayNames.length > 0) {
      const escapedNames = allDisplayNames.map(name => `"${name.replace(/"/g, '""')}"`).join(',')
      orConditions.push(`display_name.in.(${escapedNames})`)
    }
    if (allGameIds.length > 0) {
      const escapedIds = allGameIds.map(id => `"${id.replace(/"/g, '""')}"`).join(',')
      orConditions.push(`game_id.in.(${escapedIds})`)
    }

    if (orConditions.length > 0) {
      banQuery = banQuery.or(orConditions.join(','))
      const { data: activeBans } = await banQuery

      if (activeBans && activeBans.length > 0) {
        for (const ban of activeBans) {
          // Count tournaments created by the creator after the ban date
          const { count, error: countErr } = await adminSupabase
            .from('tournaments')
            .select('id', { count: 'exact', head: true })
            .eq('creator_id', tournament.creator_id)
            .gt('created_at', ban.banned_at)
            .lte('created_at', tournament.created_at || new Date().toISOString())

          if (!countErr && count !== null && count < 3) {
            const bannedName = ban.display_name
            const remaining = 3 - count
            return {
              error: `El jugador '${bannedName}' está suspendido por el organizador para este torneo y ${remaining === 1 ? 'el siguiente' : `los siguientes ${remaining}`} torneos debido a abandono previo.`
            }
          }
        }
      }
    }

    // Validar Límite de Equipos (Capacidad Máxima)
    if (tournament.max_teams && tournament.max_teams > 0) {
      const { count, error: countErr } = await adminSupabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)
      
      if (!countErr && count !== null && count >= tournament.max_teams) {
        return { error: 'El torneo ha alcanzado el límite máximo de inscripciones (Cupos Llenos).' }
      }
    }

    // 1.7. Validar contraseña para torneos privados
    if (tournament.is_private && tournament.registration_password) {
      if (!formData.password || formData.password.trim() !== tournament.registration_password.trim()) {
        return { error: 'La contraseña de inscripción es incorrecta. Verifica con el organizador.' }
      }
    }

    // 1.8. Validar si el que se registra o algún compañero es staff/creador/colaborador
    const forbiddenIds = new Set<string>()
    if (tournament.creator_id) forbiddenIds.add(tournament.creator_id)
    if (tournament.collaborator_id) forbiddenIds.add(tournament.collaborator_id)

    // Consultar el staff del streamer
    const { data: staffData } = await adminSupabase
      .from('streamer_staff')
      .select('staff_id')
      .eq('streamer_id', tournament.creator_id)

    if (staffData) {
      staffData.forEach((s: any) => {
        if (s.staff_id) forbiddenIds.add(s.staff_id)
      })
    }

    const pList = formData.participants.filter(p => p.displayName.trim() !== '')

    if (forbiddenIds.has(user.id)) {
      return { error: 'El creador del torneo, colaboradores o miembros de su staff no pueden inscribirse como jugadores.' }
    }

    for (const p of pList) {
      if (p.userId && forbiddenIds.has(p.userId)) {
        return { error: `El jugador '${p.displayName}' es organizador o staff de este torneo y no puede participar.` }
      }
    }

    // 2. Verificar si el usuario ya está registrado en este torneo
    const { data: existingPlayer } = await adminSupabase
      .from('participants')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .limit(1)

    if (existingPlayer && existingPlayer.length > 0) {
      return { error: 'Ya estás inscrito en este torneo.' }
    }

    // 2.2. Verificar conflicto de fechas con otros torneos activos
    if (tournament.start_date && allUserIds.length > 0) {
      const { data: otherParticipations } = await adminSupabase
        .from('participants')
        .select(`
          user_id,
          display_name,
          tournament_id,
          tournaments (
            id,
            name,
            start_date,
            status
          )
        `)
        .in('user_id', allUserIds)
        .neq('tournament_id', tournamentId)

      if (otherParticipations && otherParticipations.length > 0) {
        const newStart = new Date(tournament.start_date).getTime()

        for (const part of otherParticipations) {
          const otherTourney = part.tournaments as any
          if (otherTourney && otherTourney.start_date && otherTourney.status !== 'finished' && otherTourney.status !== 'draft') {
            const otherStart = new Date(otherTourney.start_date).getTime()
            const diffHours = Math.abs(newStart - otherStart) / (1000 * 60 * 60)
            
            // Si la diferencia es menor a 6 horas (360 minutos)
            if (diffHours < 6) {
              const formattedDate = new Date(otherTourney.start_date).toLocaleString('es-ES', {
                day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit'
              })
              const isSelf = part.user_id === user.id
              const playerName = isSelf ? 'Tú ya estás' : `El integrante '${part.display_name}' ya está`
              
              return {
                error: `Conflicto de calendario: ${playerName} inscrito en el torneo "${otherTourney.name}" que inicia el ${formattedDate}. Debe haber una diferencia de al menos 6 horas entre torneos.`
              }
            }
          }
        }
      }
    }

    const maxPerTeam = ({ individual: 1, duos: 2, trios: 3, cuartetos: 4, quintas: 5 } as any)[tournament.mode] || 1

    // En modalidades de equipo, exigir que todos los compañeros sean usuarios registrados de Kronix
    if (tournament.mode !== 'individual') {
      if (pList.length < maxPerTeam) {
        return { error: `Tu equipo debe tener exactamente ${maxPerTeam} integrantes para inscribirse en este torneo.` }
      }

      const missingUserIndex = pList.findIndex((p, idx) => idx > 0 && !p.userId)
      if (missingUserIndex !== -1) {
        return {
          error: `Todos los integrantes del equipo deben ser usuarios registrados en Kronix y seleccionados de tu lista de amigos. (Falta el Integrante ${missingUserIndex + 1})`
        }
      }

      // Verificar que no haya usuarios duplicados dentro del mismo equipo (incluyendo al capitán)
      const teamUserSet = new Set<string>([user.id])
      for (let i = 1; i < pList.length; i++) {
        const uId = pList[i].userId
        if (uId) {
          if (teamUserSet.has(uId)) {
            return { error: 'No puedes agregar al mismo usuario varias veces en el equipo.' }
          }
          teamUserSet.add(uId)
        }
      }

      // Verificar que no haya nombres duplicados dentro del equipo
      const nameSet = new Set<string>()
      for (const p of pList) {
        const normalizedName = p.displayName.trim().toLowerCase()
        if (normalizedName) {
          if (nameSet.has(normalizedName)) {
            return { error: `El nombre '${p.displayName}' está repetido en el equipo. Cada integrante debe tener un nombre único.` }
          }
          nameSet.add(normalizedName)
        }
      }
    }

    // Verificar si alguno de los compañeros seleccionados ya está inscrito en este torneo
    const userIdsToCheck = pList
      .map(p => p.userId)
      .filter((id): id is string => !!id)

    if (userIdsToCheck.length > 0) {
      const { data: existingTeammates } = await adminSupabase
        .from('participants')
        .select('user_id, display_name')
        .eq('tournament_id', tournamentId)
        .in('user_id', userIdsToCheck)

      if (existingTeammates && existingTeammates.length > 0) {
        const alreadyReg = existingTeammates[0]
        const inputMember = pList.find(p => p.userId === alreadyReg.user_id)
        const nameToShow = inputMember?.displayName || alreadyReg.display_name
        return { error: `El jugador '${nameToShow}' ya está inscrito en este torneo en otro equipo.` }
      }
    }

    // 3. Validar el tamaño del equipo según el modo del torneo
    if (tournament.mode === 'individual') {
      if (pList.length === 0) {
        return { error: 'El nombre del jugador es requerido.' }
      }
    } else {
      if (!formData.teamName.trim()) {
        return { error: 'El nombre del equipo es requerido.' }
      }
      if (pList.length === 0) {
        return { error: 'Debes ingresar al menos un participante.' }
      }
      if (pList.length > maxPerTeam) {
        return { error: `Un equipo en modo ${tournament.mode} solo puede tener un máximo de ${maxPerTeam} integrantes.` }
      }
    }

    // 3.1. Validar que TODOS los participantes del equipo tengan Game ID y Game Username
    const gameIdSet = new Set<string>()
    const gameUsernameSet = new Set<string>()

    for (let i = 0; i < pList.length; i++) {
      const p = pList[i]
      const memberLabel = i === 0 ? 'del Capitán' : `del Integrante ${i + 1} (${p.displayName || 'compañero'})`
      if (!p.gameId || !p.gameId.trim()) {
        return { error: `El ID de cuenta en el juego ${memberLabel} es obligatorio para completar la inscripción.` }
      }
      if (!p.gameUsername || !p.gameUsername.trim()) {
        return { error: `El nombre de cuenta en el juego ${memberLabel} es obligatorio para completar la inscripción.` }
      }

      const cleanGId = p.gameId.trim()
      const cleanGUser = p.gameUsername.trim().toLowerCase()

      if (gameIdSet.has(cleanGId)) {
        return { error: `El ID de juego '${cleanGId}' está repetido en el equipo. Cada jugador debe usar una cuenta de juego diferente.` }
      }
      gameIdSet.add(cleanGId)

      if (gameUsernameSet.has(cleanGUser)) {
        return { error: `El nombre de cuenta en el juego '${p.gameUsername.trim()}' está repetido en el equipo.` }
      }
      gameUsernameSet.add(cleanGUser)
    }

    // 3.2. Validar que ninguna cuenta de juego esté ya registrada en otro equipo de este torneo
    const allGameIdsInTeam = Array.from(gameIdSet)
    if (allGameIdsInTeam.length > 0) {
      const { data: existingGameAccounts } = await adminSupabase
        .from('participants')
        .select('game_id, display_name')
        .eq('tournament_id', tournamentId)
        .in('game_id', allGameIdsInTeam)

      if (existingGameAccounts && existingGameAccounts.length > 0) {
        const conflict = existingGameAccounts[0]
        return {
          error: `La cuenta de juego con ID '${conflict.game_id}' (${conflict.display_name}) ya está registrada en este torneo en otro equipo.`
        }
      }
    }

    // 5. Verificar si el nombre del equipo o del jugador individual ya está registrado
    const finalTeamName = tournament.mode === 'individual' ? pList[0].displayName.trim() : formData.teamName.trim()
    const { data: teamExists } = await adminSupabase
      .from('teams')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('name', finalTeamName)
      .limit(1)

    if (teamExists && teamExists.length > 0) {
      return { error: `El nombre '${finalTeamName}' ya está registrado en este torneo.` }
    }

    const hasEntryFee = tournament.entry_fee && Number(tournament.entry_fee) > 0
    const entryFeeUsd = Number(tournament.entry_fee || 0)
    let initialStatus = tournament.mode === 'individual' ? 'confirmed' : 'pending_confirmation'
    let amountPaidValue = 0

    if (hasEntryFee) {
      const rate = await getUsdToDopRate()
      const entryFeeInKCoins = parseFloat((entryFeeUsd * rate).toFixed(2))

      // Verificar saldo de K-Coins del capitán y versión del perfil
      const { data: captainProfile, error: balErr } = await adminSupabase
        .from('profiles')
        .select('balance, updated_at')
        .eq('id', user.id)
        .single()

      if (balErr || !captainProfile) {
        return { error: 'No se pudo verificar tu saldo de K-Coins.' }
      }

      const currentBalance = parseFloat(captainProfile.balance || '0')
      const lastUpdatedAt = captainProfile.updated_at
      
      // Permitir tolerancia de hasta 2.0 K-Coins para absorber micro-variaciones de tasa de cambio y redondeos
      if (currentBalance + 2.0 < entryFeeInKCoins) {
        return {
          error: `Saldo insuficiente de K-Coins. El costo es de $${entryFeeUsd} USD (~${entryFeeInKCoins.toLocaleString('es-ES')} K-Coins) y tu saldo es ${currentBalance.toFixed(2)} K-Coins. Recarga en tu billetera.`
        }
      }

      // Descontar K-Coins del capitán usando OCC (descontando el mínimo entre el saldo actual and el costo)
      const deductionAmount = Math.min(currentBalance, entryFeeInKCoins)
      const newBalance = parseFloat(Math.max(0, currentBalance - deductionAmount).toFixed(2))
      const { data: updateData, error: deductErr } = await adminSupabase
        .from('profiles')
        .update({ 
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .eq('updated_at', lastUpdatedAt)
        .select()

      if (deductErr || !updateData || updateData.length === 0) {
        return { error: 'Conflicto de transacción concurrente. Por favor, intenta de nuevo.' }
      }

      // Registrar transacción
      await adminSupabase.from('coin_transactions').insert({
        user_id: user.id,
        amount: -entryFeeInKCoins,
        type: 'tournament_entry',
        description: `Inscripción al torneo: ${tournament.name} ($${entryFeeUsd} USD)`,
        reference_id: tournamentId,
      })

      amountPaidValue = entryFeeInKCoins
    }

    // 6. Insertar Equipo
    const { data: team, error: teamErr } = await adminSupabase
      .from('teams')
      .insert({
        tournament_id: tournamentId,
        name: finalTeamName,
        stream_url: formData.streamUrl || null,
        registration_status: initialStatus,
        amount_paid: amountPaidValue
      })
      .select()
      .single()

    if (teamErr || !team) {
      return { error: teamErr?.message || 'Error al registrar el equipo.' }
    }
    // Sincronizar equipo a Apuestas Kronix
    pushToAC('teams', 'upsert', {
      id: team.id,
      tournamentId: team.tournament_id,
      name: team.name,
      avatarUrl: team.avatar_url,
      streamUrl: team.stream_url,
    })

    // Fetch captain's Discord connection status
    const { data: capProfile } = await adminSupabase
      .from('profiles')
      .select('discord_connected')
      .eq('id', user.id)
      .maybeSingle()

    const captainDiscordConnected = !!capProfile?.discord_connected

    // 7. Insertar Participantes
    for (let i = 0; i < pList.length; i++) {
      const pData = pList[i]
      const isCaptain = i === 0 // El primer participante listado es el capitán
      const targetUserId = isCaptain ? user.id : (pData.userId || null)

      let teammateGameId = pData.gameId?.trim() || null
      let teammateGameUsername = pData.gameUsername?.trim() || null

      // Si no es el capitán, intentar auto-completar desde sus cuentas de juego registradas
      if (!isCaptain && targetUserId && (!teammateGameId || !teammateGameUsername)) {
        const { data: savedAccount } = await adminSupabase
          .from('game_accounts')
          .select('game_id, game_username')
          .eq('user_id', targetUserId)
          .eq('game', tournament.discipline)
          .maybeSingle()

        if (savedAccount) {
          teammateGameId = savedAccount.game_id
          teammateGameUsername = savedAccount.game_username
        }
      }

      const isConfirmed = tournament.mode === 'individual' || isCaptain
      const isDiscordConnected = isCaptain ? captainDiscordConnected : false

      const { data: participant, error: partErr } = await adminSupabase
        .from('participants')
        .insert({
          tournament_id: tournamentId,
          team_id: team.id,
          display_name: pData.displayName.trim(),
          contact_id: pData.contactId || null,
          stream_url: pData.streamUrl || null,
          is_captain: isCaptain,
          user_id: targetUserId,
          game_id: teammateGameId,
          game_username: teammateGameUsername,
          is_confirmed: isConfirmed,
          discord_connected: isDiscordConnected,
        })
        .select()
        .single()

      if (partErr) {
        console.error('Error al insertar participante:', partErr.message)
      } else if (participant) {
        pushToAC('participants', 'upsert', {
          id: participant.id,
          tournamentId: participant.tournament_id,
          teamId: participant.team_id,
          displayName: participant.display_name,
          streamUrl: participant.stream_url,
          totalKills: participant.total_kills || 0,
          isCaptain: participant.is_captain,
        })

        // Insert in-app notification
        if (targetUserId) {
          try {
            await adminSupabase.from('notifications').insert({
              user_id: targetUserId,
              title: isCaptain ? 'Inscripción Confirmada ⚔️' : 'Inscrito en Torneo ⚔️',
              message: isCaptain 
                ? `Te has inscrito con éxito en el torneo "${tournament.name}" con tu equipo "${team.name}".`
                : `Tu capitán te ha inscrito en el equipo "${team.name}" para el torneo "${tournament.name}".`
            })
          } catch (notifErr) {
            console.error('Error inserting in-app notification:', notifErr)
          }
        }

        // Notificar por correo a los integrantes del equipo para que acepten la invitación
        if (!isCaptain && targetUserId) {
          const { data: teammateProfile } = await adminSupabase
            .from('profiles')
            .select('email, username')
            .eq('id', targetUserId)
            .single()

          if (teammateProfile?.email) {
            const { sendTeammateInvitationEmail } = await import('@/lib/services/email')

            await sendTeammateInvitationEmail({
              email: teammateProfile.email,
              teammateName: pData.displayName.trim(),
              captainName: pList[0].displayName.trim(),
              tournamentName: tournament.name,
              teamName: team.name,
              portalUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/profile`
            }).catch(e => console.error('Error al notificar al compañero por correo:', e))
          }
        }
      }
    }

    // 8. Inicializar la tabla de posiciones (Standings) del equipo solo si está confirmado directamente
    if (initialStatus === 'confirmed') {
      const { error: standingsErr } = await adminSupabase
        .from('team_standings')
        .upsert({
          tournament_id: tournamentId,
          team_id: team.id,
          total_points: 0,
          total_kills: 0,
          kill_rate: 0,
          pot_top_count: 0,
          vip_score: 0,
          rank: 99,
          previous_rank: 99,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tournament_id,team_id' })

      if (standingsErr) {
        console.error('[registerTournament] Failed to initialize team_standings:', standingsErr.message)
      }
    }

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Ocurrió un error inesperado al procesar la inscripción.' }
  }
}

export async function getPendingInvitations(): Promise<{ success: boolean; invitations?: any[] } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    const adminSupabase = await createAdminClient()
    const { data: invitations, error } = await adminSupabase
      .from('participants')
      .select(`
        id,
        is_confirmed,
        discord_connected,
        display_name,
        tournament_id,
        team_id,
        tournaments (
          id,
          name,
          slug,
          mode,
          start_date,
          discord_url,
          creator_id
        ),
        teams (
          id,
          name,
          registration_status
        )
      `)
      .eq('user_id', user.id)
      .eq('is_confirmed', false)

    if (error) return { error: error.message }
    return { success: true, invitations: invitations || [] }
  } catch (err: any) {
    return { error: err.message || 'Error al obtener invitaciones pendientes.' }
  }
}

export async function confirmTeamParticipation(
  participantId: string
): Promise<{ success: boolean; joinedDiscord?: boolean; discordUrl?: string } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    const adminSupabase = await createAdminClient()

    // 1. Fetch participant, team, and tournament details
    const { data: participant, error: partErr } = await adminSupabase
      .from('participants')
      .select(`
        id,
        user_id,
        is_confirmed,
        team_id,
        tournament_id,
        display_name,
        game_id,
        game_username,
        teams (
          id,
          name,
          registration_status
        ),
        tournaments (
          id,
          name,
          slug,
          mode,
          discord_url,
          creator_id,
          discipline
        )
      `)
      .eq('id', participantId)
      .single()

    if (partErr || !participant) {
      return { error: 'No se encontró tu registro de participación.' }
    }

    if (participant.user_id !== user.id) {
      return { error: 'No estás autorizado para confirmar este registro.' }
    }

    if (participant.is_confirmed) {
      return { success: true } // Already confirmed
    }

    const team = participant.teams as any
    const tournament = participant.tournaments as any

    if (!team || !tournament) {
      return { error: 'Información de torneo o equipo incompleta.' }
    }

    // 2. Resolve user's Discord ID (checks OAuth and manual profile text field)
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('discord_username')
      .eq('id', user.id)
      .maybeSingle()

    let discordUserId: string | null = null
    const { data: identities } = await adminSupabase
      .schema('auth')
      .from('identities')
      .select('provider_id')
      .eq('provider', 'discord')
      .eq('user_id', user.id)
      .maybeSingle()

    if (identities?.provider_id) {
      discordUserId = identities.provider_id
    }

    if (!discordUserId && profile?.discord_username) {
      const trimmedVal = profile.discord_username.trim()
      if (/^\d{17,21}$/.test(trimmedVal)) {
        discordUserId = trimmedVal
      }
    }

    // 3. Resolve Discord Guild ID (Server ID)
    let guildId: string | null = null
    const { resolveDiscordGuildId, checkMemberInGuild, createOrGetTeamRole, assignDiscordRoleToMember, findMemberIdByUsername } = await import('@/lib/services/discord')

    if (tournament.discord_url) {
      guildId = await resolveDiscordGuildId(tournament.discord_url)
    }

    if (!guildId && tournament.creator_id) {
      const { data: creatorProf } = await adminSupabase
        .from('profiles')
        .select('discord_guild_id')
        .eq('id', tournament.creator_id)
        .maybeSingle()

      if (creatorProf?.discord_guild_id) {
        guildId = await resolveDiscordGuildId(creatorProf.discord_guild_id)
      }
    }

    // If still no numeric ID, and we have a text username and guildId, resolve it dynamically!
    if (!discordUserId && profile?.discord_username && guildId) {
      const resolvedId = await findMemberIdByUsername(guildId, profile.discord_username)
      if (resolvedId) {
        discordUserId = resolvedId
        // Sync resolved ID back to profiles table so subsequent calls don't need API search lookup!
        await adminSupabase
          .from('profiles')
          .update({ discord_username: resolvedId })
          .eq('id', user.id)
      }
    }

    if (!discordUserId) {
      return {
        error: 'Por favor, vincula tu cuenta de Discord en tu Perfil (usando inicio de sesión social, tu usuario o tu ID numérico en Ajustes) antes de confirmar tu participación.'
      }
    }

    // 4. Validate user is in Discord server (if configured)
    if (guildId) {
      const isInServer = await checkMemberInGuild(guildId, discordUserId)
      if (!isInServer) {
        return {
          error: `Debes unirte al servidor oficial de Discord de este torneo antes de confirmar tu participación.`,
          discordUrl: tournament.discord_url || 'https://discord.gg/'
        }
      }

      // Assign team role to the participant in Discord
      try {
        const teamRoleRes = await createOrGetTeamRole(guildId, team.name)
        if ('roleId' in teamRoleRes && teamRoleRes.roleId) {
          await assignDiscordRoleToMember(guildId, discordUserId, teamRoleRes.roleId)
        }
      } catch (roleErr) {
        console.error('[Confirm Team Participation] Error assigning team role:', roleErr)
      }
    }

    // 5. Update participant as confirmed and discord connected
    const { error: updateErr } = await adminSupabase
      .from('participants')
      .update({
        is_confirmed: true,
        discord_connected: true
      })
      .eq('id', participantId)

    if (updateErr) {
      return { error: 'Error al actualizar el estado de confirmación: ' + updateErr.message }
    }

    // 6. Check if all team members are now confirmed
    const { data: allMembers } = await adminSupabase
      .from('participants')
      .select('is_confirmed')
      .eq('team_id', team.id)

    const allConfirmed = allMembers && allMembers.every((m: any) => m.is_confirmed)

    if (allConfirmed) {
      // If team has a paid entry, keep it confirmed (free is confirmed immediately)
      const { error: teamStatusErr } = await adminSupabase
        .from('teams')
        .update({ registration_status: 'confirmed' })
        .eq('id', team.id)

      if (teamStatusErr) {
        console.error('[confirmTeamParticipation] Failed to confirm team status:', teamStatusErr.message)
      }

      // Initialize team standings since team is now confirmed!
      await adminSupabase
        .from('team_standings')
        .upsert({
          tournament_id: tournament.id,
          team_id: team.id,
          total_points: 0,
          total_kills: 0,
          kill_rate: 0,
          pot_top_count: 0,
          vip_score: 0,
          rank: 99,
          previous_rank: 99,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tournament_id,team_id' })

      // Push to Apuestas Kronix
      const { pushToAC } = await import('./ac-push')
      pushToAC('teams', 'upsert', {
        id: team.id,
        tournamentId: tournament.id,
        name: team.name,
        registrationStatus: 'confirmed'
      })

      // Enviar anuncio oficial a Discord si está configurado
      if (guildId || tournament.discord_announcement_channel_id) {
        try {
          const { sendDiscordEmbed, getGuildChannels } = await import('@/lib/services/discord')
          let announceChannelId = tournament.discord_announcement_channel_id
          
          if (!announceChannelId && guildId) {
            const channelsRes = await getGuildChannels(guildId)
            if (channelsRes.success && Array.isArray(channelsRes.data)) {
              const annChan = channelsRes.data.find((c: any) => c.name === '📢-anuncios-torneo' || c.name.includes('anuncio'))
              if (annChan) {
                announceChannelId = annChan.id
              }
            }
          }

          if (announceChannelId) {
            await sendDiscordEmbed(announceChannelId, {
              title: `⚔️ ¡Equipo Confirmado!`,
              description: `El equipo **${team.name}** ha confirmado su participación para el torneo **${tournament.name}**.\n\n¡Bienvenidos y buena suerte! 🔥`,
              color: 62909,
              timestamp: new Date().toISOString(),
            })
          }
        } catch (discordAnnErr) {
          console.error('[confirmTeamParticipation] Failed to send Discord confirmation announcement:', discordAnnErr)
        }
      }
    }

    revalidatePath(`/t/${tournament.slug}`)
    revalidatePath('/profile')
    revalidatePath(`/t/${tournament.slug}/team/${team.id}`)

    return { success: true }
  } catch (err: any) {
    console.error('Error in confirmTeamParticipation Server Action:', err)
    return { error: err.message || 'Error interno del servidor al confirmar participación.' }
  }
}

export async function rejectTeamParticipation(
  participantId: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    const adminSupabase = await createAdminClient()

    const { data: participant, error: partErr } = await adminSupabase
      .from('participants')
      .select('id, user_id, team_id, tournaments(slug)')
      .eq('id', participantId)
      .single()

    if (partErr || !participant) {
      return { error: 'No se encontró tu registro de participación.' }
    }

    if (participant.user_id !== user.id) {
      return { error: 'No estás autorizado para rechazar esta invitación.' }
    }

    // Delete the participant record (declining removes the player from the team roster)
    const { error: deleteErr } = await adminSupabase
      .from('participants')
      .delete()
      .eq('id', participantId)

    if (deleteErr) return { error: deleteErr.message }

    const tournament = participant.tournaments as any
    if (tournament) {
      revalidatePath(`/t/${tournament.slug}`)
    }
    revalidatePath('/profile')

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al rechazar la invitación.' }
  }
}

export async function resendTeammateInvitation(
  participantId: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    const adminSupabase = await createAdminClient()

    // 1. Fetch participant details
    const { data: participant, error: partErr } = await adminSupabase
      .from('participants')
      .select('*, teams(*), tournaments(*), profiles:profiles!participants_user_id_fkey(email, username)')
      .eq('id', participantId)
      .single()

    if (partErr || !participant) {
      return { error: 'No se encontró el participante.' }
    }

    if (participant.is_confirmed) {
      return { error: 'El participante ya ha confirmado su participación.' }
    }

    // 2. Fetch captain of the team
    const { data: captain } = await adminSupabase
      .from('participants')
      .select('display_name, user_id')
      .eq('team_id', participant.team_id)
      .eq('is_captain', true)
      .single()

    // 3. Verify user is authorized (either captain, self, or tournament organizer/admin)
    const isCaptain = captain?.user_id === user.id
    const isSelf = participant.user_id === user.id
    const isOrganizer = participant.tournaments?.creator_id === user.id || participant.tournaments?.collaborator_id === user.id

    if (!isCaptain && !isSelf && !isOrganizer) {
      return { error: 'No tienes permisos para reenviar esta invitación.' }
    }

    const teammateEmail = participant.profiles?.email
    if (!teammateEmail) {
      return { error: 'El participante no tiene una dirección de correo vinculada.' }
    }

    // 4. Send email
    const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/profile`
    const { sendTeammateInvitationEmail } = await import('@/lib/services/email')
    
    const emailRes = await sendTeammateInvitationEmail({
      email: teammateEmail,
      teammateName: participant.display_name,
      captainName: captain?.display_name || 'Tu Capitán',
      tournamentName: participant.tournaments.name,
      teamName: participant.teams.name,
      portalUrl
    })

    if (!emailRes.success) {
      return { error: 'Error al enviar el correo con Resend.' }
    }

    return { success: true }
  } catch (err: any) {
    console.error('Error in resendTeammateInvitation Action:', err)
    return { error: err.message || 'Error inesperado al reenviar la invitación.' }
  }
}
