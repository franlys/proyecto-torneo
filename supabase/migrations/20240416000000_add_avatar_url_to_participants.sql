-- Sprint 18: Add avatar support for participants
-- Resolve error: Could not find the 'avatar_url' column of 'participants'

-- 1. Add the column to the participants table
ALTER TABLE participants ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Add description for clarity
COMMENT ON COLUMN participants.avatar_url IS 'URL de la imagen de perfil del jugador/participante';

-- 3. Note: If the error persists after running this, 
-- you might need to run "NOTIFY pgrst, 'reload config';" 
-- in the SQL Editor to refresh the PostgREST cache.
