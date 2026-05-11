// ============================================================================
// TransactionsTable — table virtualisée (format SYSCOHADA)
// ============================================================================
// 7 colonnes (relevé bancaire standard) + indicateur anomalie :
//   Date | Valeur | Libellé | Référence | Débit | Crédit | Solde | ⚠
//
// Tri cliquable sur : date, valueDate, debit, credit, balance.
// Date affichée en jj/MM/yyyy via formatDateDDMMYYYY (UTC-safe).
// ============================================================================

import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUpDown, AlertTriangle } from 'lucide-react';
import { AmountFCFA } from '../../../../components/shared';
import { formatDateDDMMYYYY } from '../../../../lib/dateFormat';
import type { BankTransaction } from '../../types/statement.types';

export type TransactionsSortKey = 'date' | 'valueDate' | 'debit' | 'credit' | 'balance';
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
      switch (sortKey) {
        case 'date':
          return dir * (a.date ?? '').localeCompare(b.date ?? '');
        case 'valueDate':
          return dir * (a.valueDate ?? '').localeCompare(b.valueDate ?? '');
        case 'debit':
          return dir * (a.debitCentimes - b.debitCentimes);
        case 'credit':
          return dir * (a.creditCentimes - b.creditCentimes);
        case 'balance':
        default:
          return dir * (a.runningBalanceCentimes - b.runningBalanceCentimes);
      }
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
      {/* En-tête : 16 colonnes pour granularité fine. */}
      <div className="grid grid-cols-16 gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink-500 bg-canvas-50 border-b border-canvas-200">
        <SortHeader k="date"      current={sortKey} dir={sortDir} onClick={onToggleSort} className="col-span-2">Date</SortHeader>
        <SortHeader k="valueDate" current={sortKey} dir={sortDir} onClick={onToggleSort} className="col-span-2">Valeur</SortHeader>
        <span className="col-span-4">Libellé</span>
        <span className="col-span-2">Référence</span>
        <SortHeader k="debit"   current={sortKey} dir={sortDir} onClick={onToggleSort} className="col-span-2 justify-end">Débit</SortHeader>
        <SortHeader k="credit"  current={sortKey} dir={sortDir} onClick={onToggleSort} className="col-span-2 justify-end">Crédit</SortHeader>
        <SortHeader k="balance" current={sortKey} dir={sortDir} onClick={onToggleSort} className="col-span-1 justify-end">Solde</SortHeader>
        <span className="col-span-1 text-center" aria-label="Indicateur anomalie">⚠</span>
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="text-center py-8 text-sm text-ink-500">Aucune transaction ne correspond.</div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const t = sorted[vi.index];
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
                  className={`grid grid-cols-16 gap-2 items-center px-3 text-xs border-b border-canvas-100 ${flagged ? 'bg-rose-50/30' : 'hover:bg-canvas-50'}`}
                >
                  <span className="col-span-2 font-mono text-ink-700">
                    {formatDateDDMMYYYY(t.date)}
                  </span>
                  <span className="col-span-2 font-mono text-ink-500">
                    {t.valueDate ? formatDateDDMMYYYY(t.valueDate) : '—'}
                  </span>
                  <span className="col-span-4 truncate" title={t.label}>{t.label}</span>
                  <span className="col-span-2 font-mono text-ink-500 text-[10px] truncate">{t.reference ?? ''}</span>
                  <span className="col-span-2 text-right">
                    {t.debitCentimes > 0 ? <AmountFCFA value={-t.debitCentimes} colorize /> : <span className="text-ink-300">—</span>}
                  </span>
                  <span className="col-span-2 text-right">
                    {t.creditCentimes > 0 ? <AmountFCFA value={t.creditCentimes} colorize /> : <span className="text-ink-300">—</span>}
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
