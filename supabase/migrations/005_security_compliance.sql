-- ============================================================================
-- ATLASBANX - Migration 005 — Security & Compliance
-- ----------------------------------------------------------------------------
-- Purpose:
--   Enterprise-grade security & compliance subsystem:
--     • policy_versions       — published CGU / Privacy / Legal notices
--     • user_consents         — consent records with version pinning
--     • data_deletion_requests— GDPR right-to-erasure queue (manual review)
--     • ip_allowlists         — cabinet-scoped IP restriction table
--                               (enforcement deferred to Edge Function)
--
-- All tables live in the `atlasbanx` schema, follow the same RLS model as
-- prior migrations (user_id = auth.uid()) and receive explicit grants
-- instead of a blanket GRANT ALL.
-- ============================================================================

-- ============================================================================
-- POLICY VERSIONS
-- ----------------------------------------------------------------------------
-- Each published version of a legal document (CGU, privacy policy, legal
-- notices, cookie policy). Content hash lets us detect unintended drift.
-- Rows are INSERT-only for normal users; service_role manages publication.
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.policy_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_type   VARCHAR(30) NOT NULL
                CHECK (policy_type IN ('cgu', 'privacy', 'legal', 'cookies')),
  version       VARCHAR(20) NOT NULL,           -- semver or YYYY-MM-DD
  content       TEXT NOT NULL,
  content_hash  VARCHAR(64) NOT NULL,           -- SHA-256 of content
  language      VARCHAR(5) NOT NULL DEFAULT 'fr',
  published_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_at TIMESTAMPTZ,                    -- set when a newer version replaces it
  UNIQUE (policy_type, version, language)
);

CREATE INDEX IF NOT EXISTS idx_policy_versions_type_current
  ON atlasbanx.policy_versions(policy_type, language, published_at DESC)
  WHERE superseded_at IS NULL;

ALTER TABLE atlasbanx.policy_versions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read published policies (no PII involved)
DROP POLICY IF EXISTS "policy_versions_read_all" ON atlasbanx.policy_versions;
CREATE POLICY "policy_versions_read_all" ON atlasbanx.policy_versions
  FOR SELECT USING (true);

-- Only service_role can insert/update — handled outside RLS scope

GRANT SELECT ON atlasbanx.policy_versions TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON atlasbanx.policy_versions FROM authenticated;
GRANT ALL ON atlasbanx.policy_versions TO service_role;

-- ============================================================================
-- USER CONSENTS
-- ----------------------------------------------------------------------------
-- One row per (user, policy version). Immutable: users can only INSERT their
-- own consent records. Rejecting consent = no row inserted = no app access.
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.user_consents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_version_id UUID NOT NULL REFERENCES atlasbanx.policy_versions(id),
  consented_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address        INET,
  user_agent        TEXT,
  UNIQUE (user_id, policy_version_id)
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user
  ON atlasbanx.user_consents(user_id, consented_at DESC);

ALTER TABLE atlasbanx.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_consents_insert_own" ON atlasbanx.user_consents;
CREATE POLICY "user_consents_insert_own" ON atlasbanx.user_consents
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_consents_select_own" ON atlasbanx.user_consents;
CREATE POLICY "user_consents_select_own" ON atlasbanx.user_consents
  FOR SELECT USING (user_id = auth.uid());

-- No UPDATE or DELETE policies — consents are append-only legal evidence.

GRANT SELECT, INSERT ON atlasbanx.user_consents TO authenticated;
REVOKE UPDATE, DELETE ON atlasbanx.user_consents FROM authenticated;
GRANT ALL ON atlasbanx.user_consents TO service_role;

-- ============================================================================
-- DATA DELETION REQUESTS (GDPR right-to-erasure)
-- ----------------------------------------------------------------------------
-- Users may request deletion; cabinet admins or service_role execute it.
-- Status progresses: pending → in_review → executed | rejected.
-- Actual cascading deletion is handled by service_role (ON DELETE CASCADE
-- already wipes owned rows when auth.users row is removed).
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.data_deletion_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'in_review', 'executed', 'rejected')),
  reason         TEXT,
  reviewed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  executed_at    TIMESTAMPTZ,
  notes          TEXT
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_user
  ON atlasbanx.data_deletion_requests(user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_status
  ON atlasbanx.data_deletion_requests(status, requested_at DESC);

ALTER TABLE atlasbanx.data_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deletion_requests_insert_own" ON atlasbanx.data_deletion_requests;
CREATE POLICY "deletion_requests_insert_own" ON atlasbanx.data_deletion_requests
  FOR INSERT WITH CHECK (user_id = auth.uid() AND requested_by = auth.uid());

DROP POLICY IF EXISTS "deletion_requests_select_own" ON atlasbanx.data_deletion_requests;
CREATE POLICY "deletion_requests_select_own" ON atlasbanx.data_deletion_requests
  FOR SELECT USING (user_id = auth.uid());

-- No UPDATE/DELETE from authenticated role — only service_role processes.

GRANT SELECT, INSERT ON atlasbanx.data_deletion_requests TO authenticated;
REVOKE UPDATE, DELETE ON atlasbanx.data_deletion_requests FROM authenticated;
GRANT ALL ON atlasbanx.data_deletion_requests TO service_role;

-- ============================================================================
-- IP ALLOWLISTS
-- ----------------------------------------------------------------------------
-- Cabinet-scoped IP CIDR whitelist. This table is managed from the Settings
-- UI. Enforcement requires an Edge Function that runs on auth hook / request
-- interception — see supabase/functions/enforce-ip-allowlist/ for the stub.
--
-- For now, the table and CRUD UI exist, but enforcement is a TODO.
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.ip_allowlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cabinet_id  UUID,                                    -- reserved for future cabinet model
  cidr        CIDR NOT NULL,
  label       TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_allowlists_user
  ON atlasbanx.ip_allowlists(user_id) WHERE active = TRUE;

ALTER TABLE atlasbanx.ip_allowlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ip_allowlists_select_own" ON atlasbanx.ip_allowlists;
CREATE POLICY "ip_allowlists_select_own" ON atlasbanx.ip_allowlists
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ip_allowlists_insert_own" ON atlasbanx.ip_allowlists;
CREATE POLICY "ip_allowlists_insert_own" ON atlasbanx.ip_allowlists
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ip_allowlists_update_own" ON atlasbanx.ip_allowlists;
CREATE POLICY "ip_allowlists_update_own" ON atlasbanx.ip_allowlists
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ip_allowlists_delete_own" ON atlasbanx.ip_allowlists;
CREATE POLICY "ip_allowlists_delete_own" ON atlasbanx.ip_allowlists
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_ip_allowlists_updated_at
  BEFORE UPDATE ON atlasbanx.ip_allowlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON atlasbanx.ip_allowlists TO authenticated;
GRANT ALL ON atlasbanx.ip_allowlists TO service_role;

-- ============================================================================
-- SEED — initial boilerplate policy versions (placeholders)
-- ----------------------------------------------------------------------------
-- These are inserted once so the app has something to display on first boot
-- and the ConsentService has a target to reference. They will be replaced by
-- the real legal text authored by counsel.
-- ============================================================================

INSERT INTO atlasbanx.policy_versions (policy_type, version, content, content_hash, language)
VALUES
  ('cgu',     '2026-04-11',
   'BOILERPLATE — Conditions générales d''utilisation AtlasBanx. Ce texte est un placeholder à remplacer par un document validé par un juriste avant usage en production. Il couvre l''objet du service, les obligations de l''utilisateur, la propriété intellectuelle, la responsabilité et la juridiction applicable (CEMAC / UEMOA).',
   encode(digest('boilerplate-cgu-v1', 'sha256'), 'hex'),
   'fr'),
  ('privacy', '2026-04-11',
   'BOILERPLATE — Politique de confidentialité AtlasBanx. Traitement des données à caractère personnel conformément au RGPD et aux lois ARTCI (Côte d''Ivoire) / ANPDP (Sénégal). Finalités: audit bancaire, détection d''anomalies, génération de rapports. Bases légales: exécution du contrat et intérêt légitime. Droits d''accès, rectification, effacement, opposition, portabilité. Responsable de traitement: Atlas Studio.',
   encode(digest('boilerplate-privacy-v1', 'sha256'), 'hex'),
   'fr'),
  ('legal',   '2026-04-11',
   'BOILERPLATE — Mentions légales AtlasBanx. Éditeur: Atlas Studio. Siège social: [à compléter]. RCCM: [à compléter]. NIF: [à compléter]. Directeur de la publication: [à compléter]. Hébergeur: Supabase / Vercel. Contact: contact@atlasbanx.com.',
   encode(digest('boilerplate-legal-v1', 'sha256'), 'hex'),
   'fr'),
  ('cookies', '2026-04-11',
   'BOILERPLATE — Politique cookies AtlasBanx. Aucun cookie marketing. Cookies techniques strictement nécessaires à l''authentification (Supabase session) et aux préférences utilisateur (localStorage). Aucun partage avec des tiers.',
   encode(digest('boilerplate-cookies-v1', 'sha256'), 'hex'),
   'fr')
ON CONFLICT (policy_type, version, language) DO NOTHING;
