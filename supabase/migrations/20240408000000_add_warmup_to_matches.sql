-- Add warmup support to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_warmup BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for efficient warmup match queries
CREATE INDEX IF NOT EXISTS idx_matches_is_warmup ON matches(tournament_id, is_warmup);
