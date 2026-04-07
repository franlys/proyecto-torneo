-- Add background opacity control to leaderboard themes
-- Value is 0-100 (percentage), default 40 for a nice semi-transparent overlay effect
ALTER TABLE leaderboard_themes 
  ADD COLUMN IF NOT EXISTS background_opacity INTEGER NOT NULL DEFAULT 40 
  CHECK (background_opacity >= 0 AND background_opacity <= 100);
