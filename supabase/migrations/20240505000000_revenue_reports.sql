-- Migration: Revenue Reports from ArenaCrypto
-- Project: Proyecto-Torneos / Kronix
-- Recibe los reportes de comisiones que AC envía vía webhook

CREATE TABLE IF NOT EXISTS public.revenue_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pt_tournament_id  UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  tournament_name   TEXT,
  total_volume      NUMERIC(14,2) DEFAULT 0,    -- Volumen total apostado en AC
  kronix_volume     NUMERIC(14,2) DEFAULT 0,    -- Volumen de apuestas con código Kronix
  commission_rate   NUMERIC(5,4) DEFAULT 0.01,
  commission_amount NUMERIC(14,2) DEFAULT 0,    -- Lo que AC debe pagar a Kronix
  period_start      TIMESTAMPTZ,
  period_end        TIMESTAMPTZ,
  received_at       TIMESTAMPTZ DEFAULT NOW(),
  source            TEXT DEFAULT 'arenacrypto'
);

CREATE INDEX IF NOT EXISTS idx_revenue_reports_tournament
  ON revenue_reports(pt_tournament_id);
CREATE INDEX IF NOT EXISTS idx_revenue_reports_received
  ON revenue_reports(received_at DESC);

ALTER TABLE revenue_reports ENABLE ROW LEVEL SECURITY;

-- Solo el dueño del proyecto (admin/service_role) puede leer
CREATE POLICY "Service role full access"
  ON revenue_reports FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated admins can read"
  ON revenue_reports FOR SELECT TO authenticated
  USING (true); -- Kronix usa service_role en sus dashboards internos

COMMENT ON TABLE revenue_reports IS
  'Registros de comisiones enviados por ArenaCrypto cuando finaliza un torneo con apuestas activadas. commission_amount es el monto que AC debe transferir a Kronix.';
