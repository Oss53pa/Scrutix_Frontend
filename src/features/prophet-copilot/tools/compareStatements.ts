// ============================================================================
// PROPH3T tool · compareStatements — comparaison entre 2 relevés
// ============================================================================

import type { BankTransaction, ProphetCitation } from '../../statement-detail/types/statement.types';

export interface CompareStatementsArgs {
  baseline: { statementId: string; bankTxs: BankTransaction[] };
  current:  { statementId: string; bankTxs: BankTransaction[] };
  /** Si fourni, on ne compare que sur les libellés contenant ce mot-clé. */
  keywordFilter?: string;
}

export interface CompareStatementsResult {
  baselineTotalCentimes: number;
  currentTotalCentimes: number;
  deltaCentimes: number;
  deltaPct: number | null;
  baselineCount: number;
  currentCount: number;
  citations: ProphetCitation[];
}

export function compareStatements(args: CompareStatementsArgs): CompareStatementsResult {
  const k = args.keywordFilter?.toLowerCase();
  const filterFn = (t: BankTransaction) => k ? t.label.toLowerCase().includes(k) : true;

  const baseTxs = args.baseline.bankTxs.filter(filterFn);
  const currTxs = args.current.bankTxs.filter(filterFn);

  const baseTotal = baseTxs.reduce((s, t) => s + (t.debitCentimes), 0);
  const currTotal = currTxs.reduce((s, t) => s + (t.debitCentimes), 0);
  const delta = currTotal - baseTotal;
  const deltaPct = baseTotal !== 0 ? (delta / baseTotal) * 100 : null;

  const citations: ProphetCitation[] = [
    { kind: 'calc', id: args.baseline.statementId, label: `Relevé baseline (${baseTxs.length} tx)` },
    { kind: 'calc', id: args.current.statementId,  label: `Relevé courant  (${currTxs.length} tx)` },
  ];

  return {
    baselineTotalCentimes: baseTotal,
    currentTotalCentimes: currTotal,
    deltaCentimes: delta,
    deltaPct,
    baselineCount: baseTxs.length,
    currentCount: currTxs.length,
    citations,
  };
}
