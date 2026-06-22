-- Migration: Streamer Portals, Staff Management, and Support Ticket System
-- Project: Kronix Multi-Tenant Platform

-- 1. Extend user roles enum
-- In PostgreSQL, ALTER TYPE ... ADD VALUE cannot be executed inside a transaction block.
-- If Supabase CLI runs it inside a transaction, we use a check or run it.
-- Supabase supports ALTER TYPE ADD VALUE in migrations.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'KRONIX_STAFF';

-- 2. Add custom organization, email, and contact fields to Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_details TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discord_link TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_link TEXT;

-- Backfill emails for existing profiles from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- Update trigger function to automatically save email on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, email)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'username',
    -- First user ever gets ADMIN automatically for ease of setup
    CASE WHEN (SELECT COUNT(*) FROM public.profiles) = 0 THEN 'ADMIN'::user_role ELSE 'STREAMER'::user_role END,
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Streamer Staff Table
CREATE TABLE IF NOT EXISTS public.streamer_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streamer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'staff', -- 'admin', 'moderator', 'analyst'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (streamer_id, staff_id)
);

-- 4. Create Streamer Staff Invitations Table
CREATE TABLE IF NOT EXISTS public.streamer_staff_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streamer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'staff',
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'expired'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (streamer_id, email)
);

-- 5. Create Support Tickets Table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    streamer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Create Support Ticket Messages Table (For conversation thread)
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Helper Security-Definer Functions for RLS
-- To avoid recursion, we query tables using SECURITY DEFINER and STABLE tags.

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'ADMIN' OR role = 'SUPER_ADMIN')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_kronix_staff_user(user_uuid UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_uuid AND (role = 'ADMIN' OR role = 'SUPER_ADMIN' OR role = 'KRONIX_STAFF')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff_of_creator(creator_uuid UUID, staff_uuid UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.streamer_staff
    WHERE streamer_id = creator_uuid AND staff_id = staff_uuid
  )
$$;

-- 8. Enable RLS on new tables
ALTER TABLE public.streamer_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streamer_staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- 9. Policies for Streamer Staff
CREATE POLICY "streamer_staff_select_policy" ON public.streamer_staff
    FOR SELECT USING (
        auth.uid() = streamer_id 
        OR auth.uid() = staff_id 
        OR public.is_kronix_staff_user(auth.uid())
    );

CREATE POLICY "streamer_staff_modify_policy" ON public.streamer_staff
    FOR ALL USING (
        auth.uid() = streamer_id 
        OR public.is_admin_user()
    );

-- 10. Policies for Streamer Staff Invitations
CREATE POLICY "invitations_select_policy" ON public.streamer_staff_invitations
    FOR SELECT USING (
        auth.uid() = streamer_id 
        OR email = auth.jwt() ->> 'email'
        OR public.is_kronix_staff_user(auth.uid())
    );

CREATE POLICY "invitations_modify_policy" ON public.streamer_staff_invitations
    FOR ALL USING (
        auth.uid() = streamer_id 
        OR public.is_admin_user()
    );

-- 11. Policies for Support Tickets
CREATE POLICY "tickets_select_policy" ON public.support_tickets
    FOR SELECT USING (
        auth.uid() = streamer_id 
        OR public.is_kronix_staff_user(auth.uid())
    );

CREATE POLICY "tickets_insert_policy" ON public.support_tickets
    FOR INSERT WITH CHECK (
        auth.uid() = streamer_id
    );

CREATE POLICY "tickets_update_policy" ON public.support_tickets
    FOR UPDATE USING (
        auth.uid() = streamer_id
        OR public.is_kronix_staff_user(auth.uid())
    );

-- 12. Policies for Support Ticket Messages
CREATE POLICY "messages_select_policy" ON public.support_ticket_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.support_tickets t
            WHERE t.id = ticket_id 
              AND (t.streamer_id = auth.uid() OR public.is_kronix_staff_user(auth.uid()))
        )
    );

CREATE POLICY "messages_insert_policy" ON public.support_ticket_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND 
        EXISTS (
            SELECT 1 FROM public.support_tickets t
            WHERE t.id = ticket_id 
              AND (t.streamer_id = auth.uid() OR public.is_kronix_staff_user(auth.uid()))
        )
    );

-- 13. Reconfigure Tournaments RLS Policies to support Staff & Staff Support override
DROP POLICY IF EXISTS "creator_full_access" ON public.tournaments;
CREATE POLICY "creator_full_access" ON public.tournaments
    FOR ALL USING (
        creator_id = auth.uid() 
        OR public.is_staff_of_creator(creator_id, auth.uid())
        OR public.is_kronix_staff_user(auth.uid())
    );

-- Reconfigure other tables RLS check to support Streamer Staff and Kronix Staff overrides
-- For teams
DROP POLICY IF EXISTS "creator_manage" ON public.teams;
CREATE POLICY "creator_manage" ON public.teams
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = tournament_id 
              AND (t.creator_id = auth.uid() OR public.is_staff_of_creator(t.creator_id, auth.uid()) OR public.is_kronix_staff_user(auth.uid()))
        )
    );

-- For participants
DROP POLICY IF EXISTS "creator_manage" ON public.participants;
CREATE POLICY "creator_manage" ON public.participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = tournament_id 
              AND (t.creator_id = auth.uid() OR public.is_staff_of_creator(t.creator_id, auth.uid()) OR public.is_kronix_staff_user(auth.uid()))
        )
    );

-- For matches
DROP POLICY IF EXISTS "creator_manage" ON public.matches;
CREATE POLICY "creator_manage" ON public.matches
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = tournament_id 
              AND (t.creator_id = auth.uid() OR public.is_staff_of_creator(t.creator_id, auth.uid()) OR public.is_kronix_staff_user(auth.uid()))
        )
    );

-- For scoring rules
DROP POLICY IF EXISTS "creator_manage" ON public.scoring_rules;
CREATE POLICY "creator_manage" ON public.scoring_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = tournament_id 
              AND (t.creator_id = auth.uid() OR public.is_staff_of_creator(t.creator_id, auth.uid()) OR public.is_kronix_staff_user(auth.uid()))
        )
    );

-- For leaderboard themes
DROP POLICY IF EXISTS "creator_manage" ON public.leaderboard_themes;
CREATE POLICY "creator_manage" ON public.leaderboard_themes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = tournament_id 
              AND (t.creator_id = auth.uid() OR public.is_staff_of_creator(t.creator_id, auth.uid()) OR public.is_kronix_staff_user(auth.uid()))
        )
    );

-- For submissions
DROP POLICY IF EXISTS "creator_manage_submissions" ON public.submissions;
CREATE POLICY "creator_manage_submissions" ON public.submissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tournaments t 
            WHERE t.id = submissions.tournament_id 
              AND (t.creator_id = auth.uid() OR public.is_staff_of_creator(t.creator_id, auth.uid()) OR public.is_kronix_staff_user(auth.uid()))
        )
    );
