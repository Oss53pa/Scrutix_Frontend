// ============================================================================
// AnomalyAuditTrail — liste audit collapsible
// ============================================================================

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AuditEntry } from '../../types/statement.types';

const ACTION_LABEL: Record<string, string> = {
  created: 'Créée',
  assigned: 'Assignée',
  qualified: 'Qualifiée',
  commented: 'Commentaire',
  validated: 'Validée',
  signed: 'Signée',
  closed: 'Clôturée',
  reopened: 'Réouverte',
  false_positive_marked: 'Faux positif',
  severity_changed: 'Sévérité modifiée',
};

interface AnomalyAuditTrailProps {
  anomalyId: string;
  auditTrail: AuditEntry[];
  defaultOpen?: boolean;
}

export function AnomalyAuditTrail({ anomalyId, auditTrail, defaultOpen = false }: AnomalyAuditTrailProps) {
  const [open, setOpen] = useState(defaultOpen);
  const entries = auditTrail.filter((e) => e.entityId === anomalyId);

  return (
    <div className="border-t border-canvas-100 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-ink-500">
          Audit trail · {entries.length} entrée{entries.length !== 1 ? 's' : ''}
        </h3>
        {open ? <ChevronDown className="w-3 h-3 text-ink-500" /> : <ChevronRight className="w-3 h-3 text-ink-500" />}
      </button>
      {open && (
        <ul className="mt-2 space-y-2 text-xs">
          {entries.map((e) => (
            <li key={e.id} className="border-l-2 border-canvas-300 pl-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink-900">{ACTION_LABEL[e.action] ?? e.action}</span>
                <span className="text-ink-400">par</span>
                <span className="font-mono text-ink-700">@{e.actor.handle}</span>
              </div>
              <div className="text-[10px] text-ink-500 font-mono mt-0.5">
                {e.createdAt} · hash {e.hash.slice(0, 12)}…
              </div>
              {(e.payload as Record<string, unknown>)?.comment ? (
                <div className="text-[11px] text-ink-600 italic mt-0.5">
                  "{(e.payload as { comment: string }).comment}"
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
