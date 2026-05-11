// ============================================================================
// ReportPreview — apercu editable du rapport prerempli
// ============================================================================
// Affiche un document A4 HTML prerempli avec les vraies donnees du releve
// (anomalies, KPI, rapprochement). Les sections textuelles sont editables
// via contentEditable. Si un vrai PDF est dispo (URL http), embed PDF.
// ============================================================================

import { useState } from 'react';
import { FileText, CheckCircle2, Pencil, Eye } from 'lucide-react';
import { ReportOptions } from './ReportOptions';
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
}

function isRealUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:');
}

export function ReportPreview({ report, statement, anomalies, reconciliation, cabinet }: ReportPreviewProps) {
  const hasRealPdf = isRealUrl(report.documentUrl);
  const [editMode, setEditMode] = useState(true);

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
            <ReportDocument
              report={report}
              statement={statement}
              anomalies={anomalies ?? []}
              reconciliation={reconciliation ?? null}
              cabinet={cabinet}
              editable={editMode}
            />
          )}
        </div>
        <ReportOptions />
      </div>
    </div>
  );
}

// ============================================================================
// ReportDocument — contenu A4 prerempli et editable
// ============================================================================

interface ReportDocumentProps {
  report: SignedReport;
  statement?: ReportPreviewProps['statement'];
  anomalies: Anomaly[];
  reconciliation: BankReconciliation | null;
  cabinet?: { name: string; addressLines: string[] };
  editable: boolean;
}

function ReportDocument({ report, statement, anomalies, reconciliation, cabinet, editable }: ReportDocumentProps) {
  const templateLabel = report.template === 'valeur_probante'
    ? 'Rapport valeur probante' : report.template === 'synthese'
    ? 'Rapport synthese' : 'Export comptable';

  const criticals = anomalies.filter((a) => a.severity === 'critical');
  const highs = anomalies.filter((a) => a.severity === 'high');
  const mediums = anomalies.filter((a) => a.severity === 'medium');
  const lows = anomalies.filter((a) => a.severity === 'low');
  const totalRecovery = anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0);

  // Score calculé via le helper centralisé (mêmes pondérations partout dans
  // l'app : header de la page relevé, ce rapport, exports comptables, etc.).
  const score = computeRiskScore(anomalies);

  const periodLabel = statement
    ? `${fmtDate(statement.period.start)} au ${fmtDate(statement.period.end)}`
    : 'Periode non definie';

  return (
    <div className="border border-canvas-200 rounded-lg bg-white overflow-y-auto" style={{ height: 700 }}>
      <div className="p-6 sm:p-8 max-w-[680px] mx-auto text-[13px] leading-relaxed text-ink-800">

        {/* === En-tete === */}
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
              <p>Document genere le</p>
              <p className="font-mono text-ink-700">
                {report.createdAt
                  ? new Date(report.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                  : new Date().toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
        </div>

        {/* === Titre === */}
        <div className="mb-6 text-center">
          <h2 className="text-base font-bold text-ink-900 uppercase tracking-wider">{templateLabel}</h2>
          <EditableBlock editable={editable} className="text-xs text-ink-600 mt-1">
            {statement ? `Releve ${statement.bankCode} · Compte ${statement.accountNumber} · ${periodLabel}` : 'Releve bancaire'}
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
              {score >= 80 ? 'Risque faible' : score >= 50 ? 'Vigilance moderee' : 'Risque eleve — action requise'}
            </p>
          </div>
        </div>

        {/* === 1. Synthese === */}
        <ReportSection title="1. Synthese" editable={editable}>
          <EditableBlock editable={editable}>
            {`Au titre de la periode du ${periodLabel}, l'audit du releve du compte ${statement?.accountNumber ?? '—'} ` +
            `ouvert aupres de ${statement?.bankLegalName ?? '—'} a permis d'identifier ` +
            `${anomalies.length} anomalie(s) dont ${criticals.length} critique(s), ` +
            `${highs.length} haute(s), ${mediums.length} moyenne(s) et ${lows.length} faible(s).`}
          </EditableBlock>
          {totalRecovery > 0 && (
            <p className="mt-2">
              Montant total a retroceder estime : <b>{fcfa(totalRecovery)} FCFA</b>.
            </p>
          )}
        </ReportSection>

        {/* === 2. Anomalies detectees === */}
        <ReportSection title="2. Anomalies detectees" editable={editable}>
          {anomalies.length === 0 ? (
            <p className="italic text-ink-500">Aucune anomalie detectee.</p>
          ) : (
            <>
              <table className="w-full text-xs border-collapse mt-2">
                <thead>
                  <tr className="border-b border-ink-200 text-left">
                    <th className="py-1 pr-2 font-semibold">Severite</th>
                    <th className="py-1 pr-2 font-semibold">Type</th>
                    <th className="py-1 pr-2 font-semibold">Description</th>
                    <th className="py-1 pr-2 text-right font-semibold">Transaction</th>
                    <th className="py-1 text-right font-semibold">Recuperable</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((a) => {
                    const txAmount = Math.abs(a.transaction.amountCentimes);
                    const recovery = a.potentialRecoveryCentimes ?? 0;
                    return (
                      <tr key={a.id} className="border-b border-canvas-100">
                        <td className="py-1.5 pr-2">
                          <SeverityDot severity={a.severity} />
                        </td>
                        <td className="py-1.5 pr-2">{a.type}</td>
                        <td className="py-1.5 pr-2">{a.title}</td>
                        <td className="py-1.5 pr-2 text-right font-mono text-ink-500">
                          {fcfa(txAmount)} FCFA
                        </td>
                        <td className="py-1.5 text-right font-mono font-semibold text-ink-900">
                          {recovery > 0 ? `${fcfa(recovery)} FCFA` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Ligne de totaux pour rappeler la convention */}
                  <tr className="border-t-2 border-ink-300 font-semibold">
                    <td className="py-1.5 pr-2" colSpan={3}>Total</td>
                    <td className="py-1.5 pr-2 text-right font-mono text-ink-500">
                      {fcfa(anomalies.reduce((s, a) => s + Math.abs(a.transaction.amountCentimes), 0))} FCFA
                    </td>
                    <td className="py-1.5 text-right font-mono text-ink-900">
                      {fcfa(totalRecovery)} FCFA
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="text-[10px] text-ink-500 mt-2 italic">
                « Transaction » = montant total de l'operation signalee. « Recuperable » = part jugee
                indue (sur-facturation, doublon, frais sans contrepartie) reclamable a la banque.
              </p>
            </>
          )}
        </ReportSection>

        {/* === 3. Rapprochement (si valeur probante) === */}
        {(report.template === 'valeur_probante') && (
          <ReportSection title="3. Etat de rapprochement SYSCOHADA" editable={editable}>
            {reconciliation ? (
              <div className="space-y-1 text-xs">
                <p>Taux de rapprochement : <b>{reconciliation.matchRate}%</b></p>
                <p>Solde releve : <b>{fcfa(reconciliation.totalBankCentimes)} FCFA</b></p>
                <p>Solde comptable : <b>{fcfa(reconciliation.totalLedgerCentimes)} FCFA</b></p>
                <p>Ecart : <b>{fcfa(reconciliation.gapCentimes)} FCFA</b></p>
                {reconciliation.discrepancies.length > 0 && (
                  <div className="mt-2">
                    <p className="font-semibold">{reconciliation.discrepancies.length} ecart(s) identifies :</p>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {reconciliation.discrepancies.slice(0, 5).map((d) => (
                        <li key={d.id}>{d.description} ({fcfa(Math.abs(d.gapCentimes))} FCFA)</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <EditableBlock editable={editable}>
                Rapprochement non effectue. Importer le grand livre du compte 521 pour generer l'etat de rapprochement.
              </EditableBlock>
            )}
          </ReportSection>
        )}

        {/* === 4. Recommandations === */}
        <ReportSection title={report.template === 'valeur_probante' ? '4. Recommandations' : '3. Recommandations'} editable={editable}>
          <EditableBlock editable={editable}>
            {anomalies.length === 0
              ? 'Aucune recommandation particuliere. Le releve est conforme aux conventions appliquees.'
              : `Au vu des ${anomalies.length} anomalie(s) detectee(s), nous recommandons :\n` +
                (criticals.length > 0 ? `- Traitement immediat des ${criticals.length} anomalie(s) critique(s) (LCB-FT, fraude).\n` : '') +
                (totalRecovery > 0 ? `- Envoi d'une lettre de reclamation a ${statement?.bankLegalName ?? 'la banque'} pour un montant de ${fcfa(totalRecovery)} FCFA.\n` : '') +
                `- Mise en place d'un suivi mensuel des frais bancaires.\n` +
                `- Revue de la convention tarifaire en vigueur.`}
          </EditableBlock>
        </ReportSection>

        {/* === Integrite === */}
        <div className="mt-8 pt-4 border-t border-canvas-200">
          <div className="flex items-center gap-2 mb-2">
            {report.status === 'signed' || report.status === 'sent' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <FileText className="w-4 h-4 text-amber-600" />
            )}
            <span className="text-xs font-semibold">
              {report.status === 'signed' || report.status === 'sent' ? 'Document signe' : 'Brouillon — en attente de signature'}
            </span>
          </div>
          <p className="text-[10px] text-ink-400 font-mono break-all">SHA-256 : {report.hash}</p>
          {report.timestampRfc3161 && (
            <p className="text-[10px] text-ink-400 font-mono mt-0.5">RFC 3161 : {report.timestampRfc3161}</p>
          )}
        </div>

        {/* === Footer === */}
        <div className="mt-6 pt-3 border-t border-canvas-100 text-center">
          <p className="text-[9px] text-ink-400">
            Ce document a ete genere par AtlasBanx · Plateforme d'audit bancaire UEMOA/CEMAC.
            L'integrite peut etre verifiee via le hash SHA-256 ci-dessus.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function ReportSection({ title, editable, children }: { title: string; editable: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-5">
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
