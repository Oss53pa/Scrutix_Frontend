-- ============================================================================
-- ATLASBANX — atlasbanx.user_settings
-- ============================================================================
-- Per-user settings blob for AtlasBanx (UI preferences, detection thresholds,
-- AI provider config, etc.). One row per user, JSONB payload, owner-only RLS.
--
-- This was originally meant to live in `public.user_settings` (migration 001)
-- but that table was never created on this Supabase project — the project is
-- shared with Atlas Studio which uses `public.cj_settings` for its own
-- purposes. We isolate AtlasBanx settings under `atlasbanx.*` to keep both
-- apps clean and avoid name conflicts.
--
-- Applied on production via Supabase MCP on 2026-05-09.
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.user_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_atlasbanx_user_settings_user_id
  ON atlasbanx.user_settings (user_id);

-- Auto-update updated_at on UPDATE
CREATE OR REPLACE FUNCTION atlasbanx.touch_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atlasbanx_user_settings_updated_at ON atlasbanx.user_settings;
CREATE TRIGGER trg_atlasbanx_user_settings_updated_at
  BEFORE UPDATE ON atlasbanx.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION atlasbanx.touch_user_settings_updated_at();

-- Row-Level Security
ALTER TABLE atlasbanx.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_settings_select_own ON atlasbanx.user_settings;
CREATE POLICY user_settings_select_own ON atlasbanx.user_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_settings_insert_own ON atlasbanx.user_settings;
CREATE POLICY user_settings_insert_own ON atlasbanx.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_settings_update_own ON atlasbanx.user_settings;
CREATE POLICY user_settings_update_own ON atlasbanx.user_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_settings_delete_own ON atlasbanx.user_settings;
CREATE POLICY user_settings_delete_own ON atlasbanx.user_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Grants for the authenticated role (Supabase JS client default)
GRANT SELECT, INSERT, UPDATE, DELETE ON atlasbanx.user_settings TO authenticated;

COMMENT ON TABLE atlasbanx.user_settings IS
  'Per-user JSONB settings blob for AtlasBanx (UI preferences, detection thresholds, AI provider config). Sensitive credentials (API keys) live in atlasbanx.user_ai_keys with NO RLS exposure to clients.';
