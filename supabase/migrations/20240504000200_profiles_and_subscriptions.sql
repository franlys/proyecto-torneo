-- Migration: Profiles, Subscriptions and Admin Access
-- Project: Proyecto-Torneos (PT)

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'STREAMER', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE sub_status AS ENUM ('NONE', 'PENDING', 'ACTIVE', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE sub_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    role user_role DEFAULT 'STREAMER',
    subscription_status sub_status DEFAULT 'NONE',
    subscription_expiry TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SUBSCRIPTION REQUESTS (For the $15 Manual Payment)
CREATE TABLE IF NOT EXISTS public.subscription_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) DEFAULT 15.00,
    evidence_url TEXT NOT NULL, -- Image of the payment receipt
    status sub_request_status DEFAULT 'PENDING',
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. STREAMER CODES (Centralized here, AC will read from here)
CREATE TABLE IF NOT EXISTS public.streamer_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    streamer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    streamer_name TEXT NOT NULL, -- To support streamers not registered in PT yet
    code VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TRIGGER: Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'username',
    -- First user ever gets ADMIN automatically for ease of setup
    CASE WHEN (SELECT COUNT(*) FROM public.profiles) = 0 THEN 'ADMIN'::user_role ELSE 'STREAMER'::user_role END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE streamer_codes ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can see all, but only edit their own
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Subscription Requests: Users only see their own, Admin sees all
DROP POLICY IF EXISTS "Users can view their own requests" ON subscription_requests;
CREATE POLICY "Users can view their own requests" ON subscription_requests FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own requests" ON subscription_requests;
CREATE POLICY "Users can create their own requests" ON subscription_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view and update all requests" ON subscription_requests;
CREATE POLICY "Admins can view and update all requests" ON subscription_requests FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Streamer Codes: Public Read (for AC Bridge), Admin Write
DROP POLICY IF EXISTS "Anyone can read active codes" ON streamer_codes;
CREATE POLICY "Anyone can read active codes" ON streamer_codes FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins/Tournament Creators can manage codes" ON streamer_codes;
CREATE POLICY "Admins/Tournament Creators can manage codes" ON streamer_codes FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    OR
    EXISTS (SELECT 1 FROM tournaments WHERE id = tournament_id AND creator_id = auth.uid())
);
