-- Add warmup configuration to tournaments table
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS warmup_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS warmup_match_count INTEGER NOT NULL DEFAULT 1 CHECK (warmup_match_count >= 1 AND warmup_match_count <= 10);
