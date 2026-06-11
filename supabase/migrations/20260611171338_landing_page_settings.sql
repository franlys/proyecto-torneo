-- Create landing_page_settings table
CREATE TABLE IF NOT EXISTS landing_page_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_title VARCHAR(255) DEFAULT 'EL PORTAL DE LOS E-SPORTS DOMINICANOS' NOT NULL,
  hero_subtitle TEXT DEFAULT 'La herramienta definitiva de clasificación nacional. Consulta estadísticas de atletas, descubre torneos avalados por la Federación y visualiza los rankings de la República Dominicana.' NOT NULL,
  live_ticker_text VARCHAR(255) DEFAULT '● 3 Torneos Activos ahora · 👥 12,450 Espectadores' NOT NULL,
  statistics_ticker_text TEXT DEFAULT '🏆 120+ Torneos Realizados ── 🛡️ 4,500+ Atletas Federados ── 📺 1.2M+ Minutos de Stream' NOT NULL,
  primary_color VARCHAR(10) DEFAULT '#00F5FF' NOT NULL,
  secondary_color VARCHAR(10) DEFAULT '#BD00FF' NOT NULL,
  ambient_video_url TEXT DEFAULT '' NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE landing_page_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read of landing settings" ON landing_page_settings;
DROP POLICY IF EXISTS "Allow admin modify of landing settings" ON landing_page_settings;

-- Allow public read of settings
CREATE POLICY "Allow public read of landing settings" 
ON landing_page_settings 
FOR SELECT 
TO public 
USING (true);

-- Allow only admins to insert/update settings
CREATE POLICY "Allow admin modify of landing settings" 
ON landing_page_settings 
FOR ALL 
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

-- Insert initial record if not exists
INSERT INTO landing_page_settings (hero_title, hero_subtitle, live_ticker_text, statistics_ticker_text, primary_color, secondary_color, ambient_video_url)
SELECT 
  'EL PORTAL DE LOS E-SPORTS DOMINICANOS',
  'La herramienta definitiva de clasificación nacional. Consulta estadísticas de atletas, descubre torneos avalados por la Federación y visualiza los rankings de la República Dominicana.',
  '● 3 Torneos Activos ahora · 👥 12,450 Espectadores',
  '🏆 120+ Torneos Realizados ── 🛡️ 4,500+ Atletas Federados ── 📺 1.2M+ Minutos de Stream',
  '#00F5FF',
  '#BD00FF',
  ''
WHERE NOT EXISTS (SELECT 1 FROM landing_page_settings LIMIT 1);
