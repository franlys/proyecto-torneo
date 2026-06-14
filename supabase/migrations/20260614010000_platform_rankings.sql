-- Add discipline and badge_url to tournaments
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS discipline VARCHAR(50) DEFAULT 'warzone' NOT NULL;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS badge_url TEXT;

-- Table for aggregate user points by discipline
CREATE TABLE IF NOT EXISTS public.user_discipline_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    discipline VARCHAR(50) NOT NULL,
    points NUMERIC(8,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, discipline)
);

-- Table for historical point awards (for time-series charts)
CREATE TABLE IF NOT EXISTS public.user_points_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    discipline VARCHAR(50) NOT NULL,
    points_awarded NUMERIC(6,2) NOT NULL,
    rank_achieved INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for badges earned by participants in tournaments
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    badge_url TEXT NOT NULL,
    name VARCHAR(150) NOT NULL,
    rank_achieved INTEGER NOT NULL,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for new tables
ALTER TABLE public.user_discipline_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Select policies (public read)
CREATE POLICY "Rankings are readable by everyone" ON public.user_discipline_rankings FOR SELECT USING (true);
CREATE POLICY "Points history is readable by everyone" ON public.user_points_history FOR SELECT USING (true);
CREATE POLICY "Badges are readable by everyone" ON public.user_badges FOR SELECT USING (true);

-- Insert/Update policies (Admin only or system level via service role, but for RLS, admin can read/write everything)
CREATE POLICY "Admins can manage rankings" ON public.user_discipline_rankings FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Admins can manage points history" ON public.user_points_history FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Admins can manage badges" ON public.user_badges FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
