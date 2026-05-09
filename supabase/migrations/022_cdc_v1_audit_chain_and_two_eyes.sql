-- ============================================================================
-- ATLASBANX — Migration 022 — CDC v1.0 § audit signing + 2-eyes + matview
-- ============================================================================
-- Couvre les exigences :
--   §5.5 Performance — vue matérialisée resolved_conditions (DDL §4.4 du CDC)
--   §8.3 Auditabilité — receipts signés persistés en append-only avec hash chain
--   §8.4 Maintenabilité — workflow à deux yeux pour publication L2
--
-- Idempotente. Applicable sans casser l'existant.
-- ============================================================================

-- ============================================================================
-- 1. Hash chain — table d'archives des receipts signés
-- ============================================================================
-- Append-only : chaque résolution produit un receipt persisté avec sa
-- signature HMAC-SHA256, son hash SHA-256 et une référence vers le précédent
-- (chaîne tamper-evident).
--
-- Index :
--   - (audit_session_id, sequence_number) → reconstitution chronologique
--   - receipt_hash → vérification rapide « ce hash existe-t-il ? »
-- ============================================================================

CREATE TABLE IF NOT EXISTS atlasbanx.cdc_audit_receipts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_session_id     uuid REFERENCES atlasbanx.cdc_audit_sessions(id) ON DELETE CASCADE,
  sequence_number      bigint NOT NULL,
  rubric_code          text NOT NULL,
  account_id           uuid,
  reference_date       date NOT NULL,
  layer_used           smallint NOT NULL CHECK (layer_used BETWEEN 1 AND 5),
  source_id            text NOT NULL,
  source_label         text NOT NULL,
  resolved_value       numeric(18,6),
  raw_value            numeric(18,6),
  cap_applied          boolean NOT NULL DEFAULT false,
  mode                 text NOT NULL CHECK (mode IN ('strict','prescriptif')),
  receipt_payload      jsonb NOT NULL,           -- canonical form (without sig/hash)
  signature            text NOT NULL,            -- HMAC-SHA256 hex
  signature_algo       text NOT NULL DEFAULT 'hmac-sha256',
  signature_key_id     text NOT NULL,
  receipt_hash         text NOT NULL,            -- SHA-256 hex
  previous_hash        text,                     -- NULL si tête de chaîne
  resolved_at          timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audit_session_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_cdc_audit_receipts_session
  ON atlasbanx.cdc_audit_receipts(audit_session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_cdc_audit_receipts_hash
  ON atlasbanx.cdc_audit_receipts(receipt_hash);
CREATE INDEX IF NOT EXISTS idx_cdc_audit_receipts_rubric
  ON atlasbanx.cdc_audit_receipts(rubric_code, reference_date);

-- Append-only : pas d'UPDATE ni de DELETE en dehors d'opérations admin
-- (faiblesse acceptée pour audits ; un trigger BEFORE UPDATE/DELETE peut
-- être ajouté ultérieurement en mode forensique strict).

ALTER TABLE atlasbanx.cdc_audit_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_receipts_tenant_select ON atlasbanx.cdc_audit_receipts;
CREATE POLICY audit_receipts_tenant_select ON atlasbanx.cdc_audit_receipts
  FOR SELECT USING (
    -- Visible aux utilisateurs ayant un seat sur le tenant de la session
    EXISTS (
      SELECT 1 FROM atlasbanx.cdc_audit_sessions s
      WHERE s.id = cdc_audit_receipts.audit_session_id
        AND s.tenant_id IN (
          SELECT tenant_id FROM licence_seats WHERE user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS audit_receipts_authenticated_insert ON atlasbanx.cdc_audit_receipts;
CREATE POLICY audit_receipts_authenticated_insert ON atlasbanx.cdc_audit_receipts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT ON atlasbanx.cdc_audit_receipts TO authenticated;

-- ============================================================================
-- 2. Workflow à 2 yeux — bank_reference_versions
-- ============================================================================
-- §8.4 : « Workflow de validation à deux yeux obligatoire pour toute
-- publication d'une nouvelle version L2. »
--
-- Évolution :
--   - submitted_by, submitted_at  → premier opérateur (saisie + soumission)
--   - validated_by, validated_at  → deuxième opérateur (revue + validation)
--   - published_at, published_by  → publication effective
--
-- Statuts désormais :
--   draft → submitted → validated → published
--           ↓             ↓
--         rejected     rejected
-- ============================================================================

ALTER TABLE atlasbanx.bank_reference_versions
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE atlasbanx.bank_reference_versions
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

ALTER TABLE atlasbanx.bank_reference_versions
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE atlasbanx.bank_reference_versions
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Évolution du CHECK constraint sur validation_status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'atlasbanx'
      AND table_name = 'bank_reference_versions'
      AND constraint_name LIKE '%validation_status%'
  ) THEN
    ALTER TABLE atlasbanx.bank_reference_versions
      DROP CONSTRAINT IF EXISTS bank_reference_versions_validation_status_check;
  END IF;
END$$;

ALTER TABLE atlasbanx.bank_reference_versions
  ADD CONSTRAINT bank_reference_versions_validation_status_check
  CHECK (validation_status IN ('draft','submitted','validated','published','rejected'));

-- Trigger anti-self-validation : un même utilisateur ne peut pas être
-- à la fois submitted_by et validated_by sur la même version.
CREATE OR REPLACE FUNCTION atlasbanx.check_two_eyes_distinct_users()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.validated_by IS NOT NULL
     AND NEW.submitted_by IS NOT NULL
     AND NEW.validated_by = NEW.submitted_by THEN
    RAISE EXCEPTION 'Two-eyes violation: validated_by must differ from submitted_by';
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_bank_ref_two_eyes ON atlasbanx.bank_reference_versions;
CREATE TRIGGER trg_bank_ref_two_eyes
  BEFORE INSERT OR UPDATE ON atlasbanx.bank_reference_versions
  FOR EACH ROW EXECUTE FUNCTION atlasbanx.check_two_eyes_distinct_users();

-- ============================================================================
-- 3. Vue matérialisée resolved_conditions (CDC §4.4)
-- ============================================================================
-- Précalcule les conditions actuellement applicables (couche la plus haute
-- non-NULL pour chaque (account, rubric)). Utilisée par l'UI pour afficher
-- en temps réel les conditions résolues, sans solliciter le moteur en TS.
--
-- ⚠️ Ne couvre PAS la résolution dimensionnelle ni les modes — c'est une
-- vue d'aperçu rapide. Les calculs d'audit utilisent toujours
-- ResolutionEngine côté TS pour la précision et la dimensionalité.
--
-- Rafraîchissement : nocturne via pg_cron (à câbler si extension dispo).
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS atlasbanx.resolved_conditions;

CREATE MATERIALIZED VIEW atlasbanx.resolved_conditions AS
SELECT
  ba.id            AS account_id,
  ba.organization_id,
  ba.bank_id,
  rt.code          AS rubric_code,
  rt.display_label_fr,
  rt.unit,
  COALESCE(
    -- L5 : avenant ponctuel
    (SELECT ac.value_numeric FROM atlasbanx.agreement_conditions ac
       JOIN atlasbanx.agreements a ON a.id = ac.agreement_id
      WHERE a.layer = 5 AND a.scope_org_id = ba.organization_id
        AND a.bank_id = ba.bank_id
        AND (a.account_id = ba.id OR a.account_id IS NULL)
        AND ac.rubric_code = rt.code
        AND a.valid_from <= CURRENT_DATE
        AND (a.valid_to IS NULL OR a.valid_to > CURRENT_DATE)
        AND a.recorded_to IS NULL
      ORDER BY a.signed_at DESC LIMIT 1),
    -- L4 : convention client
    (SELECT ac.value_numeric FROM atlasbanx.agreement_conditions ac
       JOIN atlasbanx.agreements a ON a.id = ac.agreement_id
      WHERE a.layer = 4 AND a.scope_org_id = ba.organization_id
        AND a.bank_id = ba.bank_id
        AND ac.rubric_code = rt.code
        AND a.valid_from <= CURRENT_DATE
        AND (a.valid_to IS NULL OR a.valid_to > CURRENT_DATE)
        AND a.recorded_to IS NULL
      ORDER BY a.signed_at DESC LIMIT 1),
    -- L3 : convention groupe (parent direct seulement — la récursion
    -- complète est gérée côté TS pour les hiérarchies profondes)
    (SELECT ac.value_numeric FROM atlasbanx.agreement_conditions ac
       JOIN atlasbanx.agreements a ON a.id = ac.agreement_id
       JOIN atlasbanx.cdc_organizations o ON o.id = ba.organization_id
      WHERE a.layer = 3
        AND (a.scope_org_id = o.parent_id OR a.scope_org_id = ba.organization_id)
        AND a.bank_id = ba.bank_id
        AND ac.rubric_code = rt.code
        AND a.valid_from <= CURRENT_DATE
        AND (a.valid_to IS NULL OR a.valid_to > CURRENT_DATE)
        AND a.recorded_to IS NULL
      ORDER BY a.signed_at DESC LIMIT 1),
    -- L2 : référentiel banque
    (SELECT brc.value_numeric FROM atlasbanx.bank_reference_conditions brc
       JOIN atlasbanx.bank_reference_versions brv
         ON brv.id = brc.reference_version_id
      WHERE brv.bank_id = ba.bank_id
        AND brc.rubric_code = rt.code
        AND brv.effective_from <= CURRENT_DATE
        AND (brv.effective_to IS NULL OR brv.effective_to > CURRENT_DATE)
        AND brv.validation_status = 'published'
      ORDER BY brv.effective_from DESC LIMIT 1)
  )::numeric AS resolved_value,
  -- Indique quelle couche a fourni la valeur (pour debug UI)
  (CASE
     WHEN EXISTS (
       SELECT 1 FROM atlasbanx.agreement_conditions ac
       JOIN atlasbanx.agreements a ON a.id = ac.agreement_id
       WHERE a.layer = 5 AND a.scope_org_id = ba.organization_id
         AND a.bank_id = ba.bank_id
         AND ac.rubric_code = rt.code
         AND a.valid_from <= CURRENT_DATE
         AND (a.valid_to IS NULL OR a.valid_to > CURRENT_DATE)
         AND a.recorded_to IS NULL
     ) THEN 5
     WHEN EXISTS (
       SELECT 1 FROM atlasbanx.agreement_conditions ac
       JOIN atlasbanx.agreements a ON a.id = ac.agreement_id
       WHERE a.layer = 4 AND a.scope_org_id = ba.organization_id
         AND a.bank_id = ba.bank_id
         AND ac.rubric_code = rt.code
         AND a.valid_from <= CURRENT_DATE
         AND (a.valid_to IS NULL OR a.valid_to > CURRENT_DATE)
         AND a.recorded_to IS NULL
     ) THEN 4
     WHEN EXISTS (
       SELECT 1 FROM atlasbanx.agreement_conditions ac
       JOIN atlasbanx.agreements a ON a.id = ac.agreement_id
       JOIN atlasbanx.cdc_organizations o ON o.id = ba.organization_id
       WHERE a.layer = 3
         AND (a.scope_org_id = o.parent_id OR a.scope_org_id = ba.organization_id)
         AND a.bank_id = ba.bank_id
         AND ac.rubric_code = rt.code
         AND a.valid_from <= CURRENT_DATE
         AND (a.valid_to IS NULL OR a.valid_to > CURRENT_DATE)
         AND a.recorded_to IS NULL
     ) THEN 3
     WHEN EXISTS (
       SELECT 1 FROM atlasbanx.bank_reference_conditions brc
       JOIN atlasbanx.bank_reference_versions brv
         ON brv.id = brc.reference_version_id
       WHERE brv.bank_id = ba.bank_id
         AND brc.rubric_code = rt.code
         AND brv.effective_from <= CURRENT_DATE
         AND (brv.effective_to IS NULL OR brv.effective_to > CURRENT_DATE)
         AND brv.validation_status = 'published'
     ) THEN 2
     ELSE NULL
   END)::smallint AS layer_used
FROM atlasbanx.cdc_bank_accounts ba
CROSS JOIN atlasbanx.rubrics_taxonomy rt
WHERE ba.is_active = TRUE
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_resolved_conditions_pk
  ON atlasbanx.resolved_conditions(account_id, rubric_code);

CREATE INDEX IF NOT EXISTS idx_resolved_conditions_org
  ON atlasbanx.resolved_conditions(organization_id);

CREATE INDEX IF NOT EXISTS idx_resolved_conditions_bank
  ON atlasbanx.resolved_conditions(bank_id);

GRANT SELECT ON atlasbanx.resolved_conditions TO authenticated;

-- ============================================================================
-- 4. Helper RPC — refresh manuel de la vue matérialisée
-- ============================================================================

CREATE OR REPLACE FUNCTION atlasbanx.refresh_resolved_conditions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY atlasbanx.resolved_conditions;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback non-concurrent au premier appel (l'index unique doit déjà être posé)
    REFRESH MATERIALIZED VIEW atlasbanx.resolved_conditions;
END$$;

GRANT EXECUTE ON FUNCTION atlasbanx.refresh_resolved_conditions() TO authenticated;

-- ============================================================================
-- 5. Helper RPC — submit / validate / reject une bank_reference_version
-- ============================================================================

CREATE OR REPLACE FUNCTION atlasbanx.submit_bank_reference_version(
  p_version_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE atlasbanx.bank_reference_versions
     SET validation_status = 'submitted',
         submitted_by = auth.uid(),
         submitted_at = now()
   WHERE id = p_version_id
     AND validation_status = 'draft';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version % not found or not in draft status', p_version_id;
  END IF;
END$$;

CREATE OR REPLACE FUNCTION atlasbanx.validate_bank_reference_version(
  p_version_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_submitter uuid;
BEGIN
  SELECT submitted_by INTO v_submitter
    FROM atlasbanx.bank_reference_versions
   WHERE id = p_version_id
     AND validation_status = 'submitted';
  IF v_submitter IS NULL THEN
    RAISE EXCEPTION 'Version % not found or not submitted', p_version_id;
  END IF;
  IF v_submitter = auth.uid() THEN
    RAISE EXCEPTION 'Two-eyes violation: validator must differ from submitter';
  END IF;
  UPDATE atlasbanx.bank_reference_versions
     SET validation_status = 'validated',
         validated_by = auth.uid(),
         validated_at = now()
   WHERE id = p_version_id;
END$$;

CREATE OR REPLACE FUNCTION atlasbanx.publish_bank_reference_version(
  p_version_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE atlasbanx.bank_reference_versions
     SET validation_status = 'published',
         published_by = auth.uid(),
         published_at = now()
   WHERE id = p_version_id
     AND validation_status = 'validated';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version % not validated yet', p_version_id;
  END IF;
END$$;

CREATE OR REPLACE FUNCTION atlasbanx.reject_bank_reference_version(
  p_version_id uuid,
  p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE atlasbanx.bank_reference_versions
     SET validation_status = 'rejected',
         rejection_reason = p_reason
   WHERE id = p_version_id
     AND validation_status IN ('submitted','draft');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version % not found or already published', p_version_id;
  END IF;
END$$;

GRANT EXECUTE ON FUNCTION atlasbanx.submit_bank_reference_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION atlasbanx.validate_bank_reference_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION atlasbanx.publish_bank_reference_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION atlasbanx.reject_bank_reference_version(uuid, text) TO authenticated;

-- ============================================================================
-- 6. Reload PostgREST schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';
