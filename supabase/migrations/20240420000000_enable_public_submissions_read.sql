-- Enable public read access for submissions 
-- This allows unauthenticated users to see stats calculated from player_kills JSONB
CREATE POLICY "public_read_submissions" ON submissions
  FOR SELECT USING (true);
