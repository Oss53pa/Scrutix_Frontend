-- ============================================================================
-- ATLASBANX — Migration 020 — Re-apply audit_trail on production
-- ============================================================================
-- The original migration 004 was never executed on the live Supabase project
-- (vgtmljfayiysuvrcmunt) because the project pre-existed AtlasBanx and uses
-- a manual migration workflow shared with Atlas Studio.
--
-- This migration is idempotent (uses IF NOT EXISTS / OR REPLACE) and brings
-- the production schema up to spec by creating atlasbanx.audit_trail with
-- its tamper-evidence trigger and RLS policies.
--
-- Applied on prod via Supabase MCP on 2026-05-09.
-- See migration 004_audit_trail.sql for the canonical reference.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS atlasbanx.audit_trail (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        VARCHAR(36) UNIQUE NOT NULL,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cabinet_id      UUID,
  client_id       UUID REFERENCES atlasbanx.clients(id) ON DELETE SET NULL,
  event_type      VARCHAR(60) NOT NULL,
  resource_type   VARCHAR(30) NOT NULL,
  resource_id     UUID,
  action          VARCHAR(30) NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address      INET,
  user_agent      TEXT,
  session_id      VARCHAR(36),
  integrity_hash  VARCHAR(64) NOT NULL,
  previous_hash   VARCHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_created ON atlasbanx.audit_trail(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource     ON atlasbanx.audit_trail(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type   ON atlasbanx.audit_trail(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_client       ON atlasbanx.audit_trail(client_id, created_at DESC);

ALTER TABLE atlasbanx.audit_trail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_insert_own" ON atlasbanx.audit_trail;
CREATE POLICY "audit_insert_own" ON atlasbanx.audit_trail
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "audit_select_own" ON atlasbanx.audit_trail;
CREATE POLICY "audit_select_own" ON atlasbanx.audit_trail
  FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION atlasbanx.compute_audit_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = atlasbanx, public, pg_temp
AS $$
DECLARE
  prev_hash   VARCHAR(64);
  hash_input  TEXT;
BEGIN
  SELECT integrity_hash INTO prev_hash
  FROM atlasbanx.audit_trail
  WHERE user_id IS NOT DISTINCT FROM NEW.user_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  NEW.previous_hash := prev_hash;

  hash_input := COALESCE(NEW.event_id, '')
             || '|' || COALESCE(NEW.event_type, '')
             || '|' || COALESCE(NEW.action, '')
             || '|' || COALESCE(NEW.resource_type, '')
             || '|' || COALESCE(NEW.resource_id::text, '')
             || '|' || COALESCE(NEW.user_id::text, '')
             || '|' || COALESCE(NEW.client_id::text, '')
             || '|' || COALESCE(NEW.payload::text, '{}')
             || '|' || COALESCE(prev_hash, '');

  NEW.integrity_hash := encode(digest(hash_input, 'sha256'), 'hex');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_insert_audit_trail ON atlasbanx.audit_trail;
CREATE TRIGGER before_insert_audit_trail
  BEFORE INSERT ON atlasbanx.audit_trail
  FOR EACH ROW EXECUTE FUNCTION atlasbanx.compute_audit_hash();

GRANT SELECT, INSERT ON atlasbanx.audit_trail TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON atlasbanx.audit_trail FROM authenticated;
GRANT ALL ON atlasbanx.audit_trail TO service_role;

NOTIFY pgrst, 'reload schema';
