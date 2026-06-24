'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { pushToAC } from './ac-push'

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
      .select('id, name, slug, mode, status, is_private, registration_password, max_teams, creator_id, collaborator_id, created_at, registration_start_date, registration_end_date, entry_fee, discipline')
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

    const maxPerTeam = ({ individual: 1, duos: 2, trios: 3, cuartetos: 4, quintas: 5 } as any)[tournament.mode] || 1

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

    // 3.1. Validar que el capitán (primer participante) tenga Game ID y Game Username
    const captain = pList[0]
    if (!captain.gameId || !captain.gameId.trim()) {
      return { error: 'El ID de cuenta del juego es obligatorio para inscribirse.' }
    }
    if (!captain.gameUsername || !captain.gameUsername.trim()) {
      return { error: 'El nombre de cuenta en el juego es obligatorio para inscribirse.' }
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
    const initialStatus = hasEntryFee ? 'pending_approval' : 'confirmed'

    // 6. Insertar Equipo
    const { data: team, error: teamErr } = await adminSupabase
      .from('teams')
      .insert({
        tournament_id: tournamentId,
        name: finalTeamName,
        stream_url: formData.streamUrl || null,
        registration_status: initialStatus
      })
      .select()
      .single()

    if (teamErr || !team) {
      return { error: teamErr?.message || 'Error al registrar el equipo.' }
    }

    // Si es de pago y requiere aprobación, notificar al streamer por correo
    if (initialStatus === 'pending_approval') {
      const { data: streamerProfile } = await adminSupabase
        .from('profiles')
        .select('email, username, organization_name')
        .eq('id', tournament.creator_id)
        .single()

      if (streamerProfile?.email) {
        const { sendRegistrationRequestEmail } = await import('@/lib/services/email')
        await sendRegistrationRequestEmail({
          email: streamerProfile.email,
          streamerName: streamerProfile.organization_name || streamerProfile.username || 'Streamer',
          tournamentName: tournament.name,
          teamName: finalTeamName,
          portalUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/tournaments/${tournament.id}/participants`
        }).catch(e => console.error('Error al enviar correo de solicitud:', e))
      }
    }

    // Sincronizar equipo a ArenaCrypto
    pushToAC('teams', 'upsert', {
      id: team.id,
      tournamentId: team.tournament_id,
      name: team.name,
      avatarUrl: team.avatar_url,
      streamUrl: team.stream_url,
    })

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

        // Si es un compañero y NO tiene su cuenta de juego vinculada/completada, notificarle por correo
        if (!isCaptain && targetUserId && (!teammateGameId || !teammateGameUsername)) {
          const { data: teammateProfile } = await adminSupabase
            .from('profiles')
            .select('email, username')
            .eq('id', targetUserId)
            .single()

          if (teammateProfile?.email) {
            const { sendTeammateRegisteredEmail } = await import('@/lib/services/email')
            const { GAME_LABELS } = await import('./game-accounts')
            const gameLabel = GAME_LABELS[tournament.discipline]?.label || tournament.discipline

            await sendTeammateRegisteredEmail({
              email: teammateProfile.email,
              teammateName: pData.displayName.trim(),
              captainName: pList[0].displayName.trim(),
              tournamentName: tournament.name,
              gameLabel: gameLabel,
              portalUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/t/${tournament.slug}`
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
