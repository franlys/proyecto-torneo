-- Enable RLS on evidence_files table
ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert evidence metadata (Participants/Anon)
-- In a real production app, you might want to restrict this more, 
-- but for current logic we need to allow participants to record their uploads.
CREATE POLICY "Allow public insert to evidence_files"
ON public.evidence_files
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy: Allow public to see evidence metadata (for Leaderboard)
CREATE POLICY "Allow public select from evidence_files"
ON public.evidence_files
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy: Allow service role / admin to manage everything
CREATE POLICY "Allow all manager of evidence_files"
ON public.evidence_files
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
