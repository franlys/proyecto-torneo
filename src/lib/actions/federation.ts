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
