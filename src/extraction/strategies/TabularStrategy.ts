// ============================================================================
// TabularStrategy — for tariff grids that are rendered as tables.
// Looks for cells whose label matches the field's aliases and pairs them
// with the next numeric cell on the same (or next) row.
// ============================================================================

import type { FieldDefinition, FieldExtraction } from '../types';
import { normalizeForMatch, parseNumber, similarity } from '../normalize';

const SIMILARITY_THRESHOLD = 0.78;

/**
 * Strategy logic:
 *   For each table row, scan cells. If a cell text fuzzy-matches one of the
 *   field's aliases, look at the cells to its RIGHT (priority) or BELOW for
 *   the first cell that parses as a number within the field's range.
 */
export function tabularStrategy(
  tables: string[][][] | undefined,
  field: FieldDefinition,
): Omit<FieldExtraction, 'key' | 'kind'> | null {
  if (!tables || tables.length === 0) return null;

  let bestMatch: { value: number; confidence: number; evidence: string } | null = null;

  for (const table of tables) {
    for (let r = 0; r < table.length; r++) {
      const row = table[r];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;

        const score = bestSimilarity(normalizeForMatch(cell), field.aliases);
        if (score < SIMILARITY_THRESHOLD) continue;

        // Found a label cell — look right then below for a number
        // Priority: same row to the right
        for (let cc = c + 1; cc < row.length; cc++) {
          const v = parseNumber(row[cc]);
          if (v === null) continue;
          if (field.range && (v < field.range.min || v > field.range.max)) continue;

          // Confidence scales with label similarity
          const confidence = 0.7 + score * 0.2;
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = {
              value: v,
              confidence,
              evidence: `${cell} | ${row[cc]}`,
            };
          }
          break;
        }

        // If nothing on the right, try the row below (same column)
        if (!bestMatch && r + 1 < table.length) {
          const below = table[r + 1][c];
          const v = parseNumber(below);
          if (v !== null && (!field.range || (v >= field.range.min && v <= field.range.max))) {
            bestMatch = {
              value: v,
              confidence: 0.65 + score * 0.15,
              evidence: `${cell} ↓ ${below}`,
            };
          }
        }
      }
    }
  }

  if (!bestMatch) return null;

  return {
    value: bestMatch.value,
    confidence: bestMatch.confidence,
    strategy: 'tabular',
    evidence: bestMatch.evidence,
  };
}

function bestSimilarity(needle: string, candidates: string[]): number {
  let best = 0;
  for (const c of candidates) {
    const s = similarity(needle, c);
    if (s > best) best = s;
    // Also consider substring containment as a strong signal
    const cn = normalizeForMatch(c);
    if (needle.includes(cn) || cn.includes(needle)) {
      best = Math.max(best, 0.9);
    }
  }
  return best;
}
