'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { fetchClashRoyalePlayer } from '@/lib/services/clash-royale'
import { getRiotAccountByRiotId, getLolSummonerByPuuid } from '@/lib/services/riot'

export const GAME_LABELS: Record<string, { label: string; idLabel: string; usernameLabel: string; idPlaceholder: string; usernamePlaceholder: string; icon: string }> = {
  warzone:               { label: 'Call of Duty: Warzone',      idLabel: 'Activision ID',        usernameLabel: 'Nombre en Warzone',     idPlaceholder: 'Ej: PlayerName#1234567',     usernamePlaceholder: 'Ej: SniperKing',       icon: '🪂' },
  fortnite:              { label: 'Fortnite',                   idLabel: 'Epic Games ID',         usernameLabel: 'Nombre en Fortnite',    idPlaceholder: 'Ej: EpicUsername',           usernamePlaceholder: 'Ej: BuildMaster99',    icon: '⛏️' },
  free_fire:             { label: 'Free Fire',                  idLabel: 'UID de Free Fire',      usernameLabel: 'Nickname',              idPlaceholder: 'Ej: 123456789',              usernamePlaceholder: 'Ej: FireKing',         icon: '🔥' },
  call_of_duty_mobile:   { label: 'Call of Duty Mobile',        idLabel: 'ID de Jugador',         usernameLabel: 'Nombre en CoD Mobile',  idPlaceholder: 'Ej: 1234567890',             usernamePlaceholder: 'Ej: MobileSniper',     icon: '🔫' },
  valorant:              { label: 'Valorant',                   idLabel: 'Riot ID',               usernameLabel: 'Riot Tag',              idPlaceholder: 'Ej: PlayerName#NA1',         usernamePlaceholder: 'Ej: AimGod#1234',     icon: '🎯' },
  league_of_legends:     { label: 'League of Legends',          idLabel: 'Summoner Name + Tag',   usernameLabel: 'Nombre en LoL',         idPlaceholder: 'Ej: SummonerName#NA1',       usernamePlaceholder: 'Ej: JungleKing',       icon: '🏆' },
  street_fighter_6:      { label: 'Street Fighter 6',           idLabel: 'CFN ID',                usernameLabel: 'Nombre en SF6',         idPlaceholder: 'Ej: CFN_Username',           usernamePlaceholder: 'Ej: HadoukenMaster',   icon: '👊' },
  super_smash_bros_ultimate: { label: 'Super Smash Bros Ultimate', idLabel: 'Nintendo ID',        usernameLabel: 'Nombre en Smash',       idPlaceholder: 'Ej: Nintendo_Username',      usernamePlaceholder: 'Ej: SmashChamp',       icon: '💥' },
  clash_royale:          { label: 'Clash Royale',               idLabel: 'Player Tag',            usernameLabel: 'Nombre en CR',          idPlaceholder: 'Ej: #2PP0YR0',               usernamePlaceholder: 'Ej: RoyaleKing',       icon: '👑' },
}

export async function updateDiscordUsername(
  discordUsername: string,
  discordGuildId?: string | null
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  let cleanGuildId = discordGuildId?.trim() || null
  if (cleanGuildId) {
    const { resolveDiscordGuildId } = await import('@/lib/services/discord')
    const resolved = await resolveDiscordGuildId(cleanGuildId)
    if (resolved) {
      cleanGuildId = resolved
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ 
      discord_username: discordUsername.trim(),
      discord_guild_id: cleanGuildId,
      discord_connected: !!cleanGuildId
    })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { success: true }
}

export async function upsertGameAccount(input: {
  game: string
  gameId: string
  gameUsername: string
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // 1. Anti-Smurf Check: game_id must be unique across all profiles for this game
  const { data: existing } = await supabase
    .from('game_accounts')
    .select('user_id')
    .eq('game', input.game)
    .eq('game_id', input.gameId.trim())
    .maybeSingle()

  if (existing && existing.user_id !== user.id) {
    return { error: 'Esta cuenta de juego ya está vinculada a otro perfil en la plataforma (Anti-Smurf).' }
  }

  let verified = false
  let verificationMeta: any = {}

  // 2. Auto-Verification Logic
  try {
    if (input.game === 'clash_royale') {
      const player = await fetchClashRoyalePlayer(input.gameId.trim())
      if (player && player.tag) {
        verified = player.expLevel >= 5 // Auto-verify if level >= 5
        verificationMeta = {
          trophies: player.trophies,
          expLevel: player.expLevel,
          arena: player.arena?.name || 'Desconocida',
          name: player.name
        }
      }
    } else if (input.game === 'league_of_legends' || input.game === 'valorant') {
      const parts = input.gameId.trim().split('#')
      if (parts.length === 2) {
        const gameName = parts[0]
        const tagLine = parts[1]
        const riotAccount = await getRiotAccountByRiotId(gameName, tagLine)
        if (riotAccount && riotAccount.puuid) {
          verified = true // Account exists on Riot
          verificationMeta = {
            puuid: riotAccount.puuid,
            gameName: riotAccount.gameName,
            tagLine: riotAccount.tagLine
          }

          if (input.game === 'league_of_legends') {
            // Try to fetch summoner level in LA1 region first, fallback to NA1 or LA2
            try {
              let summoner = await getLolSummonerByPuuid(riotAccount.puuid, 'la1')
              verificationMeta = {
                ...verificationMeta,
                level: summoner.summonerLevel,
                profileIconId: summoner.profileIconId
              }
            } catch (err) {
              // Try NA1 region
              try {
                let summoner = await getLolSummonerByPuuid(riotAccount.puuid, 'na1')
                verificationMeta = {
                  ...verificationMeta,
                  level: summoner.summonerLevel,
                  profileIconId: summoner.profileIconId
                }
              } catch (err2) {
                // Ignore error, keep verified = true but without level details
              }
            }
          }
        }
      } else {
        return { error: 'Para juegos de Riot (Valorant/LoL), debes ingresar tu ID con el formato: Nombre#Etiqueta (Ej: Player#NA1)' }
      }
    }
  } catch (apiError: any) {
    console.error('API Verification error during upsert:', apiError.message)
    // Don't crash, just let the account be created but not verified
  }

  const { error } = await supabase
    .from('game_accounts')
    .upsert({
      user_id: user.id,
      game: input.game,
      game_id: input.gameId.trim(),
      game_username: input.gameUsername.trim(),
      verified,
      verification_meta: verificationMeta,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,game' })

  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { success: true }
}

export async function deleteGameAccount(game: string): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('game_accounts')
    .delete()
    .eq('user_id', user.id)
    .eq('game', game)

  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { success: true }
}

export async function getMyGameAccounts(): Promise<{ data: any[] } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data, error } = await supabase
    .from('game_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('game')

  if (error) return { error: error.message }
  return { data: data || [] }
}

export async function getGameAccountForUser(userId: string, game: string): Promise<{ data: { game_id: string; game_username: string } | null } | { error: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('game_accounts')
    .select('game_id, game_username')
    .eq('user_id', userId)
    .eq('game', game)
    .maybeSingle()

  if (error) return { error: error.message }
  return { data }
}

export async function updateTeammateGameCredentials(
  participantId: string,
  game: string,
  gameId: string,
  gameUsername: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const adminSupabase = await createAdminClient()

  // 1. Verify participant belongs to the user
  const { data: participant, error: pErr } = await adminSupabase
    .from('participants')
    .select('id, user_id')
    .eq('id', participantId)
    .single()

  if (pErr || !participant || participant.user_id !== user.id) {
    return { error: 'No tienes permisos para modificar este participante.' }
  }

  // 2. Update participant record
  const { error: partUpdateErr } = await adminSupabase
    .from('participants')
    .update({
      game_id: gameId.trim(),
      game_username: gameUsername.trim(),
    })
    .eq('id', participantId)

  if (partUpdateErr) return { error: partUpdateErr.message }

  // 3. Upsert into game_accounts for future registrations
  const { error: accUpsertErr } = await adminSupabase
    .from('game_accounts')
    .upsert({
      user_id: user.id,
      game: game,
      game_id: gameId.trim(),
      game_username: gameUsername.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,game' })

  if (accUpsertErr) {
    console.error('Error auto-saving game account:', accUpsertErr.message)
  }

  revalidatePath('/tournaments')
  return { success: true }
}
