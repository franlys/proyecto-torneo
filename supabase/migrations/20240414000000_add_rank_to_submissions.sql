-- Add rank column to submissions table
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS rank INTEGER;

-- Comment for documentation
COMMENT ON COLUMN submissions.rank IS 'The placement rank achieved by the team in this match (e.g., 1 for Top 1, 2 for Top 2, etc.)';
