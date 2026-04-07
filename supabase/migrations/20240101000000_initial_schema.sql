-- Enums
CREATE TYPE tournament_mode AS ENUM ('individual', 'duos', 'trios', 'cuartetos');
CREATE TYPE competition_format AS ENUM (
  'battle_royale_clasico', 'kill_race', 'custom_rooms',
  'eliminacion_directa', 'fase_de_grupos'
);
CREATE TYPE tournament_level AS ENUM ('casual', 'profesional');
CREATE TYPE tournament_status AS ENUM ('draft', 'active', 'finished');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected');

-- Tournaments
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rules_text TEXT CHECK (char_length(rules_text) <= 5000),
  slug VARCHAR(100) UNIQUE NOT NULL,
  mode tournament_mode NOT NULL,
  format competition_format NOT NULL,
  level tournament_level NOT NULL DEFAULT 'casual',
  status tournament_status NOT NULL DEFAULT 'draft',
  total_matches INTEGER NOT NULL CHECK (total_matches > 0),
  matches_completed INTEGER NOT NULL DEFAULT 0,
  kill_rate_enabled BOOLEAN NOT NULL DEFAULT true,
  pot_top_enabled BOOLEAN NOT NULL DEFAULT true,
  vip_enabled BOOLEAN NOT NULL DEFAULT false,
  tiebreaker_match_enabled BOOLEAN NOT NULL DEFAULT false,
  kill_race_time_limit_minutes INTEGER,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scoring Rules
CREATE TABLE scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  kill_points NUMERIC(6,2) NOT NULL CHECK (kill_points >= 0),
  placement_points JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  vip_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, name)
);

-- Participants
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  display_name VARCHAR(100) NOT NULL,
  contact_id VARCHAR(255),
  is_captain BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, display_name)
);

-- Matches
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_number INTEGER NOT NULL,
  name VARCHAR(100),
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, match_number)
);

-- Submissions
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES participants(id),
  kill_count INTEGER NOT NULL CHECK (kill_count >= 0),
  pot_top BOOLEAN NOT NULL DEFAULT false,
  status submission_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- Evidence files
CREATE TABLE evidence_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team standings
CREATE TABLE team_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  total_points NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_kills INTEGER NOT NULL DEFAULT 0,
  kill_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  pot_top_count INTEGER NOT NULL DEFAULT 0,
  vip_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  rank INTEGER,
  previous_rank INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, team_id)
);

-- Leaderboard themes
CREATE TABLE leaderboard_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL UNIQUE REFERENCES tournaments(id) ON DELETE CASCADE,
  preset_name VARCHAR(50),
  primary_color VARCHAR(7),
  background_type VARCHAR(20),
  background_value TEXT,
  font_family VARCHAR(100),
  logo_url TEXT,
  banner_url TEXT,
  column_order JSONB,
  visible_columns JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bracket rounds
CREATE TABLE bracket_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  round_name VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bracket matchups
CREATE TABLE bracket_matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES bracket_rounds(id) ON DELETE CASCADE,
  team_a_id UUID REFERENCES teams(id),
  team_b_id UUID REFERENCES teams(id),
  winner_id UUID REFERENCES teams(id),
  is_bye BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Groups (Fase de Grupos)
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name VARCHAR(10) NOT NULL,
  advance_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Group teams
CREATE TABLE group_teams (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, team_id)
);
