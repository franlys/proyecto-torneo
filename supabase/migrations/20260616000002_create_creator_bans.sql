-- Create creator_bans table
CREATE TABLE IF NOT EXISTS creator_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name VARCHAR(100) NOT NULL,
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  source_tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL
);
