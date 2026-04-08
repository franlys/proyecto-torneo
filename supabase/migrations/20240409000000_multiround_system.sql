-- Sprint 9: Multiround Match System

-- 1. Add rounds support to tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS default_rounds_per_match INTEGER DEFAULT 1;

-- 2. Add hierarchical structure to matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS parent_match_id UUID REFERENCES matches(id) ON DELETE CASCADE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round_number INTEGER DEFAULT 1;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS map_name TEXT;

-- 3. Add index for grouped matches
CREATE INDEX IF NOT EXISTS idx_matches_parent_match_id ON matches(parent_match_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_rounds ON matches(tournament_id, parent_match_id, round_number);

-- 4. Update submissions to specifically target a round
-- Conceptually, match_id in submissions will now point to a CHILD match (the round) 
-- if it's a multiround encounter, or to the match itself if it's single round.
