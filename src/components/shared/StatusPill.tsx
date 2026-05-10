// ============================================================================
// <StatusPill /> — pill colorée pour les statuts d'anomalie
// ============================================================================

import type { AnomalyStatus } from '../../features/statement-detail/types/statement.types';

const STATUS_LABEL: Record<AnomalyStatus, string> = {
  detected:        'Détectée',
  qualified:       'Qualifiée — à valider',
  validated:       'Validée — à signer',
  signed:          'Signée',
  closed:          'Clôturée',
  false_positive:  'Faux positif',
};

const STATUS_TONE: Record<AnomalyStatus, string> = {
  detected:        'bg-blue-50 text-blue-700 border-blue-200',
  qualified:       'bg-amber-50 text-amber-800 border-amber-200',
  validated:       'bg-indigo-50 text-indigo-700 border-indigo-200',
  signed:          'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed:          'bg-canvas-100 text-ink-600 border-canvas-300',
  false_positive:  'bg-canvas-50 text-ink-400 border-canvas-200',
};

interface StatusPillProps {
  status: AnomalyStatus;
  className?: string;
}

export function StatusPill({ status, className = '' }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_TONE[status]} ${className}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
