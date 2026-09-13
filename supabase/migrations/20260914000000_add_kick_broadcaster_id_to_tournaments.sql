-- Migration: Add kick_broadcaster_id and kick_subs_type to tournaments
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS kick_broadcaster_id text NULL,
ADD COLUMN IF NOT EXISTS kick_subs_type text NULL DEFAULT 'all';

-- Reload schema cache in PostgREST
NOTIFY pgrst, 'reload schema';
