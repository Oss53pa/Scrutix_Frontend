// ============================================================================
// ReportPreview — apercu editable du rapport prerempli
// ============================================================================
// Trois templates RADICALEMENT DIFFERENTS :
//   - synthese        : 1 page, score + KPI + top anomalies (audit interne)
//   - valeur_probante : 12-18 pages, état rapprochement + signature ADVIST + RFC 3161
//   - export_comptable: tableau brut transactions catégorisées + écritures de
//                       redressement (Atlas Finance / SYSCOHADA)
//
// Le `detailLevel` (synthèse / standard / exhaustif) filtre la profondeur
// des sections présentes :
//   - synthese  : titre + score + 1 paragraphe résumé + top 3 anomalies
//   - standard  : sections complètes (1 paragraphe par anomalie)
//   - exhaustif : ajoute détails par anomalie (algo, confidence, rule) +
//                 statistiques + annexe transactions liées
// ============================================================================

import { useState } from 'react';
import { FileText, CheckCircle2, Pencil, Eye } from 'lucide-react';
import { ReportOptions, REPORT_OPTIONS_DEFAULTS, type ReportOptionsState } from './ReportOptions';
import type { SignedReport, Anomaly, BankReconciliation } from '../../types/statement.types';
import { computeRiskScore } from '../../utils/riskScore';

export interface ReportPreviewProps {
  report: SignedReport;
  statement?: {
    bankCode: string;
    bankLegalName: string;
    accountNumber: string;
    clientLegalName: string;
    period: { start: string; end: string };
  };
  anomalies?: Anomaly[];
  reconciliation?: BankReconciliation | null;
  cabinet?: { name: string; addressLines: string[] };
  /** PDF source du releve (pour la section annexe). */
  sourcePdfUrl?: string | null;
  /** Lettre de réclamation pré-générée (pour annexe). */
  complaintLetterText?: string | null;
}

function isRealUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:');
}

export function ReportPreview({
  report, statement, anomalies, reconciliation, cabinet,
  sourcePdfUrl, complaintLetterText,
}: ReportPreviewProps) {
  const hasRealPdf = isRealUrl(report.documentUrl);
  const [editMode, setEditMode] = useState(true);
  const [options, setOptions] = useState<ReportOptionsState>(REPORT_OPTIONS_DEFAULTS);

  return (
    <div className="bg-white border border-canvas-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-canvas-200 bg-canvas-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Apercu du rapport</h3>
          <button
            onClick={() => setEditMode(!editMode)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-canvas-300 hover:bg-white"
          >
            {editMode ? <><Eye className="w-3 h-3" /> Lecture</> : <><Pencil className="w-3 h-3" /> Modifier</>}
          </button>
        </div>
        <span className="text-[10px] font-mono text-ink-500">
          hash {report.hash.slice(0, 12)}...
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3">
        <div className="lg:col-span-2">
          {hasRealPdf ? (
            <embed
              src={report.documentUrl}
              type="application/pdf"
              className="w-full rounded border border-canvas-200"
              style={{ height: 700 }}
            />
          ) : (
            <div className="border border-canvas-200 rounded-lg bg-white overflow-y-auto" style={{ height: 700 }}>
              <ReportDocumentBody
                report={report}
                statement={statement}
                anomalies={anomalies ?? []}
                reconciliation={reconciliation ?? null}
                cabinet={cabinet}
                options={options}
                sourcePdfUrl={sourcePdfUrl}
                complaintLetterText={complaintLetterText}
                editable={editMode}
              />
            </div>
          )}
        </div>
        <ReportOptions value={options} onChange={setOptions} />
      </div>
    </div>
  );
}

// ============================================================================
// ReportDocumentBody — sélectionne le bon template ; exportable standalone
// ============================================================================
// Cet alias permet à `ReportViewerPage` (visualiseur fullscreen avec 2 sidebars)
// de rendre le document sans le wrapper preview interne.

export interface ReportDocumentBodyProps {
  report: SignedReport;
  statement?: ReportPreviewProps['statement'];
  anomalies: Anomaly[];
  reconciliation?: BankReconciliation | null;
  cabinet?: { name: string; addressLines: string[] };
  options: ReportOptionsState;
  sourcePdfUrl?: string | null;
  complaintLetterText?: string | null;
  editable: boolean;
}

export function ReportDocumentBody(props: ReportDocumentBodyProps) {
  if (props.report.template === 'export') {
    return (
      <ExportComptableDocument
        report={props.report}
        statement={props.statement}
        anomalies={props.anomalies}
        cabinet={props.cabinet}
        options={props.options}
        editable={props.editable}
      />
    );
  }
  return (
    <NarrativeReportDocument
      report={props.report}
      statement={props.statement}
      anomalies={props.anomalies}
      reconciliation={props.reconciliation ?? null}
      cabinet={props.cabinet}
      options={props.options}
      sourcePdfUrl={props.sourcePdfUrl}
      complaintLetterText={props.complaintLetterText}
      editable={props.editable}
    />
  );
}

// ============================================================================
// NarrativeReportDocument — pour synthese + valeur_probante
// ============================================================================

interface NarrativeProps {
  report: SignedReport;
  statement?: ReportPreviewProps['statement'];
  anomalies: Anomaly[];
  reconciliation: BankReconciliation | null;
  cabinet?: { name: string; addressLines: string[] };
  options: ReportOptionsState;
  sourcePdfUrl?: string | null;
  complaintLetterText?: string | null;
  editable: boolean;
}

export function NarrativeReportDocument({
  report, statement, anomalies, reconciliation, cabinet, options,
  sourcePdfUrl, complaintLetterText, editable,
}: NarrativeProps) {
  const isProbante = report.template === 'valeur_probante';
  const templateLabel = isProbante ? 'Rapport valeur probante' : 'Rapport synthèse';
  const detail = options.detailLevel;

  const criticals = anomalies.filter((a) => a.severity === 'critical');
  const highs     = anomalies.filter((a) => a.severity === 'high');
  const mediums   = anomalies.filter((a) => a.severity === 'medium');
  const lows      = anomalies.filter((a) => a.severity === 'low');
  const totalRecovery = anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0);
  const totalTransactionFlagged = anomalies.reduce((s, a) => s + Math.abs(a.transaction.amountCentimes), 0);

  const score = computeRiskScore(anomalies);

  const periodLabel = statement
    ? `${fmtDate(statement.period.start)} au ${fmtDate(statement.period.end)}`
    : 'Periode non definie';

  // Synthèse condense fortement
  const isSynthese = detail === 'synthese';
  const isExhaustif = detail === 'exhaustif';

  // Anomalies à montrer dans la section table
  const anomaliesShown = isSynthese ? anomalies.slice(0, 3) : anomalies;
  const truncated = isSynthese && anomalies.length > 3 ? anomalies.length - 3 : 0;

  // Numérotation dynamique des sections
  const sections: string[] = ['1. Synthèse', '2. Anomalies détectées'];
  if (isProbante) sections.push('3. État de rapprochement SYSCOHADA');
  if (isProbante && !isSynthese) sections.push((isProbante ? 4 : 3) + '. Workflow de validation');
  if (isExhaustif) sections.push((isProbante ? 5 : 3) + '. Annexe statistique');
  sections.push((sections.length + 1) + '. Recommandations');

  function s(n: number) { return sections[n - 1] ?? `${n}.`; }

  return (
    <div className="bg-white">
      <div className="p-6 sm:p-8 max-w-[680px] mx-auto text-[13px] leading-relaxed text-ink-800">

        {/* === Bandeau template === */}
        <div className={`mb-4 inline-flex items-center gap-2 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          isProbante ? 'bg-ink-900 text-amber-100' : 'bg-amber-100 text-amber-900'
        }`}>
          {isProbante ? '⚖ Document à valeur probante' : '📋 Audit interne'}
          <span className="opacity-70">· {detail}</span>
        </div>

        {/* === En-tête === */}
        {options.customLogo && (
          <div className="border-b-2 border-ink-900 pb-4 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <EditableBlock editable={editable} className="text-lg font-bold text-ink-900">
                  {cabinet?.name ?? 'AtlasBanx'}
                </EditableBlock>
                {cabinet?.addressLines.map((l, i) => (
                  <p key={i} className="text-xs text-ink-500">{l}</p>
                ))}
              </div>
              <div className="text-right text-xs text-ink-500">
                <p>Document généré le</p>
                <p className="font-mono text-ink-700">
                  {report.createdAt
                    ? new Date(report.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                    : new Date().toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* === Titre === */}
        <div className="mb-6 text-center">
          <h2 className="text-base font-bold text-ink-900 uppercase tracking-wider">{templateLabel}</h2>
          <EditableBlock editable={editable} className="text-xs text-ink-600 mt-1">
            {statement ? `Relevé ${statement.bankCode} · Compte ${statement.accountNumber} · ${periodLabel}` : 'Relevé bancaire'}
          </EditableBlock>
          {statement && <p className="text-xs text-ink-500 mt-0.5">Client : {statement.clientLegalName}</p>}
        </div>

        {/* === Score === */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
            score >= 80 ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
            : score >= 50 ? 'border-amber-500 text-amber-700 bg-amber-50'
            : 'border-rose-500 text-rose-700 bg-rose-50'
          }`}>{score}</div>
          <div>
            <p className="text-sm font-semibold">Score de risque : {score}/100</p>
            <p className="text-xs text-ink-500">
              {score >= 80 ? 'Risque faible' : score >= 50 ? 'Vigilance modérée' : 'Risque élevé — action requise'}
            </p>
          </div>
        </div>

        {/* === 1. Synthèse === */}
        <ReportSection title={s(1)} editable={editable}>
          <EditableBlock editable={editable}>
            {`Au titre de la période du ${periodLabel}, l'audit du relevé du compte ${statement?.accountNumber ?? '—'} ` +
            `ouvert auprès de ${statement?.bankLegalName ?? '—'} a permis d'identifier ` +
            `${anomalies.length} anomalie(s) dont ${criticals.length} critique(s), ` +
            `${highs.length} haute(s), ${mediums.length} moyenne(s) et ${lows.length} faible(s).`}
          </EditableBlock>
          {totalRecovery > 0 && (
            <p className="mt-2">
              Montant total à rétrocéder estimé : <b>{fcfa(totalRecovery)} FCFA</b>.
            </p>
          )}
          {isExhaustif && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <KpiBlock label="Total transactions flaguées" value={fcfa(totalTransactionFlagged) + ' FCFA'} />
              <KpiBlock label="Taux de récupération estimé" value={totalTransactionFlagged > 0 ? `${((totalRecovery / totalTransactionFlagged) * 100).toFixed(1)}%` : '—'} />
            </div>
          )}
        </ReportSection>

        {/* === 2. Anomalies === */}
        <ReportSection title={s(2)} editable={editable}>
          {anomalies.length === 0 ? (
            <p className="italic text-ink-500">Aucune anomalie détectée.</p>
          ) : (
            <>
              <table className="w-full text-xs border-collapse mt-2">
                <thead>
                  <tr className="border-b border-ink-200 text-left">
                    <th className="py-1 pr-2 font-semibold">Sévérité</th>
                    <th className="py-1 pr-2 font-semibold">Type</th>
                    <th className="py-1 pr-2 font-semibold">Description</th>
                    <th className="py-1 pr-2 text-right font-semibold">Transaction</th>
                    <th className="py-1 text-right font-semibold">Récupérable</th>
                  </tr>
                </thead>
                <tbody>
                  {anomaliesShown.map((a) => {
                    const txAmount = Math.abs(a.transaction.amountCentimes);
                    const recovery = a.potentialRecoveryCentimes ?? 0;
                    return (
                      <tr key={a.id} className="border-b border-canvas-100 align-top">
                        <td className="py-1.5 pr-2"><SeverityDot severity={a.severity} /></td>
                        <td className="py-1.5 pr-2">{a.type}</td>
                        <td className="py-1.5 pr-2">
                          {a.title}
                          {isExhaustif && (
                            <div className="text-[10px] text-ink-500 mt-0.5 italic">
                              {a.detection.algorithm} · confiance {(a.detection.confidence * 100).toFixed(0)}%
                              {a.detection.rule && <> · {a.detection.rule}</>}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono text-ink-500">{fcfa(txAmount)} FCFA</td>
                        <td className="py-1.5 text-right font-mono font-semibold text-ink-900">
                          {recovery > 0 ? `${fcfa(recovery)} FCFA` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-ink-300 font-semibold">
                    <td className="py-1.5 pr-2" colSpan={3}>Total</td>
                    <td className="py-1.5 pr-2 text-right font-mono text-ink-500">{fcfa(totalTransactionFlagged)} FCFA</td>
                    <td className="py-1.5 text-right font-mono text-ink-900">{fcfa(totalRecovery)} FCFA</td>
                  </tr>
                </tbody>
              </table>
              {truncated > 0 && (
                <p className="text-[10px] text-ink-500 mt-2 italic">
                  + {truncated} anomalie(s) supplémentaire(s) — voir le niveau « Standard » pour le détail complet.
                </p>
              )}
              <p className="text-[10px] text-ink-500 mt-2 italic">
                « Transaction » = montant total de l'opération signalée. « Récupérable » = part jugée
                indue (sur-facturation, doublon, frais sans contrepartie) réclamable à la banque.
              </p>
            </>
          )}
        </ReportSection>

        {/* === 3. Rapprochement (UNIQUEMENT valeur probante) === */}
        {isProbante && (
          <ReportSection title={s(3)} editable={editable}>
            {reconciliation ? (
              <div className="space-y-1 text-xs">
                <p>Taux de rapprochement : <b>{reconciliation.matchRate}%</b></p>
                <p>Solde relevé : <b>{fcfa(reconciliation.totalBankCentimes)} FCFA</b></p>
                <p>Solde comptable : <b>{fcfa(reconciliation.totalLedgerCentimes)} FCFA</b></p>
                <p>Écart : <b>{fcfa(reconciliation.gapCentimes)} FCFA</b></p>
                {reconciliation.discrepancies.length > 0 && (
                  <div className="mt-2">
                    <p className="font-semibold">{reconciliation.discrepancies.length} écart(s) identifié(s) :</p>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {reconciliation.discrepancies.slice(0, isExhaustif ? undefined : 5).map((d) => (
                        <li key={d.id}>{d.description} ({fcfa(Math.abs(d.gapCentimes))} FCFA)</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <EditableBlock editable={editable}>
                Rapprochement non effectué. Importer le grand livre du compte 521 pour générer l'état de rapprochement.
              </EditableBlock>
            )}
          </ReportSection>
        )}

        {/* === 4. Workflow validation (valeur probante non-synthèse) === */}
        {isProbante && !isSynthese && (
          <ReportSection title={s(4)} editable={editable}>
            <ol className="list-decimal pl-5 text-xs space-y-1">
              <li>Détection automatique par 19 algorithmes déterministes (PROPH3T).</li>
              <li>Qualification par auditeur junior (sévérité ≥ medium).</li>
              <li>Validation par auditeur senior (sévérité ≥ high).</li>
              <li>Signature DG pour les anomalies critiques (LCB-FT, fraude).</li>
              <li>Horodatage RFC 3161 + hash SHA-256 chaîné (immuabilité prouvée).</li>
            </ol>
          </ReportSection>
        )}

        {/* === Annexe statistique (exhaustif) === */}
        {isExhaustif && (
          <ReportSection title={s(isProbante ? 5 : 3)} editable={editable}>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <KpiBlock label="Anomalies / sévérité critique" value={String(criticals.length)} />
              <KpiBlock label="Anomalies / sévérité haute"    value={String(highs.length)} />
              <KpiBlock label="Anomalies / sévérité moyenne"  value={String(mediums.length)} />
              <KpiBlock label="Anomalies / sévérité faible"   value={String(lows.length)} />
              <KpiBlock label="Confiance moyenne détecteurs" value={
                anomalies.length === 0 ? '—'
                  : `${(anomalies.reduce((s, a) => s + a.detection.confidence, 0) / anomalies.length * 100).toFixed(0)}%`
              } />
              <KpiBlock label="Algorithmes déclenchés" value={String(new Set(anomalies.map((a) => a.detection.algorithm)).size)} />
            </div>
          </ReportSection>
        )}

        {/* === Recommandations === */}
        <ReportSection title={sections[sections.length - 1]} editable={editable}>
          <EditableBlock editable={editable}>
            {anomalies.length === 0
              ? 'Aucune recommandation particulière. Le relevé est conforme aux conventions appliquées.'
              : `Au vu des ${anomalies.length} anomalie(s) détectée(s), nous recommandons :\n` +
                (criticals.length > 0 ? `- Traitement immédiat des ${criticals.length} anomalie(s) critique(s) (LCB-FT, fraude).\n` : '') +
                (totalRecovery > 0 ? `- Envoi d'une lettre de réclamation à ${statement?.bankLegalName ?? 'la banque'} pour un montant de ${fcfa(totalRecovery)} FCFA.\n` : '') +
                `- Mise en place d'un suivi mensuel des frais bancaires.\n` +
                `- Revue de la convention tarifaire en vigueur.` +
                (isExhaustif && isProbante ? `\n- Conservation du présent rapport horodaté RFC 3161 pour toute procédure contentieuse.` : '')}
          </EditableBlock>
        </ReportSection>

        {/* === Annexes activées par les toggles === */}
        {options.includeComplaint && complaintLetterText && (
          <ReportSection title={`Annexe A — Lettre de réclamation`} editable={editable}>
            <pre className="whitespace-pre-wrap text-[11px] font-sans bg-canvas-50 border border-canvas-200 rounded p-2">{complaintLetterText}</pre>
          </ReportSection>
        )}
        {options.includeSourcePdf && sourcePdfUrl && (
          <ReportSection title={`Annexe B — Relevé bancaire source`} editable={false}>
            <p className="text-xs text-ink-500">Le PDF source est joint au document final.</p>
            <a href={sourcePdfUrl} target="_blank" rel="noreferrer" className="text-xs text-amber-700 underline">
              Ouvrir le PDF dans un nouvel onglet
            </a>
          </ReportSection>
        )}

        {/* === Intégrité (valeur probante uniquement) === */}
        {isProbante && (
          <div className="mt-8 pt-4 border-t border-canvas-200">
            <div className="flex items-center gap-2 mb-2">
              {report.status === 'signed' || report.status === 'sent' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <FileText className="w-4 h-4 text-amber-600" />
              )}
              <span className="text-xs font-semibold">
                {report.status === 'signed' || report.status === 'sent' ? 'Document signé' : 'Brouillon — en attente de signature'}
              </span>
            </div>
            <p className="text-[10px] text-ink-400 font-mono break-all">SHA-256 : {report.hash}</p>
            {report.timestampRfc3161 && (
              <p className="text-[10px] text-ink-400 font-mono mt-0.5">RFC 3161 : {report.timestampRfc3161}</p>
            )}
          </div>
        )}

        {/* === Footer === */}
        <div className="mt-6 pt-3 border-t border-canvas-100 text-center">
          <p className="text-[9px] text-ink-400">
            Ce document a été généré par AtlasBanx · Plateforme d'audit bancaire UEMOA/CEMAC.
            {isProbante && ' L\'intégrité peut être vérifiée via le hash SHA-256 ci-dessus.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ExportComptableDocument — tableau brut transactions catégorisées
// ============================================================================

interface ExportProps {
  report: SignedReport;
  statement?: ReportPreviewProps['statement'];
  anomalies: Anomaly[];
  cabinet?: { name: string; addressLines: string[] };
  options: ReportOptionsState;
  editable: boolean;
}

export function ExportComptableDocument({ report, statement, anomalies, cabinet, options, editable }: ExportProps) {
  const detail = options.detailLevel;
  const isSynthese = detail === 'synthese';
  const isExhaustif = detail === 'exhaustif';

  // Mapping plan comptable SYSCOHADA (extrait)
  const SYSCOHADA_MAP: Record<string, string> = {
    commission_excessive: '627000 — Services bancaires et assimilés',
    frais_double:         '627000 — Services bancaires et assimilés',
    agio_errone:          '671000 — Frais financiers (charges d\'intérêts)',
    pays_gafi_risque:     '486000 — Comptes d\'attente (à régulariser)',
    frais_non_justifie:   '627000 — Services bancaires et assimilés',
    doublon_transaction:  '486000 — Comptes d\'attente',
  };

  return (
    <div className="bg-white">
      <div className="p-6 sm:p-8 max-w-[760px] mx-auto text-[12px] leading-relaxed text-ink-800">

        {/* === Bandeau template === */}
        <div className="mb-4 inline-flex items-center gap-2 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900">
          📊 Export comptable SYSCOHADA · {detail}
        </div>

        {/* En-tête minimal */}
        {options.customLogo && (
          <div className="flex items-baseline justify-between mb-3">
            <span className="font-semibold">{cabinet?.name ?? 'AtlasBanx'}</span>
            <span className="text-xs text-ink-500 font-mono">
              {report.createdAt ? new Date(report.createdAt).toLocaleDateString('fr-FR') : ''}
            </span>
          </div>
        )}

        <h2 className="text-base font-bold text-ink-900 uppercase tracking-wider mb-1">Export comptable</h2>
        {statement && (
          <p className="text-xs text-ink-600 mb-4">
            {statement.bankCode} · Compte {statement.accountNumber} · {fmtDate(statement.period.start)} → {fmtDate(statement.period.end)} · {statement.clientLegalName}
          </p>
        )}

        {/* === 1. Tableau écritures de redressement === */}
        <ReportSection title="1. Écritures de redressement proposées" editable={editable}>
          {anomalies.length === 0 ? (
            <p className="italic text-ink-500">Aucune anomalie — pas d'écriture de redressement nécessaire.</p>
          ) : (
            <table className="w-full text-[11px] border-collapse mt-2">
              <thead>
                <tr className="border-b-2 border-ink-300 text-left bg-canvas-50">
                  <th className="py-1 px-1.5 font-semibold">Date</th>
                  <th className="py-1 px-1.5 font-semibold">Libellé original</th>
                  <th className="py-1 px-1.5 font-semibold">Compte SYSCOHADA</th>
                  <th className="py-1 px-1.5 text-right font-semibold">Débit</th>
                  <th className="py-1 px-1.5 text-right font-semibold">Crédit</th>
                  {isExhaustif && <th className="py-1 px-1.5 font-semibold">Note</th>}
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a) => {
                  const compte = SYSCOHADA_MAP[a.type] ?? '486000 — Comptes d\'attente';
                  const recoveryCentimes = a.potentialRecoveryCentimes ?? 0;
                  // Convention : on contre-passe la sur-charge (débit 627 / crédit 512)
                  return (
                    <tr key={a.id} className="border-b border-canvas-100">
                      <td className="py-1.5 px-1.5 font-mono text-[10px]">{a.transaction.date || '—'}</td>
                      <td className="py-1.5 px-1.5 truncate max-w-[200px]" title={a.transaction.label}>{a.transaction.label || a.title}</td>
                      <td className="py-1.5 px-1.5 font-mono text-[10px]">{compte}</td>
                      <td className="py-1.5 px-1.5 text-right font-mono">
                        {recoveryCentimes > 0 ? fcfa(recoveryCentimes) : ''}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono">
                        {recoveryCentimes > 0 ? fcfa(recoveryCentimes) : ''}
                      </td>
                      {isExhaustif && (
                        <td className="py-1.5 px-1.5 text-[10px] text-ink-500">
                          {a.detection.algorithm}
                          {a.severity === 'critical' && <> · ⚠ LCB-FT</>}
                        </td>
                      )}
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-ink-300 font-semibold bg-canvas-50">
                  <td colSpan={3} className="py-1.5 px-1.5">Total à régulariser</td>
                  <td className="py-1.5 px-1.5 text-right font-mono">
                    {fcfa(anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0))} FCFA
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono">
                    {fcfa(anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0))} FCFA
                  </td>
                  {isExhaustif && <td />}
                </tr>
              </tbody>
            </table>
          )}
        </ReportSection>

        {/* === 2. Mapping plan comptable === */}
        {!isSynthese && (
          <ReportSection title="2. Mapping plan comptable (extrait)" editable={editable}>
            <ul className="text-[11px] space-y-0.5 font-mono">
              {Array.from(new Set(anomalies.map((a) => a.type))).map((t) => (
                <li key={t} className="flex justify-between gap-2">
                  <span>{t}</span>
                  <span className="text-ink-500">→ {SYSCOHADA_MAP[t] ?? '486000 — Comptes d\'attente'}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-ink-500 italic">
              Plan comptable SYSCOHADA OHADA · adapté aux conventions UEMOA/CEMAC.
            </p>
          </ReportSection>
        )}

        {/* === 3. Totaux par compte SYSCOHADA — utile pour vérifier
                  l'équilibre débit/crédit avant import en compta. === */}
        {isExhaustif && (() => {
          // Agrège les montants récupérables par compte SYSCOHADA cible.
          const byAccount = new Map<string, number>();
          for (const a of anomalies) {
            const compte = SYSCOHADA_MAP[a.type] ?? '486000 — Comptes d\'attente';
            const cur = byAccount.get(compte) ?? 0;
            byAccount.set(compte, cur + (a.potentialRecoveryCentimes ?? 0));
          }
          const rows = Array.from(byAccount.entries())
            .filter(([, amt]) => amt > 0)
            .sort((a, b) => b[1] - a[1]);
          const grandTotal = rows.reduce((s, [, amt]) => s + amt, 0);
          return (
            <ReportSection title="3. Totaux par compte SYSCOHADA" editable={editable}>
              {rows.length === 0 ? (
                <p className="italic text-ink-500 text-[11px]">Aucun montant à régulariser sur ce relevé.</p>
              ) : (
                <table className="w-full text-[11px] border-collapse mt-2">
                  <thead>
                    <tr className="border-b-2 border-ink-300 text-left bg-canvas-50">
                      <th className="py-1 px-1.5 font-semibold">Compte</th>
                      <th className="py-1 px-1.5 text-right font-semibold">Débit (FCFA)</th>
                      <th className="py-1 px-1.5 text-right font-semibold">Crédit (FCFA)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([compte, amt]) => (
                      <tr key={compte} className="border-b border-canvas-100">
                        <td className="py-1.5 px-1.5 font-mono text-[10px]">{compte}</td>
                        <td className="py-1.5 px-1.5 text-right font-mono">{fcfa(amt)}</td>
                        <td className="py-1.5 px-1.5 text-right font-mono">{fcfa(amt)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-ink-300 font-semibold bg-canvas-50">
                      <td className="py-1.5 px-1.5">Total général</td>
                      <td className="py-1.5 px-1.5 text-right font-mono">{fcfa(grandTotal)}</td>
                      <td className="py-1.5 px-1.5 text-right font-mono">{fcfa(grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
              <p className="mt-2 text-[10px] text-ink-500 italic">
                Vérification d'équilibre : total débit = total crédit (principe de la partie double SYSCOHADA).
                Le fichier Excel téléchargé contient les écritures détaillées prêtes à importer.
              </p>
            </ReportSection>
          );
        })()}

        <div className="mt-6 pt-3 border-t border-canvas-100 text-center">
          <p className="text-[9px] text-ink-400">Export comptable AtlasBanx · destiné à Atlas Finance / logiciel de comptabilité tiers.</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function ReportSection({ title, editable, children }: { title: string; editable: boolean; children: React.ReactNode }) {
  // Extrait l'index « N » du titre (« 1. Synthèse » → « 1 ») pour générer
  // un ancrage data-section cliquable depuis la sidebar du visualiseur.
  const match = title.match(/^(\d+)\./);
  const anchor = match ? `section-${match[1]}` : undefined;
  void editable;
  return (
    <div className="mb-5" data-section={anchor}>
      <h3 className="text-sm font-bold text-ink-900 border-b border-ink-200 pb-1 mb-2">{title}</h3>
      <div className="text-[13px] leading-relaxed">{children}</div>
    </div>
  );
}

function EditableBlock({ editable, className, children }: { editable: boolean; className?: string; children: React.ReactNode }) {
  if (!editable) return <div className={className}>{children}</div>;
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      className={`${className ?? ''} outline-none focus:bg-amber-50/50 focus:ring-1 focus:ring-amber-300 rounded px-1 -mx-1`}
    >
      {children}
    </div>
  );
}

function KpiBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas-50 border border-canvas-200 rounded p-2">
      <p className="text-[9px] uppercase tracking-wider text-ink-500">{label}</p>
      <p className="text-xs font-semibold text-ink-900 mt-0.5">{value}</p>
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const color = severity === 'critical' ? 'bg-rose-500'
    : severity === 'high' ? 'bg-orange-500'
    : severity === 'medium' ? 'bg-amber-500'
    : 'bg-ink-400';
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="capitalize">{severity}</span>
    </span>
  );
}

function fcfa(centimes: number): string {
  const u = Math.round(centimes / 100);
  let out = '';
  const s = String(Math.abs(u));
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
    out += s[i];
  }
  return u < 0 ? '-' + out : out;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00Z'));
  if (isNaN(d.getTime())) return iso;
  const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
