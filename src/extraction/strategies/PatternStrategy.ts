// ============================================================================
// PatternStrategy — fastest, highest-confidence: known regex patterns.
// Tries bank-specific templates first, then generic aliases.
// ============================================================================

import type { FieldDefinition, FieldExtraction } from '../types';
import { labelRegex } from '../FieldRegistry';
import { parseNumber } from '../normalize';

export interface PatternMatch {
  value: number;
  confidence: number;
  evidence: string;
}

/**
 * Try to find the field value in `text` using its registered patterns
 * (template-specific first, then generic aliases). Returns the FIRST
 * sane match (passes range check).
 */
export function patternStrategy(
  text: string,
  field: FieldDefinition,
  bankCode?: string,
): Omit<FieldExtraction, 'key' | 'kind'> | null {
  // 1. Bank-specific template patterns (highest confidence)
  if (bankCode && field.templates?.[bankCode]) {
    const match = matchAny(text, field.templates[bankCode]);
    if (match && inRange(match.value, field)) {
      return {
        value: match.value,
        confidence: 0.98,
        strategy: 'template',
        evidence: match.evidence,
      };
    }
  }

  // 2. Custom user-supplied patterns
  if (field.patterns) {
    const match = matchAny(text, field.patterns);
    if (match && inRange(match.value, field)) {
      return {
        value: match.value,
        confidence: 0.92,
        strategy: 'pattern',
        evidence: match.evidence,
      };
    }
  }

  // 3. Generic patterns from aliases (the bread-and-butter)
  const generic = labelRegex(field.aliases);
  const match = matchAny(text, generic);
  if (match && inRange(match.value, field)) {
    return {
      value: match.value,
      confidence: 0.85,
      strategy: 'pattern',
      evidence: match.evidence,
    };
  }

  return null;
}

function matchAny(text: string, patterns: RegExp[]): PatternMatch | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const numStr = m[1] ?? m[0];
    const value = parseNumber(numStr);
    if (value === null) continue;
    return {
      value,
      confidence: 0.85,
      evidence: m[0].slice(0, 200), // cap evidence length
    };
  }
  return null;
}

function inRange(value: number, field: FieldDefinition): boolean {
  if (!field.range) return true;
  return value >= field.range.min && value <= field.range.max;
}
