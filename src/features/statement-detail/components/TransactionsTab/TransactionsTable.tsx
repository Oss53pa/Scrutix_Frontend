// ============================================================================
// TransactionsTable — table virtualisée
// ============================================================================
// Spec §5.7 : 7 colonnes (Date / Libellé / Catégorie / Débit / Crédit / Solde
// / Indicateur anomalie). Tri cliquable sur Date, Montant, Solde.
// ============================================================================

import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUpDown, AlertTriangle } from 'lucide-react';
import { AmountFCFA, RelativeDate } from '../../../../components/shared';
import type { BankTransaction } from '../../types/statement.types';

export type TransactionsSortKey = 'date' | 'amount' | 'balance';
export type TransactionsSortDir = 'asc' | 'desc';

interface TransactionsTableProps {
  transactions: BankTransaction[];
  /** IDs des transactions qui portent une anomalie (pour afficher l'indicateur). */
  flaggedTxIds?: Set<string>;
  sortKey: TransactionsSortKey;
  sortDir: TransactionsSortDir;
  onToggleSort: (k: TransactionsSortKey) => void;
}

export function TransactionsTable(props: TransactionsTableProps) {
  const { transactions, sortKey, sortDir, onToggleSort } = props;
  const parentRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(() => {
    const xs = [...transactions];
    const dir = sortDir === 'asc' ? 1 : -1;
    return xs.sort((a, b) => {
      if (sortKey === 'date') return dir * a.date.localeCompare(b.date);
      if (sortKey === 'amount') {
        return dir * ((a.creditCentimes - a.debitCentimes) - (b.creditCentimes - b.debitCentimes));
      }
      return dir * (a.runningBalanceCentimes - b.runningBalanceCentimes);
    });
  }, [transactions, sortKey, sortDir]);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 38,
    overscan: 12,
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="grid grid-cols-12 px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink-500 bg-canvas-50 border-b border-canvas-200">
        <SortHeader k="date" current={sortKey} dir={sortDir} onClick={onToggleSort} className="col-span-2">Date</SortHeader>
        <span className="col-span-4">Libellé</span>
        <span className="col-span-2">Référence</span>
        <SortHeader k="amount" current={sortKey} dir={sortDir} onClick={onToggleSort} className="col-span-2 text-right">Montant</SortHeader>
        <SortHeader k="balance" current={sortKey} dir={sortDir} onClick={onToggleSort} className="col-span-1 text-right">Solde</SortHeader>
        <span className="col-span-1 text-center" aria-label="Indicateur anomalie">⚠</span>
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="text-center py-8 text-sm text-ink-500">Aucune transaction ne correspond.</div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const t = sorted[vi.index];
              const amount = t.creditCentimes - t.debitCentimes;
              const flagged = props.flaggedTxIds?.has(t.id) ?? false;
              return (
                <div
                  key={t.id}
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    transform: `translateY(${vi.start}px)`,
                    height: 38,
                  }}
                  className={`grid grid-cols-12 items-center px-3 text-xs border-b border-canvas-100 ${flagged ? 'bg-rose-50/30' : 'hover:bg-canvas-50'}`}
                >
                  <span className="col-span-2 font-mono text-ink-700">
                    <RelativeDate date={t.date} />
                  </span>
                  <span className="col-span-4 font-mono truncate" title={t.label}>{t.label}</span>
                  <span className="col-span-2 font-mono text-ink-500 text-[10px] truncate">{t.reference ?? ''}</span>
                  <span className="col-span-2 text-right">
                    <AmountFCFA value={amount} colorize />
                  </span>
                  <span className="col-span-1 text-right text-ink-700">
                    <AmountFCFA value={t.runningBalanceCentimes} compact />
                  </span>
                  <span className="col-span-1 flex items-center justify-center">
                    {flagged && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface SortHeaderProps {
  k: TransactionsSortKey;
  current: TransactionsSortKey;
  dir: TransactionsSortDir;
  onClick: (k: TransactionsSortKey) => void;
  children: React.ReactNode;
  className?: string;
}

function SortHeader({ k, current, dir, onClick, children, className = '' }: SortHeaderProps) {
  const active = k === current;
  return (
    <button
      onClick={() => onClick(k)}
      className={`flex items-center gap-1 hover:text-ink-900 ${active ? 'text-ink-900' : ''} ${className}`}
    >
      {children}
      <ArrowUpDown className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-30'}`} />
      {active && <span className="text-[8px]">{dir === 'asc' ? '▲' : '▼'}</span>}
    </button>
  );
}
