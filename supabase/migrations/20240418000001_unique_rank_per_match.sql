-- Enforce rank uniqueness per match at the DB level.
-- Only non-rejected submissions count — a rejected submission frees the slot.
-- We use a partial unique index instead of a constraint so we can filter by status.

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_unique_rank_per_match
  ON submissions (match_id, rank)
  WHERE status IN ('pending', 'approved') AND rank IS NOT NULL;
