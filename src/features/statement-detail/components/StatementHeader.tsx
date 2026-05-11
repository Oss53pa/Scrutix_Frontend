// ============================================================================
// StatementHeader — titre relevé + actions globales
// ============================================================================
// Spec :
//   "Relevé NSIA · 10 fév → 08 mai 2026  [pill: Analysé]
//    94 transactions · importé le 09/05/2026 par Pame · fichier ...pdf
//    [PDF source] [Comparer] [PROPH3T]"
// ============================================================================

import { FileText, ArrowLeftRight, Sparkles } from 'lucide-react';
import { formatDateDDMMYYYY } from '../../../lib/dateFormat';

interface StatementHeaderProps {
  bankCode: string;
  periodLabel: string;       // ex. "10 fév → 08 mai 2026"
  status: 'pending' | 'analyzed' | string;
  transactionCount: number;
  importedAt: string;        // ISO
  importedBy?: string | null;
  fileName?: string | null;
  onPdfSource?: () => void;
  onCompare?: () => void;
  onOpenProphet?: () => void;
}

export function StatementHeader(props: StatementHeaderProps) {
  const isAnalyzed = props.status === 'analyzed' || props.status === 'imported';
  const importedFr = formatDateDDMMYYYY(props.importedAt);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-semibold text-ink-900">
          Relevé {props.bankCode} · {props.periodLabel}
        </h1>
        {isAnalyzed ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
            ✓ Analysé
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-canvas-100 text-ink-500 border border-canvas-300 text-[10px] font-semibold">
            Risque non évalué
          </span>
        )}
      </div>
      <p className="text-xs text-ink-500 flex flex-wrap items-center gap-1">
        <span>{props.transactionCount} transactions</span>
        <span>·</span>
        <span>importé le {importedFr}</span>
        {props.importedBy && <><span>·</span><span>par {props.importedBy}</span></>}
        {props.fileName && <><span>·</span><span className="font-mono truncate max-w-xs">fichier {props.fileName}</span></>}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={props.onPdfSource}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-canvas-300 bg-white hover:bg-canvas-50"
        >
          <FileText className="w-3.5 h-3.5" />
          PDF source
        </button>
        <button
          onClick={props.onCompare}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-canvas-300 bg-white hover:bg-canvas-50"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          Comparer
        </button>
        <button
          onClick={props.onOpenProphet}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-canvas-300 bg-white hover:bg-canvas-50"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          PROPH3T
        </button>
      </div>
    </div>
  );
}

