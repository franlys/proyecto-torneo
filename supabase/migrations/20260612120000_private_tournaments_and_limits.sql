-- Migration: Private Tournaments and Registration Limits
-- Project: Proyecto-Torneos

ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS registration_password VARCHAR(100) DEFAULT NULL;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS max_teams INTEGER DEFAULT NULL;
