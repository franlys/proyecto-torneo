-- ============================================================
-- Gate 1: Kick OAuth Connection & Identity
-- Migration: kick_connections
-- ============================================================
-- Una conexión por usuario de plataforma (UNIQUE user_id) y
-- una cuenta de plataforma por cuenta de Kick (UNIQUE kick_user_id).
--
-- S1 HARDENING (hallazgo del Gatekeeper): `authenticated` NO tiene
-- INSERT/UPDATE/DELETE. Toda escritura pasa exclusivamente por las API
-- routes con service_role (admin client). Un usuario autenticado nunca
-- puede fabricar una fila con un access_token_encrypted forjado desde el
-- navegador, porque el rol del navegador no puede escribir. Las policies
-- de INSERT/UPDATE/DELETE se conservan SOLO como defensa en profundidad
-- por si en el futuro se relajaran los grants.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.kick_connections (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  kick_user_id            text NOT NULL UNIQUE,
  kick_username           text,
  kick_email              text,
  kick_profile_picture    text,
  access_token_encrypted  text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  scopes                  text NOT NULL DEFAULT 'user:read',
  access_token_expires_at timestamptz NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS: un usuario solo ve su propia fila (capa de defensa 1)
-- ============================================================
ALTER TABLE public.kick_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own kick connection"
  ON public.kick_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own kick connection (defense-in-depth)"
  ON public.kick_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own kick connection (defense-in-depth)"
  ON public.kick_connections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own kick connection (defense-in-depth)"
  ON public.kick_connections FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- S1: GRANTS — el rol de navegador solo puede LEER columnas seguras.
-- Sin INSERT/UPDATE/DELETE para authenticated: la tabla queda
-- gobernada 100% por el servidor (service_role).
-- ============================================================
REVOKE ALL ON public.kick_connections FROM anon, authenticated;

GRANT SELECT (
  id, user_id, kick_user_id, kick_username, kick_email,
  kick_profile_picture, scopes, access_token_expires_at,
  created_at, updated_at
) ON public.kick_connections TO authenticated;
