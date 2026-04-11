-- ============================================================================
-- ATLASBANX - Migration 006 — Risk Score History
-- ----------------------------------------------------------------------------
-- Purpose:
--   Store the historical evolution of the global Risk Score (0-100) per
--   client, computed at the end of each audit run by RiskScoreEngine.
--
--   The score is the most-visible KPI of the product: cabinet auditors and
--   enterprise CFOs use it to prioritize their work. Persisting it lets us
--   draw 12-month trend charts and detect risk drift over time.
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.risk_score_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES atlasbanx.clients(id) ON DELETE CASCADE,
  -- Aggregated score (0-100) and risk level label
  score           INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  risk_level      VARCHAR(20) NOT NULL
                  CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
  -- Decomposition by dimension (raw points before normalization)
  dimensions      JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Snapshot metadata at compute time
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Period of the audit that produced this score (YYYY-MM)
  period          VARCHAR(7),
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_score_client_computed
  ON atlasbanx.risk_score_history(client_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_risk_score_user_computed
  ON atlasbanx.risk_score_history(user_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_risk_score_level
  ON atlasbanx.risk_score_history(user_id, risk_level, computed_at DESC);

ALTER TABLE atlasbanx.risk_score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "risk_score_select_own" ON atlasbanx.risk_score_history;
CREATE POLICY "risk_score_select_own" ON atlasbanx.risk_score_history
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "risk_score_insert_own" ON atlasbanx.risk_score_history;
CREATE POLICY "risk_score_insert_own" ON atlasbanx.risk_score_history
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Scores are append-only — no UPDATE / DELETE policies. If a score is wrong,
-- compute a new one (the latest wins via ORDER BY computed_at DESC).

GRANT SELECT, INSERT ON atlasbanx.risk_score_history TO authenticated;
REVOKE UPDATE, DELETE ON atlasbanx.risk_score_history FROM authenticated;
GRANT ALL ON atlasbanx.risk_score_history TO service_role;
