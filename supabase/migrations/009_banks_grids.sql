-- ============================================================================
-- ATLASBANX - Banks, Conditions & Grids (per-user)
-- Stores the user's bank list with conditions, condition grids (versioning),
-- and archived documents. JSONB for nested structures keeps client code
-- simple while ensuring per-row ownership via RLS.
-- ============================================================================

CREATE TABLE atlasbanx.user_banks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_id         TEXT NOT NULL,           -- client-side stable id (uuid)
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  country         TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  conditions      JSONB,                   -- BankConditions | null
  condition_grids JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ConditionGrid[]
  documents       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ArchivedDocument[]
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, bank_id)
);

CREATE INDEX idx_user_banks_user_id ON atlasbanx.user_banks(user_id);
CREATE INDEX idx_user_banks_user_code ON atlasbanx.user_banks(user_id, code);

ALTER TABLE atlasbanx.user_banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_banks_select" ON atlasbanx.user_banks
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_own_banks_insert" ON atlasbanx.user_banks
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_banks_update" ON atlasbanx.user_banks
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_banks_delete" ON atlasbanx.user_banks
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_atlasbanx_user_banks_updated_at
  BEFORE UPDATE ON atlasbanx.user_banks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Grants — RLS still enforces per-row ownership
GRANT ALL ON atlasbanx.user_banks TO authenticated;
GRANT ALL ON atlasbanx.user_banks TO service_role;
