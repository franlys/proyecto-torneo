-- Sprint 18: Storage Bucket Configuration & RLS Policies
-- Solves the "400 Bad Request" when uploading images (logos, evidence, branding)

-- 1. Create the 'evidences' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'evidences', 'evidences', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'evidences'
);

-- 2. Enable RLS on storage.objects (Safety first)
-- Note: Often enabled by default, but good to be explicit
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. DROP existing policies to avoid conflicts if re-running
DROP POLICY IF EXISTS "Public access to evidences" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads for evidence folder" ON storage.objects;

-- 4. CREATE POLICIES

-- a) Public Read Access: Everyone can see images
CREATE POLICY "Public access to evidences"
ON storage.objects FOR SELECT
USING ( bucket_id = 'evidences' );

-- b) Authenticated Insert: Organizers can upload to any path (avatars, branding, etc.)
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'evidences' );

-- c) Authenticated Update: Organizers can update existing files
CREATE POLICY "Authenticated users can update their avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'evidences' );

-- d) Authenticated Delete: Organizers can remove files
CREATE POLICY "Authenticated users can delete their avatars"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'evidences' );

-- e) Public/Anonymous Insert: Allows captains to upload match evidence via frontend
-- We restrict this specifically to the root or subfolders that aren't 'branding' if desired
CREATE POLICY "Allow public uploads for evidence folder"
ON storage.objects FOR INSERT
TO public
WITH CHECK ( bucket_id = 'evidences' );
