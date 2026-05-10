// ============================================================================
// DiscrepanciesPanel — panneau récapitulatif des 5 catégories d'écarts
// ============================================================================

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DiscrepancyCard } from './DiscrepancyCard';
import type { ReconciliationDiscrepancy, DiscrepancyKind } from '../../types/statement.types';

const KIND_LABEL: Record<DiscrepancyKind, string> = {
  bank_only:        'Op banque non comptabilisée',
  ledger_only:      'Écriture compta absente du relevé',
  amount_mismatch:  'Écart de montant',
  date_mismatch:    'Écart de date',
  duplicate_bank:   'Doublon côté banque',
  duplicate_ledger: 'Doublon côté compta',
};

interface DiscrepanciesPanelProps {
  discrepancies: ReconciliationDiscrepancy[];
  onPushToAtlas?: (id: string) => void;
  onIgnore?: (id: string) => void;
}

export function DiscrepanciesPanel({ discrepancies, onPushToAtlas, onIgnore }: DiscrepanciesPanelProps) {
  const grouped = useMemo(() => {
    const m = new Map<DiscrepancyKind, ReconciliationDiscrepancy[]>();
    for (const d of discrepancies) {
      const arr = m.get(d.kind) ?? [];
      arr.push(d);
      m.set(d.kind, arr);
    }
    return m;
  }, [discrepancies]);

  if (discrepancies.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" />
        Aucun écart détecté — le rapprochement est parfait.
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 mb-3">
        <AlertTriangle className="w-4 h-4" />
        {discrepancies.length} écart{discrepancies.length > 1 ? 's' : ''} détecté{discrepancies.length > 1 ? 's' : ''}
      </div>
      {Array.from(grouped.entries()).map(([kind, items]) => (
        <div key={kind} className="mb-3">
          <h4 className="text-xs font-semibold text-amber-900 mb-1.5">
            {KIND_LABEL[kind]} ({items.length})
          </h4>
          <div className="space-y-1.5">
            {items.map((d) => (
              <DiscrepancyCard key={d.id} d={d} onPushToAtlas={onPushToAtlas} onIgnore={onIgnore} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
