-- Añadir contador de kills a los participantes individuales para el reporte de Top Fragger
ALTER TABLE participants
ADD COLUMN IF NOT EXISTS total_kills INTEGER DEFAULT 0;

-- Opcional: Index para velocidad en leaderboards individuales
CREATE INDEX IF NOT EXISTS idx_participants_total_kills ON participants(total_kills DESC);
