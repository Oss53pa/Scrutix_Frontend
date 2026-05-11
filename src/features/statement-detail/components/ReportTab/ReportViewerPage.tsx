// ============================================================================
// ReportViewerPage — page plein ecran pour visualiser/editer le rapport
// ============================================================================
// S'ouvre en overlay plein ecran quand l'utilisateur genere un rapport.
// Contient le document A4 editable + panneau lateral d'options + actions.
// ============================================================================

import { useState } from 'react';
import { ArrowLeft, Pencil, Eye, Printer, Download, Send } from 'lucide-react';
import { ReportPreview, type ReportPreviewProps } from './ReportPreview';
import { ReportOptions, type ReportOptionsState } from './ReportOptions';
import { SignAndSendCard } from './SignAndSendCard';
import type { SignedReport, SignatureType, ReportRecipient } from '../../types/statement.types';

interface ReportViewerPageProps extends ReportPreviewProps {
  onBack: () => void;
  currentUser: { handle: string; displayName: string; role: 'dg' | 'senior' | 'junior' | 'consultation' };
  onSignAndSend?: (args: {
    reportId: string;
    signatureType: SignatureType;
    recipients: ReportRecipient[];
    message: string;
  }) => Promise<void>;
}

export function ReportViewerPage(props: ReportViewerPageProps) {
  const [showSign, setShowSign] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-canvas-50 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <header className="bg-white border-b border-canvas-200 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={props.onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-ink-700 hover:bg-canvas-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au releve
          </button>
          <div className="h-5 w-px bg-canvas-200" />
          <span className="text-sm font-semibold text-ink-900">
            {props.report.template === 'valeur_probante' ? 'Rapport valeur probante'
              : props.report.template === 'synthese' ? 'Rapport synthese'
              : 'Export comptable'}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            props.report.status === 'signed' || props.report.status === 'sent'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {props.report.status === 'draft' ? 'Brouillon' : props.report.status === 'signed' ? 'Signe' : props.report.status === 'sent' ? 'Envoye' : props.report.status}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-canvas-300 hover:bg-canvas-50"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimer
          </button>
          {props.report.documentUrl && (
            <a
              href={props.report.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-canvas-300 hover:bg-canvas-50"
            >
              <Download className="w-3.5 h-3.5" />
              Telecharger
            </a>
          )}
          <button
            onClick={() => setShowSign(!showSign)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700"
          >
            <Send className="w-3.5 h-3.5" />
            Signer et envoyer
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {showSign ? (
          <div className="max-w-2xl mx-auto p-6">
            <SignAndSendCard
              report={props.report}
              currentUser={props.currentUser}
              onSignAndSend={props.onSignAndSend}
            />
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            <ReportPreview
              report={props.report}
              statement={props.statement}
              anomalies={props.anomalies}
              reconciliation={props.reconciliation}
              cabinet={props.cabinet}
            />
          </div>
        )}
      </div>
    </div>
  );
}
