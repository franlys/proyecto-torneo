-- Migration: Game Accounts Verification, Anti-Smurf Unique Constraint & Discord Profile Connection

-- 1. Add verified and verification_meta columns to game_accounts
ALTER TABLE public.game_accounts 
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS verification_meta JSONB DEFAULT '{}'::jsonb NOT NULL;

-- 2. Clean up any existing duplicate game_id entries before adding UNIQUE constraint (keeps the newest updated one)
DELETE FROM public.game_accounts a USING public.game_accounts b
WHERE a.id < b.id 
  AND a.game = b.game 
  AND LOWER(TRIM(a.game_id)) = LOWER(TRIM(b.game_id));

-- 3. Add UNIQUE constraint to prevent multiple users from using the same game account (anti-smurf)
ALTER TABLE public.game_accounts 
  DROP CONSTRAINT IF EXISTS game_accounts_game_game_id_key;

ALTER TABLE public.game_accounts 
  ADD CONSTRAINT game_accounts_game_game_id_key UNIQUE (game, game_id);

-- 4. Add discord_username column to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS discord_username TEXT;
