// ============================================================================
// AnomalyRow — carte cliquable d'une anomalie dans la liste
// ============================================================================

import { ChevronRight } from 'lucide-react';
import { SeverityPill, StatusPill, AmountFCFA, WorkflowSteps, RelativeDate } from '../../../../components/shared';
import type { Anomaly, DialogAction } from '../../types/statement.types';
import { getAvailableActions } from '../../workflow/anomalyActions';
import { useRole } from '../../../../workspace/useWorkspace';

interface AnomalyRowProps {
  anomaly: Anomaly;
  isActive: boolean;
  onSelect: () => void;
  onAction: (action: DialogAction, anomaly: Anomaly) => void;
}

export function AnomalyRow({ anomaly, isActive, onSelect, onAction }: AnomalyRowProps) {
  const { role } = useRole();
  const actions = role ? getAvailableActions(role, anomaly) : [];

  return (
    <div
      onClick={onSelect}
      className={`p-3 border rounded-lg cursor-pointer transition-all ${
        isActive
          ? 'ring-2 ring-amber-500 border-amber-400 bg-amber-50/40'
          : 'border-canvas-200 hover:border-canvas-400 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityPill severity={anomaly.severity} />
            <span className="text-sm font-semibold text-ink-900 truncate">{anomaly.title}</span>
          </div>
          <p className="text-xs text-ink-600 mt-1 truncate" title={anomaly.description}>
            {anomaly.description}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-500 flex-wrap">
            <span className="font-mono">{anomaly.transaction.label.slice(0, 32)}{anomaly.transaction.label.length > 32 ? '…' : ''}</span>
            <span>·</span>
            <RelativeDate date={anomaly.transaction.date} />
            <span>·</span>
            <AmountFCFA value={anomaly.transaction.amountCentimes} colorize compact />
          </div>
          <div className="mt-1 text-[10px] text-ink-400 font-mono">
            {anomaly.detection.algorithm}
          </div>
        </div>
        <StatusPill status={anomaly.status} />
      </div>

      <div className="mt-3 pt-2 border-t border-canvas-100">
        <WorkflowSteps anomaly={anomaly} />
      </div>

      {actions.length > 0 && (
        <div className="mt-2 flex items-center justify-end gap-1.5">
          {actions.map((a) => (
            <button
              key={a.opens}
              onClick={(e) => {
                e.stopPropagation();
                onAction(a, anomaly);
              }}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
                a.primary
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'border border-canvas-300 text-ink-700 hover:bg-canvas-50'
              }`}
            >
              {a.label}
              {a.primary && <ChevronRight className="inline-block w-3 h-3 ml-0.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
