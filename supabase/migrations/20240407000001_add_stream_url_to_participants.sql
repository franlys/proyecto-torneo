-- Añadir enlace de stream a los participantes individuales
ALTER TABLE participants
ADD COLUMN IF NOT EXISTS stream_url TEXT;

-- Asegurarse de que sea una URL válida si está presente (opcional pero recomendado)
-- ALTER TABLE participants ADD CONSTRAINT valid_participant_stream_url CHECK (stream_url IS NULL OR stream_url ~ '^https?://');
