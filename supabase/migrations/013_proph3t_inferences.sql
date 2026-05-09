-- ============================================================================
-- ATLASBANX - PROPH3T Inferences (append-only audit trail)
-- Traces every LLM inference for auditability, learning, and monitoring.
-- Ref: CDC PROPH3T v1.0, Section 3 (Architecture couche 6)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- proph3t_inferences — append-only, one row per inference call
-- ----------------------------------------------------------------------------

CREATE TABLE atlasbanx.proph3t_inferences (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competence_id      SMALLINT NOT NULL CHECK (competence_id BETWEEN 1 AND 14),
  competence_version TEXT NOT NULL,
  model_used         TEXT NOT NULL,
  prompt_hash        TEXT NOT NULL,
  input_hash         TEXT NOT NULL,
  output             JSONB NOT NULL,
  confidence_score   NUMERIC(5,2) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100)),
  validated_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at       TIMESTAMPTZ,
  source_document_id UUID,
  source_bbox        JSONB,
  duration_ms        INTEGER NOT NULL DEFAULT 0,
  tokens_in          INTEGER NOT NULL DEFAULT 0,
  tokens_out         INTEGER NOT NULL DEFAULT 0,
  organization_id    UUID,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id        UUID REFERENCES atlasbanx.analyses(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No updated_at: this table is append-only by design.
-- Validation is the only allowed mutation (validated_by + validated_at).

COMMENT ON TABLE atlasbanx.proph3t_inferences IS
  'Append-only audit trail for PROPH3T LLM inferences. Each row = one model call.';

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

-- Query by user + time (dashboard, recent inferences)
CREATE INDEX idx_inferences_user_created
  ON atlasbanx.proph3t_inferences(user_id, created_at DESC);

-- Query by competence (monitoring per-competence metrics)
CREATE INDEX idx_inferences_competence
  ON atlasbanx.proph3t_inferences(competence_id, created_at DESC);

-- Query by analysis (link inferences to a specific audit run)
CREATE INDEX idx_inferences_analysis
  ON atlasbanx.proph3t_inferences(analysis_id)
  WHERE analysis_id IS NOT NULL;

-- Pending validation (orange zone inferences awaiting human review)
CREATE INDEX idx_inferences_pending_validation
  ON atlasbanx.proph3t_inferences(competence_id, created_at DESC)
  WHERE validated_by IS NULL;

-- Model usage stats
CREATE INDEX idx_inferences_model
  ON atlasbanx.proph3t_inferences(model_used, created_at DESC);

-- ----------------------------------------------------------------------------
-- RLS — users see their own inferences; service_role sees all
-- ----------------------------------------------------------------------------

ALTER TABLE atlasbanx.proph3t_inferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_inferences_select"
  ON atlasbanx.proph3t_inferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_own_inferences_insert"
  ON atlasbanx.proph3t_inferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Only allow updating validation fields (validated_by, validated_at)
CREATE POLICY "users_validate_own_inferences"
  ON atlasbanx.proph3t_inferences
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No DELETE policy: append-only table, no deletions allowed.

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON atlasbanx.proph3t_inferences TO authenticated;
GRANT ALL ON atlasbanx.proph3t_inferences TO service_role;

-- ----------------------------------------------------------------------------
-- Helper views for monitoring dashboard
-- ----------------------------------------------------------------------------

-- Aggregated metrics per competence (last 30 days)
CREATE OR REPLACE VIEW atlasbanx.proph3t_competence_metrics AS
SELECT
  competence_id,
  model_used,
  COUNT(*)                                     AS total_calls,
  ROUND(AVG(duration_ms))                      AS avg_duration_ms,
  ROUND(AVG(confidence_score), 2)              AS avg_confidence,
  ROUND(AVG(tokens_in + tokens_out))           AS avg_tokens,
  COUNT(*) FILTER (WHERE validated_by IS NOT NULL)  AS validated_count,
  COUNT(*) FILTER (WHERE validated_by IS NULL)      AS pending_count,
  ROUND(
    COUNT(*) FILTER (WHERE validated_by IS NOT NULL)::numeric
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                            AS validation_rate_pct
FROM atlasbanx.proph3t_inferences
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY competence_id, model_used
ORDER BY competence_id, total_calls DESC;

GRANT SELECT ON atlasbanx.proph3t_competence_metrics TO authenticated;
GRANT SELECT ON atlasbanx.proph3t_competence_metrics TO service_role;
