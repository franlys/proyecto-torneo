-- Fix: Ensure the 'evidences' bucket is public.
-- If the bucket was created manually in Supabase Studio without checking "Public bucket",
-- all uploaded files return 404 on the /storage/v1/object/public/... URL.

-- 1. Create bucket if it doesn't exist yet (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidences',
  'evidences',
  true,
  52428800,  -- 50 MB limit
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','video/mp4','video/webm']
)
ON CONFLICT (id) DO UPDATE
  SET public = true;  -- Force public = true even if it existed as private

-- 2. Recreate storage policies cleanly (DROP IF EXISTS first to avoid duplicates)
DROP POLICY IF EXISTS "Public access to evidences"             ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads for evidence folder" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to evidences"  ON storage.objects;

-- Public read: anyone can view any file in this bucket
CREATE POLICY "Public access to evidences"
ON storage.objects FOR SELECT
USING ( bucket_id = 'evidences' );

-- Authenticated upload/update/delete (organizers managing assets)
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'evidences' );

CREATE POLICY "Authenticated users can update their avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'evidences' );

CREATE POLICY "Authenticated users can delete their avatars"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'evidences' );

-- Anonymous upload: team portal participants upload match evidence without login
CREATE POLICY "Allow public uploads for evidence folder"
ON storage.objects FOR INSERT
TO anon
WITH CHECK ( bucket_id = 'evidences' );

-- Service role: needed for AI validation download in server actions
CREATE POLICY "Service role full access to evidences"
ON storage.objects FOR ALL
TO service_role
USING ( bucket_id = 'evidences' )
WITH CHECK ( bucket_id = 'evidences' );
