// ============================================================================
// ReportTab — onglet "Rapport" (templates + signature + lettre réclamation)
// ============================================================================
// Spec onglets 2-5 §3 : 4 cartes empilées :
//   1. Choix template (3 cards)
//   2. Aperçu rapport
//   3. Signature et envoi
//   4. Lettre de réclamation (si anomalies tarifaires éligibles)
// ============================================================================

import { useMemo, useState } from 'react';
import {
  FileText, FileBadge, FileSpreadsheet, ShieldCheck, Send, Mail, Sparkles, X,
} from 'lucide-react';
import { AmountFCFA, ConfirmDialog, RoleGuard, UserPill } from '../../../../components/shared';
import type {
  Anomaly,
  AccountConvention,
  ReportTemplate,
  SignatureType,
  SignedReport,
  ReportRecipient,
} from '../../types/statement.types';
import { formatComplaintLetter } from '../../reports/formatComplaintLetter';

interface ReportTabProps {
  statement: {
    id: string;
    accountNumber: string;
    bankCode: string;
    bankLegalName: string;
    period: { start: string; end: string };
    clientLegalName: string;
  };
  anomalies: Anomaly[];
  convention?: AccountConvention | null;
  currentUser: { handle: string; displayName: string; role: 'dg' | 'senior' | 'junior' | 'consultation' };
  cabinet: { name: string; addressLines: string[] };
  /** Aperçu PDF généré (URL Blob ou Storage). */
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
    <div className="flex flex-col gap-4 p-4 max-w-5xl mx-auto">
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

      <ComplaintLetterCard
        statement={props.statement}
        anomalies={props.anomalies}
        convention={props.convention ?? null}
        cabinet={props.cabinet}
        signatory={props.currentUser}
        onGenerate={props.onGenerateComplaintLetter}
      />
    </div>
  );
}

// ============================================================================
// 1. TemplateChooser
// ============================================================================

const TEMPLATE_DEFS: Array<{
  key: ReportTemplate;
  Icon: typeof FileText;
  title: string;
  subtitle: string;
  features: Array<{ ok: boolean; label: string }>;
  plan: string;
  recommended?: boolean;
}> = [
  {
    key: 'synthese',
    Icon: FileText,
    title: 'Rapport synthèse',
    subtitle: 'Pour usage interne ou échange courant. A4, 3-5 pages.',
    features: [
      { ok: true,  label: 'Score de risque + KPI' },
      { ok: true,  label: 'Liste anomalies résumée' },
      { ok: false, label: 'Pas de signature électronique' },
    ],
    plan: 'Standard et au-delà',
  },
  {
    key: 'valeur_probante',
    Icon: FileBadge,
    title: 'Rapport valeur probante',
    subtitle: 'Recommandé · Pour CAC, juridiction, due diligence. A4, 12-18 pages.',
    features: [
      { ok: true, label: 'Tout du synthèse' },
      { ok: true, label: 'État de rapprochement SYSCOHADA' },
      { ok: true, label: 'Workflow de validation détaillé' },
      { ok: true, label: 'Signature électronique ADVIST légalement opposable' },
      { ok: true, label: 'Hash SHA-256 + horodatage RFC 3161' },
    ],
    plan: 'Pro et au-delà',
    recommended: true,
  },
  {
    key: 'export',
    Icon: FileSpreadsheet,
    title: 'Export comptable',
    subtitle: 'Pour intégration directe à Atlas Finance ou autre logiciel. Excel + JSON.',
    features: [
      { ok: true, label: 'Transactions catégorisées' },
      { ok: true, label: 'Écritures de redressement proposées' },
      { ok: true, label: 'Mapping plan comptable SYSCOHADA' },
    ],
    plan: 'Tous',
  },
];

function TemplateChooser({
  chosen,
  onChoose,
}: { chosen: ReportTemplate | null; onChoose: (t: ReportTemplate) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {TEMPLATE_DEFS.map((t) => {
        const isChosen = chosen === t.key;
        return (
          <div
            key={t.key}
            className={`relative bg-white rounded-lg p-4 border transition-all ${
              isChosen
                ? 'border-amber-500 ring-2 ring-amber-300'
                : t.recommended
                  ? 'border-amber-400 border-2'
                  : 'border-canvas-200 hover:border-canvas-400'
            }`}
          >
            {t.recommended && (
              <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider">
                Recommandé
              </span>
            )}
            <t.Icon className="w-6 h-6 text-amber-700 mb-2" />
            <h3 className="text-sm font-semibold text-ink-900">{t.title}</h3>
            <p className="text-xs text-ink-600 mt-1">{t.subtitle}</p>
            <ul className="mt-3 space-y-1">
              {t.features.map((f, i) => (
                <li key={i} className={`text-[11px] flex items-start gap-1 ${f.ok ? 'text-ink-700' : 'text-ink-400'}`}>
                  <span>{f.ok ? '✓' : '✗'}</span>
                  <span>{f.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 text-[10px] uppercase tracking-wider text-ink-500">Plan : {t.plan}</div>
            <button
              onClick={() => onChoose(t.key)}
              className={`mt-3 w-full px-3 py-1.5 text-xs font-semibold rounded ${
                isChosen
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              {isChosen ? 'Généré ✓' : 'Générer'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// 2. ReportPreview
// ============================================================================

function ReportPreview({ report }: { report: SignedReport }) {
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

function ReportOptions() {
  const [includeComplaint, setIncludeComplaint] = useState(true);
  const [includePdf, setIncludePdf] = useState(true);
  const [customLogo, setCustomLogo] = useState(true);
  const [detail, setDetail] = useState<'synthese' | 'standard' | 'exhaustif'>('standard');

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 mb-1">Options</h4>
        <Toggle label="Inclure la lettre de réclamation en annexe" checked={includeComplaint} onChange={setIncludeComplaint} />
        <Toggle label="Inclure le PDF source du relevé" checked={includePdf} onChange={setIncludePdf} />
        <Toggle label="En-tête personnalisée avec logo cabinet" checked={customLogo} onChange={setCustomLogo} />
      </div>
      <div>
        <h4 className="text-[11px] uppercase tracking-wider font-semibold text-ink-500 mb-1">Niveau de détail</h4>
        {(['synthese', 'standard', 'exhaustif'] as const).map((d) => (
          <label key={d} className="flex items-center gap-2 text-xs py-0.5 cursor-pointer">
            <input
              type="radio"
              name="detail"
              checked={detail === d}
              onChange={() => setDetail(d)}
              className="accent-amber-600"
            />
            <span className="capitalize">{d}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 py-1 text-xs cursor-pointer">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-amber-600" />
    </label>
  );
}

// ============================================================================
// 3. SignAndSend
// ============================================================================

function SignAndSendCard({
  report,
  currentUser,
  onSignAndSend,
}: {
  report: SignedReport;
  currentUser: { handle: string; displayName: string; role: 'dg' | 'senior' | 'junior' | 'consultation' };
  onSignAndSend?: ReportTabProps['onSignAndSend'];
}) {
  const [signatureType, setSignatureType] = useState<SignatureType>('advist');
  const [recipients, setRecipients] = useState<ReportRecipient[]>([
    { email: 'pamela@example.com', displayName: 'Pamela ATOKOUNA (client)', audience: 'client' },
    { email: 'kadi@cabinet.com',   displayName: '@KadiL (interne)',         audience: 'internal' },
  ]);
  const [message, setMessage] = useState(
    'Bonjour,\n\nVeuillez trouver ci-joint le rapport d\'audit signé pour le relevé de la période concernée.\n\nCordialement,',
  );
  const [openConfirm, setOpenConfirm] = useState(false);
  const canSign = currentUser.role === 'dg' || currentUser.role === 'senior';

  return (
    <div className="bg-white border border-canvas-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3">Signature et envoi</h3>

      <div className="text-xs space-y-3">
        <div>
          <div className="text-ink-500 mb-1">Signataire (selon vos permissions) :</div>
          <UserPill user={currentUser} />
        </div>

        <div>
          <div className="text-ink-500 mb-1">Type de signature :</div>
          <label className="flex items-center gap-2 py-0.5">
            <input type="radio" name="sig" checked={signatureType === 'simple'} onChange={() => setSignatureType('simple')} className="accent-amber-600" />
            Signature simple (PDF avec hash + horodatage)
          </label>
          <label className="flex items-center gap-2 py-0.5">
            <input type="radio" name="sig" checked={signatureType === 'advist'} onChange={() => setSignatureType('advist')} className="accent-amber-600" />
            <ShieldCheck className="w-3 h-3 inline text-emerald-600" />
            Signature ADVIST légalement opposable (recommandé)
          </label>
        </div>

        <div>
          <div className="text-ink-500 mb-1">Destinataires :</div>
          {recipients.map((r, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <Mail className="w-3 h-3 text-ink-400" />
              <span className="font-mono text-[11px]">{r.email}</span>
              <span className="text-ink-500">· {r.displayName}</span>
              <button
                onClick={() => setRecipients((rs) => rs.filter((_, j) => j !== i))}
                className="ml-auto text-ink-400 hover:text-rose-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              setRecipients((rs) => [...rs, { email: '', displayName: '', audience: 'internal' }])
            }
            className="mt-1 text-[11px] text-amber-700 hover:underline"
          >
            + Ajouter un destinataire
          </button>
        </div>

        <div>
          <div className="text-ink-500 mb-1">Message d'accompagnement :</div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full px-2 py-1.5 text-xs border border-canvas-300 rounded font-mono"
          />
        </div>
      </div>

      <RoleGuard role={['senior', 'dg']}>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button className="px-3 py-1.5 text-xs border border-canvas-300 rounded hover:bg-canvas-50">
            Aperçu email
          </button>
          <button
            disabled={!canSign}
            onClick={() => setOpenConfirm(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <Send className="inline w-3 h-3 mr-1" />
            Signer et envoyer
          </button>
        </div>
      </RoleGuard>

      <ConfirmDialog
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        title="Confirmer la signature"
        variant="success"
        confirmLabel="Confirmer la signature"
        requireComment={false}
        commentLabel="Commentaire (optionnel)"
        futureHash={report.hash.slice(0, 16) + '…' + report.hash.slice(-4)}
        description={
          <span>
            Vous allez signer ce rapport au nom de <b>{currentUser.displayName}</b>.
            Cette signature est légalement opposable et ne pourra être révoquée.
          </span>
        }
        onConfirm={async () => {
          if (onSignAndSend) {
            await onSignAndSend({ reportId: report.id, signatureType, recipients, message });
          }
        }}
      />
    </div>
  );
}

// ============================================================================
// 4. ComplaintLetterCard
// ============================================================================

function ComplaintLetterCard({
  statement,
  anomalies,
  convention,
  cabinet,
  signatory,
  onGenerate,
}: {
  statement: ReportTabProps['statement'];
  anomalies: Anomaly[];
  convention: AccountConvention | null;
  cabinet: { name: string; addressLines: string[] };
  signatory: { displayName: string; role: 'dg' | 'senior' | 'junior' | 'consultation' };
  onGenerate?: (anomalyIds: string[]) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  // Anomalies tarifaires éligibles (qualifiées+)
  const eligible = useMemo(() => {
    const tariffaires = ['commission_excessive', 'agio_errone', 'frais_double', 'convention_violee'];
    return anomalies.filter(
      (a) =>
        tariffaires.includes(a.type) &&
        ['qualified', 'validated', 'signed', 'closed'].includes(a.status),
    );
  }, [anomalies]);

  const totalRecovery = eligible.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0);

  if (eligible.length === 0) return null;

  const formatted = convention
    ? formatComplaintLetter({
        cabinet,
        bank: { legalName: statement.bankLegalName, addressLines: ['—'] },
        client: { legalName: statement.clientLegalName, accountNumber: statement.accountNumber },
        period: statement.period,
        convention: { id: convention.id, signedDate: convention.signedDate },
        anomalies: eligible,
        signatory: { displayName: signatory.displayName, title: signatory.role.toUpperCase() },
      })
    : null;

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-amber-700" />
        <h3 className="text-sm font-semibold text-amber-900">Lettre de réclamation à {statement.bankCode}</h3>
      </div>
      <p className="text-xs text-amber-900">
        Sur la base de <b>{eligible.length}</b> anomalie{eligible.length > 1 ? 's' : ''} tarifaire{eligible.length > 1 ? 's' : ''} qualifiée{eligible.length > 1 ? 's' : ''},
        {' '}AtlasBanx peut générer une lettre de réclamation formelle adressée à {statement.bankLegalName}{' '}
        pour un montant à rétrocéder estimé à <b><AmountFCFA value={totalRecovery} /></b>.
      </p>
      <ul className="mt-2 space-y-0.5">
        {eligible.map((a) => (
          <li key={a.id} className="text-xs text-amber-900">✓ {a.title}</li>
        ))}
      </ul>
      {convention && (
        <div className="mt-2 text-[11px] text-amber-800">
          Référence convention : signée le {convention.signedDate}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setPreviewOpen(true)}
          disabled={!formatted}
          className="px-3 py-1.5 text-xs border border-amber-400 rounded hover:bg-amber-100 disabled:opacity-50"
        >
          Aperçu de la lettre
        </button>
        <RoleGuard role={['senior', 'dg']}>
          <button
            onClick={() => onGenerate?.(eligible.map((a) => a.id))}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-amber-600 text-white hover:bg-amber-700"
          >
            Générer la lettre
          </button>
        </RoleGuard>
      </div>

      {previewOpen && formatted && (
        <ComplaintLetterDrawer text={formatted.text} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}

function ComplaintLetterDrawer({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[600px] bg-white shadow-2xl border-l border-canvas-200 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-canvas-200">
        <h3 className="text-sm font-semibold">Aperçu de la lettre</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-canvas-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      <pre className="flex-1 overflow-auto p-4 text-[11px] font-mono whitespace-pre-wrap text-ink-800">
        {text}
      </pre>
    </div>
  );
}
