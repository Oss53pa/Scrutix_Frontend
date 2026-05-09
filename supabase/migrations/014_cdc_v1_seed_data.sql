-- ============================================================================
-- CDC v1.0 — Seed Data
-- Juridictions réglementaires + banques initiales (5 banques CI)
-- ============================================================================

-- ============================================================================
-- JURIDICTIONS RÉGLEMENTAIRES
-- ============================================================================

INSERT INTO atlasbanx.regulatory_jurisdictions (code, name, scope_countries)
VALUES
  ('BCEAO', 'Banque Centrale des États de l''Afrique de l''Ouest', ARRAY['BJ','BF','CI','GW','ML','NE','SN','TG']),
  ('COBAC', 'Commission Bancaire de l''Afrique Centrale', ARRAY['CM','CF','CG','GA','GQ','TD']),
  ('OHADA', 'Organisation pour l''Harmonisation en Afrique du Droit des Affaires', ARRAY['BJ','BF','CI','GW','ML','NE','SN','TG','CM','CF','CG','GA','GQ','TD'])
ON CONFLICT (code) DO NOTHING;

-- Sous-juridictions nationales
INSERT INTO atlasbanx.regulatory_jurisdictions (code, name, scope_countries, parent_id)
VALUES
  ('CI-MEF', 'Ministère de l''Économie et des Finances - Côte d''Ivoire', ARRAY['CI'],
    (SELECT id FROM atlasbanx.regulatory_jurisdictions WHERE code = 'BCEAO')),
  ('SN-MEF', 'Ministère de l''Économie et des Finances - Sénégal', ARRAY['SN'],
    (SELECT id FROM atlasbanx.regulatory_jurisdictions WHERE code = 'BCEAO')),
  ('CM-MINFI', 'Ministère des Finances - Cameroun', ARRAY['CM'],
    (SELECT id FROM atlasbanx.regulatory_jurisdictions WHERE code = 'COBAC'))
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- RÈGLES RÉGLEMENTAIRES (L1) — Taux d'usure BCEAO
-- ============================================================================

INSERT INTO atlasbanx.regulatory_rules (
  jurisdiction_id, rubric_code, product_category, rule_type,
  value_numeric, unit, valid_from, source_reference
)
SELECT
  j.id, r.rubric_code, r.product_category, 'cap_max',
  r.value_numeric, 'percent', r.valid_from, r.source_reference
FROM atlasbanx.regulatory_jurisdictions j
CROSS JOIN (VALUES
  -- Taux usure BCEAO (avis 01/2024, effectif 2024-07-01)
  ('credits.taux_usure', 'credit_conso', 15.0, '2024-07-01'::DATE, 'Avis BCEAO n°01/2024'),
  ('credits.taux_usure', 'credit_immo', 12.0, '2024-07-01'::DATE, 'Avis BCEAO n°01/2024'),
  ('credits.taux_usure', 'credit_equipement', 13.5, '2024-07-01'::DATE, 'Avis BCEAO n°01/2024'),
  -- CPFD plafond (50% des intérêts débiteurs)
  ('decouverts.cpfd_plafond', NULL, 50.0, '2020-01-01'::DATE, 'Instruction BCEAO n°23/2019'),
  -- Date valeur max versement espèces: J+1
  ('dv.versement_especes', NULL, 1.0, '2020-01-01'::DATE, 'Instruction BCEAO DV'),
  -- Date valeur max chèque sur place: J+3
  ('dv.cheque_sur_place', NULL, 3.0, '2020-01-01'::DATE, 'Instruction BCEAO DV'),
  -- Date valeur virement reçu: J
  ('dv.virement_recu', NULL, 0.0, '2020-01-01'::DATE, 'Instruction BCEAO DV')
) AS r(rubric_code, product_category, value_numeric, valid_from, source_reference)
WHERE j.code = 'BCEAO';

-- ============================================================================
-- 5 BANQUES CI (Phase 1)
-- ============================================================================

INSERT INTO atlasbanx.cdc_banks (code, legal_name, country_iso, zone, jurisdiction_ids, swift_bic, parent_group)
SELECT
  b.code, b.legal_name, 'CI', 'UEMOA',
  ARRAY(SELECT id FROM atlasbanx.regulatory_jurisdictions WHERE code IN ('BCEAO', 'OHADA')),
  b.swift_bic, b.parent_group
FROM (VALUES
  ('SGCI', 'Société Générale Côte d''Ivoire', 'SGBFCIAB', 'Société Générale'),
  ('BICICI', 'Banque Internationale pour le Commerce et l''Industrie de la Côte d''Ivoire', 'BICICIAS', 'BNP Paribas'),
  ('NSIA-CI', 'NSIA Banque Côte d''Ivoire', 'NSIACIAS', 'Groupe NSIA'),
  ('BOA-CI', 'Bank of Africa Côte d''Ivoire', 'AFRICIAS', 'BOA Group'),
  ('ECOBANK-CI', 'Ecobank Côte d''Ivoire', 'EABORGAS', 'Ecobank Transnational')
) AS b(code, legal_name, swift_bic, parent_group)
ON CONFLICT (code) DO NOTHING;
