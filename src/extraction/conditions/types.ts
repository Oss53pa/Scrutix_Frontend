// ============================================================================
// ATLASBANX — Conditions extraction — types
// ============================================================================
// Tariff/conditions documents are different from bank statements:
//   • Multiple small tables per page (one per fee category)
//   • Often label-value pairs with dotted leaders ("Frais carte ....... 5 000")
//   • Sections separated by larger headers in bold
//   • Currency / unit hints scattered in section labels
//
// We keep it generic: we don't assume column orders, we let the document
// tell us where labels and values are by reading X positions row by row.
// ============================================================================

import type { FieldDefinition } from '../types';
import type { PositionedItem, ReconstructedRow } from '../bank-statement/types';

/** A label-value pair extracted from a single row of the document */
export interface LabelValuePair {
  label: string;
  /** Raw amount string as seen in the document (eg "5 000 FCFA", "14,5%") */
  rawValue: string;
  /** Parsed numeric value (0 for qualitative values) */
  value: number;
  /** Detected unit hint */
  unit?: 'FCFA' | 'XAF' | 'XOF' | 'EUR' | 'USD' | '%' | 'days';
  /** Qualitative classifier — when set, value is 0 but the row IS a real condition */
  qualitative?: 'gratuit' | 'consulter' | 'neant' | 'franco' | 'souscription' | 'other';
  /** Confidence in the parse (0-1) */
  confidence: number;
  /** Page number */
  page: number;
  /** Y coordinate (for ordering / debug) */
  y: number;
  /** Section header that this pair lives under (best effort) */
  section?: string;
}

/** Candidate match between a LabelValuePair and a registered FieldDefinition */
export interface RubricMatch {
  field: FieldDefinition;
  pair: LabelValuePair;
  /** Similarity score 0-1 between the document label and the rubric's aliases */
  similarity: number;
  /** Aggregate confidence — pair confidence × similarity */
  confidence: number;
  /** The alias that matched best */
  matchedAlias: string;
}

export interface ConditionsExtractionResult {
  /** Per-rubric best match (only the highest-confidence match per field key) */
  matches: Record<string, RubricMatch>;
  /** Every label-value pair the parser saw, useful for diagnostics + UI */
  rawPairs: LabelValuePair[];
  /** Pairs that were extracted but did NOT match any registered rubric.
   *  The UI can surface these so the user can either map them manually or
   *  request that we add the rubric to the registry. */
  unmatchedPairs: LabelValuePair[];
  /** Section headers detected in the document */
  sections: string[];
  stats: {
    totalPages: number;
    pairsFound: number;
    rubricsMatched: number;
    pairsUnmatched: number;
    averageConfidence: number;
    durationMs: number;
  };
  warnings: string[];
}

export type { PositionedItem, ReconstructedRow };
