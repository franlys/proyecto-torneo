-- Migración para añadir stream_url a la tabla tournaments
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS stream_url text;
