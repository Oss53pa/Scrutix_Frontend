// ============================================================================
// ReportTab — orchestrateur de l'onglet Rapport
// ============================================================================
// Compose TemplateChooser + ReportPreview + SignAndSendCard + ForensicExportButton
// + ComplaintLetterCard (chacun dans son fichier, spec §7).
// ============================================================================

import { useState } from 'react';
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

      {chosenTemplate && props.generatedReport && (
        <ReportPreview report={props.generatedReport} />
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
