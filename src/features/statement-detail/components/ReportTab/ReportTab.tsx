// ============================================================================
// ReportTab — orchestrateur de l'onglet Rapport
// ============================================================================
// Compose TemplateChooser + ReportViewerPage (plein ecran) + ComplaintLetterCard.
// Au clic sur "Generer", le rapport s'ouvre en plein ecran avec le visualiseur.
// ============================================================================

import { useMemo, useState } from 'react';
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
import { ReportViewerPage } from './ReportViewerPage';
import { ComplaintLetterCard } from './ComplaintLetterCard';
import { ForensicExportButton } from './ForensicExportButton';
import { formatComplaintLetter } from '../../reports/formatComplaintLetter';
import { resolveBankAddress } from '../../data/bankDirectory';

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
  const [viewerOpen, setViewerOpen] = useState(false);
  // Pour la lettre de réclamation ouverte dans le visualiseur : on construit
  // un faux SignedReport (template = 'lettre_reclamation') car le viewer
  // attend toujours un SignedReport en entrée.
  const [letterReport, setLetterReport] = useState<SignedReport | null>(null);

  function handleChoose(t: ReportTemplate) {
    setChosenTemplate(t);
    props.onGenerateReport?.(t);
    // Ouvre le viewer plein ecran des que le rapport est pret
    setViewerOpen(true);
  }

  function handleOpenLetterInViewer(formattedText: string) {
    void formattedText; // injecté via complaintLetterText prop
    const synthLetterReport: SignedReport = {
      id: `letter-${Date.now()}`,
      statementId: props.statement.id,
      template: 'lettre_reclamation',
      signerId: null,
      signerHandle: null,
      signatureType: null,
      documentUrl: '',
      proofBundleUrl: null,
      hash: '—',
      timestampRfc3161: null,
      recipients: [],
      status: 'draft',
      signedAt: null,
      createdAt: new Date().toISOString(),
    };
    setLetterReport(synthLetterReport);
  }

  // Texte de la lettre de réclamation — préparé à l'avance pour pouvoir
  // l'afficher comme « Annexe A » dans le visualiseur du rapport quand
  // l'option « Inclure la lettre de réclamation » est activée.
  const complaintLetterText = useMemo(() => {
    const tariffaires = ['commission_excessive', 'agio_errone', 'frais_double', 'convention_violee'];
    const eligible = props.anomalies.filter(
      (a) => tariffaires.includes(a.type)
        && ['qualified', 'validated', 'signed', 'closed'].includes(a.status),
    );
    if (eligible.length === 0 || !props.convention) return null;

    const bankAddr = resolveBankAddress(props.statement.bankCode);
    const formatted = formatComplaintLetter({
      cabinet: props.cabinet,
      bank: {
        legalName: bankAddr.legalName || props.statement.bankLegalName,
        addressLines: bankAddr.addressLines.length > 0
          ? bankAddr.addressLines
          : [props.statement.bankLegalName],
      },
      client: {
        legalName: props.statement.clientLegalName,
        accountNumber: props.statement.accountNumber,
      },
      period: props.statement.period,
      convention: { id: props.convention.id, signedDate: props.convention.signedDate },
      anomalies: eligible,
      signatory: {
        displayName: props.currentUser.displayName,
        title: props.currentUser.role.toUpperCase(),
      },
    });
    return formatted.text;
  }, [
    props.anomalies, props.convention, props.cabinet,
    props.statement, props.currentUser,
  ]);

  return (
    <>
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <TemplateChooser chosen={chosenTemplate} onChoose={handleChoose} />

        {/* Loading */}
        {chosenTemplate && props.loading && !props.generatedReport && (
          <div className="bg-white border border-canvas-200 rounded-lg p-6 flex items-center gap-3 text-sm text-ink-700">
            <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
            <div>
              <div className="font-semibold">Generation du rapport en cours...</div>
              <div className="text-xs text-ink-500 mt-0.5">Preparation du document</div>
            </div>
          </div>
        )}

        {/* Erreur */}
        {props.error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-start gap-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-rose-900">Erreur lors de la generation</div>
              <div className="font-mono text-[11px] text-rose-800 mt-1 break-all">{props.error}</div>
            </div>
          </div>
        )}

        {/* Rapport deja genere — bouton pour rouvrir le viewer */}
        {chosenTemplate && props.generatedReport && !viewerOpen && (
          <div className="bg-white border border-canvas-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-900">
                {chosenTemplate === 'valeur_probante' ? 'Rapport valeur probante' : chosenTemplate === 'synthese' ? 'Rapport synthese' : 'Export comptable'}
              </p>
              <p className="text-xs text-ink-500 mt-0.5">
                Statut : {props.generatedReport.status === 'draft' ? 'Brouillon' : props.generatedReport.status}
                {' · '}Hash : {props.generatedReport.hash.slice(0, 12)}...
              </p>
            </div>
            <button
              onClick={() => setViewerOpen(true)}
              className="px-4 py-2 rounded-md text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700"
            >
              Ouvrir le rapport
            </button>
          </div>
        )}

        {/* Forensic export (si signe) */}
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

        {/* Lettre de reclamation */}
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
          onPreviewInViewer={handleOpenLetterInViewer}
        />
      </div>

      {/* Viewer plein ecran — rapport */}
      {viewerOpen && props.generatedReport && (
        <ReportViewerPage
          report={props.generatedReport}
          statement={props.statement}
          anomalies={props.anomalies}
          reconciliation={props.reconciliation}
          cabinet={props.cabinet}
          complaintLetterText={complaintLetterText}
          currentUser={props.currentUser}
          onSignAndSend={props.onSignAndSend}
          onBack={() => setViewerOpen(false)}
        />
      )}

      {/* Viewer plein ecran — lettre de reclamation (meme UI que les rapports) */}
      {letterReport && (
        <ReportViewerPage
          report={letterReport}
          statement={props.statement}
          anomalies={props.anomalies}
          reconciliation={props.reconciliation}
          cabinet={props.cabinet}
          complaintLetterText={complaintLetterText}
          currentUser={props.currentUser}
          onSignAndSend={props.onSignAndSend}
          onBack={() => setLetterReport(null)}
        />
      )}
    </>
  );
}
