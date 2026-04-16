-- Add is_active to matches so AC knows which match is currently live
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;

-- Only one match per tournament should be active at a time.
-- Enforced at app level, but we add an index for fast querying.
CREATE INDEX IF NOT EXISTS idx_matches_active
  ON public.matches (tournament_id, is_active)
  WHERE is_active = true;
