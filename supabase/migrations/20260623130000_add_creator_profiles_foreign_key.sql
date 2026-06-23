-- Migration: Add foreign key constraint from tournaments.creator_id to profiles(id)
-- This allows PostgREST / supabase-js to perform joins between tournaments and profiles

ALTER TABLE public.tournaments
ADD CONSTRAINT fk_tournaments_creator_profile
FOREIGN KEY (creator_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;
