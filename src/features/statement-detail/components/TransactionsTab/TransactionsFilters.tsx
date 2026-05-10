// ============================================================================
// TransactionsFilters — filtres au-dessus de la table Transactions
// ============================================================================

import { Search } from 'lucide-react';

export interface TransactionsFiltersState {
  q: string;
  side: 'all' | 'debit' | 'credit';
}

interface TransactionsFiltersProps {
  filters: TransactionsFiltersState;
  onChange: (next: TransactionsFiltersState) => void;
  /** Compteur affiché à droite (n filtered / m total). */
  counterText?: string;
}

export function TransactionsFilters({ filters, onChange, counterText }: TransactionsFiltersProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-canvas-200 bg-white">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
        <input
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder="Recherche libellé ou référence…"
          className="w-full pl-7 pr-2 py-1 text-xs border border-canvas-300 rounded"
        />
      </div>
      <select
        value={filters.side}
        onChange={(e) => onChange({ ...filters, side: e.target.value as TransactionsFiltersState['side'] })}
        className="px-2 py-1 text-xs border border-canvas-300 rounded bg-white"
      >
        <option value="all">Tous</option>
        <option value="debit">Débits</option>
        <option value="credit">Crédits</option>
      </select>
      {counterText && (
        <span className="text-[11px] text-ink-500 ml-auto">{counterText}</span>
      )}
    </div>
  );
}
