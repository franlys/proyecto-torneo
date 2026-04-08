-- Add logo_url column to tournaments table
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS logo_url TEXT;
