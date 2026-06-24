-- Migration: Fix tournaments RLS policy to allow public select for pending tournaments
-- This fixes the issue where players get a "No se encontró el torneo" error during registration

DROP POLICY IF EXISTS "public_read_active" ON public.tournaments;

CREATE POLICY "public_read_active" ON public.tournaments
  FOR SELECT USING (status IN ('pending', 'active', 'finished'));
