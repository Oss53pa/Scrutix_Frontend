// ============================================================================
// TransactionsTab — orchestrateur de l'onglet Transactions
// ============================================================================
// Compose TransactionsFilters + TransactionsTable (spec §10).
// ============================================================================

import { useMemo, useState } from 'react';
import { TransactionsFilters, type TransactionsFiltersState } from './TransactionsTab/TransactionsFilters';
import {
  TransactionsTable,
  type TransactionsSortKey,
  type TransactionsSortDir,
} from './TransactionsTab/TransactionsTable';
import { AmountFCFA } from '../../../components/shared';
import type { BankTransaction } from '../types/statement.types';

interface TransactionsTabProps {
  bankTxs: BankTransaction[];
  flaggedTxIds?: Set<string>;
}

export function TransactionsTab({ bankTxs, flaggedTxIds }: TransactionsTabProps) {
  const [filters, setFilters] = useState<TransactionsFiltersState>({ q: '', side: 'all' });
  const [sortKey, setSortKey] = useState<TransactionsSortKey>('date');
  const [sortDir, setSortDir] = useState<TransactionsSortDir>('asc');

  const filtered = useMemo(() => {
    let xs = bankTxs;
    if (filters.side === 'debit')  xs = xs.filter((t) => t.debitCentimes > 0);
    if (filters.side === 'credit') xs = xs.filter((t) => t.creditCentimes > 0);
    if (filters.q.trim()) {
      const ql = filters.q.toLowerCase();
      xs = xs.filter((t) =>
        t.label.toLowerCase().includes(ql) ||
        (t.reference ?? '').toLowerCase().includes(ql),
      );
    }
    return xs;
  }, [bankTxs, filters]);

  const totalDebit = filtered.reduce((s, t) => s + t.debitCentimes, 0);
  const totalCredit = filtered.reduce((s, t) => s + t.creditCentimes, 0);

  function toggleSort(k: TransactionsSortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  }

  const counter = (
    <>
      {filtered.length} ligne(s) · −<AmountFCFA value={totalDebit} compact /> /
      +<AmountFCFA value={totalCredit} compact />
    </>
  );

  return (
    <div className="flex flex-col h-full">
      <TransactionsFilters
        filters={filters}
        onChange={setFilters}
        counterText={typeof counter === 'string' ? counter : undefined}
      />
      <TransactionsTable
        transactions={filtered}
        flaggedTxIds={flaggedTxIds}
        sortKey={sortKey}
        sortDir={sortDir}
        onToggleSort={toggleSort}
      />
    </div>
  );
}
