-- Migration: Create kick_streamer_partners table
-- Purpose: Super Admin management of authorized Kick Streamer Partners

CREATE TABLE IF NOT EXISTS public.kick_streamer_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kick_user_id TEXT NOT NULL,
  integration_enabled BOOLEAN NOT NULL DEFAULT true,
  subscriber_tournaments_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ NULL,

  CONSTRAINT unique_kick_partner_user UNIQUE (user_id),
  CONSTRAINT unique_kick_partner_kick_user UNIQUE (kick_user_id),
  CONSTRAINT chk_partner_sub_requires_integration CHECK (integration_enabled = true OR subscriber_tournaments_enabled = false)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_kick_streamer_partners_user_id ON public.kick_streamer_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_kick_streamer_partners_kick_user_id ON public.kick_streamer_partners(kick_user_id);
CREATE INDEX IF NOT EXISTS idx_kick_streamer_partners_active ON public.kick_streamer_partners(integration_enabled, subscriber_tournaments_enabled) WHERE revoked_at IS NULL;

-- Enable RLS
ALTER TABLE public.kick_streamer_partners ENABLE ROW LEVEL SECURITY;

-- Policy: SUPER_ADMIN full access (INSERT, UPDATE, DELETE, SELECT)
CREATE POLICY "Super Admins have full access to kick_streamer_partners"
  ON public.kick_streamer_partners
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'SUPER_ADMIN'
    )
  );

-- Policy: Authenticated users can select active partners (for tournament creation selector & validation)
CREATE POLICY "Users can view active kick partners"
  ON public.kick_streamer_partners
  FOR SELECT
  TO authenticated
  USING (
    revoked_at IS NULL AND integration_enabled = true
  );
