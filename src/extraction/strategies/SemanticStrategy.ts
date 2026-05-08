// ============================================================================
// SemanticStrategy — last resort before defaulting.
// Splits the text into "lines" (logical statements separated by newline /
// punctuation) and scores each line against the field's aliases. The best
// scoring line containing a parseable number wins.
// ============================================================================

import type { FieldDefinition, FieldExtraction } from '../types';
import { normalizeForMatch, parseNumber, similarity } from '../normalize';

const MIN_SCORE = 0.62;
const NUMBER_REGEX = /(\d[\d\s .,]{0,15}\d|\d+)\s*(?:%|FCFA|XAF|XOF)?/g;

export function semanticStrategy(
  text: string,
  field: FieldDefinition,
): Omit<FieldExtraction, 'key' | 'kind'> | null {
  // Break text into manageable lines
  const lines = text
    .split(/\r?\n|[•·]|\.{3,}|…/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.length < 500);

  let best: {
    score: number;
    value: number;
    line: string;
  } | null = null;

  for (const rawLine of lines) {
    const norm = normalizeForMatch(rawLine);
    const score = bestSimilarityOrContainment(norm, field.aliases);
    if (score < MIN_SCORE) continue;

    // Find a number on this line that fits the range
    const candidates = extractNumbers(rawLine);
    for (const v of candidates) {
      if (field.range && (v < field.range.min || v > field.range.max)) continue;

      const blendedScore = score; // could weight by unit-hint match
      if (!best || blendedScore > best.score) {
        best = { score: blendedScore, value: v, line: rawLine };
      }
    }
  }

  if (!best) return null;

  // Confidence based on label similarity, capped to leave room above for
  // pattern/tabular strategies.
  const confidence = 0.55 + (best.score - MIN_SCORE) * 0.6;

  return {
    value: best.value,
    confidence: Math.min(confidence, 0.82),
    strategy: 'semantic',
    evidence: best.line.slice(0, 200),
  };
}

function bestSimilarityOrContainment(needle: string, candidates: string[]): number {
  let best = 0;
  for (const c of candidates) {
    const cn = normalizeForMatch(c);
    if (needle.includes(cn)) {
      // Direct substring match — very strong signal
      best = Math.max(best, 0.95);
      continue;
    }
    const s = similarity(needle, c);
    if (s > best) best = s;
  }
  return best;
}

function extractNumbers(line: string): number[] {
  const nums: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = NUMBER_REGEX.exec(line)) !== null) {
    const n = parseNumber(m[1]);
    if (n !== null) nums.push(n);
  }
  // Reset regex state
  NUMBER_REGEX.lastIndex = 0;
  return nums;
}
