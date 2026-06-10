-- Update is_admin_user() function to include 'FEDERATION' role
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND (role = 'ADMIN' OR role = 'FEDERATION')
  )
$$;

-- Ensure RLS on subscription_requests allows both ADMIN and FEDERATION
DROP POLICY IF EXISTS "Admins can view and update all requests" ON subscription_requests;
CREATE POLICY "Admins can view and update all requests" ON subscription_requests FOR ALL USING (
  is_admin_user()
);
