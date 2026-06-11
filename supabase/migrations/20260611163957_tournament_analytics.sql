-- Create tournament_analytics table
CREATE TABLE IF NOT EXISTS tournament_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'page_view', 'click_stream', 'click_ad'
  path VARCHAR(255) NOT NULL,
  visitor_id VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE tournament_analytics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public insert of analytics" ON tournament_analytics;
DROP POLICY IF EXISTS "Allow admin read of analytics" ON tournament_analytics;

-- Allow anyone to insert analytics
CREATE POLICY "Allow public insert of analytics" 
ON tournament_analytics 
FOR INSERT 
TO public 
WITH CHECK (true);

-- Allow only admins to read analytics
CREATE POLICY "Allow admin read of analytics" 
ON tournament_analytics 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);
