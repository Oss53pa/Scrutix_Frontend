// ============================================================================
// ATLASBANX — PDF bank statement extractor (generic, position-aware)
// ============================================================================
// Multi-strategy extractor that works on ANY bank format because it doesn't
// assume specific column orders or labels — it discovers the table structure
// from the document itself.
//
// Pipeline:
//   1. Read PDF with pdfjs → items[] with X/Y per page
//   2. Cluster items into rows by similar Y (per page)
//   3. Detect the header row (free text "Débit / Crédit / Solde / Date" etc.)
//   4. Snap each content row to columns using the header's X bounds
//   5. Merge multi-line transactions (rows without a date in date column
//      fold into the previous row)
//   6. Build ExtractedTransaction per row with confidence + warnings
//   7. If header detection fails OR yields 0 transactions, run the legacy
//      free-text strategy as a fallback (handles formats with no clear table)
//   8. If still empty AND PDF is image-based, OCR the pages and retry
// ============================================================================

import { pdfjsLib } from '../../services/pdfjsWorker';
import { OcrService } from '../../services/OcrService';
import {
  clusterRows,
  detectTableStructure,
} from './HeaderDetector';
import {
  filterNoise,
  mergeMultilineTransactions,
  snapRowToColumns,
} from './RowReconstructor';
import { buildTransaction } from './TransactionBuilder';
import { findAmounts, parseAmount } from './AmountParser';
import type {
  ExtractedTransaction,
  ExtractionOptions,
  ExtractionResult,
  PositionedItem,
  TableStructure,
} from './types';
import type { Transaction } from '../../types';
import { TransactionType } from '../../types';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_OPTS: Required<Omit<ExtractionOptions, 'onProgress' | 'bankCode'>> = {
  forceOcr: false,
  skipOcr: false,
  defaultCurrency: 'XOF',
  rowYTolerance: 3,
};

/**
 * Main entry point. Extracts transactions from a bank statement PDF.
 */
export async function extractStatement(
  file: File,
  options: ExtractionOptions = {},
): Promise<ExtractionResult> {
  const start = performance.now();
  const opts = { ...DEFAULT_OPTS, ...options };
  const warnings: string[] = [];

  options.onProgress?.({ stage: 'load', pct: 0, message: 'Lecture du PDF...' });

  // ─── 1. Read PDF with positions ────────────────────────────────────────
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const items: PositionedItem[] = [];
  let totalChars = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      const text = (it as { str: string }).str;
      if (!text || !text.trim()) continue;
      const transform = (it as { transform?: number[] }).transform;
      const x = transform?.[4] ?? 0;
      const y = transform?.[5] ?? 0;
      const width = (it as { width?: number }).width ?? text.length * 4;
      const height = (it as { height?: number }).height ?? 8;
      items.push({ text, page: p, x, y, width, height });
      totalChars += text.length;
    }
    options.onProgress?.({
      stage: 'load',
      pct: p / pdf.numPages,
      message: `Lecture page ${p}/${pdf.numPages}`,
    });
  }

  // ─── 1b. Decide if we need OCR ────────────────────────────────────────
  const avgPerPage = totalChars / Math.max(1, pdf.numPages);
  const needsOcr = opts.forceOcr || (!opts.skipOcr && avgPerPage < 50);

  if (needsOcr) {
    warnings.push('PDF scanné détecté — extraction par OCR');
    options.onProgress?.({ stage: 'ocr', pct: 0, message: 'OCR en cours...' });
    const ocrResult = await OcrService.recognizePdf(file);
    if (ocrResult.success) {
      // OCR doesn't give us positions, so we fall back to the legacy
      // free-text strategy on the OCR output
      const tx = strategyFreeText(
        ocrResult.text.split('\n').map((l) => l.trim()).filter(Boolean),
        opts,
      );
      return finalize(tx, {
        totalPages: pdf.numPages,
        itemCount: items.length,
        rowCount: 0,
        headerDetected: false,
        headerConfidence: 0,
        ocrUsed: true,
        durationMs: Math.round(performance.now() - start),
      }, warnings, opts, !tx.length ? 'Le moteur OCR n\'a pas trouvé de tableau de transactions. Le document est peut-être de mauvaise qualité.' : undefined);
    }
    warnings.push(`Échec OCR: ${ocrResult.error}`);
  }

  // ─── 2. Strategy A: position-aware table detection ────────────────────
  options.onProgress?.({ stage: 'detect', pct: 0.5, message: 'Détection du tableau...' });

  let bestStructure: TableStructure | null = null;
  // Try header detection per page (header usually only on page 1, but some
  // banks repeat it on every page)
  for (let p = 1; p <= pdf.numPages; p++) {
    const rowsOnPage = clusterRows(items, p, opts.rowYTolerance);
    const struct = detectTableStructure(rowsOnPage);
    if (struct && (!bestStructure || struct.confidence > bestStructure.confidence)) {
      bestStructure = struct;
    }
    if (bestStructure && bestStructure.confidence > 0.85) break;
  }

  let candidates: ExtractedTransaction[] = [];

  if (bestStructure && bestStructure.confidence >= 0.4) {
    options.onProgress?.({
      stage: 'extract',
      pct: 0.7,
      message: `Tableau détecté (${Math.round(bestStructure.confidence * 100)}% confiance, ${bestStructure.columns.length} colonnes)`,
    });

    // Cluster rows across ALL pages
    const allRows = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const pageRows = clusterRows(items, p, opts.rowYTolerance);
      allRows.push(...pageRows);
    }

    // Snap each row to columns, then merge multiline transactions
    const mapped = allRows.map((r) => snapRowToColumns(r, bestStructure!));
    const filtered = filterNoise(mapped, bestStructure);
    const merged = mergeMultilineTransactions(filtered);

    // Build transactions
    for (const row of merged) {
      const tx = buildTransaction(row, bestStructure);
      if (tx) candidates.push(tx);
    }
  }

  // ─── 3. Fallback: free-text strategy ──────────────────────────────────
  if (candidates.length === 0) {
    warnings.push('Détection de tableau infructueuse, basculement sur extraction texte libre');
    // Reconstruct line-grouped text from items
    const lineMap = new Map<string, string[]>();
    for (const it of items) {
      const key = `${it.page}|${Math.round(it.y / 5) * 5}`;
      if (!lineMap.has(key)) lineMap.set(key, []);
      lineMap.get(key)!.push(it.text);
    }
    const lines = Array.from(lineMap.entries())
      .sort((a, b) => {
        const [pa, ya] = a[0].split('|').map(Number);
        const [pb, yb] = b[0].split('|').map(Number);
        if (pa !== pb) return pa - pb;
        return yb - ya;
      })
      .map(([, parts]) => parts.join(' ').trim())
      .filter((l) => l.length > 0);

    candidates = strategyFreeText(lines, opts);
  }

  // ─── 4. Finalize ──────────────────────────────────────────────────────
  return finalize(
    candidates,
    {
      totalPages: pdf.numPages,
      itemCount: items.length,
      rowCount: 0,
      headerDetected: !!bestStructure,
      headerConfidence: bestStructure?.confidence ?? 0,
      ocrUsed: needsOcr,
      durationMs: Math.round(performance.now() - start),
    },
    warnings,
    opts,
    candidates.length === 0
      ? 'Aucune transaction détectable. Le format du relevé n\'est peut-être pas un tableau standard.'
      : undefined,
  );
}

// ============================================================================
// Strategy: free-text fallback (no positions)
// Lines that contain a date + ≥1 amount-like cluster are treated as transactions.
// Multi-line wrap (continuation lines without a date) are concatenated.
// ============================================================================

const DATE_LINE = /^\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/;

function strategyFreeText(
  lines: string[],
  opts: { defaultCurrency: string },
): ExtractedTransaction[] {
  const transactions: ExtractedTransaction[] = [];

  // Group continuation lines into the previous date-bearing line
  const grouped: string[] = [];
  for (const line of lines) {
    if (DATE_LINE.test(line) || grouped.length === 0) {
      grouped.push(line);
    } else {
      grouped[grouped.length - 1] += ' ' + line;
    }
  }

  for (const line of grouped) {
    const dateMatch = line.match(DATE_LINE);
    if (!dateMatch) continue;

    // Strip date(s) at the start (some banks have Date + Date Valeur)
    let rest = line.replace(/^\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}(?:\s+\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})?)\s*/, '');

    // Find amount-like clusters in the rest
    const amounts = findAmounts(rest);
    if (amounts.length === 0) continue;

    // Heuristic: the LAST 1-3 amounts at the end of the line are the fees columns.
    // The libellé is everything before the first of those amounts.
    // Banks typically print: [Libellé] [Débit OR Crédit] [Solde]
    const lastAmounts = amounts.slice(-3);
    const firstFeeAmt = lastAmounts[0];
    const description = rest.slice(0, firstFeeAmt.start).trim();

    // The signed transaction amount = the first of last 1-2 amounts (excluding
    // the LAST one which is the running balance)
    let txAmount = 0;
    let balance: number | undefined;
    if (lastAmounts.length >= 2) {
      const txParsed = parseAmount(lastAmounts[lastAmounts.length - 2].raw);
      const balParsed = parseAmount(lastAmounts[lastAmounts.length - 1].raw);
      if (txParsed) txAmount = txParsed.value;
      if (balParsed) balance = balParsed.value;
    } else {
      const onlyParsed = parseAmount(lastAmounts[0].raw);
      if (onlyParsed) txAmount = onlyParsed.value;
    }

    // Sign detection from keywords in the libellé
    const lower = description.toLowerCase();
    if (txAmount > 0 && /retrait|prelev|cheque|frais|commission|virement\s*emis|debit|virt\s+w/i.test(lower)) {
      txAmount = -Math.abs(txAmount);
    } else if (txAmount > 0 && /versement|depot|virement\s*recu|credit|interets\s*credit/i.test(lower)) {
      txAmount = Math.abs(txAmount);
    }

    transactions.push({
      date: parseDateLoose(dateMatch[1]) ?? undefined,
      description,
      amount: txAmount,
      balance,
      currency: opts.defaultCurrency,
      multiline: false,
      confidence: 0.55,
      warnings: ['Extraction sans positions — confiance réduite'],
    });
  }

  return transactions;
}

function parseDateLoose(s: string): Date | null {
  const m = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (!m) return null;
  let dd = parseInt(m[1], 10);
  let mm = parseInt(m[2], 10);
  let yy = parseInt(m[3], 10);
  if (yy < 100) yy = yy >= 50 ? 1900 + yy : 2000 + yy;
  if (mm > 12 && dd <= 12) [dd, mm] = [mm, dd];
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const d = new Date(Date.UTC(yy, mm - 1, dd));
  if (isNaN(d.getTime())) return null;
  // Validate the date didn't roll over (e.g., Feb 31 → Mar 3)
  if (d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return null;
  return d;
}

// ============================================================================
// Finalization — convert ExtractedTransaction[] into domain Transaction[]
// ============================================================================

function finalize(
  candidates: ExtractedTransaction[],
  stats: {
    totalPages: number;
    itemCount: number;
    rowCount: number;
    headerDetected: boolean;
    headerConfidence: number;
    ocrUsed: boolean;
    durationMs: number;
  },
  warnings: string[],
  opts: { defaultCurrency: string },
  diagnostic?: string,
): ExtractionResult {
  const transactions: Transaction[] = candidates
    .filter((c) => c.date && c.amount !== 0)
    .map((c) => ({
      id: uuidv4(),
      date: c.date!,
      valueDate: c.valueDate ?? c.date!,
      amount: c.amount,
      description: c.description || 'Transaction',
      reference: c.reference ?? '',
      type: c.amount < 0 ? TransactionType.DEBIT : TransactionType.CREDIT,
      bankCode: '',
      accountId: '',
      clientId: '',
      balance: c.balance,
      currency: c.currency || opts.defaultCurrency,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

  const avgConf =
    candidates.length === 0
      ? 0
      : candidates.reduce((s, c) => s + c.confidence, 0) / candidates.length;

  return {
    success: transactions.length > 0,
    transactions,
    candidates,
    stats: {
      ...stats,
      rowCount: candidates.length,
      transactionCount: transactions.length,
      averageConfidence: avgConf,
    },
    warnings,
    diagnostic,
  };
}
