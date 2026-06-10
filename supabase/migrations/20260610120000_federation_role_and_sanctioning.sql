-- 1. Extend user roles to support 'FEDERATION' staff
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'FEDERATION';

-- 2. Add federation fields to tournaments (aval/sanction status)
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_sanctioned BOOLEAN DEFAULT false NOT NULL;

-- 3. Add ranking license status to player profiles (for professional ranking rights)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_ranking_license BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS license_expiry TIMESTAMPTZ;

-- 4. Create policy bypasses/updates so FEDERATION and ADMIN can manage sanctioned cups and rankings
CREATE OR REPLACE FUNCTION is_admin_or_fede(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND (role = 'ADMIN' OR role = 'FEDERATION')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate policy for player stats management
DROP POLICY IF EXISTS "Admins and Fede can manage national stats" ON player_national_stats;
CREATE TABLE IF NOT EXISTS player_national_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
); -- safety check if table exists (it already does)

ALTER TABLE player_national_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select national stats" ON player_national_stats;
CREATE POLICY "Public select national stats" ON player_national_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin and Fede write national stats" ON player_national_stats;
CREATE POLICY "Admin and Fede write national stats" ON player_national_stats FOR ALL USING (
  is_admin_or_fede(auth.uid())
);

-- Recreate policy for sanctioned cups management
DROP POLICY IF EXISTS "Public select sanctioned cups" ON sanctioned_cups;
CREATE POLICY "Public select sanctioned cups" ON sanctioned_cups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin and Fede write sanctioned cups" ON sanctioned_cups;
CREATE POLICY "Admin and Fede write sanctioned cups" ON sanctioned_cups FOR ALL USING (
  is_admin_or_fede(auth.uid())
);
