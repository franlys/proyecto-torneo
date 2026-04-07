-- Add stream_url to teams table
ALTER TABLE teams ADD COLUMN stream_url TEXT;

-- Update leaderboard_themes to check for Kick.com backgrounds (already in client code)
-- but ensuring schema is intact.
