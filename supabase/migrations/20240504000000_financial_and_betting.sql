-- Migration: Financial Model and Arena Betting Integration
-- Sprint: Integration Phase

-- 1. Create Enums for Betting Status
DO $$ BEGIN
    CREATE TYPE arena_betting_status AS ENUM ('open', 'closed', 'paused');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add Financial and Betting Columns to Tournaments
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS entry_fee NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS prize_1st NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS prize_2nd NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS prize_3rd NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS prize_mvp NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS organizer_split NUMERIC(5,2) DEFAULT 50, -- Percentage
ADD COLUMN IF NOT EXISTS streamer_split NUMERIC(5,2) DEFAULT 50, -- Percentage
ADD COLUMN IF NOT EXISTS total_live_viewers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS arena_betting_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS arena_betting_status arena_betting_status DEFAULT 'closed';

-- 3. Add Stream Metadata to Participants (Optional enrichment for AC)
ALTER TABLE participants
ADD COLUMN IF NOT EXISTS stream_platform VARCHAR(20), -- 'twitch', 'youtube', 'kick'
ADD COLUMN IF NOT EXISTS stream_id VARCHAR(100);

-- 4. Comments for Documentation
COMMENT ON COLUMN tournaments.entry_fee IS 'Cost per team to register (handled in PT)';
COMMENT ON COLUMN tournaments.organizer_split IS 'Percentage of remaining profit for the organizer';
COMMENT ON COLUMN tournaments.arena_betting_enabled IS 'Signals ArenaCrypto to allow community bets';
