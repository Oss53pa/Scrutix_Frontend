-- ============================================================================
-- ATLASBANX - Migration 008 — Import History
-- ----------------------------------------------------------------------------
-- Tracks every file import with a hash to detect duplicates.
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.import_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id           UUID REFERENCES atlasbanx.clients(id) ON DELETE SET NULL,
  connector_id        VARCHAR(50) NOT NULL,       -- 'ocr_sgbci', 'csv_universal', 'excel', etc.
  file_name           TEXT NOT NULL,
  file_hash           VARCHAR(64),                -- SHA-256 of file contents (dedup)
  file_size_bytes     BIGINT,
  transactions_count  INTEGER NOT NULL DEFAULT 0,
  date_range_start    DATE,
  date_range_end      DATE,
  status              VARCHAR(20) NOT NULL DEFAULT 'success'
                      CHECK (status IN ('success', 'partial', 'failed')),
  error_message       TEXT,
  imported_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_import_history_user
  ON atlasbanx.import_history(user_id, imported_at DESC);

CREATE INDEX IF NOT EXISTS idx_import_history_hash
  ON atlasbanx.import_history(user_id, file_hash);

ALTER TABLE atlasbanx.import_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_history_select_own" ON atlasbanx.import_history;
CREATE POLICY "import_history_select_own" ON atlasbanx.import_history
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "import_history_insert_own" ON atlasbanx.import_history;
CREATE POLICY "import_history_insert_own" ON atlasbanx.import_history
  FOR INSERT WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON atlasbanx.import_history TO authenticated;
REVOKE UPDATE, DELETE ON atlasbanx.import_history FROM authenticated;
GRANT ALL ON atlasbanx.import_history TO service_role;
