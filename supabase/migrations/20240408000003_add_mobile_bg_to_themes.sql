-- Add mobile background support to leaderboard themes
ALTER TABLE leaderboard_themes 
  ADD COLUMN IF NOT EXISTS background_mobile_value TEXT;
