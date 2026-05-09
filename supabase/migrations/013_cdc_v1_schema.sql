-- ============================================================================
-- CDC Architecture v1.0 — Conditions de Compte (5 couches)
-- Tables fondamentales pour le moteur de résolution multi-couches
-- L1: Réglementaire | L2: Référentiel banque | L3-L5: Conventions client
-- ============================================================================

-- ============================================================================
-- L1 : RÉGLEMENTAIRE (BCEAO / COBAC / OHADA)
-- ============================================================================

CREATE TABLE atlasbanx.regulatory_jurisdictions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,        -- 'BCEAO', 'COBAC', 'CI-USURE'
  name            TEXT NOT NULL,
  scope_countries TEXT[] NOT NULL,             -- ['CI','SN','BJ',...]
  parent_id       UUID REFERENCES atlasbanx.regulatory_jurisdictions(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE atlasbanx.regulatory_jurisdictions ENABLE ROW LEVEL SECURITY;

-- L1 is read-only for authenticated, writable by service_role (Atlas Studio manages)
CREATE POLICY "regulatory_jurisdictions_read"
  ON atlasbanx.regulatory_jurisdictions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "regulatory_jurisdictions_service"
  ON atlasbanx.regulatory_jurisdictions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE TABLE atlasbanx.regulatory_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id   UUID NOT NULL REFERENCES atlasbanx.regulatory_jurisdictions(id),
  rubric_code       TEXT NOT NULL,              -- 'taux_usure', 'cpfd_max'
  product_category  TEXT,                       -- 'credit_conso','credit_immo'
  rule_type         TEXT NOT NULL,              -- 'cap_max','cap_min','formula'
  value_numeric     NUMERIC(18,6),
  value_formula     JSONB,
  unit              TEXT NOT NULL,              -- 'percent','fcfa','days'
  valid_from        DATE NOT NULL,
  valid_to          DATE,
  source_reference  TEXT,
  source_document   TEXT,                       -- Storage URL
  recorded_at       TIMESTAMPTZ DEFAULT NOW(),
  recorded_by       UUID REFERENCES auth.users(id),
  superseded_by     UUID REFERENCES atlasbanx.regulatory_rules(id),
  CONSTRAINT valid_period_regulatory CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE INDEX idx_regulatory_active
  ON atlasbanx.regulatory_rules(jurisdiction_id, rubric_code, valid_from)
  WHERE superseded_by IS NULL;

ALTER TABLE atlasbanx.regulatory_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regulatory_rules_read"
  ON atlasbanx.regulatory_rules FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "regulatory_rules_service"
  ON atlasbanx.regulatory_rules FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- TAXONOMIE DES RUBRIQUES (~180 rubriques)
-- ============================================================================

CREATE TABLE atlasbanx.rubrics_taxonomy (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT UNIQUE NOT NULL,        -- 'decouvert.taux_autorise'
  parent_code       TEXT REFERENCES atlasbanx.rubrics_taxonomy(code),
  category          TEXT NOT NULL,               -- 'compte','cartes','credits'
  display_label_fr  TEXT NOT NULL,
  unit              TEXT NOT NULL,               -- 'percent','fcfa','days','count'
  is_dimensional    BOOLEAN DEFAULT FALSE,
  description       TEXT
);

CREATE INDEX idx_rubrics_category ON atlasbanx.rubrics_taxonomy(category);
CREATE INDEX idx_rubrics_parent ON atlasbanx.rubrics_taxonomy(parent_code);

ALTER TABLE atlasbanx.rubrics_taxonomy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rubrics_taxonomy_read"
  ON atlasbanx.rubrics_taxonomy FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "rubrics_taxonomy_service"
  ON atlasbanx.rubrics_taxonomy FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- L2 : RÉFÉRENTIEL BANQUE (Conditions Générales publiques)
-- ============================================================================

-- CDC banks table (enhanced, separate from existing atlasbanx.user_banks)
CREATE TABLE atlasbanx.cdc_banks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT UNIQUE NOT NULL,       -- 'NSIA-CI','SGCI'
  legal_name        TEXT NOT NULL,
  country_iso       CHAR(2) NOT NULL,
  zone              TEXT NOT NULL,              -- 'UEMOA','CEMAC'
  jurisdiction_ids  UUID[] NOT NULL DEFAULT '{}',
  swift_bic         TEXT,
  parent_group      TEXT,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE atlasbanx.cdc_banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cdc_banks_read"
  ON atlasbanx.cdc_banks FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "cdc_banks_service"
  ON atlasbanx.cdc_banks FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE TABLE atlasbanx.bank_reference_versions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id            UUID NOT NULL REFERENCES atlasbanx.cdc_banks(id),
  version_label      TEXT NOT NULL,
  effective_from     DATE NOT NULL,
  effective_to       DATE,
  source_pdf_url     TEXT NOT NULL,
  source_hash_sha256 TEXT NOT NULL,
  validation_status  TEXT NOT NULL CHECK (validation_status IN ('draft','validated','published')),
  validated_by       UUID REFERENCES auth.users(id),
  validated_at       TIMESTAMPTZ,
  published_at       TIMESTAMPTZ,
  superseded_by      UUID REFERENCES atlasbanx.bank_reference_versions(id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT version_period CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX idx_bank_ref_versions_bank
  ON atlasbanx.bank_reference_versions(bank_id, effective_from DESC);

ALTER TABLE atlasbanx.bank_reference_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_ref_versions_read"
  ON atlasbanx.bank_reference_versions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "bank_ref_versions_service"
  ON atlasbanx.bank_reference_versions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE TABLE atlasbanx.bank_reference_conditions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_version_id UUID NOT NULL REFERENCES atlasbanx.bank_reference_versions(id),
  rubric_code          TEXT NOT NULL REFERENCES atlasbanx.rubrics_taxonomy(code),
  dimensions           JSONB,                     -- {"montant":{"min":0,"max":1000000},"profil":"PME"}
  value_numeric        NUMERIC(18,6),
  value_formula        JSONB,
  pdf_bbox             JSONB,                     -- {x,y,w,h}
  pdf_page             INTEGER,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ref_cond_lookup
  ON atlasbanx.bank_reference_conditions(reference_version_id, rubric_code);

ALTER TABLE atlasbanx.bank_reference_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_ref_conditions_read"
  ON atlasbanx.bank_reference_conditions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "bank_ref_conditions_service"
  ON atlasbanx.bank_reference_conditions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- L3/L4/L5 : CONVENTIONS CLIENT (table unifiée)
-- ============================================================================

-- CDC organizations with hierarchy (separate from public.organizations)
CREATE TABLE atlasbanx.cdc_organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  parent_id     UUID REFERENCES atlasbanx.cdc_organizations(id),
  legal_name    TEXT NOT NULL,
  trade_name    TEXT,
  org_type      TEXT NOT NULL CHECK (org_type IN ('cabinet','group','subsidiary','client')),
  rccm          TEXT,
  tax_id        TEXT,
  country_iso   CHAR(2) NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_parent CHECK (id != parent_id)
);

CREATE INDEX idx_cdc_org_hierarchy ON atlasbanx.cdc_organizations(parent_id);
CREATE INDEX idx_cdc_org_tenant ON atlasbanx.cdc_organizations(tenant_id);

ALTER TABLE atlasbanx.cdc_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cdc_orgs_tenant_read"
  ON atlasbanx.cdc_organizations FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
  ));

CREATE POLICY "cdc_orgs_tenant_write"
  ON atlasbanx.cdc_organizations FOR ALL
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
  ));

-- CDC bank accounts (enhanced, linked to CDC organizations & banks)
CREATE TABLE atlasbanx.cdc_bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES atlasbanx.cdc_organizations(id),
  bank_id         UUID NOT NULL REFERENCES atlasbanx.cdc_banks(id),
  account_number  TEXT NOT NULL,              -- chiffré pgcrypto
  account_label   TEXT,
  account_type    TEXT NOT NULL CHECK (account_type IN ('courant','epargne','devise','titres')),
  currency        CHAR(3) NOT NULL,           -- 'XOF','XAF','EUR','USD'
  iban            TEXT,
  opened_at       DATE,
  closed_at       DATE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bank_id, account_number)
);

CREATE INDEX idx_cdc_accounts_org ON atlasbanx.cdc_bank_accounts(organization_id);
CREATE INDEX idx_cdc_accounts_bank ON atlasbanx.cdc_bank_accounts(bank_id);

ALTER TABLE atlasbanx.cdc_bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS via organization tenant
CREATE POLICY "cdc_accounts_tenant_read"
  ON atlasbanx.cdc_bank_accounts FOR SELECT
  TO authenticated
  USING (organization_id IN (
    SELECT id FROM atlasbanx.cdc_organizations WHERE tenant_id IN (
      SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "cdc_accounts_tenant_write"
  ON atlasbanx.cdc_bank_accounts FOR ALL
  TO authenticated
  USING (organization_id IN (
    SELECT id FROM atlasbanx.cdc_organizations WHERE tenant_id IN (
      SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
    )
  ))
  WITH CHECK (organization_id IN (
    SELECT id FROM atlasbanx.cdc_organizations WHERE tenant_id IN (
      SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
    )
  ));

-- Agreements: unified table for L3 (group), L4 (client), L5 (amendment)
CREATE TABLE atlasbanx.agreements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer              SMALLINT NOT NULL CHECK (layer IN (3,4,5)),
  scope_org_id       UUID NOT NULL REFERENCES atlasbanx.cdc_organizations(id),
  bank_id            UUID NOT NULL REFERENCES atlasbanx.cdc_banks(id),
  account_id         UUID REFERENCES atlasbanx.cdc_bank_accounts(id),  -- NULL = all accounts
  agreement_label    TEXT NOT NULL,
  signed_at          DATE NOT NULL,
  valid_from         DATE NOT NULL,
  valid_to           DATE,
  recorded_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_to        TIMESTAMPTZ,              -- NULL = current version
  source_pdf_url     TEXT,
  source_hash_sha256 TEXT,
  validation_status  TEXT NOT NULL CHECK (validation_status IN ('draft','validated')),
  validated_by       UUID REFERENCES auth.users(id),
  superseded_by      UUID REFERENCES atlasbanx.agreements(id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT validity_period_agreement CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE INDEX idx_agreement_lookup
  ON atlasbanx.agreements(scope_org_id, bank_id, valid_from, layer)
  WHERE recorded_to IS NULL;

ALTER TABLE atlasbanx.agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agreements_tenant_read"
  ON atlasbanx.agreements FOR SELECT
  TO authenticated
  USING (scope_org_id IN (
    SELECT id FROM atlasbanx.cdc_organizations WHERE tenant_id IN (
      SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "agreements_tenant_write"
  ON atlasbanx.agreements FOR ALL
  TO authenticated
  USING (scope_org_id IN (
    SELECT id FROM atlasbanx.cdc_organizations WHERE tenant_id IN (
      SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
    )
  ))
  WITH CHECK (scope_org_id IN (
    SELECT id FROM atlasbanx.cdc_organizations WHERE tenant_id IN (
      SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
    )
  ));

-- Agreement conditions (individual rubric overrides)
CREATE TABLE atlasbanx.agreement_conditions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id  UUID NOT NULL REFERENCES atlasbanx.agreements(id) ON DELETE CASCADE,
  rubric_code   TEXT NOT NULL REFERENCES atlasbanx.rubrics_taxonomy(code),
  dimensions    JSONB,
  value_numeric NUMERIC(18,6),
  value_formula JSONB,
  pdf_bbox      JSONB,
  pdf_page      INTEGER,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agreement_cond ON atlasbanx.agreement_conditions(agreement_id, rubric_code);

ALTER TABLE atlasbanx.agreement_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agreement_conditions_tenant_read"
  ON atlasbanx.agreement_conditions FOR SELECT
  TO authenticated
  USING (agreement_id IN (
    SELECT id FROM atlasbanx.agreements WHERE scope_org_id IN (
      SELECT id FROM atlasbanx.cdc_organizations WHERE tenant_id IN (
        SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
      )
    )
  ));

CREATE POLICY "agreement_conditions_tenant_write"
  ON atlasbanx.agreement_conditions FOR ALL
  TO authenticated
  USING (agreement_id IN (
    SELECT id FROM atlasbanx.agreements WHERE scope_org_id IN (
      SELECT id FROM atlasbanx.cdc_organizations WHERE tenant_id IN (
        SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
      )
    )
  ))
  WITH CHECK (agreement_id IN (
    SELECT id FROM atlasbanx.agreements WHERE scope_org_id IN (
      SELECT id FROM atlasbanx.cdc_organizations WHERE tenant_id IN (
        SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
      )
    )
  ));

-- ============================================================================
-- AUDIT RESOLUTION LOG (receipt trail)
-- ============================================================================

CREATE TABLE atlasbanx.resolution_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES atlasbanx.cdc_bank_accounts(id),
  rubric_code     TEXT NOT NULL REFERENCES atlasbanx.rubrics_taxonomy(code),
  reference_date  DATE NOT NULL,
  dimensions      JSONB,
  -- Resolution result
  layer_used      SMALLINT NOT NULL,
  source_id       UUID NOT NULL,               -- ID of the condition/rule used
  source_label    TEXT NOT NULL,
  value_resolved  NUMERIC(18,6),
  formula_resolved JSONB,
  -- Receipt metadata
  superseded_layers JSONB NOT NULL DEFAULT '[]', -- [{layer, reason}]
  regulatory_violations JSONB NOT NULL DEFAULT '[]', -- [{rule_id, code, message}]
  resolved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Audit context
  audit_session_id UUID,
  resolved_by     UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_resolution_log_account
  ON atlasbanx.resolution_log(account_id, rubric_code, reference_date);

ALTER TABLE atlasbanx.resolution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resolution_log_tenant_read"
  ON atlasbanx.resolution_log FOR SELECT
  TO authenticated
  USING (account_id IN (
    SELECT id FROM atlasbanx.cdc_bank_accounts WHERE organization_id IN (
      SELECT id FROM atlasbanx.cdc_organizations WHERE tenant_id IN (
        SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
      )
    )
  ));

CREATE POLICY "resolution_log_insert"
  ON atlasbanx.resolution_log FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "resolution_log_service"
  ON atlasbanx.resolution_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- AUDIT SESSIONS (tracks full audit runs using CDC)
-- ============================================================================

CREATE TABLE atlasbanx.cdc_audit_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  organization_id   UUID NOT NULL REFERENCES atlasbanx.cdc_organizations(id),
  account_id        UUID NOT NULL REFERENCES atlasbanx.cdc_bank_accounts(id),
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','running','completed','failed')),
  -- Results summary
  total_operations  INTEGER DEFAULT 0,
  total_ecarts      INTEGER DEFAULT 0,
  total_impact_centimes BIGINT DEFAULT 0,
  ecarts_by_code    JSONB DEFAULT '{}',        -- {E01: 5, E02: 1, ...}
  -- Metadata
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  started_by        UUID REFERENCES auth.users(id),
  error             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE atlasbanx.cdc_audit_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_sessions_tenant"
  ON atlasbanx.cdc_audit_sessions FOR ALL
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- ÉCARTS DÉTECTÉS (audit findings with CDC codes)
-- ============================================================================

CREATE TABLE atlasbanx.cdc_ecarts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_session_id    UUID NOT NULL REFERENCES atlasbanx.cdc_audit_sessions(id) ON DELETE CASCADE,
  code                TEXT NOT NULL,             -- E01..E08
  rubric_code         TEXT NOT NULL REFERENCES atlasbanx.rubrics_taxonomy(code),
  -- Resolution receipt reference
  resolution_id       UUID REFERENCES atlasbanx.resolution_log(id),
  -- Amounts (BIGINT centimes)
  expected_centimes   BIGINT NOT NULL,
  actual_centimes     BIGINT NOT NULL,
  ecart_centimes      BIGINT NOT NULL,
  -- Scoring
  materialite_centimes BIGINT NOT NULL,
  confiance           SMALLINT NOT NULL CHECK (confiance BETWEEN 0 AND 100),
  recuperabilite      TEXT NOT NULL CHECK (recuperabilite IN ('forte','moyenne','faible')),
  -- Context
  operation_date      DATE,
  operation_ref       TEXT,
  description         TEXT NOT NULL,
  details             JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ecarts_session ON atlasbanx.cdc_ecarts(audit_session_id, code);

ALTER TABLE atlasbanx.cdc_ecarts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ecarts_tenant_read"
  ON atlasbanx.cdc_ecarts FOR SELECT
  TO authenticated
  USING (audit_session_id IN (
    SELECT id FROM atlasbanx.cdc_audit_sessions WHERE tenant_id IN (
      SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "ecarts_tenant_write"
  ON atlasbanx.cdc_ecarts FOR ALL
  TO authenticated
  USING (audit_session_id IN (
    SELECT id FROM atlasbanx.cdc_audit_sessions WHERE tenant_id IN (
      SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
    )
  ))
  WITH CHECK (audit_session_id IN (
    SELECT id FROM atlasbanx.cdc_audit_sessions WHERE tenant_id IN (
      SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
    )
  ));

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA atlasbanx TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA atlasbanx TO service_role;
