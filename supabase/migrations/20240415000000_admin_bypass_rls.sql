-- Admin bypass: users with role='ADMIN' in profiles can access all data

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
$$;

-- tournaments: admin full access
CREATE POLICY "admin_full_access" ON tournaments
  USING (is_admin_user());

-- scoring_rules: admin full access
CREATE POLICY "admin_full_access" ON scoring_rules
  USING (is_admin_user());

-- teams: admin full access
CREATE POLICY "admin_full_access" ON teams
  USING (is_admin_user());

-- participants: admin full access
CREATE POLICY "admin_full_access" ON participants
  USING (is_admin_user());

-- matches: admin full access
CREATE POLICY "admin_full_access" ON matches
  USING (is_admin_user());

-- submissions: admin full access
CREATE POLICY "admin_full_access" ON submissions
  USING (is_admin_user());

-- leaderboard_themes: admin full access
CREATE POLICY "admin_full_access" ON leaderboard_themes
  USING (is_admin_user());

-- streamer_codes: admin full access
CREATE POLICY "admin_full_access" ON streamer_codes
  USING (is_admin_user());
