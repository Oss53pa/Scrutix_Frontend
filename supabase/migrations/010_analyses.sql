-- ============================================================================
-- ATLASBANX - Analyses & Anomalies (per-user)
-- Persists analysis results (current + history) and individual anomalies.
-- Each anomaly stores its triggering transaction(s) inline as JSONB so
-- the dashboard can render history without joining transactions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- analyses — one row per audit run
-- ----------------------------------------------------------------------------

CREATE TABLE atlasbanx.analyses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES atlasbanx.clients(id) ON DELETE SET NULL,
  external_id       TEXT,                            -- legacy id from client (string)
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  config            JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary           JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_savings     NUMERIC NOT NULL DEFAULT 0,
  anomaly_count     INTEGER NOT NULL DEFAULT 0,
  is_current        BOOLEAN NOT NULL DEFAULT FALSE,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  error             TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analyses_user_id ON atlasbanx.analyses(user_id, created_at DESC);
CREATE INDEX idx_analyses_user_current ON atlasbanx.analyses(user_id) WHERE is_current = TRUE;
CREATE INDEX idx_analyses_client_id ON atlasbanx.analyses(client_id);

ALTER TABLE atlasbanx.analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_analyses_select" ON atlasbanx.analyses
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_own_analyses_insert" ON atlasbanx.analyses
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_analyses_update" ON atlasbanx.analyses
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_analyses_delete" ON atlasbanx.analyses
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_atlasbanx_analyses_updated_at
  BEFORE UPDATE ON atlasbanx.analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------------------------
-- anomalies — child rows of an analysis
-- ----------------------------------------------------------------------------

CREATE TABLE atlasbanx.anomalies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id       UUID NOT NULL REFERENCES atlasbanx.analyses(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES atlasbanx.clients(id) ON DELETE SET NULL,
  external_id       TEXT,                            -- legacy id from client (string)
  type              TEXT NOT NULL,
  severity          TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'dismissed', 'contested')),
  amount            NUMERIC NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'XAF',
  confidence        NUMERIC NOT NULL DEFAULT 0,
  description       TEXT,
  notes             TEXT,
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at        TIMESTAMPTZ,
  -- Inline transactions: anomalies typically reference 1-3 transactions; we
  -- snapshot them so the timeline doesn't break if the underlying tx changes.
  transactions      JSONB NOT NULL DEFAULT '[]'::jsonb,
  reasoning         JSONB NOT NULL DEFAULT '{}'::jsonb,   -- AI/rule reasoning blob
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_anomalies_analysis_id ON atlasbanx.anomalies(analysis_id);
CREATE INDEX idx_anomalies_user_id ON atlasbanx.anomalies(user_id, detected_at DESC);
CREATE INDEX idx_anomalies_severity ON atlasbanx.anomalies(user_id, severity);
CREATE INDEX idx_anomalies_status ON atlasbanx.anomalies(user_id, status);

ALTER TABLE atlasbanx.anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_anomalies_select" ON atlasbanx.anomalies
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_own_anomalies_insert" ON atlasbanx.anomalies
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_anomalies_update" ON atlasbanx.anomalies
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_anomalies_delete" ON atlasbanx.anomalies
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_atlasbanx_anomalies_updated_at
  BEFORE UPDATE ON atlasbanx.anomalies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------------------------
-- Helper: ensure exactly one is_current=TRUE per user
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION atlasbanx.ensure_single_current_analysis()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = TRUE THEN
    UPDATE atlasbanx.analyses
       SET is_current = FALSE
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_current = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER ensure_single_current_analysis_trigger
  AFTER INSERT OR UPDATE OF is_current ON atlasbanx.analyses
  FOR EACH ROW
  WHEN (NEW.is_current = TRUE)
  EXECUTE FUNCTION atlasbanx.ensure_single_current_analysis();

-- Grants
GRANT ALL ON atlasbanx.analyses TO authenticated;
GRANT ALL ON atlasbanx.anomalies TO authenticated;
GRANT ALL ON atlasbanx.analyses TO service_role;
GRANT ALL ON atlasbanx.anomalies TO service_role;
