-- ============================================================================
-- ATLASBANX - Report Drafts & Generated Reports (per-user)
-- Stores the in-progress draft (one per user) and the history of generated
-- reports. Anomaly arrays kept as JSONB snapshots for portability.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- report_drafts — work-in-progress, typically 0 or 1 per user
-- ----------------------------------------------------------------------------

CREATE TABLE atlasbanx.report_drafts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id                UUID REFERENCES atlasbanx.clients(id) ON DELETE SET NULL,
  client_name              TEXT NOT NULL,
  title                    TEXT NOT NULL,
  type                     TEXT NOT NULL CHECK (type IN ('audit', 'summary', 'detailed', 'recovery')),
  period_start             TIMESTAMPTZ,
  period_end               TIMESTAMPTZ,
  selected_anomalies       JSONB NOT NULL DEFAULT '[]'::jsonb,
  confirmed_anomalies      JSONB NOT NULL DEFAULT '[]'::jsonb,
  dismissed_anomalies      JSONB NOT NULL DEFAULT '[]'::jsonb,
  contested_anomalies      JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes                    TEXT NOT NULL DEFAULT '',
  include_ai_analysis      BOOLEAN NOT NULL DEFAULT TRUE,
  include_recommendations  BOOLEAN NOT NULL DEFAULT TRUE,
  include_transaction_details BOOLEAN NOT NULL DEFAULT TRUE,
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_drafts_user_id ON atlasbanx.report_drafts(user_id, updated_at DESC);
CREATE INDEX idx_report_drafts_client_id ON atlasbanx.report_drafts(client_id);

ALTER TABLE atlasbanx.report_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_report_drafts_select" ON atlasbanx.report_drafts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_own_report_drafts_insert" ON atlasbanx.report_drafts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_report_drafts_update" ON atlasbanx.report_drafts
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_report_drafts_delete" ON atlasbanx.report_drafts
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_atlasbanx_report_drafts_updated_at
  BEFORE UPDATE ON atlasbanx.report_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------------------------
-- generated_reports — historical snapshots
-- ----------------------------------------------------------------------------

CREATE TABLE atlasbanx.generated_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES atlasbanx.clients(id) ON DELETE SET NULL,
  draft_id        UUID REFERENCES atlasbanx.report_drafts(id) ON DELETE SET NULL,
  external_id     TEXT,                                         -- legacy id from client
  title           TEXT NOT NULL,
  client_name     TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('audit', 'summary', 'detailed', 'recovery')),
  format          TEXT NOT NULL CHECK (format IN ('pdf', 'excel')),
  anomaly_count   INTEGER NOT NULL DEFAULT 0,
  total_amount    NUMERIC NOT NULL DEFAULT 0,
  download_url    TEXT,                                         -- optional storage url
  storage_path    TEXT,                                         -- optional storage object path
  integrity_hash  TEXT,                                         -- SHA-256 of the rendered file
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generated_reports_user_id ON atlasbanx.generated_reports(user_id, generated_at DESC);
CREATE INDEX idx_generated_reports_client_id ON atlasbanx.generated_reports(client_id);

ALTER TABLE atlasbanx.generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_generated_reports_select" ON atlasbanx.generated_reports
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_own_generated_reports_insert" ON atlasbanx.generated_reports
  FOR INSERT WITH CHECK (user_id = auth.uid());
-- generated reports are immutable history — UPDATE intentionally not granted
CREATE POLICY "users_own_generated_reports_delete" ON atlasbanx.generated_reports
  FOR DELETE USING (user_id = auth.uid());

-- Grants
GRANT SELECT, INSERT, DELETE ON atlasbanx.report_drafts TO authenticated;
GRANT UPDATE ON atlasbanx.report_drafts TO authenticated;
GRANT SELECT, INSERT, DELETE ON atlasbanx.generated_reports TO authenticated;
GRANT ALL ON atlasbanx.report_drafts TO service_role;
GRANT ALL ON atlasbanx.generated_reports TO service_role;
