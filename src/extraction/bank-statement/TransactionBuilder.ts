// ============================================================================
// ATLASBANX — Transaction builder
// ============================================================================
// Turns a MappedRow (column-aware text cells) into an ExtractedTransaction.
// Handles the three common amount layouts seen across UEMOA/CEMAC banks:
//
//   Layout A — separate Débit + Crédit columns (NSIA, Ecobank, BICICI, ...)
//      Date | Libellé | Débit | Crédit | Solde
//   Layout B — single signed amount column (some Premium reports)
//      Date | Libellé | Montant | Solde
//   Layout C — single amount + a D/C type indicator
//      Date | Libellé | Sens | Montant | Solde
// ============================================================================

import type { ExtractedTransaction, MappedRow, TableStructure } from './types';
import { computeBoundingBox } from './types';
import { parseAmount } from './AmountParser';

const DATE_REGEX = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/;

/** Parse a DD/MM/YYYY (or DD-MM-YY) string. Returns null on failure. */
export function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const m = s.match(DATE_REGEX);
  if (!m) return null;
  let dd = parseInt(m[1], 10);
  let mm = parseInt(m[2], 10);
  let yy = parseInt(m[3], 10);
  if (yy < 100) yy = yy >= 50 ? 1900 + yy : 2000 + yy;
  // Handle "MM/DD/YYYY" by sniff: if dd > 12 we know it's DD/MM,
  // if mm > 12 we know it's MM/DD; otherwise default to DD/MM (FR).
  if (mm > 12 && dd <= 12) {
    [dd, mm] = [mm, dd];
  }
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const date = new Date(Date.UTC(yy, mm - 1, dd));
  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * Build an ExtractedTransaction from a MappedRow + TableStructure.
 * Returns null if the row clearly isn't a transaction (no date AND no amount).
 */
export function buildTransaction(
  row: MappedRow,
  structure: TableStructure,
): ExtractedTransaction | null {
  const warnings: string[] = [];

  const date = parseDate(row.cells.date);
  const valueDate = parseDate(row.cells.value_date);
  const description = (row.cells.description ?? '').trim();
  const reference = (row.cells.reference ?? '').trim() || undefined;

  // ─── Amount resolution: try the layout that matches the structure ─────
  const hasDebitCol = structure.columns.some((c) => c.role === 'debit');
  const hasCreditCol = structure.columns.some((c) => c.role === 'credit');
  const hasAmountCol = structure.columns.some((c) => c.role === 'amount');
  const hasTypeCol = structure.columns.some((c) => c.role === 'type');

  let amount = 0;
  let amountConfidence = 0;
  let currency: string | undefined;

  if (hasDebitCol || hasCreditCol) {
    // Layout A — separate columns
    const debitParsed = parseAmount(row.cells.debit);
    const creditParsed = parseAmount(row.cells.credit);
    if (debitParsed && Math.abs(debitParsed.value) > 0) {
      amount = -Math.abs(debitParsed.value);
      amountConfidence = debitParsed.confidence;
      currency = debitParsed.currency;
    } else if (creditParsed && Math.abs(creditParsed.value) > 0) {
      amount = Math.abs(creditParsed.value);
      amountConfidence = creditParsed.confidence;
      currency = creditParsed.currency;
    } else {
      warnings.push('Aucun montant débit/crédit lisible');
    }
  } else if (hasAmountCol) {
    // Layout B / C — single column, with optional sign indicator
    const amtParsed = parseAmount(row.cells.amount);
    if (amtParsed) {
      amount = amtParsed.value;
      amountConfidence = amtParsed.confidence;
      currency = amtParsed.currency;
      if (hasTypeCol && !amtParsed.hasExplicitSign) {
        const t = (row.cells.type ?? '').trim().toUpperCase();
        if (/^D|DEBIT|DR/.test(t)) amount = -Math.abs(amount);
        else if (/^C|CREDIT|CR/.test(t)) amount = Math.abs(amount);
      }
    } else {
      warnings.push('Aucun montant lisible');
    }
  } else {
    warnings.push('Structure de colonnes insuffisante');
  }

  // Balance is always positive in practice (account balance can be negative
  // but we don't flip its sign here; we just store what we read)
  const balanceParsed = parseAmount(row.cells.balance);
  const balance = balanceParsed ? balanceParsed.value : undefined;

  // Reject rows that have neither a date nor a non-zero amount (likely page
  // headers, totals, footnotes that slipped through filterNoise).
  if (!date && amount === 0) return null;

  // Confidence aggregation: date present (+0.3), description present (+0.2),
  // amount confidence (×0.5)
  let conf = 0;
  if (date) conf += 0.3;
  if (description.length >= 3) conf += 0.2;
  conf += amountConfidence * 0.5;
  if (warnings.length > 0) conf -= 0.1 * warnings.length;
  conf = Math.max(0, Math.min(1, conf));

  return {
    date: date ?? undefined,
    valueDate: valueDate ?? undefined,
    description,
    reference,
    amount,
    balance,
    currency,
    multiline: row.items.length > 8, // heuristic: multi-line tx have many tokens
    confidence: conf,
    warnings,
    source: row,
    boundingBox: computeBoundingBox(row.items),
  };
}
