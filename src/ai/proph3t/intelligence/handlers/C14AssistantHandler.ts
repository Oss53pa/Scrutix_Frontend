// ============================================================================
// ATLASBANX - C14 Handler: Assistant saisie split-screen
// Zone: Verte (toutes propositions, jamais d'action auto)
// Baseline V1: coherence checks and suggestions based on taxonomy + known ranges
// ============================================================================

import type { C14Input, C14Output, AssistantSuggestion, AssistantSuggestionType } from '../types';
import { RUBRICS_TAXONOMY } from '../../../../cdc/taxonomy/rubrics';
import { FIELD_DEFINITIONS } from '../../../../extraction/FieldRegistry';

// ----------------------------------------------------------------------------
// Known value ranges per rubric category (FCFA, typical CEMAC/UEMOA)
// ----------------------------------------------------------------------------

const TYPICAL_RANGES: Record<string, { min: number; max: number; median: number; unit: string }> = {
  'compte.tenue_mensuelle': { min: 1000, max: 25000, median: 5000, unit: 'fcfa' },
  'decouverts.taux_autorise': { min: 8, max: 18, median: 14, unit: 'percent' },
  'decouverts.taux_non_autorise': { min: 12, max: 25, median: 18, unit: 'percent' },
  'decouverts.commission_mouvement': { min: 0.01, max: 0.1, median: 0.025, unit: 'percent' },
  'decouverts.cpfd': { min: 0.01, max: 0.1, median: 0.05, unit: 'percent' },
  'cartes.cotisation_debit': { min: 5000, max: 50000, median: 15000, unit: 'fcfa' },
  'cartes.cotisation_credit': { min: 20000, max: 200000, median: 75000, unit: 'fcfa' },
  'virements.intra_banque': { min: 0, max: 5000, median: 1000, unit: 'fcfa' },
  'virements.inter_banques': { min: 1000, max: 15000, median: 3500, unit: 'fcfa' },
  'virements.swift_international': { min: 5000, max: 50000, median: 15000, unit: 'fcfa' },
  'cheques.carnet_25': { min: 2000, max: 15000, median: 5000, unit: 'fcfa' },
  'ebanking.abonnement': { min: 0, max: 10000, median: 3000, unit: 'fcfa' },
  'ebanking.alerte_sms': { min: 0, max: 2000, median: 500, unit: 'fcfa' },
};

// L1 regulatory limits (BCEAO/COBAC)
const L1_LIMITS: Array<{ rubric_pattern: string; max: number; unit: string; reference: string }> = [
  { rubric_pattern: 'decouverts.taux', max: 18, unit: 'percent', reference: 'Taux d\'usure BCEAO (15% + marge 3pp)' },
  { rubric_pattern: 'credits.taux_usure', max: 15, unit: 'percent', reference: 'Plafond taux d\'usure BCEAO' },
];

// Cross-rubric coherence rules
const COHERENCE_RULES: Array<{
  check: (values: Record<string, unknown>) => AssistantSuggestion | null;
}> = [
  // Taux conso should be < taux immo (unusual otherwise)
  {
    check: (values) => {
      const conso = getNumericValue(values, 'credits.taux_conso', 'creditFees.creditConsoTauxMin');
      const immo = getNumericValue(values, 'credits.taux_immo', 'creditFees.creditImmoTauxMin');
      if (conso !== null && immo !== null && conso < immo) {
        return {
          type: 'coherence_inter_rubriques',
          message: `Taux credit conso (${conso}%) inferieur au taux credit immo (${immo}%) — situation inhabituelle a verifier.`,
          severity: 'warning',
        };
      }
      return null;
    },
  },
  // CPFD should be ≤ 50% of interest rate
  {
    check: (values) => {
      const cpfd = getNumericValue(values, 'decouverts.cpfd', 'creditFees.commissionPlusForteDecouverte');
      const taux = getNumericValue(values, 'decouverts.taux_autorise', 'creditFees.tauxDecouvertAutorise');
      if (cpfd !== null && taux !== null && cpfd > taux * 0.5) {
        return {
          type: 'coherence_inter_rubriques',
          message: `CPFD (${cpfd}%) semble elevee par rapport au taux decouvert (${taux}%). Le plafond reglementaire est 50% des interets debiteurs.`,
          severity: 'warning',
          reference: 'Reglementation COBAC plafond CPFD',
        };
      }
      return null;
    },
  },
  // Taux non autorise should be > taux autorise
  {
    check: (values) => {
      const autorise = getNumericValue(values, 'decouverts.taux_autorise', 'creditFees.tauxDecouvertAutorise');
      const nonAutorise = getNumericValue(values, 'decouverts.taux_non_autorise', 'creditFees.tauxDecouvertNonAutorise');
      if (autorise !== null && nonAutorise !== null && nonAutorise <= autorise) {
        return {
          type: 'coherence_inter_rubriques',
          message: `Taux decouvert non autorise (${nonAutorise}%) inferieur ou egal au taux autorise (${autorise}%) — probablement une erreur de saisie.`,
          severity: 'error',
        };
      }
      return null;
    },
  },
];

function getNumericValue(values: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = values[key];
    if (typeof v === 'number') return v;
  }
  return null;
}

// ----------------------------------------------------------------------------
// Suggestion generators
// ----------------------------------------------------------------------------

function checkRangeAnomaly(rubricCode: string, value: number): AssistantSuggestion | null {
  const range = TYPICAL_RANGES[rubricCode];
  if (!range) return null;

  const deviationPct = range.median > 0
    ? Math.abs(value - range.median) / range.median * 100
    : 0;

  if (value < range.min || value > range.max) {
    return {
      type: 'coherence_inter_banques',
      message: `Valeur ${value} ${range.unit} hors plage habituelle [${range.min}–${range.max}] pour ${rubricCode}. Mediane zone : ${range.median}.`,
      severity: 'warning',
      suggested_value: range.median,
    };
  }

  if (deviationPct > 50) {
    return {
      type: 'coherence_inter_banques',
      message: `Valeur ${value} ${range.unit} s'ecarte de ${Math.round(deviationPct)}% de la mediane zone (${range.median}) pour ${rubricCode}.`,
      severity: 'info',
    };
  }

  return null;
}

function checkL1Violation(rubricCode: string, value: number): AssistantSuggestion | null {
  for (const limit of L1_LIMITS) {
    if (rubricCode.startsWith(limit.rubric_pattern) && value > limit.max) {
      return {
        type: 'violation_l1',
        message: `Valeur ${value}% depasse le plafond reglementaire L1 de ${limit.max}% (${limit.reference}).`,
        severity: 'error',
        reference: limit.reference,
      };
    }
  }
  return null;
}

function suggestCompletion(allValues: Record<string, unknown>): AssistantSuggestion[] {
  const suggestions: AssistantSuggestion[] = [];

  // Check if card fees are partially filled
  const hasCardFees = Object.keys(allValues).some(k => k.includes('carte') || k.includes('card'));
  const hasCardOpposition = Object.keys(allValues).some(k => k.includes('opposition'));
  if (hasCardFees && !hasCardOpposition) {
    suggestions.push({
      type: 'completion',
      message: 'Frais de cartes renseignes mais opposition carte non saisie. Verifier les CG pour cette rubrique.',
      severity: 'info',
    });
  }

  // Check if overdraft rates are set but CPFD is missing
  const hasOverdraftRate = Object.keys(allValues).some(k =>
    k.includes('taux_autorise') || k.includes('tauxDecouvert'));
  const hasCpfd = Object.keys(allValues).some(k =>
    k.includes('cpfd') || k.includes('PlusForte'));
  if (hasOverdraftRate && !hasCpfd) {
    suggestions.push({
      type: 'completion',
      message: 'Taux de decouvert renseigne mais CPFD non saisie. La CPFD est generalement mentionnee dans la meme section.',
      severity: 'info',
    });
  }

  return suggestions;
}

// ----------------------------------------------------------------------------
// Public handler
// ----------------------------------------------------------------------------

export function handleC14(input: C14Input): C14Output {
  const suggestions: AssistantSuggestion[] = [];

  // 1. Range check on current value
  if (input.rubric_code && typeof input.current_value === 'number') {
    const rangeCheck = checkRangeAnomaly(input.rubric_code, input.current_value);
    if (rangeCheck) suggestions.push(rangeCheck);

    const l1Check = checkL1Violation(input.rubric_code, input.current_value);
    if (l1Check) suggestions.push(l1Check);
  }

  // 2. Cross-rubric coherence
  const allValues = { ...input.all_values };
  if (input.rubric_code && input.current_value !== undefined) {
    allValues[input.rubric_code] = input.current_value;
  }

  for (const rule of COHERENCE_RULES) {
    const suggestion = rule.check(allValues as Record<string, unknown>);
    if (suggestion) suggestions.push(suggestion);
  }

  // 3. Completion suggestions
  const completions = suggestCompletion(allValues as Record<string, unknown>);
  suggestions.push(...completions);

  return { suggestions };
}
