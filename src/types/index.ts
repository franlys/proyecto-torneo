// TypeScript types for Tournament Leaderboard Platform
// TODO: Task 2.3 — Full type definitions

export type TournamentMode = 'individual' | 'duos' | 'trios' | 'cuartetos';
export type CompetitionFormat =
  | 'battle_royale_clasico'
  | 'kill_race'
  | 'custom_rooms'
  | 'eliminacion_directa'
  | 'fase_de_grupos';
export type TournamentLevel = 'casual' | 'profesional';
export type TournamentStatus = 'draft' | 'active' | 'finished';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface Tournament {
  id: string;
  creatorId: string;
  name: string;
  description?: string;
  rulesText?: string;
  slug: string;
  mode: TournamentMode;
  format: CompetitionFormat;
  level: TournamentLevel;
  status: TournamentStatus;
  totalMatches: number;
  matchesCompleted: number;
  killRateEnabled: boolean;
  potTopEnabled: boolean;
  vipEnabled: boolean;
  tiebreakerMatchEnabled: boolean;
  killRaceTimeLimitMinutes?: number;
  defaultRoundsPerMatch: number;
  startDate?: string;
  endDate?: string;
}

export interface ScoringRule {
  id: string;
  tournamentId: string;
  killPoints: number;
  placementPoints: Record<string, number>;
}

export interface Team {
  id: string;
  tournamentId: string;
  name: string;
  avatarUrl?: string;
  streamUrl?: string;
  vipScore: number;
}

export interface Participant {
  id: string;
  tournamentId: string;
  teamId?: string;
  displayName: string;
  contactId?: string;
  streamUrl?: string;
  isCaptain: boolean;
  totalKills: number;
}

export interface Submission {
  id: string;
  tournamentId: string;
  teamId: string;
  matchId: string;
  submittedBy: string;
  killCount: number;
  potTop: boolean;
  status: SubmissionStatus;
  rejectionReason?: string;
  submittedAt: string;
  aiStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  aiData?: any;
  aiConfidence?: number;
  aiError?: string;
  playerKills?: Record<string, number>;
}

export interface Match {
  id: string;
  tournamentId: string;
  name: string;
  matchNumber: number;
  isCompleted: boolean;
  isWarmup: boolean;
  parentMatchId?: string;
  roundNumber: number;
  mapName?: string;
  createdAt: string;
}

export interface TeamStanding {
  teamId: string;
  teamName: string;
  avatarUrl?: string;
  streamUrl?: string;
  streams?: { name: string; url: string }[];
  totalPoints: number;
  totalKills: number;
  killRate: number;
  potTopCount: number;
  vipScore: number;
  rank: number;
  previousRank?: number;
}

export interface LeaderboardTheme {
  presetName?: string;
  primaryColor: string;
  backgroundType: 'solid' | 'gradient' | 'image';
  backgroundValue: string;
  fontFamily: string;
  logoUrl?: string;
  bannerUrl?: string;
  columnOrder: string[];
  visibleColumns: Record<string, boolean>;
}

export interface BracketRound {
  roundNumber: number;
  roundName: string;
  matchups: BracketMatchup[];
}

export interface BracketMatchup {
  id: string;
  teamA?: Team;
  teamB?: Team;
  winner?: Team;
  isBye: boolean;
}

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  order: number;
}
