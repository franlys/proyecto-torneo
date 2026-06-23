-- Migration: Add Registration Status, Payment Evidence to Teams and Discord URL to Tournaments
-- Project: Proyecto-Torneos

-- 1. Add discord_url to tournaments
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS discord_url TEXT;

-- 2. Add registration_status and payment_evidence_url to teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS registration_status VARCHAR(50) NOT NULL DEFAULT 'confirmed';
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS payment_evidence_url TEXT;

-- Add comment explaining status values
COMMENT ON COLUMN public.teams.registration_status IS 'Status of the team registration. Values: pending_approval, approved_to_pay, pending_payment_validation, confirmed';
