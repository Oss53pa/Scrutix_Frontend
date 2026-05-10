// ============================================================================
// PROPH3T tool · aggregateAmount — agrégations sur transactions filtrées
// ============================================================================

import type { BankTransaction } from '../../statement-detail/types/statement.types';
import { searchTransactions, type SearchTransactionsArgs } from './searchTransactions';

export interface AggregateAmountArgs extends SearchTransactionsArgs {
  groupBy?: 'month' | 'category' | 'counterparty' | 'none';
  operation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
}

export interface AggregateAmountResult {
  groups: Array<{ key: string; valueCentimes: number; count: number }>;
  total: number;
}

export function aggregateAmount(
  pool: BankTransaction[],
  args: AggregateAmountArgs,
): AggregateAmountResult {
  const filtered = searchTransactions(pool, args).transactions;
  const operation = args.operation ?? 'sum';
  const groupBy = args.groupBy ?? 'none';

  const groups = new Map<string, { sum: number; count: number; min: number; max: number }>();
  for (const tx of filtered) {
    let key = 'all';
    if (groupBy === 'month') key = tx.date.slice(0, 7);
    if (groupBy === 'counterparty') key = tx.label.split(' ').slice(0, 3).join(' ');

    const amount = Math.abs(tx.creditCentimes - tx.debitCentimes);
    const cur = groups.get(key) ?? { sum: 0, count: 0, min: Infinity, max: -Infinity };
    cur.sum += amount;
    cur.count++;
    if (amount < cur.min) cur.min = amount;
    if (amount > cur.max) cur.max = amount;
    groups.set(key, cur);
  }

  const out = Array.from(groups.entries()).map(([key, v]) => {
    let value = v.sum;
    if (operation === 'avg')   value = v.count > 0 ? v.sum / v.count : 0;
    if (operation === 'count') value = v.count;
    if (operation === 'min')   value = isFinite(v.min) ? v.min : 0;
    if (operation === 'max')   value = isFinite(v.max) ? v.max : 0;
    return { key, valueCentimes: Math.round(value), count: v.count };
  });

  return { groups: out, total: filtered.length };
}
