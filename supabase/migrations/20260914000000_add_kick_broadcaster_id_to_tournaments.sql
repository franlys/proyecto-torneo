-- Migration: Add kick_broadcaster_id to tournaments for Kick Private Tournaments v1.0
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS kick_broadcaster_id text NULL;
