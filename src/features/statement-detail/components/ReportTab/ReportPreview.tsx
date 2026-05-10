// ============================================================================
// ReportPreview — aperçu PDF embedded + panneau d'options
// ============================================================================

import { ReportOptions } from './ReportOptions';
import type { SignedReport } from '../../types/statement.types';

interface ReportPreviewProps {
  report: SignedReport;
}

export function ReportPreview({ report }: ReportPreviewProps) {
  return (
    <div className="bg-white border border-canvas-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-canvas-200 bg-canvas-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Aperçu du rapport</h3>
        <span className="text-[10px] font-mono text-ink-500">
          hash {report.hash.slice(0, 12)}…
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3">
        <div className="lg:col-span-2">
          <embed
            src={report.documentUrl}
            type="application/pdf"
            className="w-full rounded border border-canvas-200"
            style={{ height: 600 }}
          />
        </div>
        <ReportOptions />
      </div>
    </div>
  );
}
