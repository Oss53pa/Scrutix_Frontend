// ============================================================================
// PROPH3T tool · searchTransactions
// ============================================================================
// Calcul TS pur. Le LLM ne calcule jamais — il sélectionne ce tool et
// formule la réponse à partir du résultat structuré.
// ============================================================================

import type { BankTransaction, ProphetCitation } from '../../statement-detail/types/statement.types';

export interface SearchTransactionsArgs {
  keywords?: string[];
  dateFrom?: string;
  dateTo?: string;
  minAmountCentimes?: number;
  maxAmountCentimes?: number;
  side?: 'debit' | 'credit' | 'both';
  limit?: number;
}

export interface SearchTransactionsResult {
  transactions: BankTransaction[];
  totalCentimes: number;
  citations: ProphetCitation[];
}

export function searchTransactions(
  pool: BankTransaction[],
  args: SearchTransactionsArgs,
): SearchTransactionsResult {
  let txs = pool;

  if (args.dateFrom) txs = txs.filter((t) => t.date >= args.dateFrom!);
  if (args.dateTo)   txs = txs.filter((t) => t.date <= args.dateTo!);

  if (args.keywords && args.keywords.length > 0) {
    const ks = args.keywords.map((k) => k.toLowerCase());
    txs = txs.filter((t) => ks.some((k) => t.label.toLowerCase().includes(k)));
  }

  if (args.side === 'debit')  txs = txs.filter((t) => t.debitCentimes > 0);
  if (args.side === 'credit') txs = txs.filter((t) => t.creditCentimes > 0);

  if (args.minAmountCentimes !== undefined) {
    txs = txs.filter((t) => Math.max(t.debitCentimes, t.creditCentimes) >= args.minAmountCentimes!);
  }
  if (args.maxAmountCentimes !== undefined) {
    txs = txs.filter((t) => Math.max(t.debitCentimes, t.creditCentimes) <= args.maxAmountCentimes!);
  }

  if (args.limit) txs = txs.slice(0, args.limit);

  const total = txs.reduce((s, t) => s + (t.creditCentimes - t.debitCentimes), 0);

  return {
    transactions: txs,
    totalCentimes: total,
    citations: txs.slice(0, 5).map((t) => ({
      kind: 'transaction',
      id: t.id,
      label: `${t.label.slice(0, 40)} — ${t.date}`,
    })),
  };
}
