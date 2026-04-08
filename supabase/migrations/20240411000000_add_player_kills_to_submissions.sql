-- Añadir soporte para desglose de kills individuales por jugador en cada envío
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS player_kills JSONB DEFAULT '{}';

-- Comentario para documentación
COMMENT ON COLUMN submissions.player_kills IS 'Objeto JSON con el formato {participant_id: kills} para mostrar el desglose individual.';
