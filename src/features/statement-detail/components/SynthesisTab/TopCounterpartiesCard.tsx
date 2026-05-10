// ============================================================================
// TopCounterpartiesCard — top 4 contreparties triées par volume absolu
// ============================================================================

import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { AmountFCFA } from '../../../../components/shared';
import type { BankTransaction } from '../../types/statement.types';

interface TopCounterpartiesCardProps {
  bankTxs: BankTransaction[];
  /** Si fourni, on flag les contreparties absentes de cette liste comme "nouveau". */
  knownCounterparties?: Set<string>;
  onSeeAll?: () => void;
}

interface Counterparty {
  name: string;
  totalCentimes: number;
  netDirection: 'in' | 'out';
  txCount: number;
  isRecurring: boolean;
  isNew: boolean;
}

export function TopCounterpartiesCard({ bankTxs, knownCounterparties, onSeeAll }: TopCounterpartiesCardProps) {
  const top = useMemo(() => buildTop(bankTxs, knownCounterparties), [bankTxs, knownCounterparties]);

  return (
    <section className="bg-white border border-canvas-200 rounded-lg p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-ink-900 inline-flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          Top contreparties
        </h3>
        <button onClick={onSeeAll} className="text-[11px] text-amber-700 hover:underline">Tout voir ↗</button>
      </div>
      <ul className="divide-y divide-canvas-100">
        {top.length === 0 && (
          <li className="text-xs text-ink-500 py-2">Aucune contrepartie identifiée.</li>
        )}
        {top.map((c) => (
          <li key={c.name} className="py-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-ink-900 truncate">{c.name}</span>
                {c.isNew && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                    nouveau
                  </span>
                )}
              </div>
              <div className="text-[10px] text-ink-500 mt-0.5">
                {c.txCount} {c.netDirection === 'in' ? 'virement' : c.txCount > 1 ? 'transactions' : 'transaction'}{c.txCount > 1 && c.netDirection === 'in' ? 's' : ''}
                {c.isRecurring ? ' · récurrent' : c.isNew ? ' · contrepartie inédite' : ''}
              </div>
            </div>
            <span className={c.netDirection === 'in' ? 'text-emerald-700' : 'text-ink-700'}>
              <AmountFCFA value={c.netDirection === 'in' ? c.totalCentimes : -c.totalCentimes} units showSign />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function buildTop(txs: BankTransaction[], known?: Set<string>): Counterparty[] {
  const map = new Map<string, { totalIn: number; totalOut: number; count: number }>();
  for (const t of txs) {
    const name = extractName(t.label);
    if (!name) continue;
    const cur = map.get(name) ?? { totalIn: 0, totalOut: 0, count: 0 };
    cur.totalIn += t.creditCentimes / 100;
    cur.totalOut += t.debitCentimes / 100;
    cur.count += 1;
    map.set(name, cur);
  }
  const all: Counterparty[] = Array.from(map.entries()).map(([name, v]) => {
    const net = v.totalIn - v.totalOut;
    return {
      name,
      totalCentimes: Math.round(Math.abs(net)),
      netDirection: net >= 0 ? 'in' : 'out',
      txCount: v.count,
      isRecurring: v.count >= 3,
      isNew: known ? !known.has(name.toLowerCase()) : false,
    };
  });
  return all
    .sort((a, b) => b.totalCentimes - a.totalCentimes)
    .slice(0, 4);
}

function extractName(label: string): string | null {
  // Heuristique : prend les 3-4 premiers mots significatifs après le préfixe technique
  const cleaned = label
    .replace(/^(VIR\s*EMIS|VIR\s*RECU|VIRT|VIR|CB|CHQ|REM|PRELEV|PRLV|RETRAIT|VERSEMENT|COM|COMM|FRAIS|INT|TPE)\s+/i, '')
    .replace(/\s+\d{6,}/g, '')   // numéros
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 3) return null;
  // Tronque à 4 mots max
  const parts = cleaned.split(' ').slice(0, 4);
  return parts.join(' ');
}
