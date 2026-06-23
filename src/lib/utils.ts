import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Tournament } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getOptimizedImageUrl(url?: string | null, width = 150, height = 150) {
  if (!url) return ''
  // Si el plan de Supabase es de nivel gratuito (Free Tier), la API de transformación (/render/image/) 
  // da error 404/403. Retornamos la URL directa del almacenamiento para asegurar la visualización.
  return url
}

export function mapTournamentRow(row: Record<string, unknown>): Tournament {
  return {
    id: row.id as string,
    creatorId: row.creator_id as string,
    collaboratorId: row.collaborator_id as string | undefined | null,
    name: row.name as string,
    description: row.description as string | undefined,
    rulesText: row.rules_text as string | undefined,
    slug: row.slug as string,
    mode: row.mode as Tournament['mode'],
    format: row.format as Tournament['format'],
    level: row.level as Tournament['level'],
    status: row.status as Tournament['status'],
    totalMatches: row.total_matches as number,
    matchesCompleted: row.matches_completed as number,
    killRateEnabled: row.kill_rate_enabled as boolean,
    potTopEnabled: row.pot_top_enabled as boolean,
    vipEnabled: row.vip_enabled as boolean,
    tiebreakerMatchEnabled: row.tiebreaker_match_enabled as boolean,
    killRaceTimeLimitMinutes: row.kill_race_time_limit_minutes as number | undefined,
    defaultRoundsPerMatch: row.default_rounds_per_match as number,
    startDate: row.start_date as string | undefined,
    endDate: row.end_date as string | undefined,
    championImageUrl: row.champion_image_url as string | undefined,
    logoUrl: row.logo_url as string | undefined,
    hideLogoInLeaderboard: row.hide_logo_in_leaderboard as boolean,
    // Finance Model
    entryFee: Number(row.entry_fee || 0),
    prize1st: Number(row.prize_1st || 0),
    prize2nd: Number(row.prize_2nd || 0),
    prize3rd: Number(row.prize_3rd || 0),
    prizeMvp: Number(row.prize_mvp || 0),
    organizerSplit: Number(row.organizer_split || 50),
    streamerSplit: Number(row.streamer_split || 50),
    // Arena Betting
    arenaBettingEnabled: row.arena_betting_enabled as boolean,
    arenaBettingStatus: row.arena_betting_status as Tournament['arenaBettingStatus'],
    totalLiveViewers: row.total_live_viewers as number,
    // Arena Crypto sync
    tournamentType: (row.tournament_type as Tournament['tournamentType']) ?? 'battle_royale',
    // Registration & Capacity
    maxTeams: row.max_teams !== undefined && row.max_teams !== null ? Number(row.max_teams) : null,
    isPrivate: row.is_private as boolean | undefined,
    registrationPassword: row.registration_password as string | undefined | null,
    registrationStartDate: row.registration_start_date as string | undefined | null,
    registrationEndDate: row.registration_end_date as string | undefined | null,
    clashRoyaleTag: row.clash_royale_tag as string | undefined | null,
    discipline: (row.discipline as string) || 'warzone',
    badgeUrl: row.badge_url as string | undefined | null,
    streamUrl: row.stream_url as string | undefined | null,
    maxPointsLimit: row.max_points_limit !== undefined && row.max_points_limit !== null ? Number(row.max_points_limit) : null,
  }
}
