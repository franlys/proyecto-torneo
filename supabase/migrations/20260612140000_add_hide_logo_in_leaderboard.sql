-- Migration: Add hide_logo_in_leaderboard to tournaments
-- Project: Proyecto-Torneos

ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS hide_logo_in_leaderboard BOOLEAN DEFAULT false;
