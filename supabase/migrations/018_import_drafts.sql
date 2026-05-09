-- ============================================================================
-- ATLASBANX - Import drafts
-- ============================================================================
-- Persists in-progress import verifications (user is reviewing extracted
-- transactions or conditions before final commit). One draft per
-- (user × source_file_hash × mode), so importing the same PDF twice
-- resumes the previous review.
--
-- Mode = 'statement' (relevé bancaire) | 'conditions' (CG tarifaires).
--
-- Payload structure (JSONB):
--   {
--     fileName: string,
--     bankCode?: string,
--     extractedAt: ISO timestamp,
--     stats: { ... },
--     rows: Array<{
--       id: uuid,
--       state: 'pending' | 'validated' | 'rejected',
--       data: { ... },          // extracted fields
--       userEdits: { ... },     // user-modified fields
--       confidence: number,
--       boundingBox?: { page, xLeft, yBottom, xRight, yTop },
--       warnings: string[],
--     }>,
--   }
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.import_drafts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- SHA-256 of the source file. Used to detect "same PDF re-uploaded"
  -- so we can resume the existing draft instead of starting from scratch.
  source_hash     TEXT NOT NULL,
  mode            TEXT NOT NULL CHECK (mode IN ('statement', 'conditions')),
  file_name       TEXT NOT NULL,
  bank_code       TEXT,
  client_id       UUID REFERENCES atlasbanx.clients(id) ON DELETE SET NULL,
  -- The full draft state — see header comment for shape
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Optional: PDF source archived in Supabase Storage for re-display
  storage_path    TEXT,
  -- Lifecycle: 'draft' = WIP, 'committed' = transaction finalized
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'committed', 'cancelled')),
  committed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source_hash, mode)
);

CREATE INDEX IF NOT EXISTS idx_import_drafts_user
  ON atlasbanx.import_drafts(user_id, updated_at DESC)
  WHERE status = 'draft';

ALTER TABLE atlasbanx.import_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_drafts_select" ON atlasbanx.import_drafts;
DROP POLICY IF EXISTS "users_own_drafts_insert" ON atlasbanx.import_drafts;
DROP POLICY IF EXISTS "users_own_drafts_update" ON atlasbanx.import_drafts;
DROP POLICY IF EXISTS "users_own_drafts_delete" ON atlasbanx.import_drafts;

CREATE POLICY "users_own_drafts_select" ON atlasbanx.import_drafts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_own_drafts_insert" ON atlasbanx.import_drafts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_drafts_update" ON atlasbanx.import_drafts
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_drafts_delete" ON atlasbanx.import_drafts
  FOR DELETE USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_atlasbanx_import_drafts_updated_at
  ON atlasbanx.import_drafts;
CREATE TRIGGER update_atlasbanx_import_drafts_updated_at
  BEFORE UPDATE ON atlasbanx.import_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT ALL ON atlasbanx.import_drafts TO authenticated;
GRANT ALL ON atlasbanx.import_drafts TO service_role;
