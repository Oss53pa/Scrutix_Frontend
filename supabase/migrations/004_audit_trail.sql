-- ============================================================================
-- ATLASBANX - Migration 004 — Immutable Audit Trail
-- ----------------------------------------------------------------------------
-- Purpose:
--   Enterprise-grade append-only audit log with cryptographic chaining.
--   Events recorded here are the legal evidence backing AtlasBanx audit
--   reports (fiscal controls, bank disputes, OHADA compliance checks).
--
-- Guarantees:
--   1. Immutability — RLS exposes INSERT/SELECT only. UPDATE/DELETE are
--      revoked for `authenticated` and there are no policies granting them,
--      so even a user with a leaked JWT cannot rewrite history.
--   2. Tamper-evidence — a BEFORE INSERT trigger computes a SHA-256 hash
--      over the event payload + the previous event's hash (per user),
--      forming a blockchain-like chain. Any silent modification breaks the
--      chain and is detectable by verify_chain_integrity().
--   3. Ownership — RLS restricts visibility to user_id = auth.uid().
--
-- Migration is idempotent-friendly: uses IF NOT EXISTS where possible.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- AUDIT TRAIL TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.audit_trail (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        VARCHAR(36) UNIQUE NOT NULL,       -- UUID v4 generated client-side
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cabinet_id      UUID,                              -- reserved for cabinet membership (future)
  client_id       UUID REFERENCES atlasbanx.clients(id) ON DELETE SET NULL,
  event_type      VARCHAR(60) NOT NULL,              -- see AuditEventType enum in TS
  resource_type   VARCHAR(30) NOT NULL,              -- 'analysis' | 'report' | ...
  resource_id     UUID,
  action          VARCHAR(30) NOT NULL,              -- 'created' | 'updated' | ...
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address      INET,
  user_agent      TEXT,
  session_id      VARCHAR(36),
  integrity_hash  VARCHAR(64) NOT NULL,              -- SHA-256 hex, computed by trigger
  previous_hash   VARCHAR(64),                       -- hash of previous event for this user
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_created
  ON atlasbanx.audit_trail(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_resource
  ON atlasbanx.audit_trail(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_audit_event_type
  ON atlasbanx.audit_trail(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_client
  ON atlasbanx.audit_trail(client_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY — INSERT and SELECT only
-- ============================================================================

ALTER TABLE atlasbanx.audit_trail ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may append events for themselves.
DROP POLICY IF EXISTS "audit_insert_own" ON atlasbanx.audit_trail;
CREATE POLICY "audit_insert_own" ON atlasbanx.audit_trail
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users may read only their own trail.
DROP POLICY IF EXISTS "audit_select_own" ON atlasbanx.audit_trail;
CREATE POLICY "audit_select_own" ON atlasbanx.audit_trail
  FOR SELECT USING (user_id = auth.uid());

-- Intentionally NO policies for UPDATE or DELETE — RLS denies them by default.

-- ============================================================================
-- HASH TRIGGER — computes integrity_hash server-side
--
-- This runs with SECURITY DEFINER so it can read the previous row even when
-- the invoking user has RLS active. We scope the chain per user_id to avoid
-- cross-user contention on previous_hash.
-- ============================================================================

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
  -- Fetch the integrity_hash of the most recent event for this user.
  -- NULL for the very first event (genesis row).
  SELECT integrity_hash INTO prev_hash
  FROM atlasbanx.audit_trail
  WHERE user_id IS NOT DISTINCT FROM NEW.user_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  NEW.previous_hash := prev_hash;

  -- Canonical hash input: order matters, do not change without bumping schema.
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

-- ============================================================================
-- GRANTS — explicit, minimal
-- ----------------------------------------------------------------------------
-- Note: the broad GRANT ALL on migration 003 only applied to tables existing
-- at that time, so this fresh table starts with no privileges. We grant
-- SELECT and INSERT explicitly and, as belt-and-suspenders, revoke UPDATE
-- and DELETE so no future default-grant can open the door.
-- ============================================================================

GRANT SELECT, INSERT ON atlasbanx.audit_trail TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON atlasbanx.audit_trail FROM authenticated;

-- service_role keeps full access for supervised admin tasks (retention purge).
GRANT ALL ON atlasbanx.audit_trail TO service_role;

-- ============================================================================
-- CHAIN VERIFICATION HELPER
--
-- Walks the chain for (user_id, [start, end]) and returns the first break
-- it finds, if any. Called by the TS service verifyChainIntegrity().
-- ============================================================================

CREATE OR REPLACE FUNCTION atlasbanx.verify_audit_chain(
  p_user_id    UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date   TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  total_events         BIGINT,
  first_broken_event   UUID,
  first_broken_at      TIMESTAMPTZ,
  is_valid             BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = atlasbanx, public, pg_temp
AS $$
DECLARE
  r             RECORD;
  expected_prev VARCHAR(64) := NULL;
  total         BIGINT := 0;
  broken_id     UUID := NULL;
  broken_at     TIMESTAMPTZ := NULL;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'verify_audit_chain: unauthorized';
  END IF;

  FOR r IN
    SELECT id, event_id, event_type, action, resource_type, resource_id,
           user_id, client_id, payload, integrity_hash, previous_hash, created_at
    FROM atlasbanx.audit_trail
    WHERE user_id = p_user_id
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
    ORDER BY created_at ASC, id ASC
  LOOP
    total := total + 1;

    -- Chain continuity check
    IF r.previous_hash IS DISTINCT FROM expected_prev THEN
      broken_id := r.id;
      broken_at := r.created_at;
      EXIT;
    END IF;

    -- Hash recomputation check
    IF r.integrity_hash <> encode(
      digest(
        COALESCE(r.event_id, '')
        || '|' || COALESCE(r.event_type, '')
        || '|' || COALESCE(r.action, '')
        || '|' || COALESCE(r.resource_type, '')
        || '|' || COALESCE(r.resource_id::text, '')
        || '|' || COALESCE(r.user_id::text, '')
        || '|' || COALESCE(r.client_id::text, '')
        || '|' || COALESCE(r.payload::text, '{}')
        || '|' || COALESCE(r.previous_hash, ''),
        'sha256'
      ),
      'hex'
    ) THEN
      broken_id := r.id;
      broken_at := r.created_at;
      EXIT;
    END IF;

    expected_prev := r.integrity_hash;
  END LOOP;

  RETURN QUERY SELECT total, broken_id, broken_at, (broken_id IS NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION atlasbanx.verify_audit_chain(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
