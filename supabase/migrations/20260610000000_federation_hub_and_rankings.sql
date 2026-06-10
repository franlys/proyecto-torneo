-- 1. Game Disciplines
CREATE TYPE game_discipline AS ENUM (
  'clash_royale',
  'street_fighter_6',
  'super_smash_bros_ultimate',
  'free_fire',
  'fortnite',
  'call_of_duty_mobile'
);

-- 2. Sanctioned Cups (Federation official tournaments)
CREATE TABLE sanctioned_cups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  discipline game_discipline NOT NULL,
  name VARCHAR(255) NOT NULL,
  level VARCHAR(50) NOT NULL DEFAULT 'nacional', -- 'nacional', 'regional', 'mundial'
  organizer VARCHAR(100) NOT NULL DEFAULT 'Kronix & FDDE',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  prize_pool VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming', -- 'upcoming', 'active', 'finished'
  registration_url TEXT,
  banner_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Federation Athlete Profiles (Extending participants or profiles)
CREATE TABLE player_national_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name VARCHAR(100) UNIQUE NOT NULL,
  real_name VARCHAR(150),
  discipline game_discipline NOT NULL,
  rank_position INTEGER DEFAULT 999,
  points INTEGER DEFAULT 0 NOT NULL,
  tournaments_played INTEGER DEFAULT 0 NOT NULL,
  podiums_count INTEGER DEFAULT 0 NOT NULL, -- 1st, 2nd, 3rd places
  win_rate NUMERIC(5,2) DEFAULT 0.00,
  avatar_url TEXT,
  social_twitch TEXT,
  social_twitter TEXT,
  is_national_selected BOOLEAN DEFAULT false NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for fast search and rank retrieval
CREATE INDEX idx_player_national_stats_discipline ON player_national_stats(discipline);
CREATE INDEX idx_player_national_stats_points ON player_national_stats(points DESC);
CREATE INDEX idx_player_national_stats_name ON player_national_stats(display_name);

-- 4. Ad Advertising Placements (Federation / Brand sponsorship slots)
CREATE TABLE advertising_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_name VARCHAR(100) UNIQUE NOT NULL, -- 'home_hero_banner', 'leaderboard_sidebar', 'bracket_footer'
  advertiser_name VARCHAR(150) NOT NULL,
  image_url TEXT NOT NULL,
  click_through_url TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  impressions_count INTEGER DEFAULT 0 NOT NULL,
  clicks_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Initial Data for Demonstration (Clash Royale, SF6, Smash, Free Fire etc.)
INSERT INTO player_national_stats (display_name, real_name, discipline, rank_position, points, tournaments_played, podiums_count, win_rate, is_national_selected, avatar_url)
VALUES 
('MenaRD', 'Saúl Mena', 'street_fighter_6', 1, 5500, 14, 8, 85.50, true, 'https://res.cloudinary.com/dqcwp4bzs/image/upload/v1700000000/menard.png'),
('Crossover', 'Cristhian Guerrero', 'street_fighter_6', 2, 3800, 12, 4, 70.20, true, NULL),
('Jose_CR', 'José Ramos', 'clash_royale', 1, 2950, 10, 5, 75.00, true, NULL),
('Yugi_Smash', 'Bryan Santana', 'super_smash_bros_ultimate', 1, 3100, 15, 6, 78.40, true, NULL),
('FreeFire_Dominican', 'Carlos Méndez', 'free_fire', 1, 2400, 8, 2, 60.00, false, NULL),
('CoDM_RD_Pro', 'Jean Carlos', 'call_of_duty_mobile', 1, 1850, 6, 1, 55.00, false, NULL);

-- Seed Mock Ad Placements for Demonstration
INSERT INTO advertising_placements (slot_name, advertiser_name, image_url, click_through_url, is_active)
VALUES
('home_hero_banner', 'Claro Gaming RD', 'https://via.placeholder.com/1200x200/ff0000/ffffff?text=CLARO+GAMING+-+PATROCINADOR+OFICIAL+FDDE+x+KRONIX', 'https://www.claro.com.do', true),
('leaderboard_sidebar', 'Red Bull RD', 'https://via.placeholder.com/300x600/000080/ffffff?text=RED+BULL+RD+-+DANDO+ALAS+AL+GAMING', 'https://redbull.com', true);
