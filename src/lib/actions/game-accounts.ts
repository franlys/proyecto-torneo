'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

export async function upsertGameAccount(input: {
  game: string
  gameId: string
  gameUsername: string
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('game_accounts')
    .upsert({
      user_id: user.id,
      game: input.game,
      game_id: input.gameId.trim(),
      game_username: input.gameUsername.trim(),
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
