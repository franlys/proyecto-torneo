-- Run this in your Supabase SQL Editor

ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0;

-- Update the TypeScript interface if necessary (already done in codebase)
