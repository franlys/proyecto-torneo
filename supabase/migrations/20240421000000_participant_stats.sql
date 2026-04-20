-- Add pre-tournament stats fields to participants
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS kd_ratio          NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS avg_kills         NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS classification_rank TEXT,
  ADD COLUMN IF NOT EXISTS br_avg_placement  NUMERIC(5,1);
