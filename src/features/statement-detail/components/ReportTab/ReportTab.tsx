// ============================================================================
// ReportTab — orchestrateur de l'onglet Rapport
// ============================================================================
// Compose TemplateChooser + ReportPreview + SignAndSendCard + ForensicExportButton
// + ComplaintLetterCard (chacun dans son fichier, spec §7).
// ============================================================================

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type {
  Anomaly,
  AccountConvention,
  ReportTemplate,
  SignatureType,
  SignedReport,
  ReportRecipient,
  BankReconciliation,
} from '../../types/statement.types';
import { TemplateChooser } from './TemplateChooser';
import { ReportPreview } from './ReportPreview';
import { SignAndSendCard } from './SignAndSendCard';
import { ComplaintLetterCard } from './ComplaintLetterCard';
import { ForensicExportButton } from './ForensicExportButton';

interface ReportTabProps {
  statement: {
    id: string;
    accountNumber: string;
    bankCode: string;
    bankLegalName: string;
    period: { start: string; end: string };
    clientLegalName: string;
    accountId?: string;
    tenantId?: string;
    organizationId?: string;
  };
  anomalies: Anomaly[];
  convention?: AccountConvention | null;
  reconciliation?: BankReconciliation | null;
  currentUser: { handle: string; displayName: string; role: 'dg' | 'senior' | 'junior' | 'consultation' };
  cabinet: { name: string; addressLines: string[] };
  generatedReport?: SignedReport | null;
  loading?: boolean;
  error?: string | null;
  onGenerateReport?: (template: ReportTemplate) => void;
  onSignAndSend?: (args: {
    reportId: string;
    signatureType: SignatureType;
    recipients: ReportRecipient[];
    message: string;
  }) => Promise<void>;
  onGenerateComplaintLetter?: (anomalyIds: string[]) => void;
}

export function ReportTab(props: ReportTabProps) {
  const [chosenTemplate, setChosenTemplate] = useState<ReportTemplate | null>(null);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <TemplateChooser
        chosen={chosenTemplate}
        onChoose={(t) => {
          setChosenTemplate(t);
          props.onGenerateReport?.(t);
        }}
      />

      {/* Loading state pendant la génération */}
      {chosenTemplate && props.loading && !props.generatedReport && (
        <div className="bg-white border border-canvas-200 rounded-lg p-6 flex items-center gap-3 text-sm text-ink-700">
          <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
          <div>
            <div className="font-semibold">Génération du rapport en cours…</div>
            <div className="text-xs text-ink-500 mt-0.5">
              Edge Function <code className="font-mono">generate-report</code> · jsPDF + Storage upload
            </div>
          </div>
        </div>
      )}

      {/* Erreur de génération — toujours visible si présente */}
      {props.error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-start gap-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-rose-900">Erreur lors de la génération</div>
            <div className="font-mono text-[11px] text-rose-800 mt-1 break-all">{props.error}</div>
            <div className="text-xs text-rose-800 mt-2">
              La preview ci-dessous est affichée en mode dégradé (HTML)
              pour permettre la suite du flux. Vérifie les logs de l'Edge
              Function <code className="font-mono">generate-report</code> côté Supabase
              si tu attendais un PDF complet.
            </div>
          </div>
        </div>
      )}

      {chosenTemplate && props.generatedReport && (
        <ReportPreview
          report={props.generatedReport}
          statement={props.statement}
          anomalies={props.anomalies}
          reconciliation={props.reconciliation}
          cabinet={props.cabinet}
        />
      )}

      {chosenTemplate && props.generatedReport && (
        <SignAndSendCard
          report={props.generatedReport}
          currentUser={props.currentUser}
          onSignAndSend={props.onSignAndSend}
        />
      )}

      {props.generatedReport && (props.generatedReport.status === 'sent' || props.generatedReport.status === 'signed') && (
        <ForensicExportButton
          signedReport={props.generatedReport}
          statementId={props.statement.id}
          tenantId={props.statement.tenantId ?? 'default'}
          organizationId={props.statement.organizationId ?? 'default'}
          accountId={props.statement.accountId ?? 'default'}
          periodStart={props.statement.period.start}
          periodEnd={props.statement.period.end}
          anomalies={props.anomalies}
          reconciliation={props.reconciliation ?? null}
          convention={props.convention ?? null}
        />
      )}

      <ComplaintLetterCard
        statement={{
          accountNumber: props.statement.accountNumber,
          bankCode: props.statement.bankCode,
          bankLegalName: props.statement.bankLegalName,
          period: props.statement.period,
          clientLegalName: props.statement.clientLegalName,
        }}
        anomalies={props.anomalies}
        convention={props.convention ?? null}
        cabinet={props.cabinet}
        signatory={props.currentUser}
        onGenerate={props.onGenerateComplaintLetter}
      />
    </div>
  );
}
