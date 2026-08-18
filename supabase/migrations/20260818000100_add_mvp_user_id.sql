-- Migration to add mvp_user_id tracking to tournaments

ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS mvp_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
