// ============================================================================
// AnomaliesTab — orchestrateur de l'onglet Anomalies
// ============================================================================
// Spec §1 : 3 zones (filtres + statsBar / liste virtualisée / drawer détail)
// Composé de AnomaliesFilters + AnomaliesStatsBar + AnomaliesList +
// AnomalyDetailDrawer + AnomalyDialogs (chaque dialog dans son fichier).
// ============================================================================

import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, FileDown, Loader2 } from 'lucide-react';
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
import {
  exportAnomaliesExcel,
  exportAnomaliesPdf,
  exportAnomaliesWord,
} from '../../utils/exportAnomalies';

interface AnomaliesTabProps {
  anomalies: Anomaly[];
  comments: AnomalyComment[];
  auditTrail: AuditEntry[];
  team: MentionableUser[];
  conventionByAnomaly?: Record<string, { id: string; label: string; signedDate: string }>;
  /** Métadonnées du relevé — utilisées pour l'en-tête des exports. */
  exportContext?: {
    statementLabel?: string;
    periodLabel?: string;
    clientLabel?: string;
    bankLabel?: string;
  };
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
  const [exporting, setExporting] = useState<null | 'excel' | 'word' | 'pdf'>(null);

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

  async function handleExport(kind: 'excel' | 'word' | 'pdf') {
    if (filtered.length === 0) return;
    setExporting(kind);
    try {
      // Enrichit le contexte avec audit trail + commentaires pour produire
      // un dossier de qualité audit-grade (cf. ISA 240 § Documentation).
      // Filtrer commentaires/audit aux seules anomalies réellement exportées.
      const filteredIds = new Set(filtered.map((a) => a.id));
      const ctx = {
        ...(props.exportContext ?? {}),
        auditTrail: auditTrail.filter((e) => filteredIds.has(e.entityId)),
        comments: comments.filter((c) => filteredIds.has(c.anomalyId)),
      };
      if (kind === 'excel') await exportAnomaliesExcel(filtered, ctx);
      else if (kind === 'word') await exportAnomaliesWord(filtered, ctx);
      else exportAnomaliesPdf(filtered, ctx);
    } catch (err) {
      // Échec silencieux côté UI — log console pour diagnostic
      console.error('[AnomaliesTab] export failed:', err);
    } finally {
      setExporting(null);
    }
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
        {/* Barre d'export — applique les filtres actuels au document produit */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-ink-500">
            Export : <strong>{filtered.length}</strong> anomalie{filtered.length > 1 ? 's' : ''}
            {filtered.length !== anomalies.length && (
              <span className="text-ink-400"> (sur {anomalies.length} après filtres)</span>
            )}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleExport('excel')}
              disabled={filtered.length === 0 || exporting !== null}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border border-canvas-300 bg-white hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Exporter en Excel (.xlsx)"
            >
              {exporting === 'excel' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3 text-emerald-700" />}
              Excel
            </button>
            <button
              onClick={() => handleExport('word')}
              disabled={filtered.length === 0 || exporting !== null}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border border-canvas-300 bg-white hover:bg-sky-50 hover:border-sky-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Exporter en Word (.doc)"
            >
              {exporting === 'word' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3 text-sky-700" />}
              Word
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={filtered.length === 0 || exporting !== null}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border border-canvas-300 bg-white hover:bg-rose-50 hover:border-rose-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Exporter en PDF"
            >
              {exporting === 'pdf' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3 text-rose-700" />}
              PDF
            </button>
          </div>
        </div>
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
