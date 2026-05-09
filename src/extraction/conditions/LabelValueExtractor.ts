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

/** Section number prefix at the start of a label (eg "10.1.2", "8.1") */
const SECTION_NUMBER_PREFIX = /^(?:\d+(?:\.\d+){1,5})\s+/;

/** Qualitative values commonly used in tariff grids. Order matters — the
 *  more specific patterns are tested first. */
const QUALITATIVE_PATTERNS: Array<{ q: NonNullable<LabelValuePair['qualitative']>; re: RegExp }> = [
  { q: 'gratuit',     re: /\b(gratuit|gratuite|gratuits|gratuites|sans\s*frais|free)\b/i },
  { q: 'neant',       re: /\bn[eé]ant\b/i },
  { q: 'franco',      re: /\bfranco\b/i },
  { q: 'souscription', re: /\b[aà]\s*la\s*souscription\b/i },
  { q: 'consulter',   re: /\bnous\s*consulter\b/i },
];

/** Strip a leading section number from a label, if present. */
function stripSectionNumber(label: string): string {
  return label.replace(SECTION_NUMBER_PREFIX, '').trim();
}

/** Detect a qualitative value embedded in a row text. Returns null if none. */
function detectQualitative(text: string): NonNullable<LabelValuePair['qualitative']> | null {
  for (const { q, re } of QUALITATIVE_PATTERNS) {
    if (re.test(text)) return q;
  }
  return null;
}

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

interface SplitResult {
  label: string;
  value: number;
  rawValue: string;
  unit?: LabelValuePair['unit'];
  confidence: number;
  qualitative?: LabelValuePair['qualitative'];
}

/** Detect a value at the right end of a row, OR a qualitative value
 *  ("Gratuit", "Nous consulter", etc.) anywhere in the row.
 *  Strategy: try numeric first (rightmost cluster = value). If no number,
 *  fall back to qualitative detection. */
function splitLabelValue(row: ReconstructedRow): SplitResult | null {
  const text = row.items.map((i) => i.text).join(' ').trim();
  const amounts = findAmounts(text);

  // ─── Path A: numeric value present ────────────────────────────────────
  if (amounts.length > 0) {
    // Use the rightmost amount as the value
    const last = amounts[amounts.length - 1];
    const labelText = text.slice(0, last.start).trim();
    const trailing = text.slice(last.end).trim();

    // Strip section number prefix + dotted/dashed leaders + trailing punct
    let cleanLabel = stripSectionNumber(labelText);
    cleanLabel = cleanLabel.replace(/[.…\s\-:]+$/, '').trim();
    if (cleanLabel.length < 2) return null;

    // Reject "labels" that are 100% digits — these are stray sub-amounts
    if (/^\d+([.,]\d+)?$/.test(cleanLabel)) return null;

    const parsed = parseAmount(last.raw);
    if (!parsed) return null;

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

    return {
      label: cleanLabel,
      value: Math.abs(parsed.value),
      rawValue: last.raw,
      unit,
      confidence: parsed.confidence,
    };
  }

  // ─── Path B: qualitative value (no number, but a known phrase) ────────
  const qualitative = detectQualitative(text);
  if (qualitative) {
    // The label is everything except the qualitative phrase. Strip the
    // matched phrase + section number prefix.
    let label = text;
    for (const { re } of QUALITATIVE_PATTERNS) {
      label = label.replace(re, '');
    }
    label = stripSectionNumber(label).replace(/[.…\s\-:]+$/, '').trim();
    if (label.length < 2) return null;
    if (/^\d+([.,]\d+)?$/.test(label)) return null;

    const phraseMatch =
      QUALITATIVE_PATTERNS.find((p) => p.q === qualitative)?.re.exec(text)?.[0] ?? '';

    return {
      label,
      value: 0,
      rawValue: phraseMatch.trim(),
      confidence: 0.8, // qualitative match is reliable
      qualitative,
    };
  }

  return null;
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
        qualitative: split.qualitative,
        confidence: split.confidence,
        page: p,
        y: row.y,
        section: currentSection,
      });
    }
  }

  return { pairs, sections };
}
