-- Migration: Setup RLS policies for advertising_placements
-- This ensures that both public users can read ads and admins can manage them.

ALTER TABLE advertising_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read of advertising placements" ON advertising_placements;
DROP POLICY IF EXISTS "Allow admin full access to advertising placements" ON advertising_placements;

-- Allow anyone (public/anon/auth) to view ads
CREATE POLICY "Allow public read of advertising placements" 
ON advertising_placements FOR SELECT 
TO public 
USING (true);

-- Allow only administrators to manage ads
CREATE POLICY "Allow admin full access to advertising placements"
ON advertising_placements FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);
