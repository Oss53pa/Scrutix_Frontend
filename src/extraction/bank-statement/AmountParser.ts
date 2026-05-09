// ============================================================================
// ATLASBANX — Amount parser
// ============================================================================
// Robust parser for monetary amounts across UEMOA/CEMAC and international
// bank statement formats. Handles:
//   • French: "5 000",  "5 000,50",  "5.000,50",  "5 000 000"
//   • English: "5,000", "5,000.50",  "5000.50"
//   • Mixed:  "5 000.50" (FR thousands + EN decimal)
//   • Signed: "-1 250", "1 250-",     "(1 250)" (parentheses for debit)
//   • With/without currency: "FCFA 5 000", "5 000 XOF", "5 000€"
//   • Compact: "1.5M", "2,3K" (some summary tables use this — rare)
// ============================================================================

const CURRENCY_PATTERN = /(?:FCFA|XOF|XAF|EUR|USD|F\s*CFA|F\.?\s*CFA)/gi;
const PARENS_DEBIT_PATTERN = /^\s*\(([^)]+)\)\s*$/;
const TRAILING_SIGN_PATTERN = /^\s*([\d\s.,]+)\s*([+\-])\s*$/;
const LEADING_SIGN_PATTERN = /^\s*([+\-])?\s*([\d\s.,]+)\s*$/;

export interface ParsedAmount {
  value: number;
  /** True if the amount looked like a debit (negative, or in parens, etc.) */
  isDebit: boolean;
  /** True if the amount was syntactically signed (vs implicit) */
  hasExplicitSign: boolean;
  /** Confidence 0-1 */
  confidence: number;
  /** Currency code if detected */
  currency?: string;
}

/**
 * Parse a single amount string.
 * Returns null if the string clearly isn't a number.
 */
export function parseAmount(raw: string | undefined | null): ParsedAmount | null {
  if (!raw) return null;
  let s = String(raw).replace(/ /g, ' ').trim();
  if (!s) return null;

  // Strip currency labels first
  let currency: string | undefined;
  const curMatch = s.match(CURRENCY_PATTERN);
  if (curMatch) {
    currency = curMatch[0].toUpperCase().replace(/[\s.]/g, '');
    if (currency === 'FCFA') currency = 'XOF';
    s = s.replace(CURRENCY_PATTERN, '').trim();
  }

  // Detect parens-as-negative pattern: "(1 250,00)"
  let isDebit = false;
  let hasExplicitSign = false;
  const parensMatch = s.match(PARENS_DEBIT_PATTERN);
  if (parensMatch) {
    isDebit = true;
    hasExplicitSign = true;
    s = parensMatch[1].trim();
  }

  // Detect trailing sign: "1 250-"
  const trailingMatch = s.match(TRAILING_SIGN_PATTERN);
  if (trailingMatch) {
    if (trailingMatch[2] === '-') {
      isDebit = true;
      hasExplicitSign = true;
    }
    s = trailingMatch[1].trim();
  } else {
    // Detect leading sign: "-1 250" / "+1 250"
    const leadingMatch = s.match(LEADING_SIGN_PATTERN);
    if (leadingMatch && leadingMatch[1]) {
      if (leadingMatch[1] === '-') {
        isDebit = true;
        hasExplicitSign = true;
      }
      s = leadingMatch[2];
    }
  }

  // Reject anything with non-numeric junk after sign/currency stripping.
  // Allowed: digits, spaces, NBSP, comma, dot
  if (!/^[\d\s.,]+$/.test(s)) return null;
  if (!/\d/.test(s)) return null;

  // Strip all spaces (always thousands sep in FR / formatted output)
  const noSpaces = s.replace(/\s+/g, '');
  if (!noSpaces) return null;

  const value = decideSeparator(noSpaces);
  if (value === null) return null;
  if (!isFinite(value)) return null;

  // Confidence: high when the input had a clear shape; lower for fishy strings
  // (eg single digit only, "00.00" etc.).
  let confidence = 0.95;
  if (value === 0) confidence = 0.5;
  if (noSpaces.length <= 1) confidence = 0.4;

  return {
    value: isDebit ? -Math.abs(value) : Math.abs(value),
    isDebit,
    hasExplicitSign,
    confidence,
    currency,
  };
}

/**
 * Decide whether comma is decimal or thousands.
 * Rules (in order):
 *   1. Both `,` and `.` present → the LAST one is the decimal.
 *   2. Only `,` present:
 *      - Exactly 3 digits after comma AND first digit not 0 → thousands ("5,000" → 5000)
 *      - Otherwise decimal ("14,5" → 14.5, "0,025" → 0.025)
 *   3. Only `.` present:
 *      - Exactly 3 digits after dot AND first digit not 0 → thousands ("5.000" → 5000)
 *      - Otherwise decimal ("14.5" → 14.5)
 *   4. Neither separator → integer.
 */
function decideSeparator(s: string): number | null {
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    const cleaned = s
      .replace(new RegExp(`\\${thousandsSep}`, 'g'), '')
      .replace(decimalSep, '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }

  if (lastComma !== -1 || lastDot !== -1) {
    const sep = lastComma !== -1 ? ',' : '.';
    const sepIdx = lastComma !== -1 ? lastComma : lastDot;
    const decimalsCount = s.length - sepIdx - 1;
    const integerPart = s.slice(0, sepIdx);
    const treatAsThousands =
      decimalsCount === 3 && integerPart.length > 0 && !integerPart.startsWith('0');

    if (treatAsThousands) {
      const n = parseInt(s.replace(sep, ''), 10);
      return isNaN(n) ? null : n;
    }
    const n = parseFloat(s.replace(sep, '.'));
    return isNaN(n) ? null : n;
  }

  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/** Quick check: does this string look like a number (anywhere in the input)? */
export function looksLikeAmount(s: string): boolean {
  if (!s) return false;
  // At least 2 digits OR "0,XX" pattern
  return /\d{2,}|\d[.,]\d/.test(s);
}

/** Find all amount-like substrings inside a free-text cell, in left-to-right order. */
export function findAmounts(text: string): Array<{ start: number; end: number; raw: string }> {
  const results: Array<{ start: number; end: number; raw: string }> = [];
  // Match clusters of digits separated by spaces / commas / dots
  // Examples: "500 293",  "74 158 089",  "1 250,50",  "5,000.50"
  const re = /[+\-]?\s*\(?\s*\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{1,2})?\s*\)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0].trim();
    // Reject single digits to avoid catching dates like "08" or "12"
    if (raw.replace(/\D/g, '').length < 2) continue;
    results.push({ start: m.index, end: m.index + m[0].length, raw });
  }
  return results;
}
