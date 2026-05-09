-- ============================================================================
-- ATLASBANX - User AI Keys (Option B: server-side proxy pattern)
-- ============================================================================
-- Stores per-user API keys (Anthropic, future OpenAI etc.) so they can be
-- used by Edge Functions WITHOUT ever being exposed to the browser.
--
-- Security model:
--   • Table has RLS enabled with NO policies → unreachable by anon/authenticated
--   • Only service_role (used by Edge Functions) can SELECT/UPDATE the raw key
--   • Users interact via SECURITY DEFINER functions:
--       set_anthropic_api_key(p_key)       — upsert their own key
--       clear_anthropic_api_key()          — delete their own key
--       has_anthropic_api_key()            — boolean: is a key configured?
--   • Functions enforce auth.uid() = user_id, so a user can only
--     manipulate their own row
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.user_ai_keys (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  anthropic_api_key TEXT,
  -- Last successful test (helps UX to show "validated 2 days ago")
  anthropic_validated_at TIMESTAMPTZ,
  -- Optional: hash of the key for easier identification without revealing it
  anthropic_key_fingerprint TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE atlasbanx.user_ai_keys ENABLE ROW LEVEL SECURITY;

-- Intentionally NO policies — direct table access denied for anon/authenticated.
-- service_role bypasses RLS, so the Edge Function (running with service_role)
-- can read keys to forward to Anthropic.

REVOKE ALL ON atlasbanx.user_ai_keys FROM authenticated;
REVOKE ALL ON atlasbanx.user_ai_keys FROM anon;
GRANT  ALL ON atlasbanx.user_ai_keys TO service_role;

CREATE OR REPLACE FUNCTION atlasbanx.user_ai_keys_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_ai_keys_touch ON atlasbanx.user_ai_keys;
CREATE TRIGGER user_ai_keys_touch
  BEFORE UPDATE ON atlasbanx.user_ai_keys
  FOR EACH ROW EXECUTE FUNCTION atlasbanx.user_ai_keys_touch_updated_at();

-- ============================================================================
-- RPC FUNCTIONS — only entry points for users
-- ============================================================================

-- Upsert the calling user's Anthropic API key.
-- Returns void; the key is never returned, even after a successful set.
CREATE OR REPLACE FUNCTION public.set_anthropic_api_key(p_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = atlasbanx, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_fp  TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  IF p_key IS NULL OR length(trim(p_key)) < 20 THEN
    RAISE EXCEPTION 'Clé invalide (trop courte)' USING ERRCODE = '22023';
  END IF;
  -- Fingerprint = first 8 chars of SHA-256 hex (never the key itself)
  v_fp := substring(encode(digest(p_key, 'sha256'), 'hex') for 8);

  INSERT INTO atlasbanx.user_ai_keys (user_id, anthropic_api_key, anthropic_key_fingerprint)
  VALUES (v_uid, p_key, v_fp)
  ON CONFLICT (user_id) DO UPDATE
    SET anthropic_api_key         = EXCLUDED.anthropic_api_key,
        anthropic_key_fingerprint = EXCLUDED.anthropic_key_fingerprint,
        anthropic_validated_at    = NULL,    -- re-validation needed
        updated_at                = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.set_anthropic_api_key(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_anthropic_api_key(TEXT) TO authenticated;

-- Clear the calling user's key.
CREATE OR REPLACE FUNCTION public.clear_anthropic_api_key()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = atlasbanx, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  DELETE FROM atlasbanx.user_ai_keys WHERE user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_anthropic_api_key() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.clear_anthropic_api_key() TO authenticated;

-- Returns metadata about the configured key (boolean + fingerprint + validated_at)
-- but NEVER the key itself.
CREATE OR REPLACE FUNCTION public.anthropic_api_key_info()
RETURNS TABLE (
  is_configured BOOLEAN,
  fingerprint   TEXT,
  validated_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = atlasbanx, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT
      (k.anthropic_api_key IS NOT NULL AND length(k.anthropic_api_key) > 0) AS is_configured,
      k.anthropic_key_fingerprint AS fingerprint,
      k.anthropic_validated_at    AS validated_at,
      k.updated_at                AS updated_at
    FROM atlasbanx.user_ai_keys k
    WHERE k.user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.anthropic_api_key_info() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.anthropic_api_key_info() TO authenticated;
