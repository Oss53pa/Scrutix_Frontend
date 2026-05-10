// ============================================================================
// AnomaliesTab — orchestrateur de l'onglet Anomalies
// ============================================================================
// Spec §1 : 3 zones (filtres + statsBar / liste virtualisée / drawer détail)
// Composé de AnomaliesFilters + AnomaliesStatsBar + AnomaliesList +
// AnomalyDetailDrawer + AnomalyDialogs (chaque dialog dans son fichier).
// ============================================================================

import { useMemo, useState } from 'react';
import {
  AnomaliesFilters,
  DEFAULT_FILTERS,
  type AnomaliesFilterState,
} from './AnomaliesFilters';
import { AnomaliesStatsBar } from './AnomaliesStatsBar';
import { AnomaliesList } from './AnomaliesList';
import { AnomalyDetailDrawer } from './AnomalyDetailDrawer';
import { AnomalyDialogs } from './dialogs/AnomalyDialogs';
import type { Anomaly, AnomalyComment, AuditEntry, DialogAction, DialogKind } from '../../types/statement.types';
import type { MentionableUser } from '../../../../components/shared';

interface AnomaliesTabProps {
  anomalies: Anomaly[];
  comments: AnomalyComment[];
  auditTrail: AuditEntry[];
  team: MentionableUser[];
  conventionByAnomaly?: Record<string, { id: string; label: string; signedDate: string }>;
  onAnomalyAction: (kind: DialogKind, anomaly: Anomaly, comment: string) => Promise<void> | void;
  onSubmitComment: (anomalyId: string, text: string, mentions: string[]) => void;
  onOpenPdfAt?: (page: number | undefined) => void;
  onOpenConvention?: (conventionId: string) => void;
}

export function AnomaliesTab(props: AnomaliesTabProps) {
  const { anomalies, comments, auditTrail, team } = props;
  const [filters, setFilters] = useState<AnomaliesFilterState>(DEFAULT_FILTERS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [dialogAnomaly, setDialogAnomaly] = useState<Anomaly | null>(null);

  const filtered = useMemo(() => {
    return anomalies.filter((a) => {
      if (filters.severity !== 'all' && a.severity !== filters.severity) return false;
      if (filters.status !== 'all' && a.status !== filters.status) return false;
      if (filters.type !== 'all' && a.type !== filters.type) return false;
      if (filters.assignedTo === 'unassigned' && a.assignedTo) return false;
      if (filters.assignedTo !== 'all' && filters.assignedTo !== 'unassigned' && a.assignedTo !== filters.assignedTo) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        const blob = `${a.title} ${a.description} ${a.transaction.label} ${a.detection.algorithm}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [anomalies, filters]);

  const activeAnomaly = filtered.find((a) => a.id === activeId) ?? null;
  const activeIdx = activeAnomaly ? filtered.findIndex((a) => a.id === activeAnomaly.id) : -1;

  function handleAction(action: DialogAction, anomaly: Anomaly) {
    setDialog(action.opens);
    setDialogAnomaly(anomaly);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-canvas-200 bg-white sticky top-0 z-10">
        <AnomaliesFilters filters={filters} onChange={setFilters} assignees={team} />
        <AnomaliesStatsBar
          anomalies={anomalies}
          filters={filters}
          onApplyFilter={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        />
      </div>

      <AnomaliesList
        anomalies={filtered}
        activeId={activeId}
        onSelect={setActiveId}
        onAction={handleAction}
      />

      {activeAnomaly && (
        <AnomalyDetailDrawer
          anomaly={activeAnomaly}
          comments={comments}
          auditTrail={auditTrail}
          team={team}
          convention={props.conventionByAnomaly?.[activeAnomaly.id] ?? null}
          onClose={() => setActiveId(null)}
          onPrev={activeIdx > 0 ? () => setActiveId(filtered[activeIdx - 1].id) : undefined}
          onNext={activeIdx < filtered.length - 1 ? () => setActiveId(filtered[activeIdx + 1].id) : undefined}
          onOpenPdfAt={props.onOpenPdfAt}
          onOpenConvention={props.onOpenConvention}
          onSubmitComment={(text, mentions) => props.onSubmitComment(activeAnomaly.id, text, mentions)}
          onAction={handleAction}
        />
      )}

      <AnomalyDialogs
        anomaly={dialogAnomaly}
        openDialog={dialog}
        futureHash="b7c1…f4a2 (calculé serveur)"
        onClose={() => {
          setDialog(null);
          setDialogAnomaly(null);
        }}
        onConfirm={async (kind, anomaly, comment) => {
          await props.onAnomalyAction(kind, anomaly, comment);
        }}
      />
    </div>
  );
}
