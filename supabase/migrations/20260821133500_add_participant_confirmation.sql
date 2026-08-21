-- Migration: Add Participant Confirmation and Discord Connection Status
-- Project: Proyecto-Torneos

-- 1. Add columns to participants table
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discord_connected BOOLEAN NOT NULL DEFAULT false;

-- 2. Add comment explaining columns
COMMENT ON COLUMN public.participants.is_confirmed IS 'Indicates if the team member has confirmed their participation in the tournament.';
COMMENT ON COLUMN public.participants.discord_connected IS 'Indicates if the participant has verified/connected their Discord account for this registration.';
