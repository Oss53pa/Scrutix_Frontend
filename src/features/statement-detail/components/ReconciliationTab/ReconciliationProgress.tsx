// ============================================================================
// ReconciliationProgress — bandeau progression du rapprochement
// ============================================================================

import type { BankReconciliation } from '../../types/statement.types';

interface ReconciliationProgressProps {
  reconciliation: BankReconciliation;
}

export function ReconciliationProgress({ reconciliation }: ReconciliationProgressProps) {
  const rate = reconciliation.matchRate;
  const tone =
    rate >= 95 ? 'bg-emerald-500'
    : rate >= 70 ? 'bg-amber-500'
    : 'bg-rose-500';

  const matchedBank = reconciliation.matchedPairs.length;
  const matchedLedger = reconciliation.matchedPairs.length;

  return (
    <div className="bg-white border border-canvas-200 rounded-lg p-3">
      <div className="flex items-center justify-between text-xs text-ink-700 mb-2">
        <span>
          Rapprochement : <b>{matchedBank}</b> / {matchedBank + reconciliation.unmatchedBank.length} transactions banque
          {' '}·{' '}
          <b>{matchedLedger}</b> / {matchedLedger + reconciliation.unmatchedLedger.length} écritures compta
        </span>
        <span className="font-mono font-semibold">{rate}%</span>
      </div>
      <div className="h-2 bg-canvas-100 rounded-full overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}
