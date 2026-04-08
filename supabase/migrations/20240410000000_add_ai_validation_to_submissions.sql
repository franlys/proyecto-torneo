-- Sprint 13: IA Vision Validation Engine

-- 1. Add AI-related fields to submissions
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT 'pending' 
  CHECK (ai_status IN ('pending', 'processing', 'completed', 'failed'));
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_data JSONB;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_confidence FLOAT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_error TEXT;

-- 2. Add index for pending AI tasks
CREATE INDEX IF NOT EXISTS idx_submissions_ai_status ON submissions(ai_status) WHERE ai_status = 'pending';

-- 3. Comment for clarity
COMMENT ON COLUMN submissions.ai_data IS 'Datos extraídos por IA (nombre equipo, kills, rank)';
COMMENT ON COLUMN submissions.ai_status IS 'Estado de la validación por IA Vision';
