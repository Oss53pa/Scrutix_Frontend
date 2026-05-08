// ============================================================================
// ATLASBANX — Text normalization & number parsing utilities
// French banking documents use varied formatting:
//   - Decimal: "14,5" or "14.5"
//   - Thousands: "5 000" / "5 000" / "5,000"
//   - Currency: "FCFA" / "F CFA" / "F CFA" / "XAF" / "XOF"
//   - Dotted lines: "Tenue de compte ......... 5 000"
// ============================================================================

/** Strip diacritics (é → e), lowercase, collapse whitespace */
export function normalizeForMatch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize an entire document: collapse whitespace, unify currency markers */
export function normalizeDocument(text: string): string {
  return text
    .replace(/ /g, ' ')          // NBSP → space
    .replace(/[…•·]/g, ' ') // ellipsis / bullets → space
    .replace(/[ \t]+/g, ' ')          // collapse spaces/tabs
    .replace(/\n{3,}/g, '\n\n')       // collapse multiple newlines
    .replace(/F\s*CFA/gi, 'FCFA')     // unify FCFA
    .replace(/F\.?\s*C\.?F\.?A\.?/gi, 'FCFA')
    .trim();
}

/**
 * Parse a number string from a French banking doc.
 * Handles:
 *   "5 000"       → 5000
 *   "5,000"       → 5000   (English thousands)
 *   "5.000"       → 5000   (also English thousands)
 *   "5 000,50"    → 5000.5
 *   "5,000.50"    → 5000.5 (English decimal)
 *   "0,025"       → 0.025
 *   "14,5"        → 14.5
 *
 * Heuristic for ambiguous "5,000": if there are exactly 3 digits after the
 * comma AND no other punctuation, treat as thousands; otherwise decimal.
 */
export function parseNumber(raw: string): number | null {
  if (!raw) return null;

  // Keep digits, comma, dot, space, NBSP
  const cleaned = raw
    .replace(/[ ]/g, ' ')
    .replace(/[^0-9 ,.]/g, '')
    .trim();

  if (!cleaned) return null;

  // Strip all spaces (they're always thousand separators in FR)
  const noSpaces = cleaned.replace(/\s+/g, '');

  // Both comma and dot present → the LAST one is the decimal separator
  const lastComma = noSpaces.lastIndexOf(',');
  const lastDot = noSpaces.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    const result = noSpaces
      .replace(new RegExp(`\\${thousandsSep}`, 'g'), '')
      .replace(decimalSep, '.');
    const n = parseFloat(result);
    return isNaN(n) ? null : n;
  }

  // Only comma OR only dot
  if (lastComma !== -1 || lastDot !== -1) {
    const sep = lastComma !== -1 ? ',' : '.';
    const sepIdx = lastComma !== -1 ? lastComma : lastDot;
    const decimalsCount = noSpaces.length - sepIdx - 1;

    // Heuristic: if exactly 3 digits after separator AND number has no
    // decimal-looking shape ("X,XX" or "X.XX"), treat as thousands.
    // Examples:
    //   "5,000"    → 3 digits after  → thousands → 5000
    //   "14,5"     → 1 digit after   → decimal   → 14.5
    //   "0,025"    → 3 digits after  → decimal   → 0.025 (because integer part starts with 0)
    //   "1,234"    → 3 digits after  → AMBIGUOUS — default to thousands
    //   "1.5"      → 1 digit after   → decimal   → 1.5
    const integerPart = noSpaces.slice(0, sepIdx);
    const treatAsThousands =
      decimalsCount === 3 &&
      integerPart.length > 0 &&
      !integerPart.startsWith('0'); // 0,025 is clearly decimal

    if (treatAsThousands) {
      const n = parseInt(noSpaces.replace(sep, ''), 10);
      return isNaN(n) ? null : n;
    }
    const n = parseFloat(noSpaces.replace(sep, '.'));
    return isNaN(n) ? null : n;
  }

  // No separator
  const n = parseInt(noSpaces, 10);
  return isNaN(n) ? null : n;
}

/**
 * Levenshtein distance — used by SemanticStrategy for fuzzy label matching.
 * Returns edit distance between two strings.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Similarity score 0-1 between two strings (1 = identical).
 * Built from levenshtein, normalized by the longer length.
 */
export function similarity(a: string, b: string): number {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - levenshtein(na, nb) / maxLen;
}

/** Set a value at a dot-notation path on an object (mutates) */
export function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (typeof cur[k] !== 'object' || cur[k] === null) {
      cur[k] = {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
}
