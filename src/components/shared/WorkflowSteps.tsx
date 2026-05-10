// ============================================================================
// <WorkflowSteps /> — étapes horizontales du workflow d'anomalie
// ============================================================================
// Spec §1.3.4 — adaptation par sévérité :
//   low/medium → 2 étapes
//   high       → 3 étapes
//   critical   → 4 étapes
// ============================================================================

import { Check, Clock, ChevronRight } from 'lucide-react';
import { getWorkflowSteps } from '../../features/statement-detail/workflow/anomalyActions';
import type { Anomaly } from '../../features/statement-detail/types/statement.types';
import { RelativeDate } from './RelativeDate';

interface WorkflowStepsProps {
  anomaly: Anomaly;
  className?: string;
  /** Compact = barre icônes seule, sans labels. */
  compact?: boolean;
}

export function WorkflowSteps({ anomaly, className = '', compact = false }: WorkflowStepsProps) {
  const steps = getWorkflowSteps(anomaly.severity);
  const status = anomaly.status === 'closed'
    ? lastStepKey(anomaly.severity)
    : anomaly.status === 'false_positive'
      ? 'detected'
      : anomaly.status;

  const reachedIdx = steps.findIndex((s) => s.key === status);

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      {steps.map((step, i) => {
        const reached = i <= reachedIdx;
        const inProgress = i === reachedIdx + 1;
        const meta = stepMeta(anomaly, step.key);

        return (
          <div key={step.key} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-3 h-3 text-ink-400" />}
            <div className="flex items-center gap-1">
              {reached ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : inProgress ? (
                <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
              ) : (
                <span className="w-3 h-3 rounded-full border border-ink-300" aria-hidden />
              )}
              {!compact && (
                <span className={`text-[11px] ${reached ? 'text-ink-900 font-semibold' : 'text-ink-500'}`}>
                  {step.label}
                </span>
              )}
              {!compact && meta && (
                <span className="text-[10px] text-ink-500">
                  {meta.actor && <span className="font-mono">{meta.actor}</span>}
                  {meta.actor && meta.at && <span> · </span>}
                  {meta.at && <RelativeDate date={meta.at} absolute />}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function lastStepKey(sev: Anomaly['severity']): Anomaly['status'] {
  if (sev === 'critical') return 'signed';
  if (sev === 'high')     return 'validated';
  return 'qualified';
}

function stepMeta(
  anomaly: Anomaly,
  key: 'detected' | 'qualified' | 'validated' | 'signed' | 'closed',
): { actor?: string; at?: string } | null {
  switch (key) {
    case 'detected':
      return { at: anomaly.createdAt };
    case 'qualified':
      return anomaly.qualifiedBy
        ? { actor: '@' + anomaly.qualifiedBy.userHandle, at: anomaly.qualifiedBy.at }
        : null;
    case 'validated':
      return anomaly.validatedBy
        ? { actor: '@' + anomaly.validatedBy.userHandle, at: anomaly.validatedBy.at }
        : null;
    case 'signed':
      return anomaly.signedBy
        ? { actor: '@' + anomaly.signedBy.userHandle, at: anomaly.signedBy.at }
        : null;
    default:
      return null;
  }
}
