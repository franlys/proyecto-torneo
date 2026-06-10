'use server'

import { createClient } from '@/lib/supabase/server'

export type GameDiscipline = 
  | 'clash_royale'
  | 'street_fighter_6'
  | 'super_smash_bros_ultimate'
  | 'free_fire'
  | 'fortnite'
  | 'call_of_duty_mobile'

export interface NationalPlayerStats {
  id: string
  displayName: string
  realName: string | null
  discipline: GameDiscipline
  rankPosition: number
  points: number
  tournamentsPlayed: number
  podiumsCount: number
  winRate: number
  avatarUrl: string | null
  socialTwitch?: string
  socialTwitter?: string
  isNationalSelected: boolean
}

export interface SanctionedCup {
  id: string
  tournamentId: string | null
  discipline: GameDiscipline
  name: string
  level: string
  organizer: string
  startDate: string | null
  endDate: string | null
  prizePool: string | null
  status: 'upcoming' | 'active' | 'finished'
  registrationUrl?: string
  bannerUrl?: string
}

export interface AdBanner {
  id: string
  slotName: string
  advertiserName: string
  imageUrl: string
  clickThroughUrl: string | null
  isActive: boolean
}

/**
 * Fetch the national rankings filterable by discipline and search query
 */
export async function getNationalRankings(
  discipline?: GameDiscipline,
  searchQuery?: string
): Promise<{ data: NationalPlayerStats[] } | { error: string }> {
  try {
    const supabase = await createClient()
    let query = supabase
      .from('player_national_stats')
      .select('*')
      .order('points', { ascending: false })

    if (discipline) {
      query = query.eq('discipline', discipline)
    }

    if (searchQuery) {
      query = query.ilike('display_name', `%${searchQuery}%`)
    }

    const { data, error } = await query

    if (error) throw error

    const formatted: NationalPlayerStats[] = (data || []).map((row, idx) => ({
      id: row.id,
      displayName: row.display_name,
      realName: row.real_name,
      discipline: row.discipline as GameDiscipline,
      rankPosition: idx + 1, // Recalculated ranking by points sorted descending
      points: row.points,
      tournamentsPlayed: row.tournaments_played,
      podiumsCount: row.podiums_count,
      winRate: Number(row.win_rate),
      avatarUrl: row.avatar_url,
      isNationalSelected: row.is_national_selected,
    }))

    return { data: formatted }
  } catch (err: any) {
    return { error: err.message || 'Error al cargar rankings' }
  }
}

/**
 * Fetch all sanctioned cups
 */
export async function getSanctionedCups(): Promise<{ data: SanctionedCup[] } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sanctioned_cups')
      .select('*')
      .order('start_date', { ascending: true })

    if (error) throw error

    const formatted: SanctionedCup[] = (data || []).map(row => ({
      id: row.id,
      tournamentId: row.tournament_id,
      discipline: row.discipline as GameDiscipline,
      name: row.name,
      level: row.level,
      organizer: row.organizer,
      startDate: row.start_date,
      endDate: row.end_date,
      prizePool: row.prize_pool,
      status: row.status as any,
      registrationUrl: row.registration_url,
      bannerUrl: row.banner_url,
    }))

    return { data: formatted }
  } catch (err: any) {
    return { error: err.message || 'Error al obtener copas oficiales' }
  }
}

/**
 * Fetch active advertisement placements
 */
export async function getAdBanners(): Promise<{ data: AdBanner[] } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('advertising_placements')
      .select('*')
      .eq('is_active', true)

    if (error) throw error

    const formatted: AdBanner[] = (data || []).map(row => ({
      id: row.id,
      slotName: row.slot_name,
      advertiserName: row.advertiser_name,
      imageUrl: row.image_url,
      clickThroughUrl: row.click_through_url,
      isActive: row.is_active,
    }))

    return { data: formatted }
  } catch (err: any) {
    return { error: err.message || 'Error al obtener banners publicitarios' }
  }
}

/**
 * Toggle the sanctioned (avalado) status of a tournament (Admin or Federation staff only)
 */
export async function toggleTournamentSanction(
  tournamentId: string,
  isSanctioned: boolean
): Promise<{ success: boolean } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    // Check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'FEDERATION')) {
      return { error: 'No tienes permisos para avalar torneos' }
    }

    const { error } = await supabase
      .from('tournaments')
      .update({ is_sanctioned: isSanctioned })
      .eq('id', tournamentId)

    if (error) throw error

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al cambiar aval de torneo' }
  }
}

/**
 * Toggle the professional ranking license for a streamer (Admin or Federation only)
 */
export async function toggleRankingLicense(
  streamerId: string,
  hasLicense: boolean
): Promise<{ success: boolean } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'FEDERATION')) {
      return { error: 'No tienes permisos para otorgar licencias de ranking' }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ 
        has_ranking_license: hasLicense,
        license_expiry: hasLicense ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null // 1 Year licence
      })
      .eq('id', streamerId)

    if (error) throw error

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al gestionar licencia de ranking' }
  }
}

/**
 * Create or Update a player's national ranking statistics (Admin or Federation only)
 */
export async function updateNationalRankingPlayer(
  playerData: Partial<NationalPlayerStats> & { displayName: string; discipline: GameDiscipline }
): Promise<{ success: boolean } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'No autenticado' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'FEDERATION')) {
      return { error: 'No tienes permisos para modificar rankings nacionales' }
    }

    const payload = {
      display_name: playerData.displayName,
      real_name: playerData.realName ?? null,
      discipline: playerData.discipline,
      points: playerData.points ?? 0,
      tournaments_played: playerData.tournamentsPlayed ?? 0,
      podiums_count: playerData.podiumsCount ?? 0,
      win_rate: playerData.winRate ?? 0.00,
      is_national_selected: playerData.isNationalSelected ?? false,
      avatar_url: playerData.avatarUrl ?? null
    }

    const { error } = await supabase
      .from('player_national_stats')
      .upsert(payload, { onConflict: 'display_name' })

    if (error) throw error

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Error al actualizar jugador de ranking' }
  }
}
