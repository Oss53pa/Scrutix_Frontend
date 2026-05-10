// ============================================================================
// TransactionsTab — onglet Transactions (table virtualisée + filtres)
// ============================================================================

import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, ArrowUpDown } from 'lucide-react';
import { AmountFCFA, RelativeDate } from '../../../components/shared';
import type { BankTransaction } from '../types/statement.types';

interface TransactionsTabProps {
  bankTxs: BankTransaction[];
}

type SortKey = 'date' | 'amount' | 'balance';
type SortDir = 'asc' | 'desc';

export function TransactionsTab({ bankTxs }: TransactionsTabProps) {
  const [q, setQ] = useState('');
  const [side, setSide] = useState<'all' | 'debit' | 'credit'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const parentRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    let xs = bankTxs;
    if (side === 'debit')  xs = xs.filter((t) => t.debitCentimes > 0);
    if (side === 'credit') xs = xs.filter((t) => t.creditCentimes > 0);
    if (q.trim()) {
      const ql = q.toLowerCase();
      xs = xs.filter((t) =>
        t.label.toLowerCase().includes(ql) ||
        (t.reference ?? '').toLowerCase().includes(ql),
      );
    }
    return [...xs].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'date') return dir * a.date.localeCompare(b.date);
      if (sortKey === 'amount') {
        const av = a.creditCentimes - a.debitCentimes;
        const bv = b.creditCentimes - b.debitCentimes;
        return dir * (av - bv);
      }
      return dir * (a.runningBalanceCentimes - b.runningBalanceCentimes);
    });
  }, [bankTxs, q, side, sortKey, sortDir]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 38,
    overscan: 12,
  });

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  }

  const totalDebit = filtered.reduce((s, t) => s + t.debitCentimes, 0);
  const totalCredit = filtered.reduce((s, t) => s + t.creditCentimes, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-canvas-200 bg-white">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Recherche libellé ou référence…"
            className="w-full pl-7 pr-2 py-1 text-xs border border-canvas-300 rounded"
          />
        </div>
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as typeof side)}
          className="px-2 py-1 text-xs border border-canvas-300 rounded bg-white"
        >
          <option value="all">Tous</option>
          <option value="debit">Débits</option>
          <option value="credit">Crédits</option>
        </select>
        <span className="text-[11px] text-ink-500 ml-auto">
          {filtered.length} ligne(s) · −<AmountFCFA value={totalDebit} compact /> /
          +<AmountFCFA value={totalCredit} compact />
        </span>
      </div>

      <div className="grid grid-cols-12 px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink-500 bg-canvas-50 border-b border-canvas-200">
        <SortHeader k="date" current={sortKey} dir={sortDir} onClick={toggleSort} className="col-span-2">Date</SortHeader>
        <span className="col-span-5">Libellé</span>
        <span className="col-span-2">Référence</span>
        <SortHeader k="amount" current={sortKey} dir={sortDir} onClick={toggleSort} className="col-span-2 text-right">Montant</SortHeader>
        <SortHeader k="balance" current={sortKey} dir={sortDir} onClick={toggleSort} className="col-span-1 text-right">Solde</SortHeader>
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-ink-500">Aucune transaction ne correspond.</div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const t = filtered[vi.index];
              const amount = t.creditCentimes - t.debitCentimes;
              return (
                <div
                  key={t.id}
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    transform: `translateY(${vi.start}px)`,
                    height: 38,
                  }}
                  className="grid grid-cols-12 items-center px-3 text-xs border-b border-canvas-100 hover:bg-canvas-50"
                >
                  <span className="col-span-2 font-mono text-ink-700">
                    <RelativeDate date={t.date} />
                  </span>
                  <span className="col-span-5 font-mono truncate" title={t.label}>{t.label}</span>
                  <span className="col-span-2 font-mono text-ink-500 text-[10px] truncate">{t.reference ?? ''}</span>
                  <span className="col-span-2 text-right">
                    <AmountFCFA value={amount} colorize />
                  </span>
                  <span className="col-span-1 text-right text-ink-700">
                    <AmountFCFA value={t.runningBalanceCentimes} compact />
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

function SortHeader({
  k, current, dir, onClick, children, className = '',
}: {
  k: SortKey; current: SortKey; dir: SortDir;
  onClick: (k: SortKey) => void;
  children: React.ReactNode; className?: string;
}) {
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
