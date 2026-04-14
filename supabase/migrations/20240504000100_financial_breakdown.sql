-- Migration: Tournament Financials
-- Project: Proyecto-torneos (PT)

CREATE TABLE IF NOT EXISTS tournament_financials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL UNIQUE REFERENCES tournaments(id) ON DELETE CASCADE,
    total_revenue NUMERIC(15,2) DEFAULT 0,
    total_prizes NUMERIC(15,2) DEFAULT 0,
    remainder NUMERIC(15,2) DEFAULT 0,
    organizer_payout NUMERIC(15,2) DEFAULT 0,
    streamer_payout NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE tournament_financials IS 'Stores the final financial breakdown of a tournament based on team inscriptions and prize distribution';
