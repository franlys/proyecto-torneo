-- ============================================================
-- Gate 3: Kick Subscriber Benefits & Tournament Eligibility
-- Migration: kick_subscribers (Current-State Projection v1.2)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.kick_subscribers (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_kick_user_id text NOT NULL,
  subscriber_kick_user_id  text NOT NULL,
  subscription_type        text NOT NULL CHECK (subscription_type IN ('direct', 'gifted')),
  is_active                boolean NOT NULL DEFAULT true,
  expires_at               timestamptz NOT NULL,
  last_event_timestamp     timestamptz NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_kick_subscribers_broadcaster_subscriber 
    UNIQUE(broadcaster_kick_user_id, subscriber_kick_user_id)
);

-- Index para búsquedas rápidas de elegibilidad
CREATE INDEX IF NOT EXISTS idx_kick_subscribers_eligibility_lookup
  ON public.kick_subscribers (broadcaster_kick_user_id, subscriber_kick_user_id, subscription_type, is_active, expires_at);

-- ============================================================
-- RLS & Security Policies
-- ============================================================
ALTER TABLE public.kick_subscribers ENABLE ROW LEVEL SECURITY;

-- Revoke mutation rights from public roles (Writes restricted strictly to service_role)
REVOKE ALL ON public.kick_subscribers FROM anon, authenticated;

-- Explicit RLS SELECT Policy mapping subscriber_kick_user_id -> kick_connections -> auth.uid()
GRANT SELECT ON public.kick_subscribers TO authenticated;

CREATE POLICY "Users can read own kick subscription state"
  ON public.kick_subscribers FOR SELECT
  USING (
    subscriber_kick_user_id IN (
      SELECT kick_user_id 
      FROM public.kick_connections 
      WHERE user_id = auth.uid()
    )
  );

GRANT ALL ON public.kick_subscribers TO service_role;
