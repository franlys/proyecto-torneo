const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.otssvwinchttedisfqtr:Progreso070901*@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

const sql = `
-- 1. Nueva tabla de cuentas de juego por usuario
CREATE TABLE IF NOT EXISTS public.game_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game          text NOT NULL,
  game_id       text NOT NULL,
  game_username text NOT NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(user_id, game)
);

-- Enable RLS
ALTER TABLE public.game_accounts ENABLE ROW LEVEL SECURITY;

-- Policies (using drop-before-create pattern to avoid duplicate object errors)
DROP POLICY IF EXISTS "Users can read their own game accounts" ON public.game_accounts;
CREATE POLICY "Users can read their own game accounts"
  ON public.game_accounts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own game accounts" ON public.game_accounts;
CREATE POLICY "Users can insert their own game accounts"
  ON public.game_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own game accounts" ON public.game_accounts;
CREATE POLICY "Users can update their own game accounts"
  ON public.game_accounts FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own game accounts" ON public.game_accounts;
CREATE POLICY "Users can delete their own game accounts"
  ON public.game_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Agregar game_id y game_username a participants
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS game_id       text,
  ADD COLUMN IF NOT EXISTS game_username text;

-- 3. Agregar game_id a creator_bans para bloquear también por cuenta de juego
ALTER TABLE public.creator_bans
  ADD COLUMN IF NOT EXISTS game_id text;
`;

async function run() {
  try {
    await client.connect();
    console.log('Connected to database. Running SQL migration...');
    await client.query(sql);
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

run();
