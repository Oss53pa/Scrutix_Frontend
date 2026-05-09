// ============================================================================
// ATLASBANX — Label-Value Extractor for Conditions documents
// ============================================================================
// For each visual row of the document, this module isolates:
//   • The rightmost numeric cluster → the value
//   • Everything to the left of it → the label
//
// Then it tracks "section headers" — rows that look like titles (no amount,
// taller font height, often in caps or bold) — and tags each pair with the
// most recent section so downstream matching can disambiguate similar labels
// between sections (e.g., "Tenue de compte" might appear under both
// "Particuliers" and "Entreprises").
// ============================================================================

import type { PositionedItem, ReconstructedRow } from '../bank-statement/types';
import { findAmounts, parseAmount } from '../bank-statement/AmountParser';
import type { LabelValuePair } from './types';
import { clusterRows } from '../bank-statement/HeaderDetector';

/** Heuristic: a row is a section header if it has no parseable amount and
 *  looks like a title (≥1 word, height in upper percentile, often uppercase). */
function looksLikeSection(row: ReconstructedRow, allHeights: number[]): boolean {
  const fullText = row.items.map((i) => i.text).join(' ').trim();
  if (!fullText) return false;
  if (fullText.length < 4) return false;

  // Drop if any amount is detected
  if (findAmounts(fullText).length > 0) return false;

  // Title-like: short-ish, alpha-heavy, no punctuation patterns of regular text
  if (fullText.length > 80) return false;

  // Height percentile: a section header is typically larger than body text
  const avgHeight = row.items.reduce((s, i) => s + (i.height ?? 8), 0) / row.items.length;
  const sorted = [...allHeights].sort((a, b) => a - b);
  const p70 = sorted[Math.floor(sorted.length * 0.7)] ?? 0;
  const isTaller = avgHeight >= p70 * 1.05;

  // Or all-caps / mostly uppercase
  const letters = fullText.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  const upperRatio = letters
    ? letters.split('').filter((c) => c === c.toUpperCase()).length / letters.length
    : 0;
  const isUpper = letters.length >= 3 && upperRatio >= 0.7;

  return isTaller || isUpper;
}

/** Detect a numeric value at the right end of a row.
 *  Strategy: find all amount-like clusters in the joined text, take the
 *  rightmost one. Anything to its left is the label. */
function splitLabelValue(
  row: ReconstructedRow,
): { label: string; value: number; rawValue: string; unit?: LabelValuePair['unit']; confidence: number } | null {
  const text = row.items.map((i) => i.text).join(' ').trim();
  const amounts = findAmounts(text);
  if (amounts.length === 0) return null;

  // The last amount is the value
  const last = amounts[amounts.length - 1];
  const labelText = text.slice(0, last.start).trim();
  const trailing = text.slice(last.end).trim();

  // Strip leader patterns from the label end (dots, dashes, colons)
  const cleanLabel = labelText.replace(/[.…\s\-:]+$/, '').trim();
  if (cleanLabel.length < 2) return null;

  const parsed = parseAmount(last.raw);
  if (!parsed) return null;

  // Detect unit: in the trailing slice (eg "%", "FCFA"), or inside the raw amount
  let unit: LabelValuePair['unit'] | undefined;
  const combined = `${last.raw} ${trailing}`.toLowerCase();
  if (/%|pour\s*cent|p\.cent/.test(combined)) unit = '%';
  else if (/fcfa|xaf|xof|f\s*cfa/.test(combined)) {
    unit = parsed.currency === 'XAF' ? 'XAF' : 'FCFA';
  } else if (/eur|€/.test(combined)) unit = 'EUR';
  else if (/usd|\$/.test(combined)) unit = 'USD';
  else if (/jours?|days?/.test(combined)) unit = 'days';
  else if (parsed.currency) {
    if (parsed.currency === 'XAF' || parsed.currency === 'XOF') unit = parsed.currency;
    else if (parsed.currency === 'EUR' || parsed.currency === 'USD') unit = parsed.currency;
  }

  // Reject "labels" that are 100% digits — these are sub-amounts (eg "0.5",
  // "1.2") not real rubric labels.
  if (/^\d+([.,]\d+)?$/.test(cleanLabel)) return null;

  return {
    label: cleanLabel,
    value: Math.abs(parsed.value),
    rawValue: last.raw,
    unit,
    confidence: parsed.confidence,
  };
}

export function extractLabelValuePairs(
  items: PositionedItem[],
  totalPages: number,
): { pairs: LabelValuePair[]; sections: string[] } {
  const pairs: LabelValuePair[] = [];
  const sections: string[] = [];
  let currentSection: string | undefined;

  // Compute global height percentile (used by section detection)
  const allHeights = items.map((i) => i.height ?? 8);

  for (let p = 1; p <= totalPages; p++) {
    const rows = clusterRows(items, p, 3);

    for (const row of rows) {
      // Multi-line label support: if the row is purely text and not a header,
      // we'll prepend it to the next row's label below.
      const split = splitLabelValue(row);

      if (!split) {
        // Maybe a section header
        if (looksLikeSection(row, allHeights)) {
          const text = row.items.map((i) => i.text).join(' ').trim();
          currentSection = text;
          if (!sections.includes(text)) sections.push(text);
        }
        continue;
      }

      pairs.push({
        label: split.label,
        rawValue: split.rawValue,
        value: split.value,
        unit: split.unit,
        confidence: split.confidence,
        page: p,
        y: row.y,
        section: currentSection,
      });
    }
  }

  return { pairs, sections };
}
