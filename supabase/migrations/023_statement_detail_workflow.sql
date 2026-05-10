-- ============================================================================
-- ATLASBANX — Migration 023 — Statement Detail workflow (V2 alignée prod)
-- ============================================================================
-- ADAPTÉE au schéma existant en prod (introspection MCP) :
--   - atlasbanx.anomalies existe déjà (FK vers analyses) → on l'étend
--   - atlasbanx.audit_trail existe déjà (hash chain via integrity_hash) → réutilisée
--   - atlasbanx.generated_reports existe déjà → on ajoute signed_reports comme
--     extension orientée signature ADVIST + envoi
--   - public.proph3t_conversations existe → réutilisée pour PROPH3T drawer
--
-- Tables créées par cette migration (manquantes) :
--   - atlasbanx.anomaly_comments
--   - atlasbanx.bank_reconciliations
--   - atlasbanx.bank_complaint_letters
--   - atlasbanx.signed_reports
--   - atlasbanx.account_conventions
--
-- Colonnes ajoutées à atlasbanx.anomalies pour le workflow 3-niveaux :
--   - statement_id   uuid          (FK vers bank_statements)
--   - title          text          (label court)
--   - qualified_by, qualified_at
--   - validated_by, validated_at
--   - signed_by, signed_at
--   - closed_by, closed_at, closed_reason
--   - assigned_to    uuid          (FK vers auth.users)
--   - convention_id  uuid          (lien vers convention/agreement)
--   - potential_recovery numeric   (montant récupérable estimé)
--
-- Idempotente.
-- ============================================================================

-- ============================================================================
-- 1. Étendre atlasbanx.anomalies avec les colonnes workflow
-- ============================================================================

ALTER TABLE atlasbanx.anomalies
  ADD COLUMN IF NOT EXISTS statement_id        uuid REFERENCES atlasbanx.bank_statements(id) ON DELETE SET NULL;

ALTER TABLE atlasbanx.anomalies
  ADD COLUMN IF NOT EXISTS title               text;

ALTER TABLE atlasbanx.anomalies
  ADD COLUMN IF NOT EXISTS qualified_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE atlasbanx.anomalies
  ADD COLUMN IF NOT EXISTS qualified_at        timestamptz;

ALTER TABLE atlasbanx.anomalies
  ADD COLUMN IF NOT EXISTS validated_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE atlasbanx.anomalies
  ADD COLUMN IF NOT EXISTS validated_at        timestamptz;

ALTER TABLE atlasbanx.anomalies
  ADD COLUMN IF NOT EXISTS signed_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE atlasbanx.anomalies
  ADD COLUMN IF NOT EXISTS signed_at           timestamptz;

ALTER TABLE atlasbanx.anomalies
  ADD COLUMN IF NOT EXISTS closed_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE atlasbanx.anomalies
  ADD COLUMN IF NOT EXISTS closed_at           timestamptz;

ALTER TABLE atlasbanx.anomalies
  ADD COLUMN IF NOT EXISTS closed_reason       text;

ALTER TABLE atlasbanx.anomalies
  ADD COLUMN IF NOT EXISTS assigned_to         uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE atlasbanx.anomalies
  ADD COLUMN IF NOT EXISTS convention_id       uuid;

ALTER TABLE atlasbanx.anomalies
  ADD COLUMN IF NOT EXISTS potential_recovery  numeric;

CREATE INDEX IF NOT EXISTS idx_anomalies_statement
  ON atlasbanx.anomalies(statement_id, status, severity);

CREATE INDEX IF NOT EXISTS idx_anomalies_assigned
  ON atlasbanx.anomalies(assigned_to) WHERE assigned_to IS NOT NULL;

-- ============================================================================
-- 2. atlasbanx.anomaly_comments
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.anomaly_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id  uuid NOT NULL REFERENCES atlasbanx.anomalies(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  content     text NOT NULL CHECK (length(content) <= 4000),
  mentions    uuid[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_comments_anomaly
  ON atlasbanx.anomaly_comments(anomaly_id, created_at);

ALTER TABLE atlasbanx.anomaly_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anomaly_comments_select ON atlasbanx.anomaly_comments;
CREATE POLICY anomaly_comments_select ON atlasbanx.anomaly_comments
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS anomaly_comments_insert ON atlasbanx.anomaly_comments;
CREATE POLICY anomaly_comments_insert ON atlasbanx.anomaly_comments
  FOR INSERT WITH CHECK (author_id = auth.uid());

GRANT SELECT, INSERT ON atlasbanx.anomaly_comments TO authenticated;

-- ============================================================================
-- 3. atlasbanx.account_conventions
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.account_conventions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES atlasbanx.bank_accounts(id) ON DELETE CASCADE,
  signed_date   date NOT NULL,
  expires_date  date,
  document_url  text,
  rules         jsonb NOT NULL DEFAULT '{}',
  uploaded_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_conv_period CHECK (expires_date IS NULL OR expires_date > signed_date)
);

CREATE INDEX IF NOT EXISTS idx_account_conv_account
  ON atlasbanx.account_conventions(account_id, signed_date DESC);

ALTER TABLE atlasbanx.account_conventions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_conv_authenticated ON atlasbanx.account_conventions;
CREATE POLICY account_conv_authenticated ON atlasbanx.account_conventions
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON atlasbanx.account_conventions TO authenticated;

-- ============================================================================
-- 4. atlasbanx.signed_reports
-- ============================================================================
-- Différent de atlasbanx.generated_reports : ce dernier stocke le PDF généré.
-- signed_reports y attache la signature ADVIST + le bundle de preuve + les
-- destinataires + le statut d'envoi.

CREATE TABLE IF NOT EXISTS atlasbanx.signed_reports (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id       uuid NOT NULL REFERENCES atlasbanx.bank_statements(id) ON DELETE CASCADE,
  generated_report_id uuid REFERENCES atlasbanx.generated_reports(id) ON DELETE SET NULL,
  template           text NOT NULL CHECK (template IN ('synthese','valeur_probante','export')),
  signer_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  signature_type     text CHECK (signature_type IN ('simple','advist')),
  document_url       text NOT NULL,
  proof_bundle_url   text,
  hash               text NOT NULL,
  timestamp_rfc3161  text,
  recipients         jsonb NOT NULL DEFAULT '[]',
  signed_at          timestamptz,
  status             text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','signed','sent','failed')),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signed_reports_statement
  ON atlasbanx.signed_reports(statement_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signed_reports_hash
  ON atlasbanx.signed_reports(hash);

ALTER TABLE atlasbanx.signed_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS signed_reports_authenticated ON atlasbanx.signed_reports;
CREATE POLICY signed_reports_authenticated ON atlasbanx.signed_reports
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE ON atlasbanx.signed_reports TO authenticated;

-- ============================================================================
-- 5. atlasbanx.bank_complaint_letters
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.bank_complaint_letters (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id             uuid NOT NULL REFERENCES atlasbanx.bank_statements(id) ON DELETE CASCADE,
  bank_code                text NOT NULL,
  total_amount_claimed     bigint NOT NULL,
  anomalies_included       uuid[] NOT NULL DEFAULT '{}',
  document_url             text,
  status                   text NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','sent','accepted','rejected','partial')),
  sent_at                  timestamptz,
  resolution_received_at   timestamptz,
  amount_recovered         bigint NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_complaint_statement
  ON atlasbanx.bank_complaint_letters(statement_id, created_at DESC);

ALTER TABLE atlasbanx.bank_complaint_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS complaint_authenticated ON atlasbanx.bank_complaint_letters;
CREATE POLICY complaint_authenticated ON atlasbanx.bank_complaint_letters
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE ON atlasbanx.bank_complaint_letters TO authenticated;

-- ============================================================================
-- 6. atlasbanx.bank_reconciliations
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.bank_reconciliations (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id              uuid NOT NULL REFERENCES atlasbanx.bank_statements(id) ON DELETE CASCADE,
  ledger_imported_at        timestamptz NOT NULL DEFAULT now(),
  ledger_source             text CHECK (ledger_source IN ('atlas_finance','manual_upload','api_pull')),
  matched_pairs             jsonb NOT NULL DEFAULT '[]',
  unmatched_bank            jsonb NOT NULL DEFAULT '[]',
  unmatched_ledger          jsonb NOT NULL DEFAULT '[]',
  discrepancies             jsonb NOT NULL DEFAULT '[]',
  ledger_entries            jsonb NOT NULL DEFAULT '[]',
  reconciliation_state_url  text,
  generated_at              timestamptz,
  generated_by              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  total_bank_centimes       bigint NOT NULL DEFAULT 0,
  total_ledger_centimes     bigint NOT NULL DEFAULT 0,
  gap_centimes              bigint GENERATED ALWAYS AS (total_bank_centimes - total_ledger_centimes) STORED,
  match_rate                numeric(5,2) NOT NULL DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_recon_statement
  ON atlasbanx.bank_reconciliations(statement_id, created_at DESC);

ALTER TABLE atlasbanx.bank_reconciliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bank_recon_authenticated ON atlasbanx.bank_reconciliations;
CREATE POLICY bank_recon_authenticated ON atlasbanx.bank_reconciliations
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON atlasbanx.bank_reconciliations TO authenticated;

-- ============================================================================
-- 7. PostgREST cache reload
-- ============================================================================

NOTIFY pgrst, 'reload schema';
