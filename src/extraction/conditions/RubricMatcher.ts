// ============================================================================
// ATLASBANX — Rubric matcher
// ============================================================================
// Maps each LabelValuePair from a document to the best-fitting FieldDefinition
// in our registry, using fuzzy matching that combines:
//   • Substring containment (strongest signal — alias appears in label)
//   • Levenshtein-based similarity (handles typos, abbreviations)
//   • Unit compatibility (% vs FCFA — heavy penalty if mismatched)
//   • Range sanity check (rejects matches whose value is way outside the
//     field's plausible range)
//
// Returns the highest-confidence match per field key (ie if 3 different rows
// could plausibly map to "Tenue de compte particulier", we keep only the
// strongest one).
// ============================================================================

import type { FieldDefinition } from '../types';
import { FIELD_DEFINITIONS } from '../FieldRegistry';
import { normalizeForMatch, similarity } from '../normalize';
import type { LabelValuePair, RubricMatch } from './types';

/** Minimum aggregated confidence to accept a match. Below this, we drop. */
const MIN_CONFIDENCE = 0.55;
/** Minimum label-similarity score to even consider a candidate. */
const MIN_SIMILARITY = 0.55;

function unitCompatible(field: FieldDefinition, pair: LabelValuePair): boolean {
  if (!pair.unit) return true; // no unit hint = neutral
  if (!field.unitHint) return true;
  if (field.unitHint === pair.unit) return true;
  // FCFA / XAF / XOF are interchangeable for our purposes
  const xCurrencies = new Set(['FCFA', 'XAF', 'XOF']);
  if (xCurrencies.has(field.unitHint) && xCurrencies.has(pair.unit)) return true;
  return false;
}

function rangeOk(field: FieldDefinition, value: number): boolean {
  if (!field.range) return true;
  return value >= field.range.min && value <= field.range.max;
}

/**
 * Score a single (field × pair) candidate.
 * Returns the best alias-similarity score over all aliases of the field.
 */
function scoreField(field: FieldDefinition, pair: LabelValuePair): { score: number; matchedAlias: string } {
  const labelN = normalizeForMatch(pair.label);
  const sectionN = pair.section ? normalizeForMatch(pair.section) : '';
  // We optionally augment the haystack with the section name; this lets
  // labels like "Tenue de compte" disambiguate by checking the section
  // ("Particuliers" → particulier rubric).
  const haystack = sectionN ? `${sectionN} ${labelN}` : labelN;

  let best = 0;
  let bestAlias = '';
  for (const alias of field.aliases) {
    const aliasN = normalizeForMatch(alias);
    let s = similarity(labelN, alias);

    // Substring containment is a strong positive signal
    if (haystack.includes(aliasN)) {
      s = Math.max(s, 0.92);
      // Even stronger if the entire label is essentially the alias
      if (labelN === aliasN) s = 0.99;
    }
    // Or alias contains the label (rubric is more specific)
    if (aliasN.includes(labelN) && labelN.length >= 6) {
      s = Math.max(s, 0.85);
    }

    if (s > best) {
      best = s;
      bestAlias = alias;
    }
  }
  return { score: best, matchedAlias: bestAlias };
}

export function matchRubrics(pairs: LabelValuePair[]): {
  matches: Record<string, RubricMatch>;
  perPair: Array<{ pair: LabelValuePair; field: FieldDefinition; score: number }>;
} {
  // Per pair, find best field
  const perPair: Array<{ pair: LabelValuePair; field: FieldDefinition; score: number; matchedAlias: string }> = [];

  for (const pair of pairs) {
    let bestField: { field: FieldDefinition; score: number; matchedAlias: string } | null = null;
    for (const field of FIELD_DEFINITIONS) {
      // Hard filter: unit must be compatible, value in range
      if (!unitCompatible(field, pair)) continue;
      if (!rangeOk(field, pair.value)) continue;
      const { score, matchedAlias } = scoreField(field, pair);
      if (score < MIN_SIMILARITY) continue;
      if (!bestField || score > bestField.score) {
        bestField = { field, score, matchedAlias };
      }
    }
    if (bestField) {
      perPair.push({ pair, ...bestField });
    }
  }

  // Per field, keep the best pair (sometimes multiple rows match the same rubric)
  const matchesByKey: Record<string, RubricMatch> = {};
  for (const p of perPair) {
    const conf = p.score * p.pair.confidence;
    if (conf < MIN_CONFIDENCE) continue;
    const key = p.field.key;
    const existing = matchesByKey[key];
    if (!existing || conf > existing.confidence) {
      matchesByKey[key] = {
        field: p.field,
        pair: p.pair,
        similarity: p.score,
        confidence: conf,
        matchedAlias: p.matchedAlias,
      };
    }
  }

  return {
    matches: matchesByKey,
    perPair: perPair.map((p) => ({ pair: p.pair, field: p.field, score: p.score })),
  };
}
