// ============================================================================
// ATLASBANX - C1 Handler: Extraction CG bancaires
// Zone: Orange (proposition, validation humaine requise)
// Baseline V1: wraps DocumentIntelligenceEngine + FieldRegistry
// Produces C1Output from existing extraction cascade (Pattern → Tabular → Semantic)
// ============================================================================

import type { C1Input, C1Output, ExtractedCondition, BoundingBox } from '../types';
import { FIELD_DEFINITIONS } from '../../../../extraction/FieldRegistry';
import type { FieldDefinition } from '../../../../extraction/types';

// ----------------------------------------------------------------------------
// FieldDefinition key → rubric_code mapping
// The FieldRegistry uses dotted keys like 'accountFees.tenueCompte.particulier'
// We map these to taxonomy rubric codes.
// ----------------------------------------------------------------------------

const FIELD_TO_RUBRIC: Record<string, string> = {
  // Account fees (from FieldRegistry actual keys)
  'accountFees.tenueCompte.particulier': 'compte.tenue_mensuelle',
  'accountFees.tenueCompte.professionnel': 'compte.tenue_mensuelle',
  'accountFees.tenueCompte.entreprise': 'compte.tenue_mensuelle',
  'accountFees.fraisOuverture': 'compte.ouverture',
  'accountFees.fraisCloture': 'compte.cloture',
  'accountFees.fraisInactivite': 'compte.inactivite',
  'accountFees.releveCompte.mensuel': 'compte.releve_mensuel',
  'accountFees.releveCompte.duplicata': 'compte.releve_duplicata',
  'accountFees.attestationSolde': 'compte.attestation_solde',
  'accountFees.lettreInjonction': 'compte.lettre_injonction',

  // Overdrafts / Credits
  'creditFees.tauxDecouvertAutorise': 'decouverts.taux_autorise',
  'creditFees.tauxDecouvertNonAutorise': 'decouverts.taux_non_autorise',
  'creditFees.commissionMouvement': 'decouverts.commission_mouvement',
  'creditFees.commissionPlusForteDecouverte': 'decouverts.cpfd',
  'creditFees.tauxUsureLegal': 'decouverts.taux_autorise',
  'creditFees.fraisDossierCredit': 'credits.frais_dossier',
  'creditFees.creditConsoTauxMin': 'credits.taux_conso',
  'creditFees.creditConsoTauxMax': 'credits.taux_conso',
  'creditFees.creditImmoTauxMin': 'credits.taux_immo',
  'creditFees.creditImmoTauxMax': 'credits.taux_immo',

  // Cards
  'cardFees.visaClassic': 'cartes.cotisation_debit',
  'cardFees.visaGold': 'cartes.cotisation_debit',
  'cardFees.visaPlatinum': 'cartes.cotisation_credit',
  'cardFees.gimac': 'cartes.cotisation_debit',
  'cardFees.opposition': 'cartes.opposition',
  'cardFees.retraitDabAutreBanque': 'cartes.retrait_dab_autre',

  // Transfers
  'transferFees.virementInterne.commission': 'virements.intra_banque',
  'transferFees.virementCemacUemoa.commission': 'virements.national',
  'transferFees.virementInternational.commission': 'virements.international',
  'transferFees.virementInternational.swift': 'virements.commission_swift',

  // Checks
  'checkFees.chequierEmission': 'cheques.frais_chequier',
  'checkFees.oppositionCheque': 'cheques.opposition_cheque',
  'checkFees.chequeSansProvision': 'cheques.frais_rejet_emis',

  // E-banking
  'eBankingFees.abonnementMensuel': 'ebanking.abonnement',
  'eBankingFees.smsAlerte': 'ebanking.alerte_sms',
};

// ----------------------------------------------------------------------------
// Unit detection from field definition
// ----------------------------------------------------------------------------

function inferUnit(fdef: FieldDefinition): 'percent' | 'fcfa' | 'days' | 'count' {
  if (fdef.kind === 'percentage' || fdef.unitHint === '%') return 'percent';
  if (fdef.kind === 'days' || fdef.unitHint === 'jours') return 'days';
  if (fdef.kind === 'count') return 'count';
  return 'fcfa';
}

// Placeholder bbox (V1 doesn't have page-level OCR coordinates)
const PLACEHOLDER_BBOX: BoundingBox = { x: 0, y: 0, w: 100, h: 10 };

// ----------------------------------------------------------------------------
// Text-based extraction engine (pure regex, no LLM)
// Extracts conditions from raw text using FieldRegistry patterns
// ----------------------------------------------------------------------------

function extractFromText(
  text: string,
  bankCode: string | undefined,
  expectedTaxonomy: string[],
): ExtractedCondition[] {
  const conditions: ExtractedCondition[] = [];
  const expectedSet = new Set(expectedTaxonomy);

  for (const fdef of FIELD_DEFINITIONS) {
    const rubricCode = FIELD_TO_RUBRIC[fdef.key];
    if (!rubricCode) continue;

    // If taxonomy filter is provided, skip rubrics not in the expected list
    if (expectedTaxonomy.length > 0 && !expectedSet.has(rubricCode)) continue;

    // Try each alias pattern
    let bestMatch: { value: number; evidence: string; confidence: number } | null = null;

    if (fdef.aliases) {
      for (const alias of fdef.aliases) {
        // Normalize: strip accents so patterns match accent-free OCR text
        const normalized = alias
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        const escaped = normalized
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\s+/g, '\\s+');
        const re = new RegExp(
          `${escaped}\\s*[:\\-.…\\s]{0,80}([0-9][0-9\\s\\u00A0.,]{0,15})`,
          'i'
        );
        const match = text.match(re);
        if (match?.[1]) {
          const rawNum = match[1].replace(/[\s\u00A0]/g, '').replace(',', '.');
          const value = parseFloat(rawNum);
          if (!isNaN(value)) {
            const confidence = 75; // Regex baseline confidence
            if (!bestMatch || confidence > bestMatch.confidence) {
              bestMatch = {
                value,
                evidence: match[0].trim().slice(0, 200),
                confidence,
              };
            }
          }
        }
      }
    }

    // Also try label directly (normalize accents)
    if (!bestMatch && fdef.label) {
      const normalizedLabel = fdef.label
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const escaped = normalizedLabel
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\s+/g, '\\s+');
      const re = new RegExp(
        `${escaped}\\s*[:\\-.…\\s]{0,80}([0-9][0-9\\s\\u00A0.,]{0,15})`,
        'i'
      );
      const match = text.match(re);
      if (match?.[1]) {
        const rawNum = match[1].replace(/[\s\u00A0]/g, '').replace(',', '.');
        const value = parseFloat(rawNum);
        if (!isNaN(value)) {
          bestMatch = {
            value,
            evidence: match[0].trim().slice(0, 200),
            confidence: 70,
          };
        }
      }
    }

    // Validate against range if defined
    if (bestMatch && fdef.range) {
      if (bestMatch.value < fdef.range.min || bestMatch.value > fdef.range.max) {
        bestMatch.confidence = Math.max(bestMatch.confidence - 30, 10);
      }
    }

    conditions.push({
      rubric_code: rubricCode,
      raw_label: fdef.label,
      value_numeric: bestMatch?.value ?? null,
      value_formula: null,
      unit: inferUnit(fdef),
      dimensions: null,
      pdf_page: 1, // V1: no page-level tracking
      pdf_bbox: PLACEHOLDER_BBOX,
      confidence: bestMatch?.confidence ?? 0,
      extraction_notes: bestMatch
        ? `Match regex: "${bestMatch.evidence}"`
        : 'Rubrique non trouvee dans le document',
    });
  }

  return conditions;
}

// ----------------------------------------------------------------------------
// Detect document metadata from text
// ----------------------------------------------------------------------------

function detectMetadata(text: string, bankId: string): C1Output['document_metadata'] {
  // Detect version / date
  const dateRe = /(?:applicable|vigueur|compter)\s*(?:du|a)\s*(?:le\s*)?(\d{1,2}[\s/.-]\d{1,2}[\s/.-]\d{2,4})/i;
  const dateMatch = text.match(dateRe);

  const versionRe = /version\s*:?\s*([^\n]{3,30})/i;
  const versionMatch = text.match(versionRe);

  // Rough page count from form feeds or page markers
  const pageMarkers = text.match(/page\s+\d+|\f/gi);
  const pageCount = pageMarkers ? pageMarkers.length + 1 : 1;

  return {
    detected_bank: bankId,
    detected_version: versionMatch?.[1]?.trim() ?? 'inconnue',
    detected_effective_date: dateMatch?.[1] ?? null,
    page_count: pageCount,
    is_native_pdf: true, // V1 assumes native (scan detection not implemented)
  };
}

// ----------------------------------------------------------------------------
// Public handler
// ----------------------------------------------------------------------------

export function handleC1(input: C1Input): C1Output {
  // V1 baseline: expects text_content in context (extracted upstream)
  // In production, the gateway will run OCR/PDF extraction before calling C1
  const text = (input as Record<string, unknown>).text_content as string | undefined ?? '';

  const conditions = extractFromText(text, input.bank_id, input.expected_taxonomy);
  const metadata = detectMetadata(text, input.bank_id);

  // Find unmapped segments: text blocks that don't match any known field
  // V1: simplified — just flag if overall extraction is sparse
  const extractedCount = conditions.filter(c => c.value_numeric !== null).length;
  const unmapped: C1Output['unmapped_segments'] = [];

  if (extractedCount < conditions.length * 0.3 && text.length > 500) {
    // Significant portions of document not mapped — flag first 500 chars as unmapped
    unmapped.push({
      page: 1,
      bbox: { x: 0, y: 0, w: 100, h: 100 },
      raw_text: text.slice(0, 500),
    });
  }

  return {
    extracted_conditions: conditions,
    document_metadata: metadata,
    unmapped_segments: unmapped,
  };
}
