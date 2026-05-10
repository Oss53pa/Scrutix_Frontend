// ============================================================================
// DiscrepancyCard — une carte d'écart avec écriture proposée
// ============================================================================

import { ArrowRightLeft } from 'lucide-react';
import { AmountFCFA, RoleGuard } from '../../../../components/shared';
import type { ReconciliationDiscrepancy } from '../../types/statement.types';

interface DiscrepancyCardProps {
  d: ReconciliationDiscrepancy;
  onPushToAtlas?: (id: string) => void;
  onIgnore?: (id: string) => void;
}

export function DiscrepancyCard({ d, onPushToAtlas, onIgnore }: DiscrepancyCardProps) {
  return (
    <div className="bg-white border border-amber-200 rounded p-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-ink-900">{d.description}</div>
          {d.gapCentimes !== 0 && (
            <div className="text-[10px] text-ink-500 font-mono mt-0.5">
              Écart : <AmountFCFA value={d.gapCentimes} colorize compact />
            </div>
          )}
        </div>
      </div>
      {d.proposedJournal && d.proposedJournal.length > 0 && (
        <div className="mt-2 bg-canvas-50 border border-canvas-200 rounded px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-ink-500 mb-1">Écriture proposée</div>
          <table className="w-full text-[10px] font-mono">
            <tbody>
              {d.proposedJournal.map((line, i) => (
                <tr key={i}>
                  <td className="text-ink-700">{line.accountCode}</td>
                  <td className="text-ink-700">{line.accountLabel}</td>
                  <td className="text-right text-ink-900">
                    {line.debitCentimes > 0 ? <AmountFCFA value={line.debitCentimes} compact /> : ''}
                  </td>
                  <td className="text-right text-ink-900">
                    {line.creditCentimes > 0 ? <AmountFCFA value={line.creditCentimes} compact /> : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <RoleGuard role={['senior', 'dg']}>
        <div className="mt-2 flex items-center justify-end gap-1">
          {onPushToAtlas && (
            <button
              onClick={() => onPushToAtlas(d.id)}
              className="px-2 py-0.5 text-[10px] bg-amber-600 text-white rounded hover:bg-amber-700"
            >
              <ArrowRightLeft className="inline w-3 h-3 mr-1" />
              Pousser vers Atlas Finance
            </button>
          )}
          {onIgnore && (
            <button
              onClick={() => onIgnore(d.id)}
              className="px-2 py-0.5 text-[10px] border border-canvas-300 rounded hover:bg-canvas-50"
            >
              Ignorer
            </button>
          )}
        </div>
      </RoleGuard>
    </div>
  );
}
