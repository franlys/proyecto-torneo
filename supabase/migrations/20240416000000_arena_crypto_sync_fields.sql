-- ─────────────────────────────────────────────────────────────────────────────
-- Arena Crypto sync fields
-- Adds tournament_type, rank, player_kills, and is_warmup so that the AC
-- sync service can read the fields it expects.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: tournament_type on tournaments
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS tournament_type TEXT
  DEFAULT 'battle_royale'
  CHECK (tournament_type IN (
    'battle_royale',
    'kill_race',
    'deathmatch',
    'eliminacion_directa',
    'custom'
  ));

-- Populate from existing format column
UPDATE public.tournaments
SET tournament_type = CASE
  WHEN format::TEXT IN ('kill_race', 'killrace')  THEN 'kill_race'
  WHEN format::TEXT = 'battle_royale_clasico'     THEN 'battle_royale'
  WHEN format::TEXT = 'eliminacion_directa'       THEN 'eliminacion_directa'
  WHEN format::TEXT = 'custom_rooms'              THEN 'custom'
  ELSE 'battle_royale'
END
WHERE tournament_type IS NULL OR tournament_type = 'battle_royale';

-- Step 2: Mark XVI COUP (and any kill_race format) as kill_race
UPDATE public.tournaments
SET tournament_type = 'kill_race'
WHERE slug = 'xvi-coup'
   OR name ILIKE '%XVI%COUP%'
   OR format::TEXT = 'kill_race';

-- Step 3: rank on submissions
ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS rank INTEGER;

-- Backfill from team_standings where available
UPDATE public.submissions s
SET rank = ts.rank
FROM public.team_standings ts
WHERE ts.team_id    = s.team_id
  AND ts.tournament_id = s.tournament_id
  AND s.rank IS NULL;

-- Step 4: player_kills on submissions
ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS player_kills JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_submissions_player_kills
  ON public.submissions USING gin(player_kills);

-- Step 5: is_warmup on matches
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS is_warmup BOOLEAN NOT NULL DEFAULT false;

-- Step 6: Ensure anon key can read all fields (idempotent policies)
DO $$ BEGIN
  CREATE POLICY "Public read matches" ON public.matches FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public read submissions" ON public.submissions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
