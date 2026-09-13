-- ============================================================
-- Gate 2: Kick Subscriber Webhooks Integration
-- Migration: kick_webhook_events
-- ============================================================
-- Registra eventos técnicos de webhooks recibidos de Kick EventSub.
--
-- SEGURIDAD:
-- RLS habilitado y REVOKE ALL para anon/authenticated.
-- Acceso exclusivo reservado para service_role (servidor).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.kick_webhook_events (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id               text NOT NULL UNIQUE,
  subscription_id          text NOT NULL,
  event_type               text NOT NULL,
  event_version            text NOT NULL DEFAULT '1',
  broadcaster_kick_user_id text NOT NULL,
  status                   text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'failed')),
  error_message            text,
  processed_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- Index para búsquedas rápidas por status y created_at (orphan recovery)
CREATE INDEX IF NOT EXISTS idx_kick_webhook_events_status_created_at 
  ON public.kick_webhook_events (status, created_at);

-- ============================================================
-- RLS & Grants (service_role únicamente)
-- ============================================================
ALTER TABLE public.kick_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.kick_webhook_events FROM anon, authenticated;
GRANT ALL ON public.kick_webhook_events TO service_role;
