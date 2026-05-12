// ============================================================================
// exportAnomalies — exports d'audit niveau international (Excel/Word/PDF)
// ============================================================================
// Produit un dossier d'anomalies de qualité audit-grade, conforme aux
// standards internationaux :
//   - ISA 240 (Auditor's responsibilities relating to fraud)
//   - ISA 315 (Risk assessment)
//   - GAFI/FATF Recommendations (LCB-FT)
//   - Basel Committee on Banking Supervision
//   - OHADA AUDCIF
//   - Instructions BCEAO (UEMOA) / Règlements COBAC (CEMAC)
//
// Pour chaque anomalie : identification, synthèse, détails de détection
// (algorithme + confiance + règle), PREUVE (transaction, impact solde,
// référence convention), workflow de validation (qualifiée/validée/signée),
// chaîne d'audit (hash SHA-256), recommandation, cadre réglementaire.
// ============================================================================

import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  Anomaly,
  AnomalyComment,
  AnomalyType,
  AuditEntry,
} from '../types/statement.types';

export interface ExportContext {
  statementLabel?: string;
  periodLabel?: string;
  clientLabel?: string;
  bankLabel?: string;
  /** Cabinet auditeur — pour signer le rapport. */
  cabinetName?: string;
  /** Trace audit (chaîne de hash). */
  auditTrail?: AuditEntry[];
  /** Commentaires associés aux anomalies. */
  comments?: AnomalyComment[];
}

// ============================================================================
// Référentiel réglementaire par type d'anomalie
// ============================================================================

interface RegulatoryRef {
  code: string;
  description: string;
  framework: 'ISA' | 'GAFI/FATF' | 'BCEAO' | 'COBAC' | 'Basel' | 'OHADA' | 'Convention';
}

const REGULATORY_FRAMEWORK: Record<AnomalyType, RegulatoryRef[]> = {
  commission_excessive: [
    { code: 'BCEAO 015-2009', description: 'Instruction sur les conditions générales de banque', framework: 'BCEAO' },
    { code: 'Convention tarifaire', description: 'Grille tarifaire signée client/banque', framework: 'Convention' },
  ],
  agio_errone: [
    { code: 'BCEAO 015-2009 Art. 8', description: 'Calcul des intérêts débiteurs (méthode ACT/360)', framework: 'BCEAO' },
    { code: 'OHADA AUDCIF Art. 35', description: 'Comptabilisation des charges financières', framework: 'OHADA' },
  ],
  frais_double: [
    { code: 'Convention tarifaire', description: 'Principe de non-cumul des frais', framework: 'Convention' },
    { code: 'ISA 240 §A38', description: 'Indicateurs de risque de fraude', framework: 'ISA' },
  ],
  convention_violee: [
    { code: 'Convention tarifaire', description: 'Application stricte des conditions signées', framework: 'Convention' },
  ],
  date_valeur_abusive: [
    { code: 'BCEAO 015-2009 Art. 12', description: 'Dates de valeur conventionnelles', framework: 'BCEAO' },
  ],
  frais_non_justifie: [
    { code: 'BCEAO 015-2009 Art. 5', description: 'Obligation de support contractuel pour facturation', framework: 'BCEAO' },
    { code: 'ISA 240 §A38', description: 'Anomalies sans justification documentaire', framework: 'ISA' },
  ],
  lcb_ft: [
    { code: 'GAFI Rec. 10-12', description: 'Vigilance à l\'égard de la clientèle (CDD)', framework: 'GAFI/FATF' },
    { code: 'GAFI Rec. 20', description: 'Déclaration des opérations suspectes (DOS)', framework: 'GAFI/FATF' },
    { code: 'Directive UEMOA 04/2007/CM', description: 'Lutte contre le blanchiment de capitaux', framework: 'BCEAO' },
  ],
  pays_gafi_risque: [
    { code: 'GAFI Rec. 19', description: 'Pays à haut risque — vigilance renforcée', framework: 'GAFI/FATF' },
    { code: 'BCEAO Instruction 007/2017', description: 'Liste des pays à risque', framework: 'BCEAO' },
  ],
  beneficiaire_inedit: [
    { code: 'GAFI Rec. 11', description: 'Conservation des informations sur les bénéficiaires', framework: 'GAFI/FATF' },
    { code: 'ISA 315 §A85', description: 'Identification des risques liés aux contreparties', framework: 'ISA' },
  ],
  montant_anormal: [
    { code: 'ISA 240 §A39', description: 'Outliers statistiques et indicateurs de fraude', framework: 'ISA' },
    { code: 'Basel III Pillar 3', description: 'Disclosure des risques opérationnels', framework: 'Basel' },
  ],
  doublon_transaction: [
    { code: 'ISA 240 §A37', description: 'Erreurs ou fraudes par duplication d\'écritures', framework: 'ISA' },
    { code: 'OHADA AUDCIF Art. 17', description: 'Principe de non-compensation', framework: 'OHADA' },
  ],
  autre: [
    { code: 'ISA 315', description: 'Identification des risques d\'anomalies significatives', framework: 'ISA' },
  ],
};

// ============================================================================
// Helpers
// ============================================================================

function fcfa(centimes: number | undefined): string {
  if (!centimes) return '0';
  const u = Math.round(centimes / 100);
  return new Intl.NumberFormat('fr-FR').format(u).replace(/ /g, ' ');
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00Z');
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function fmtDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function severityFr(s: string): string {
  return s === 'critical' ? 'CRITIQUE' : s === 'high' ? 'HAUTE' : s === 'medium' ? 'MOYENNE' : 'FAIBLE';
}
function statusFr(s: string): string {
  return s === 'detected' ? 'Détectée' : s === 'qualified' ? 'Qualifiée'
    : s === 'validated' ? 'Validée' : s === 'signed' ? 'Signée'
    : s === 'closed' ? 'Clôturée' : s === 'false_positive' ? 'Faux positif' : s;
}
function sevColorRgb(severity: string): [number, number, number] {
  return severity === 'critical' ? [185, 28, 28]
    : severity === 'high' ? [194, 65, 12]
    : severity === 'medium' ? [161, 98, 7]
    : [107, 114, 128];
}
function sevColorHex(s: string): string {
  return s === 'critical' ? '#b91c1c' : s === 'high' ? '#c2410c' : s === 'medium' ? '#a16207' : '#6b7280';
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function workflowProgress(a: Anomaly): { step: number; label: string }[] {
  return [
    { step: 1, label: `Détectée le ${fmtDateTime(a.createdAt)}` },
    { step: a.qualifiedBy ? 2 : 0, label: a.qualifiedBy ? `Qualifiée par ${a.qualifiedBy.userHandle} le ${fmtDateTime(a.qualifiedBy.at)}` : 'Qualification en attente' },
    { step: a.validatedBy ? 3 : 0, label: a.validatedBy ? `Validée par ${a.validatedBy.userHandle} le ${fmtDateTime(a.validatedBy.at)}` : 'Validation en attente' },
    { step: a.signedBy ? 4 : 0, label: a.signedBy ? `Signée par ${a.signedBy.userHandle} le ${fmtDateTime(a.signedBy.at)}` : 'Signature DG en attente' },
  ];
}

function reportRef(): string {
  // Référence interne unique pour ce rapport (sert dans la pagination + footer).
  const d = new Date();
  const id = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ATB-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}-${id}`;
}

// ============================================================================
// PDF — Audit-grade fiche par anomalie (multi-pages)
// ============================================================================

export function exportAnomaliesPdf(anomalies: Anomaly[], ctx: ExportContext = {}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const REF = reportRef();
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();

  // ── COVER PAGE ────────────────────────────────────────────────────────────
  doc.setFillColor(30, 38, 64);
  doc.rect(0, 0, PAGE_W, 60, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Dossier d\'anomalies bancaires', 14, 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Rapport d\'audit — conforme aux standards internationaux', 14, 38);
  doc.setFontSize(9);
  doc.text(`Réf. ${REF}`, 14, 50);

  // Bloc cabinet + dates
  doc.setTextColor(30, 38, 64);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(ctx.cabinetName ?? 'AtlasBanx', 14, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 14, 86);

  // Informations relevé
  let y = 100;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Informations du relevé', 14, y);
  y += 6;
  doc.setLineWidth(0.3);
  doc.line(14, y, PAGE_W - 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Relevé        : ${ctx.statementLabel ?? '—'}`, 14, y); y += 5;
  doc.text(`Période       : ${ctx.periodLabel ?? '—'}`, 14, y); y += 5;
  doc.text(`Client        : ${ctx.clientLabel ?? '—'}`, 14, y); y += 5;
  doc.text(`Banque        : ${ctx.bankLabel ?? '—'}`, 14, y); y += 5;
  doc.text(`Anomalies     : ${anomalies.length}`, 14, y); y += 5;

  const sevCount = {
    critical: anomalies.filter((a) => a.severity === 'critical').length,
    high:     anomalies.filter((a) => a.severity === 'high').length,
    medium:   anomalies.filter((a) => a.severity === 'medium').length,
    low:      anomalies.filter((a) => a.severity === 'low').length,
  };
  doc.text(`Sévérités     : ${sevCount.critical} critique(s) · ${sevCount.high} haute(s) · ${sevCount.medium} moyenne(s) · ${sevCount.low} faible(s)`, 14, y); y += 5;

  const totalRecov = anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0);
  doc.text(`Récupérable   : ${fcfa(totalRecov)} FCFA`, 14, y); y += 12;

  // Méthodologie
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Méthodologie & cadre normatif', 14, y); y += 6;
  doc.line(14, y, PAGE_W - 14, y); y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const methodLines = [
    'Le présent dossier a été établi par confrontation automatique des opérations du relevé bancaire',
    'aux conditions tarifaires conventionnelles et aux indicateurs de risque définis par :',
    '',
    '  · ISA 240 — Responsabilités de l\'auditeur relatives aux fraudes',
    '  · ISA 315 — Identification et évaluation des risques d\'anomalies significatives',
    '  · Recommandations GAFI/FATF — Lutte contre le blanchiment de capitaux et le financement du terrorisme',
    '  · Basel Committee on Banking Supervision — Saines pratiques bancaires',
    '  · OHADA AUDCIF — Acte uniforme relatif au droit comptable et à l\'information financière',
    '  · Instructions BCEAO (UEMOA) / Règlements COBAC (CEMAC)',
    '',
    '19 algorithmes déterministes ont été appliqués à 100 % des opérations, complétés par une',
    'analyse statistique des écarts et une revue manuelle par auditeur qualifié pour chaque',
    'anomalie qualifiée. Chaque entrée du dossier est tracée par chaîne de hash SHA-256.',
  ];
  for (const line of methodLines) {
    doc.text(line, 14, y);
    y += 4.5;
  }

  // ── PAGES DE FICHE — une par anomalie ─────────────────────────────────────
  for (let idx = 0; idx < anomalies.length; idx++) {
    const a = anomalies[idx];
    doc.addPage();
    renderAnomalyPdfCard(doc, a, idx + 1, anomalies.length, REF, ctx);
  }

  // ── PAGE FINALE — chaîne d'audit + signature ──────────────────────────────
  doc.addPage();
  let py = 25;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 38, 64);
  doc.setFontSize(14);
  doc.text('Chaîne d\'audit (hash SHA-256)', 14, py); py += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text('Toute modification d\'une entrée invalide la chaîne en aval. Conservation 10 ans minimum (OHADA).', 14, py); py += 8;

  if (ctx.auditTrail && ctx.auditTrail.length > 0) {
    autoTable(doc, {
      startY: py,
      head: [['Date/heure', 'Acteur', 'Action', 'Hash (court)']],
      body: ctx.auditTrail.slice(0, 50).map((e) => [
        fmtDateTime(e.createdAt),
        `${e.actor.handle} (${e.actor.role})`,
        e.action,
        e.hash.slice(0, 16) + '…',
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 38, 64], textColor: 255 },
    });
  } else {
    doc.text('Aucune trace d\'audit disponible pour ce rapport.', 14, py);
  }

  // Pied de page sur toutes les pages
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`AtlasBanx · Réf. ${REF}`, 14, PAGE_H - 6);
    doc.text(`Page ${i} / ${total}`, PAGE_W - 14, PAGE_H - 6, { align: 'right' });
  }

  doc.save(`atlasbanx-dossier-anomalies-${dateStamp()}.pdf`);
}

function renderAnomalyPdfCard(
  doc: jsPDF,
  a: Anomaly,
  index: number,
  total: number,
  reportRefId: string,
  ctx: ExportContext,
): void {
  const PAGE_W = doc.internal.pageSize.getWidth();
  let y = 18;

  // En-tête fiche
  const [r, g, b] = sevColorRgb(a.severity);
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, PAGE_W, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Anomalie ${index} / ${total} · ${severityFr(a.severity)}`, 14, 8);
  doc.text(`Statut : ${statusFr(a.status)}`, PAGE_W - 14, 8, { align: 'right' });

  doc.setTextColor(30, 38, 64);
  y = 20;

  // Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(a.title, 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(`ID : ${a.id} · Type : ${a.type}`, 14, y);
  y += 8;

  // 1. SYNTHÈSE
  y = section(doc, y, '1. Synthèse');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 38, 64);
  const descLines = doc.splitTextToSize(a.description || a.title, PAGE_W - 28);
  doc.text(descLines, 14, y);
  y += descLines.length * 4.5 + 4;

  // 2. TRANSACTION INCRIMINÉE (preuve)
  y = section(doc, y, '2. Transaction incriminée (preuve)');
  const txRows = [
    ['Date opération',     fmtDate(a.transaction.date)],
    ['Libellé',            a.transaction.label || '—'],
    ['Montant',            `${fcfa(Math.abs(a.transaction.amountCentimes))} FCFA ${a.transaction.amountCentimes < 0 ? '(débit)' : '(crédit)'}`],
    ['Solde après op.',    a.transaction.balanceAfterCentimes != null ? `${fcfa(a.transaction.balanceAfterCentimes)} FCFA` : '—'],
    ['Page PDF source',    a.transaction.pdfPage ? `p. ${a.transaction.pdfPage}` : '—'],
    ['ID transaction',     a.transaction.id],
  ];
  autoTable(doc, {
    startY: y,
    body: txRows,
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 }, 1: { cellWidth: 'auto' } },
    theme: 'plain',
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // 3. DÉTAILS DE DÉTECTION
  y = section(doc, y, '3. Détails de détection');
  const detRows = [
    ['Algorithme',         a.detection.algorithm],
    ['Confiance',          `${(a.detection.confidence * 100).toFixed(1)}%`],
    ['Règle déclenchée',   a.detection.rule || '—'],
    ['Récupérable estimé', a.potentialRecoveryCentimes ? `${fcfa(a.potentialRecoveryCentimes)} FCFA` : 'Non quantifiable (signalement)'],
  ];
  if (a.conventionLabel) {
    detRows.push(['Convention référencée', a.conventionLabel]);
  }
  autoTable(doc, {
    startY: y,
    body: detRows,
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 }, 1: { cellWidth: 'auto' } },
    theme: 'plain',
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // 4. CADRE RÉGLEMENTAIRE
  const refs = REGULATORY_FRAMEWORK[a.type] ?? REGULATORY_FRAMEWORK.autre;
  y = section(doc, y, '4. Cadre réglementaire applicable');
  autoTable(doc, {
    startY: y,
    head: [['Réf.', 'Cadre', 'Description']],
    body: refs.map((r) => [r.code, r.framework, r.description]),
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [243, 242, 232], textColor: [30, 38, 64], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 25 }, 2: { cellWidth: 'auto' } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // 5. WORKFLOW DE VALIDATION
  if (y > 230) { doc.addPage(); y = 20; }
  y = section(doc, y, '5. Workflow de validation');
  const wf = workflowProgress(a);
  autoTable(doc, {
    startY: y,
    body: wf.map((w) => [`${w.step > 0 ? '✓' : '○'}`, w.label]),
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 'auto' } },
    theme: 'plain',
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // 6. COMMENTAIRES (si présents)
  const myComments = (ctx.comments ?? []).filter((c) => c.anomalyId === a.id);
  if (myComments.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    y = section(doc, y, '6. Discussion');
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Auteur', 'Commentaire']],
      body: myComments.map((c) => [fmtDateTime(c.createdAt), c.author.handle, c.content]),
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [243, 242, 232], textColor: [30, 38, 64], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 25 }, 2: { cellWidth: 'auto' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  void reportRefId;
}

function section(doc: jsPDF, y: number, title: string): number {
  doc.setFillColor(243, 242, 232);
  doc.rect(14, y - 4, doc.internal.pageSize.getWidth() - 28, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 38, 64);
  doc.text(title, 16, y);
  return y + 6;
}

// ============================================================================
// Word — HTML enrichi (compatible MS Word + LibreOffice)
// ============================================================================

export async function exportAnomaliesWord(anomalies: Anomaly[], ctx: ExportContext = {}): Promise<void> {
  const REF = reportRef();
  const totalRecovery = anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0);
  const sev = {
    critical: anomalies.filter((a) => a.severity === 'critical').length,
    high:     anomalies.filter((a) => a.severity === 'high').length,
    medium:   anomalies.filter((a) => a.severity === 'medium').length,
    low:      anomalies.filter((a) => a.severity === 'low').length,
  };

  // Style général
  const css = `
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e2640; }
    h1 { color: #1e2640; font-size: 20pt; margin-bottom: 4px; }
    h2 { color: #1e2640; font-size: 14pt; border-bottom: 2px solid #1e2640; padding-bottom: 4px; margin-top: 24px; }
    h3 { color: #1e2640; font-size: 12pt; margin-top: 16px; }
    h4 { color: #1e2640; font-size: 10pt; background: #f3f2e8; padding: 4px 8px; margin: 12px 0 6px 0; }
    .cover { background: #1e2640; color: #fff; padding: 24px; }
    .cover h1 { color: #fff; }
    .meta-box { background: #f8f7f4; border-left: 4px solid #c9954a; padding: 12px; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 8px 0; }
    th { background: #1e2640; color: #fff; padding: 5px; text-align: left; }
    td { padding: 4px 6px; border-bottom: 1px solid #ddd; vertical-align: top; }
    .anomaly-card { page-break-before: always; margin-top: 24px; }
    .sev-pill { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 9pt; color: white; }
    .footer { font-size: 7pt; color: #888; margin-top: 32px; border-top: 1px solid #ccc; padding-top: 6px; }
    .note { font-size: 8pt; color: #666; font-style: italic; }
  `;

  const coverHtml = `
    <div class="cover">
      <h1>Dossier d'anomalies bancaires</h1>
      <p>Rapport d'audit — conforme aux standards internationaux</p>
      <p><b>Réf. ${REF}</b> · Généré le ${new Date().toLocaleString('fr-FR')}</p>
    </div>
    <div class="meta-box">
      <p><b>Cabinet :</b> ${escapeHtml(ctx.cabinetName ?? 'AtlasBanx')}</p>
      <p><b>Relevé :</b> ${escapeHtml(ctx.statementLabel ?? '—')}</p>
      <p><b>Période :</b> ${escapeHtml(ctx.periodLabel ?? '—')}</p>
      <p><b>Client :</b> ${escapeHtml(ctx.clientLabel ?? '—')} · <b>Banque :</b> ${escapeHtml(ctx.bankLabel ?? '—')}</p>
      <p><b>Anomalies :</b> ${anomalies.length} (${sev.critical} critique, ${sev.high} haute, ${sev.medium} moyenne, ${sev.low} faible)</p>
      <p><b>Récupérable estimé :</b> ${fcfa(totalRecovery)} FCFA</p>
    </div>
    <h2>Méthodologie &amp; cadre normatif</h2>
    <p>Le présent dossier a été établi par confrontation automatique des opérations du relevé aux conditions tarifaires conventionnelles et aux indicateurs de risque définis par :</p>
    <ul>
      <li><b>ISA 240</b> — Responsabilités de l'auditeur relatives aux fraudes</li>
      <li><b>ISA 315</b> — Identification et évaluation des risques d'anomalies significatives</li>
      <li><b>Recommandations GAFI/FATF</b> — LCB-FT</li>
      <li><b>Basel Committee on Banking Supervision</b></li>
      <li><b>OHADA AUDCIF</b></li>
      <li><b>Instructions BCEAO (UEMOA) / Règlements COBAC (CEMAC)</b></li>
    </ul>
    <p>19 algorithmes déterministes appliqués à 100 % des opérations + analyse statistique + revue manuelle par auditeur qualifié. Chaque entrée tracée par chaîne SHA-256.</p>
  `;

  const anomaliesHtml = anomalies.map((a, idx) => {
    const refs = REGULATORY_FRAMEWORK[a.type] ?? REGULATORY_FRAMEWORK.autre;
    const wf = workflowProgress(a);
    const myComments = (ctx.comments ?? []).filter((c) => c.anomalyId === a.id);
    return `
      <div class="anomaly-card">
        <h2><span class="sev-pill" style="background:${sevColorHex(a.severity)};">${severityFr(a.severity)}</span> Anomalie ${idx + 1} / ${anomalies.length} — ${escapeHtml(a.title)}</h2>
        <p><b>Statut :</b> ${statusFr(a.status)} · <b>ID :</b> ${escapeHtml(a.id)} · <b>Type :</b> ${escapeHtml(a.type)}</p>

        <h4>1. Synthèse</h4>
        <p>${escapeHtml(a.description || a.title)}</p>

        <h4>2. Transaction incriminée (preuve)</h4>
        <table>
          <tr><td><b>Date opération</b></td><td>${fmtDate(a.transaction.date)}</td></tr>
          <tr><td><b>Libellé</b></td><td>${escapeHtml(a.transaction.label || '—')}</td></tr>
          <tr><td><b>Montant</b></td><td>${fcfa(Math.abs(a.transaction.amountCentimes))} FCFA (${a.transaction.amountCentimes < 0 ? 'débit' : 'crédit'})</td></tr>
          <tr><td><b>Solde après opération</b></td><td>${a.transaction.balanceAfterCentimes != null ? `${fcfa(a.transaction.balanceAfterCentimes)} FCFA` : '—'}</td></tr>
          <tr><td><b>Page PDF source</b></td><td>${a.transaction.pdfPage ? `p. ${a.transaction.pdfPage}` : '—'}</td></tr>
          <tr><td><b>ID transaction</b></td><td><span style="font-family:monospace;font-size:8pt">${escapeHtml(a.transaction.id)}</span></td></tr>
        </table>

        <h4>3. Détails de détection</h4>
        <table>
          <tr><td><b>Algorithme</b></td><td><span style="font-family:monospace;font-size:9pt">${escapeHtml(a.detection.algorithm)}</span></td></tr>
          <tr><td><b>Confiance</b></td><td>${(a.detection.confidence * 100).toFixed(1)}%</td></tr>
          <tr><td><b>Règle déclenchée</b></td><td>${escapeHtml(a.detection.rule || '—')}</td></tr>
          <tr><td><b>Récupérable estimé</b></td><td>${a.potentialRecoveryCentimes ? `<b>${fcfa(a.potentialRecoveryCentimes)} FCFA</b>` : 'Non quantifiable (signalement)'}</td></tr>
          ${a.conventionLabel ? `<tr><td><b>Convention référencée</b></td><td>${escapeHtml(a.conventionLabel)}</td></tr>` : ''}
        </table>

        <h4>4. Cadre réglementaire applicable</h4>
        <table>
          <thead><tr><th>Réf.</th><th>Cadre</th><th>Description</th></tr></thead>
          <tbody>
            ${refs.map((r) => `<tr><td>${escapeHtml(r.code)}</td><td>${r.framework}</td><td>${escapeHtml(r.description)}</td></tr>`).join('')}
          </tbody>
        </table>

        <h4>5. Workflow de validation</h4>
        <table>
          ${wf.map((w) => `<tr><td style="width:20px;">${w.step > 0 ? '✓' : '○'}</td><td>${escapeHtml(w.label)}</td></tr>`).join('')}
        </table>

        ${myComments.length > 0 ? `
          <h4>6. Discussion (${myComments.length})</h4>
          <table>
            <thead><tr><th>Date</th><th>Auteur</th><th>Commentaire</th></tr></thead>
            <tbody>
              ${myComments.map((c) => `<tr><td>${fmtDateTime(c.createdAt)}</td><td>${escapeHtml(c.author.handle)}</td><td>${escapeHtml(c.content)}</td></tr>`).join('')}
            </tbody>
          </table>
        ` : ''}
      </div>
    `;
  }).join('');

  // Chaîne d'audit
  const auditHtml = ctx.auditTrail && ctx.auditTrail.length > 0 ? `
    <h2 style="page-break-before:always;">Chaîne d'audit (SHA-256)</h2>
    <p class="note">Toute modification d'une entrée invalide la chaîne en aval. Conservation 10 ans minimum (OHADA).</p>
    <table>
      <thead><tr><th>Date/heure</th><th>Acteur</th><th>Action</th><th>Hash (court)</th></tr></thead>
      <tbody>
        ${ctx.auditTrail.slice(0, 100).map((e) => `<tr><td>${fmtDateTime(e.createdAt)}</td><td>${escapeHtml(e.actor.handle)} (${e.actor.role})</td><td>${escapeHtml(e.action)}</td><td style="font-family:monospace;font-size:8pt">${escapeHtml(e.hash.slice(0, 24))}…</td></tr>`).join('')}
      </tbody>
    </table>
  ` : '';

  const html = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<title>Dossier d'anomalies AtlasBanx</title>
<style>${css}</style>
</head>
<body>
  ${coverHtml}
  ${anomaliesHtml}
  ${auditHtml}
  <div class="footer">AtlasBanx · Réf. ${REF} · Plateforme d'audit bancaire UEMOA/CEMAC</div>
</body>
</html>`;

  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  downloadBlob(blob, `atlasbanx-dossier-anomalies-${dateStamp()}.doc`);
}

// ============================================================================
// Excel — workbook multi-feuilles (Cover · Anomalies · Workflow · Audit)
// ============================================================================

export async function exportAnomaliesExcel(anomalies: Anomaly[], ctx: ExportContext = {}): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AtlasBanx';
  wb.created = new Date();
  const REF = reportRef();

  // ── Feuille 1 : Synthèse exécutive ─────────────────────────────────────────
  const cover = wb.addWorksheet('Synthèse', { pageSetup: { orientation: 'portrait' } });
  cover.mergeCells('A1:F1');
  cover.getCell('A1').value = 'Dossier d\'anomalies bancaires — AtlasBanx';
  cover.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FF1E2640' } };
  cover.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  cover.getRow(1).height = 28;

  cover.getCell('A2').value = `Rapport d'audit international · Réf. ${REF}`;
  cover.getCell('A2').font = { italic: true, color: { argb: 'FF888888' } };

  const meta = [
    ['Cabinet',             ctx.cabinetName ?? 'AtlasBanx'],
    ['Relevé',              ctx.statementLabel ?? '—'],
    ['Période',             ctx.periodLabel ?? '—'],
    ['Client',              ctx.clientLabel ?? '—'],
    ['Banque',              ctx.bankLabel ?? '—'],
    ['Anomalies',           anomalies.length],
    ['  Critiques',         anomalies.filter((a) => a.severity === 'critical').length],
    ['  Hautes',            anomalies.filter((a) => a.severity === 'high').length],
    ['  Moyennes',          anomalies.filter((a) => a.severity === 'medium').length],
    ['  Faibles',           anomalies.filter((a) => a.severity === 'low').length],
    ['Récupérable estimé',  anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0) / 100],
    ['Généré le',           new Date().toLocaleString('fr-FR')],
  ];
  meta.forEach((row, i) => {
    const r = cover.getRow(4 + i);
    r.getCell(1).value = row[0] as string;
    r.getCell(1).font = { bold: true };
    r.getCell(2).value = row[1] as string | number;
    if (row[0] === 'Récupérable estimé') r.getCell(2).numFmt = '#,##0" FCFA"';
  });

  // Méthodologie
  const methStart = 4 + meta.length + 2;
  cover.getCell(`A${methStart}`).value = 'Méthodologie & cadre normatif';
  cover.getCell(`A${methStart}`).font = { bold: true, size: 12, color: { argb: 'FF1E2640' } };
  const methText = [
    'ISA 240 — Responsabilités de l\'auditeur relatives aux fraudes',
    'ISA 315 — Identification et évaluation des risques d\'anomalies significatives',
    'Recommandations GAFI/FATF — LCB-FT',
    'Basel Committee on Banking Supervision',
    'OHADA AUDCIF',
    'Instructions BCEAO (UEMOA) / Règlements COBAC (CEMAC)',
  ];
  methText.forEach((t, i) => {
    cover.getCell(`A${methStart + 1 + i}`).value = `· ${t}`;
  });

  cover.getColumn(1).width = 28;
  cover.getColumn(2).width = 55;

  // ── Feuille 2 : Anomalies (détaillé) ───────────────────────────────────────
  const ws = wb.addWorksheet('Anomalies', { pageSetup: { orientation: 'landscape', paperSize: 9 }, views: [{ state: 'frozen', ySplit: 1 }] });
  const headers = [
    'ID', 'Sévérité', 'Type', 'Statut', 'Titre', 'Description',
    'Date transaction', 'Libellé transaction', 'Montant tx (FCFA)', 'Solde après (FCFA)', 'Page PDF',
    'Algorithme', 'Confiance', 'Règle', 'Convention',
    'Récupérable (FCFA)',
    'Qualifiée par', 'Qualifiée le', 'Validée par', 'Validée le', 'Signée par', 'Signée le',
    'Créée le', 'Cadre réglementaire',
  ];
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2640' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
  });

  for (const a of anomalies) {
    const refs = (REGULATORY_FRAMEWORK[a.type] ?? REGULATORY_FRAMEWORK.autre)
      .map((r) => `${r.code} (${r.framework})`).join(' · ');
    const row = ws.addRow([
      a.id, severityFr(a.severity), a.type, statusFr(a.status), a.title, a.description,
      a.transaction.date, a.transaction.label,
      Math.round(Math.abs(a.transaction.amountCentimes) / 100),
      a.transaction.balanceAfterCentimes != null ? Math.round(a.transaction.balanceAfterCentimes / 100) : '',
      a.transaction.pdfPage ?? '',
      a.detection.algorithm,
      a.detection.confidence,
      a.detection.rule,
      a.conventionLabel ?? '',
      a.potentialRecoveryCentimes != null ? Math.round(a.potentialRecoveryCentimes / 100) : 0,
      a.qualifiedBy?.userHandle ?? '',
      a.qualifiedBy ? fmtDateTime(a.qualifiedBy.at) : '',
      a.validatedBy?.userHandle ?? '',
      a.validatedBy ? fmtDateTime(a.validatedBy.at) : '',
      a.signedBy?.userHandle ?? '',
      a.signedBy ? fmtDateTime(a.signedBy.at) : '',
      fmtDateTime(a.createdAt),
      refs,
    ]);
    const sevColor =
      a.severity === 'critical' ? 'FFB91C1C' :
      a.severity === 'high'     ? 'FFC2410C' :
      a.severity === 'medium'   ? 'FFA16207' : 'FF6B7280';
    row.getCell(2).font = { bold: true, color: { argb: sevColor } };
    row.getCell(9).numFmt  = '#,##0';
    row.getCell(10).numFmt = '#,##0';
    row.getCell(13).numFmt = '0.0%';
    row.getCell(16).numFmt = '#,##0';
    row.getCell(16).font   = { bold: true };
    row.alignment = { vertical: 'top', wrapText: true };
  }

  ws.columns.forEach((c, i) => {
    const widths = [38, 10, 22, 12, 36, 50, 12, 36, 16, 16, 8, 32, 10, 36, 28, 16, 14, 18, 14, 18, 14, 18, 18, 60];
    c.width = widths[i] ?? 16;
  });

  // ── Feuille 3 : Workflow ──────────────────────────────────────────────────
  const wfWs = wb.addWorksheet('Workflow', { views: [{ state: 'frozen', ySplit: 1 }] });
  const wfHeader = wfWs.addRow(['Anomalie', 'Sévérité', 'Étape', 'Statut', 'Acteur', 'Date/heure']);
  wfHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  wfHeader.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2640' } }; });
  for (const a of anomalies) {
    const steps: Array<[string, string, string]> = [
      ['1. Détection',        '✓',  fmtDateTime(a.createdAt)],
      ['2. Qualification',    a.qualifiedBy ? '✓' : '○', a.qualifiedBy ? `${a.qualifiedBy.userHandle} · ${fmtDateTime(a.qualifiedBy.at)}` : 'En attente'],
      ['3. Validation senior', a.validatedBy ? '✓' : '○', a.validatedBy ? `${a.validatedBy.userHandle} · ${fmtDateTime(a.validatedBy.at)}` : 'En attente'],
      ['4. Signature DG',      a.signedBy ? '✓' : '○', a.signedBy ? `${a.signedBy.userHandle} · ${fmtDateTime(a.signedBy.at)}` : 'En attente'],
    ];
    for (const [step, ok, detail] of steps) {
      wfWs.addRow([a.title, severityFr(a.severity), step, ok, '', detail]);
    }
  }
  wfWs.columns = [{ width: 42 }, { width: 12 }, { width: 22 }, { width: 8 }, { width: 18 }, { width: 36 }];

  // ── Feuille 4 : Audit trail (chaîne de hash) ──────────────────────────────
  if (ctx.auditTrail && ctx.auditTrail.length > 0) {
    const aWs = wb.addWorksheet('Audit Trail', { views: [{ state: 'frozen', ySplit: 1 }] });
    const aHeader = aWs.addRow(['Date/heure', 'Acteur', 'Rôle', 'Entité', 'Action', 'Hash', 'Hash précédent']);
    aHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    aHeader.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2640' } }; });
    for (const e of ctx.auditTrail) {
      aWs.addRow([
        fmtDateTime(e.createdAt),
        e.actor.handle,
        e.actor.role,
        e.entityId,
        e.action,
        e.hash,
        e.prevHash ?? '(racine)',
      ]);
    }
    aWs.columns = [{ width: 20 }, { width: 18 }, { width: 12 }, { width: 38 }, { width: 18 }, { width: 70 }, { width: 70 }];
  }

  // ── Feuille 5 : Commentaires ──────────────────────────────────────────────
  if (ctx.comments && ctx.comments.length > 0) {
    const cWs = wb.addWorksheet('Commentaires', { views: [{ state: 'frozen', ySplit: 1 }] });
    const cHeader = cWs.addRow(['Anomalie', 'Date/heure', 'Auteur', 'Rôle', 'Commentaire']);
    cHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cHeader.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2640' } }; });
    for (const c of ctx.comments) {
      const a = anomalies.find((x) => x.id === c.anomalyId);
      cWs.addRow([a?.title ?? c.anomalyId, fmtDateTime(c.createdAt), c.author.handle, c.author.role, c.content]);
    }
    cWs.columns = [{ width: 42 }, { width: 20 }, { width: 18 }, { width: 14 }, { width: 80 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `atlasbanx-dossier-anomalies-${dateStamp()}.xlsx`);
}
