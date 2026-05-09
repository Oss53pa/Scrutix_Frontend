// ============================================================================
// ATLASBANX — Premium audit report generator (jsPDF, vector, multi-section)
// ============================================================================
// Builds an international-quality PDF audit report with:
//   • Cover page  (gold/navy brand, watermark, audit metadata)
//   • Executive summary  (status banner + headline KPIs + per-severity bars)
//   • Findings overview  (severity & type breakdown via vector charts)
//   • Recommendations    (actionable items, sorted by impact)
//   • Anomaly detail cards  (one per anomaly, with evidence table)
//   • Methodology + glossary
//   • Integrity certificate (cryptographic, when reportId provided)
//   • Page footer with audit ID, page N/M, generation timestamp
//
// All output is vector / native PDF text — fully searchable, no rasterization.
// ============================================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Anomaly,
  AnalysisResult,
  ANOMALY_TYPE_LABELS,
  SEVERITY_LABELS,
  Severity,
} from '../types';
import { formatCurrency, formatDate } from '../utils';
import {
  auditLog,
  auditLogCritical,
  AuditEventType,
  generateIntegrityCertificate,
  formatCertificateForPdf,
} from './auditTrail';

// ───────────────────────────────────────────────────────────────────────────
// BRAND PALETTE — Ink Navy + Champagne Gold
// ───────────────────────────────────────────────────────────────────────────

const INK_950: [number, number, number] = [7, 11, 31];        // #070b1f — deepest
const INK_900: [number, number, number] = [16, 24, 48];       // #101830 — headers
const INK_700: [number, number, number] = [40, 52, 88];
const INK_500: [number, number, number] = [88, 100, 132];     // body
const INK_300: [number, number, number] = [168, 178, 200];
const INK_100: [number, number, number] = [228, 232, 240];

const GOLD_700: [number, number, number] = [156, 113, 53];    // accent darker
const GOLD_500: [number, number, number] = [201, 149, 74];    // brand
const GOLD_300: [number, number, number] = [222, 192, 120];   // pale
const GOLD_100: [number, number, number] = [248, 240, 220];   // wash

const CANVAS_50: [number, number, number] = [253, 251, 246];  // warm ivory
const WHITE: [number, number, number] = [255, 255, 255];

const SEV_CRITICAL: [number, number, number] = [185, 28, 28];   // red-700
const SEV_HIGH: [number, number, number] = [217, 119, 6];       // amber-600
const SEV_MEDIUM: [number, number, number] = [202, 138, 4];     // amber/yellow-600
const SEV_LOW: [number, number, number] = [21, 128, 61];        // green-700

function severityColor(s: Severity): [number, number, number] {
  if (s === Severity.CRITICAL) return SEV_CRITICAL;
  if (s === Severity.HIGH) return SEV_HIGH;
  if (s === Severity.MEDIUM) return SEV_MEDIUM;
  return SEV_LOW;
}

const SEVERITY_RANK: Record<Severity, number> = {
  [Severity.CRITICAL]: 0,
  [Severity.HIGH]: 1,
  [Severity.MEDIUM]: 2,
  [Severity.LOW]: 3,
};

// ───────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ───────────────────────────────────────────────────────────────────────────

export interface PremiumReportData {
  /** Title of the report */
  title: string;
  /** Client / audited entity name */
  clientName: string;
  /** Optional: cabinet (auditor firm) info, shown on cover and footer */
  cabinet?: {
    name: string;
    tagline?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
  /** Period audited */
  period: { start: Date; end: Date };
  /** Detected anomalies — sorted by severity for the overview */
  anomalies: Anomaly[];
  /** Aggregate statistics */
  statistics: AnalysisResult['statistics'];
  /** Synthesis: status, key findings, recommendations */
  summary: AnalysisResult['summary'];
  /** Mode of analysis (algorithm / ai / hybrid) — shown on cover */
  analysisMode?: string;
  /** Bank context — single bank or multi-bank */
  banks?: Array<{ name: string; code: string }>;
  /** Reference number / audit ID */
  auditId?: string;
}

export class PremiumReportService {
  /**
   * Generate the premium PDF and trigger a download.
   * When reportId is provided, the PDF includes a cryptographic integrity
   * certificate as the last page and emits a critical audit event.
   */
  static async download(
    data: PremiumReportData,
    filename?: string,
    reportId?: string,
  ): Promise<void> {
    const doc = await this.build(data, reportId);
    const safeName = data.clientName.replace(/\s+/g, '-').toLowerCase();
    const stamp = new Date().toISOString().slice(0, 10);
    const name = filename || `audit-atlasbanx-${safeName}-${stamp}.pdf`;
    doc.save(name);

    // Audit trail
    if (reportId) {
      try {
        await auditLogCritical({
          eventType: AuditEventType.REPORT_EXPORTED_PDF,
          resourceType: 'report',
          action: 'exported',
          resourceId: reportId,
          payload: {
            filename: name,
            anomalyCount: data.anomalies.length,
            totalAmount: data.statistics.totalAnomalyAmount,
            premium: true,
          },
        });
      } catch (err) {
        console.warn('[PremiumReportService] audit failed:', err);
      }
    } else {
      auditLog({
        eventType: AuditEventType.REPORT_EXPORTED_PDF,
        resourceType: 'report',
        action: 'exported',
        payload: { filename: name, anomalyCount: data.anomalies.length, premium: true },
      });
    }
  }

  /**
   * Build the document but don't trigger download.
   */
  static async build(data: PremiumReportData, reportId?: string): Promise<jsPDF> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const ctx = createCtx(doc, data);

    drawCover(ctx);
    drawExecutiveSummary(ctx);
    drawFindingsOverview(ctx);
    drawRecommendations(ctx);
    drawAnomalyDetails(ctx);
    drawMethodology(ctx);
    drawGlossary(ctx);

    if (reportId) {
      try {
        const certificate = await generateIntegrityCertificate(reportId);
        const certText = formatCertificateForPdf(certificate);
        drawIntegrityCertificate(ctx, certText);
      } catch (err) {
        console.warn('[PremiumReportService] certificate generation failed:', err);
      }
    }

    paginateFooters(ctx);
    return doc;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// DRAWING CONTEXT
// ───────────────────────────────────────────────────────────────────────────

interface DrawCtx {
  doc: jsPDF;
  data: PremiumReportData;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
}

function createCtx(doc: jsPDF, data: PremiumReportData): DrawCtx {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18; // mm
  return { doc, data, pageWidth, pageHeight, margin, contentWidth: pageWidth - 2 * margin };
}

// ───────────────────────────────────────────────────────────────────────────
// COVER PAGE
// ───────────────────────────────────────────────────────────────────────────

function drawCover(ctx: DrawCtx): void {
  const { doc, data, pageWidth, pageHeight } = ctx;

  // Full-page ink background
  setFill(doc, INK_950);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Champagne gold accent stripe (top-left to bottom-right diagonal vibe via two rects)
  setFill(doc, GOLD_700);
  doc.rect(0, 0, 8, pageHeight, 'F');
  setFill(doc, GOLD_500);
  doc.rect(8, 0, 2, pageHeight, 'F');

  // Top brand block
  setFont(doc, 'GrandHotel', 56);
  setColor(doc, GOLD_500);
  doc.text('AtlasBanx', 24, 50);

  setFont(doc, 'Inter', 9, 'normal');
  setColor(doc, GOLD_300);
  doc.text('AUDIT BANCAIRE — INTELLIGENCE TARIFAIRE', 24, 58, { charSpace: 1.2 });

  // Subtle horizontal hairline
  setDraw(doc, GOLD_500);
  doc.setLineWidth(0.3);
  doc.line(24, 64, pageWidth - 24, 64);

  // Title block, vertically centered-ish
  const titleY = pageHeight / 2 - 30;

  setFont(doc, 'Inter', 11, 'normal');
  setColor(doc, GOLD_300);
  doc.text('RAPPORT D’AUDIT', 24, titleY, { charSpace: 2.5 });

  setFont(doc, 'Inter', 28, 'bold');
  setColor(doc, WHITE);
  const titleLines = doc.splitTextToSize(data.title, pageWidth - 48);
  doc.text(titleLines, 24, titleY + 12);

  // Client + period card
  const cardY = pageHeight - 110;
  setFill(doc, INK_900);
  doc.rect(0, cardY, pageWidth, 60, 'F');
  setFill(doc, GOLD_500);
  doc.rect(0, cardY, 4, 60, 'F');

  setFont(doc, 'Inter', 8, 'normal');
  setColor(doc, GOLD_300);
  doc.text('CLIENT AUDITÉ', 24, cardY + 10, { charSpace: 1.5 });

  setFont(doc, 'Inter', 18, 'bold');
  setColor(doc, WHITE);
  doc.text(data.clientName, 24, cardY + 20);

  // Period
  setFont(doc, 'Inter', 8, 'normal');
  setColor(doc, GOLD_300);
  doc.text('PÉRIODE', 24, cardY + 32, { charSpace: 1.5 });

  setFont(doc, 'Inter', 11, 'normal');
  setColor(doc, INK_100);
  doc.text(`Du ${formatDate(data.period.start)} au ${formatDate(data.period.end)}`, 24, cardY + 40);

  // Right column — banks, mode, audit id
  const rightX = pageWidth / 2 + 8;

  setFont(doc, 'Inter', 8, 'normal');
  setColor(doc, GOLD_300);
  doc.text('PÉRIMÈTRE', rightX, cardY + 10, { charSpace: 1.5 });

  setFont(doc, 'Inter', 11, 'normal');
  setColor(doc, INK_100);
  const banksLine = data.banks && data.banks.length > 0
    ? data.banks.map((b) => b.name).slice(0, 3).join(', ')
        + (data.banks.length > 3 ? ` +${data.banks.length - 3}` : '')
    : 'Toutes banques';
  doc.text(doc.splitTextToSize(banksLine, pageWidth / 2 - 32), rightX, cardY + 20);

  setFont(doc, 'Inter', 8, 'normal');
  setColor(doc, GOLD_300);
  doc.text('MOTEUR D’ANALYSE', rightX, cardY + 32, { charSpace: 1.5 });

  setFont(doc, 'Inter', 11, 'normal');
  setColor(doc, INK_100);
  const modeLabel = data.analysisMode === 'ai'
    ? 'IA Claude'
    : data.analysisMode === 'algorithm'
      ? 'Algorithmique'
      : 'Hybride (IA + algorithmes)';
  doc.text(modeLabel, rightX, cardY + 40);

  // Footer band of cover
  const footY = pageHeight - 28;
  setFill(doc, INK_950);
  doc.rect(0, footY, pageWidth, 28, 'F');

  setFont(doc, 'Inter', 7, 'normal');
  setColor(doc, INK_300);
  doc.text(
    data.cabinet?.name
      ? `Préparé par ${data.cabinet.name}${data.cabinet.tagline ? ` — ${data.cabinet.tagline}` : ''}`
      : 'Préparé par AtlasBanx',
    24,
    footY + 10,
  );
  if (data.auditId) {
    doc.text(`RÉFÉRENCE : ${data.auditId.toUpperCase()}`, 24, footY + 16, { charSpace: 0.5 });
  }
  doc.text(`Émis le ${new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`, 24, footY + 22);

  setColor(doc, GOLD_500);
  doc.text('CONFIDENTIEL', pageWidth - 24, footY + 22, { align: 'right', charSpace: 1.5 });
}

// ───────────────────────────────────────────────────────────────────────────
// EXECUTIVE SUMMARY
// ───────────────────────────────────────────────────────────────────────────

function drawExecutiveSummary(ctx: DrawCtx): void {
  const { doc, data } = ctx;
  doc.addPage();
  drawPageHeader(ctx, 'Synthèse exécutive');

  const stats = data.statistics;
  const total = data.anomalies.length;
  const status = data.summary?.status ?? (total === 0 ? 'OK' : 'WARNING');
  const statusColor =
    status === 'CRITICAL' ? SEV_CRITICAL
    : status === 'WARNING' ? SEV_HIGH
    : SEV_LOW;

  let y = 48;

  // Status banner
  setFill(doc, statusColor);
  doc.rect(ctx.margin, y, ctx.contentWidth, 18, 'F');
  setFont(doc, 'Inter', 9, 'normal');
  setColor(doc, WHITE);
  doc.text('STATUT GLOBAL', ctx.margin + 5, y + 7, { charSpace: 2 });
  setFont(doc, 'Inter', 14, 'bold');
  doc.text(
    status === 'OK' ? 'Conforme — aucune anomalie critique'
      : status === 'WARNING' ? 'Vigilance recommandée'
      : 'Action immédiate requise',
    ctx.margin + 5, y + 14,
  );
  y += 26;

  // KPI tiles row
  const kpis: Array<{ label: string; value: string; tone: [number, number, number] }> = [
    { label: 'Anomalies détectées', value: total.toLocaleString('fr-FR'), tone: INK_900 },
    {
      label: 'Économies potentielles',
      value: formatCurrency(stats.totalAnomalyAmount ?? stats.potentialSavings ?? 0, 'XAF'),
      tone: GOLD_700,
    },
    {
      label: 'Taux d’anomalie',
      value: `${(stats.anomalyRate ?? 0).toFixed(1)}%`,
      tone: INK_700,
    },
    {
      label: 'Transactions analysées',
      value: (stats.totalTransactions ?? 0).toLocaleString('fr-FR'),
      tone: INK_700,
    },
  ];

  const tileWidth = (ctx.contentWidth - 6 * 3) / 4;
  const tileHeight = 28;
  kpis.forEach((kpi, i) => {
    const x = ctx.margin + i * (tileWidth + 6);
    setFill(doc, CANVAS_50);
    doc.roundedRect(x, y, tileWidth, tileHeight, 1.5, 1.5, 'F');
    setDraw(doc, INK_100);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, tileWidth, tileHeight, 1.5, 1.5, 'S');
    setFill(doc, kpi.tone);
    doc.rect(x, y, 1.6, tileHeight, 'F');

    setFont(doc, 'Inter', 7, 'normal');
    setColor(doc, INK_500);
    doc.text(kpi.label.toUpperCase(), x + 5, y + 8, { charSpace: 0.7 });

    setFont(doc, 'Inter', 14, 'bold');
    setColor(doc, INK_900);
    doc.text(kpi.value, x + 5, y + 20);
  });
  y += tileHeight + 10;

  // Severity distribution mini-bars
  setFont(doc, 'Inter', 11, 'bold');
  setColor(doc, INK_900);
  doc.text('Répartition par sévérité', ctx.margin, y);
  y += 6;

  const severities: Severity[] = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW];
  const maxSev = Math.max(1, ...severities.map((s) => stats.anomaliesBySeverity?.[s] ?? 0));
  severities.forEach((sev) => {
    const count = stats.anomaliesBySeverity?.[sev] ?? 0;
    const ratio = count / maxSev;
    const barX = ctx.margin + 36;
    const barWidth = ctx.contentWidth - 36 - 18;
    const barY = y + 1;

    setFont(doc, 'Inter', 8, 'normal');
    setColor(doc, INK_700);
    doc.text(SEVERITY_LABELS[sev], ctx.margin, barY + 4);

    setFill(doc, INK_100);
    doc.roundedRect(barX, barY, barWidth, 5, 0.8, 0.8, 'F');
    if (count > 0) {
      setFill(doc, severityColor(sev));
      doc.roundedRect(barX, barY, Math.max(0.8, barWidth * ratio), 5, 0.8, 0.8, 'F');
    }

    setFont(doc, 'Inter', 8, 'bold');
    setColor(doc, INK_900);
    doc.text(String(count), barX + barWidth + 3, barY + 4);
    y += 8;
  });
  y += 6;

  // Headline narrative
  setFont(doc, 'Inter', 11, 'bold');
  setColor(doc, INK_900);
  doc.text('Conclusion de l’auditeur', ctx.margin, y);
  y += 6;
  setFont(doc, 'Inter', 10, 'normal');
  setColor(doc, INK_700);
  const summaryText = data.summary?.message
    ?? `${total} anomalie${total > 1 ? 's' : ''} ${total > 1 ? 'ont' : 'a'} été détectée${total > 1 ? 's' : ''} sur la période. Le détail figure dans les sections suivantes.`;
  const lines = doc.splitTextToSize(summaryText, ctx.contentWidth);
  doc.text(lines, ctx.margin, y);
  y += lines.length * 4.5 + 4;

  // Key findings
  if (data.summary?.keyFindings && data.summary.keyFindings.length > 0) {
    setFont(doc, 'Inter', 11, 'bold');
    setColor(doc, INK_900);
    doc.text('Faits saillants', ctx.margin, y);
    y += 6;
    setFont(doc, 'Inter', 10, 'normal');
    setColor(doc, INK_700);
    data.summary.keyFindings.slice(0, 6).forEach((f) => {
      const flines = doc.splitTextToSize(`•  ${f}`, ctx.contentWidth - 4);
      doc.text(flines, ctx.margin + 2, y);
      y += flines.length * 4.5 + 2;
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// FINDINGS OVERVIEW (charts)
// ───────────────────────────────────────────────────────────────────────────

function drawFindingsOverview(ctx: DrawCtx): void {
  const { doc, data } = ctx;
  doc.addPage();
  drawPageHeader(ctx, 'Cartographie des anomalies');

  let y = 48;

  // ─── Donut by severity ──
  const severities: Severity[] = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW];
  const sevCounts = severities.map((s) => data.statistics.anomaliesBySeverity?.[s] ?? 0);
  const sevTotal = sevCounts.reduce((a, b) => a + b, 0);

  setFont(doc, 'Inter', 11, 'bold');
  setColor(doc, INK_900);
  doc.text('Distribution par sévérité', ctx.margin, y);
  y += 8;

  const donutCenterX = ctx.margin + 28;
  const donutCenterY = y + 28;
  drawDonut(doc, donutCenterX, donutCenterY, 22, 14, sevCounts.map((c, i) => ({
    value: c,
    color: severityColor(severities[i]),
  })));

  // Donut center label
  setFont(doc, 'Inter', 8, 'normal');
  setColor(doc, INK_500);
  doc.text('TOTAL', donutCenterX, donutCenterY - 1, { align: 'center', charSpace: 1 });
  setFont(doc, 'Inter', 14, 'bold');
  setColor(doc, INK_900);
  doc.text(String(sevTotal), donutCenterX, donutCenterY + 5, { align: 'center' });

  // Legend
  const legendX = donutCenterX + 30;
  let legendY = y + 6;
  severities.forEach((s, i) => {
    const c = sevCounts[i];
    const pct = sevTotal === 0 ? 0 : (c / sevTotal) * 100;
    setFill(doc, severityColor(s));
    doc.roundedRect(legendX, legendY, 4, 4, 0.5, 0.5, 'F');
    setFont(doc, 'Inter', 9, 'normal');
    setColor(doc, INK_700);
    doc.text(SEVERITY_LABELS[s], legendX + 7, legendY + 3.4);
    setFont(doc, 'Inter', 9, 'bold');
    setColor(doc, INK_900);
    doc.text(`${c} (${pct.toFixed(0)}%)`, legendX + 50, legendY + 3.4);
    legendY += 8;
  });

  y += 70;

  // ─── Top types bar chart ──
  setFont(doc, 'Inter', 11, 'bold');
  setColor(doc, INK_900);
  doc.text('Top des types d’anomalies', ctx.margin, y);
  y += 8;

  const byType = data.statistics.anomaliesByType ?? {};
  const typeEntries = Object.entries(byType)
    .filter(([, c]) => c > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  if (typeEntries.length === 0) {
    setFont(doc, 'Inter', 10, 'italic');
    setColor(doc, INK_500);
    doc.text('Aucune anomalie détectée — rien à afficher.', ctx.margin, y);
  } else {
    const barMax = Math.max(...typeEntries.map(([, c]) => c));
    const labelW = 60;
    const chartX = ctx.margin + labelW;
    const chartW = ctx.contentWidth - labelW - 16;
    typeEntries.forEach(([typ, count]) => {
      const ratio = count / barMax;
      setFont(doc, 'Inter', 8, 'normal');
      setColor(doc, INK_700);
      const label = ANOMALY_TYPE_LABELS[typ as keyof typeof ANOMALY_TYPE_LABELS] ?? typ;
      doc.text(doc.splitTextToSize(label, labelW - 2), ctx.margin, y + 3.5);

      setFill(doc, INK_100);
      doc.roundedRect(chartX, y + 1, chartW, 5, 0.8, 0.8, 'F');
      setFill(doc, GOLD_500);
      doc.roundedRect(chartX, y + 1, Math.max(1, chartW * ratio), 5, 0.8, 0.8, 'F');

      setFont(doc, 'Inter', 8, 'bold');
      setColor(doc, INK_900);
      doc.text(String(count), chartX + chartW + 3, y + 5);
      y += 9;
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// RECOMMENDATIONS
// ───────────────────────────────────────────────────────────────────────────

function drawRecommendations(ctx: DrawCtx): void {
  const { doc, data } = ctx;
  doc.addPage();
  drawPageHeader(ctx, 'Recommandations prioritaires');

  let y = 48;

  // Top recommendations: highest severity × amount, deduplicated
  const ranked = [...data.anomalies]
    .filter((a) => a.recommendation && a.recommendation.trim().length > 0)
    .sort((a, b) => {
      const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (sev !== 0) return sev;
      return b.amount - a.amount;
    })
    .slice(0, 8);

  if (ranked.length === 0) {
    setFont(doc, 'Inter', 11, 'italic');
    setColor(doc, INK_500);
    doc.text('Aucune recommandation — la gestion tarifaire est conforme.', ctx.margin, y);
    return;
  }

  ranked.forEach((a, idx) => {
    if (y > ctx.pageHeight - 40) {
      doc.addPage();
      drawPageHeader(ctx, 'Recommandations prioritaires (suite)');
      y = 48;
    }

    const cardX = ctx.margin;
    const cardW = ctx.contentWidth;
    const padding = 6;

    // Estimate height
    setFont(doc, 'Inter', 10, 'normal');
    const recoLines = doc.splitTextToSize(a.recommendation, cardW - 2 * padding);
    const cardH = 28 + recoLines.length * 4.5;

    // Card background
    setFill(doc, CANVAS_50);
    doc.roundedRect(cardX, y, cardW, cardH, 2, 2, 'F');
    setFill(doc, severityColor(a.severity));
    doc.rect(cardX, y, 2, cardH, 'F');

    // Number badge
    setFill(doc, INK_900);
    doc.roundedRect(cardX + padding, y + padding, 9, 9, 1, 1, 'F');
    setFont(doc, 'Inter', 9, 'bold');
    setColor(doc, GOLD_300);
    doc.text(String(idx + 1).padStart(2, '0'), cardX + padding + 4.5, y + padding + 6, { align: 'center' });

    // Title row
    setFont(doc, 'Inter', 11, 'bold');
    setColor(doc, INK_900);
    doc.text(
      ANOMALY_TYPE_LABELS[a.type] ?? a.type,
      cardX + padding + 13,
      y + padding + 6,
    );

    // Severity + amount badges
    const sevTextX = cardX + cardW - padding - 2;
    setFont(doc, 'Inter', 7, 'bold');
    setColor(doc, severityColor(a.severity));
    doc.text(SEVERITY_LABELS[a.severity].toUpperCase(), sevTextX, y + padding + 4, { align: 'right', charSpace: 1 });

    setFont(doc, 'Inter', 9, 'bold');
    setColor(doc, INK_900);
    doc.text(formatCurrency(a.amount, 'XAF'), sevTextX, y + padding + 10, { align: 'right' });

    // Recommendation body
    setFont(doc, 'Inter', 9, 'normal');
    setColor(doc, INK_700);
    doc.text(recoLines, cardX + padding, y + padding + 18);

    y += cardH + 4;
  });
}

// ───────────────────────────────────────────────────────────────────────────
// ANOMALY DETAIL CARDS
// ───────────────────────────────────────────────────────────────────────────

function drawAnomalyDetails(ctx: DrawCtx): void {
  const { doc, data } = ctx;

  // Section opener
  doc.addPage();
  drawPageHeader(ctx, 'Détail des anomalies');
  let y = 48;

  setFont(doc, 'Inter', 10, 'normal');
  setColor(doc, INK_700);
  const intro = `Cette section présente une analyse détaillée de chacune des ${data.anomalies.length} anomalies détectées, classée par sévérité décroissante. Pour chaque cas, vous trouverez les preuves matérielles (références tarifaires, comparaison contractuelle), les transactions concernées, et le niveau de confiance algorithmique.`;
  doc.text(doc.splitTextToSize(intro, ctx.contentWidth), ctx.margin, y);
  y += 18;

  if (data.anomalies.length === 0) {
    setFont(doc, 'Inter', 11, 'italic');
    setColor(doc, INK_500);
    doc.text('Aucune anomalie à détailler.', ctx.margin, y);
    return;
  }

  const sorted = [...data.anomalies].sort((a, b) => {
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    return b.amount - a.amount;
  });

  sorted.forEach((a, i) => {
    drawAnomalyCard(ctx, a, i + 1);
  });
}

function drawAnomalyCard(ctx: DrawCtx, a: Anomaly, index: number): void {
  const { doc } = ctx;
  doc.addPage();
  drawPageHeader(ctx, `Anomalie #${String(index).padStart(3, '0')}`);

  let y = 48;

  // Top banner: severity + type + amount
  const bannerH = 22;
  setFill(doc, INK_900);
  doc.rect(ctx.margin, y, ctx.contentWidth, bannerH, 'F');
  setFill(doc, severityColor(a.severity));
  doc.rect(ctx.margin, y, 3, bannerH, 'F');

  setFont(doc, 'Inter', 8, 'normal');
  setColor(doc, GOLD_300);
  doc.text('TYPE D’ANOMALIE', ctx.margin + 8, y + 7, { charSpace: 1.5 });

  setFont(doc, 'Inter', 14, 'bold');
  setColor(doc, WHITE);
  doc.text(ANOMALY_TYPE_LABELS[a.type] ?? a.type, ctx.margin + 8, y + 16);

  // Right: amount
  setFont(doc, 'Inter', 8, 'normal');
  setColor(doc, GOLD_300);
  doc.text(
    'IMPACT FINANCIER',
    ctx.pageWidth - ctx.margin - 8,
    y + 7,
    { align: 'right', charSpace: 1.5 },
  );
  setFont(doc, 'Inter', 14, 'bold');
  setColor(doc, WHITE);
  doc.text(
    formatCurrency(a.amount, 'XAF'),
    ctx.pageWidth - ctx.margin - 8,
    y + 16,
    { align: 'right' },
  );
  y += bannerH + 8;

  // Severity + status + confidence row
  setFont(doc, 'Inter', 9, 'normal');
  setColor(doc, INK_700);
  const metaItems = [
    { l: 'Sévérité', v: SEVERITY_LABELS[a.severity], color: severityColor(a.severity) },
    { l: 'Statut', v: statusLabel(a.status) },
    { l: 'Confiance', v: `${Math.round(a.confidence * 100)}%` },
    { l: 'Détecté le', v: formatDate(a.detectedAt) },
  ];
  const metaCol = ctx.contentWidth / metaItems.length;
  metaItems.forEach((m, i) => {
    const x = ctx.margin + i * metaCol;
    setFont(doc, 'Inter', 7, 'normal');
    setColor(doc, INK_500);
    doc.text(m.l.toUpperCase(), x, y, { charSpace: 1 });
    setFont(doc, 'Inter', 11, 'bold');
    setColor(doc, m.color ?? INK_900);
    doc.text(String(m.v), x, y + 6);
  });
  y += 18;

  // Recommendation block
  setFill(doc, GOLD_100);
  setDraw(doc, GOLD_300);
  doc.setLineWidth(0.2);
  setFont(doc, 'Inter', 10, 'normal');
  const recoLines = doc.splitTextToSize(a.recommendation || '—', ctx.contentWidth - 14);
  const recoH = 14 + recoLines.length * 4.5;
  doc.roundedRect(ctx.margin, y, ctx.contentWidth, recoH, 1.5, 1.5, 'FD');

  setFont(doc, 'Inter', 8, 'bold');
  setColor(doc, GOLD_700);
  doc.text('RECOMMANDATION', ctx.margin + 6, y + 8, { charSpace: 1.5 });

  setFont(doc, 'Inter', 10, 'normal');
  setColor(doc, INK_900);
  doc.text(recoLines, ctx.margin + 6, y + 14);
  y += recoH + 8;

  // Evidence table
  if (a.evidence && a.evidence.length > 0) {
    setFont(doc, 'Inter', 11, 'bold');
    setColor(doc, INK_900);
    doc.text('Preuves matérielles', ctx.margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: ctx.margin, right: ctx.margin },
      head: [['Type', 'Description', 'Valeur', 'Référence']],
      body: a.evidence.slice(0, 8).map((e) => [
        e.type ?? '—',
        e.description ?? '—',
        e.expectedValue !== undefined && e.appliedValue !== undefined
          ? `Attendu: ${e.expectedValue}\nFacturé: ${e.appliedValue}`
          : String(e.value ?? '—'),
        [e.source, e.conditionRef].filter(Boolean).join('\n') || '—',
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2,
        textColor: INK_700,
        lineColor: INK_100,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: INK_900,
        textColor: GOLD_300,
        fontSize: 8,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: CANVAS_50 },
      columnStyles: {
        0: { cellWidth: 26, fontStyle: 'bold' },
        1: { cellWidth: 60 },
        2: { cellWidth: 38 },
        3: { cellWidth: 50, textColor: INK_500 },
      },
    });
    // @ts-expect-error jspdf-autotable adds lastAutoTable
    y = (doc.lastAutoTable?.finalY ?? y) + 8;
  }

  // Transactions table
  if (a.transactions && a.transactions.length > 0) {
    if (y > ctx.pageHeight - 40) {
      doc.addPage();
      drawPageHeader(ctx, `Anomalie #${String(index).padStart(3, '0')} (suite)`);
      y = 48;
    }
    setFont(doc, 'Inter', 11, 'bold');
    setColor(doc, INK_900);
    doc.text('Transactions concernées', ctx.margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: ctx.margin, right: ctx.margin },
      head: [['Date', 'Libellé', 'Montant', 'Solde']],
      body: a.transactions.slice(0, 12).map((t) => [
        formatDate(t.date as unknown as Date),
        t.description ?? '—',
        formatCurrency(t.amount, 'XAF'),
        formatCurrency(t.balance ?? 0, 'XAF'),
      ]),
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2,
        textColor: INK_700,
        lineColor: INK_100,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: INK_700,
        textColor: GOLD_300,
        fontSize: 8,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: CANVAS_50 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 90 },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 32, halign: 'right' },
      },
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// METHODOLOGY + GLOSSARY + CERTIFICATE
// ───────────────────────────────────────────────────────────────────────────

function drawMethodology(ctx: DrawCtx): void {
  const { doc } = ctx;
  doc.addPage();
  drawPageHeader(ctx, 'Méthodologie');

  let y = 48;
  const sections = [
    {
      title: 'Source des données',
      body: 'Les transactions sont importées directement depuis les relevés bancaires (PDF, CSV, Excel) du client. L’extraction est position-aware, multi-banques, sans gabarit fixe : les colonnes sont détectées dynamiquement à partir de l’entête du tableau.',
    },
    {
      title: 'Référentiel tarifaire',
      body: 'Chaque écriture est confrontée à la grille tarifaire active de la banque, telle que publiée par l’établissement et stockée dans le coffre AtlasBanx. La grille fait foi pour la détection des écarts.',
    },
    {
      title: 'Détection algorithmique',
      body: 'Quatre familles de détecteurs indépendants : doublons (frais facturés deux fois), frais fantômes (sans correspondance tarifaire), surfacturation (dépassement du tarif contractuel), erreurs de calcul (agios, dates de valeur, commissions de mouvement). Chaque détecteur produit une preuve matérielle référencée.',
    },
    {
      title: 'Analyse IA (mode hybride)',
      body: 'Lorsque le mode hybride est activé, un large language model (Claude 3.5) catégorise les écritures ambiguës et identifie les patterns de fraude non couverts par les détecteurs déterministes. Les conclusions IA sont systématiquement confirmées par une preuve documentaire.',
    },
    {
      title: 'Niveau de confiance',
      body: 'Chaque anomalie porte un score 0-100% reflétant la robustesse de la détection (qualité du parsing, force du match tarifaire, recoupement IA + algo). En-deçà de 65%, l’auditeur humain est sollicité pour validation.',
    },
    {
      title: 'Cadre légal',
      body: 'Le présent rapport s’appuie sur le règlement n°02/CEMAC/UMAC/COBAC relatif aux conditions générales de banque et sur les directives BCEAO 02/PR/2010 (UEMOA). Les références tarifaires citées sont opposables aux établissements concernés.',
    },
  ];

  sections.forEach((s) => {
    if (y > ctx.pageHeight - 40) {
      doc.addPage();
      drawPageHeader(ctx, 'Méthodologie (suite)');
      y = 48;
    }
    setFont(doc, 'Inter', 11, 'bold');
    setColor(doc, INK_900);
    doc.text(s.title, ctx.margin, y);
    y += 5;

    setFont(doc, 'Inter', 10, 'normal');
    setColor(doc, INK_700);
    const lines = doc.splitTextToSize(s.body, ctx.contentWidth);
    doc.text(lines, ctx.margin, y);
    y += lines.length * 4.6 + 6;
  });
}

function drawGlossary(ctx: DrawCtx): void {
  const { doc } = ctx;
  doc.addPage();
  drawPageHeader(ctx, 'Glossaire');

  const terms: Array<[string, string]> = [
    ['Agios', 'Intérêts débiteurs facturés sur un solde négatif. Calculés selon la méthode des nombres × taux × jours / 360.'],
    ['Date de valeur', 'Date à laquelle l’opération produit ses effets sur le solde porteur d’intérêts. Une date de valeur défavorable génère un coût caché.'],
    ['Doublon', 'Frais facturé deux ou plusieurs fois pour la même opération sous-jacente.'],
    ['Frais fantôme', 'Prélèvement sans contrepartie identifiable dans la grille tarifaire ou les opérations du compte.'],
    ['Surfacturation', 'Application d’un montant supérieur à celui prévu par la grille tarifaire active.'],
    ['CEMAC', 'Communauté Économique et Monétaire de l’Afrique Centrale (XAF).'],
    ['UEMOA', 'Union Économique et Monétaire Ouest-Africaine (XOF).'],
    ['COBAC', 'Commission Bancaire de l’Afrique Centrale.'],
    ['BCEAO', 'Banque Centrale des États de l’Afrique de l’Ouest.'],
    ['CGB', 'Conditions Générales de Banque — référentiel publié par chaque établissement.'],
  ];

  let y = 48;
  terms.forEach(([term, def]) => {
    if (y > ctx.pageHeight - 25) return;
    setFont(doc, 'Inter', 10, 'bold');
    setColor(doc, INK_900);
    doc.text(term, ctx.margin, y);
    setFont(doc, 'Inter', 10, 'normal');
    setColor(doc, INK_700);
    const lines = doc.splitTextToSize(def, ctx.contentWidth - 36);
    doc.text(lines, ctx.margin + 36, y);
    y += Math.max(5, lines.length * 4.5) + 3;
  });
}

function drawIntegrityCertificate(ctx: DrawCtx, certText: string): void {
  const { doc } = ctx;
  doc.addPage();
  drawPageHeader(ctx, 'Certificat d’intégrité');

  let y = 48;

  setFont(doc, 'Inter', 10, 'normal');
  setColor(doc, INK_700);
  const intro = 'Ce document est cryptographiquement scellé. La signature SHA-256 ci-dessous garantit que le contenu n’a pas été altéré après émission. Toute modification ultérieure invalidera la signature. Les évènements d’export sont enregistrés dans le journal d’audit.';
  doc.text(doc.splitTextToSize(intro, ctx.contentWidth), ctx.margin, y);
  y += 18;

  // Certificate box
  setFill(doc, INK_950);
  doc.roundedRect(ctx.margin, y, ctx.contentWidth, 80, 2, 2, 'F');
  setFill(doc, GOLD_500);
  doc.rect(ctx.margin, y, 2, 80, 'F');

  setFont(doc, 'courier', 9, 'normal');
  setColor(doc, GOLD_300);
  const certLines = certText.split('\n').slice(0, 18);
  doc.text(certLines, ctx.margin + 6, y + 8);
}

// ───────────────────────────────────────────────────────────────────────────
// LAYOUT HELPERS — header, footer, paginate
// ───────────────────────────────────────────────────────────────────────────

function drawPageHeader(ctx: DrawCtx, title: string): void {
  const { doc, pageWidth } = ctx;

  // Top brand bar
  setFill(doc, INK_900);
  doc.rect(0, 0, pageWidth, 22, 'F');
  setFill(doc, GOLD_500);
  doc.rect(0, 22, pageWidth, 1.2, 'F');

  setFont(doc, 'GrandHotel', 18);
  setColor(doc, GOLD_300);
  doc.text('AtlasBanx', ctx.margin, 14);

  setFont(doc, 'Inter', 8, 'normal');
  setColor(doc, GOLD_300);
  doc.text(title.toUpperCase(), pageWidth - ctx.margin, 14, { align: 'right', charSpace: 2 });

  setFont(doc, 'Inter', 14, 'bold');
  setColor(doc, INK_900);
  doc.text(title, ctx.margin, 38);
}

function paginateFooters(ctx: DrawCtx): void {
  const { doc, data, pageWidth, pageHeight } = ctx;
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (p === 1) continue; // cover stays clean

    setDraw(doc, INK_100);
    doc.setLineWidth(0.2);
    doc.line(ctx.margin, pageHeight - 14, pageWidth - ctx.margin, pageHeight - 14);

    setFont(doc, 'Inter', 7, 'normal');
    setColor(doc, INK_500);

    // Left: cabinet / generated
    doc.text(
      data.cabinet?.name
        ? `${data.cabinet.name} · ${data.cabinet.email ?? ''}`.replace(/\s+·\s+$/, '')
        : 'AtlasBanx · audit@atlasbanx.com',
      ctx.margin,
      pageHeight - 8,
    );

    // Center: audit ID
    if (data.auditId) {
      doc.text(
        `Réf. ${data.auditId}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' },
      );
    }

    // Right: page count
    doc.text(`${p} / ${total}`, pageWidth - ctx.margin, pageHeight - 8, { align: 'right' });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// LOW-LEVEL VECTOR HELPERS
// ───────────────────────────────────────────────────────────────────────────

function setFill(doc: jsPDF, [r, g, b]: [number, number, number]): void {
  doc.setFillColor(r, g, b);
}
function setDraw(doc: jsPDF, [r, g, b]: [number, number, number]): void {
  doc.setDrawColor(r, g, b);
}
function setColor(doc: jsPDF, [r, g, b]: [number, number, number]): void {
  doc.setTextColor(r, g, b);
}

/** jsPDF doesn't ship Inter / GrandHotel out of the box. We map our brand
 *  tokens to the closest core fonts: helvetica for Inter, times for
 *  GrandHotel (the cover wordmark). Fallback is graceful. */
function setFont(doc: jsPDF, family: 'Inter' | 'GrandHotel' | 'courier', size: number, weight: 'normal' | 'bold' | 'italic' = 'normal'): void {
  let realFamily = 'helvetica';
  let realStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = weight;
  if (family === 'courier') {
    realFamily = 'courier';
  } else if (family === 'GrandHotel') {
    realFamily = 'times';
    realStyle = 'italic'; // approximation of the script wordmark
  }
  try {
    doc.setFont(realFamily, realStyle);
  } catch {
    doc.setFont('helvetica', weight);
  }
  doc.setFontSize(size);
}

/** Vector donut chart. Approximates each ring slice with quadratic Bezier
 *  segments. No raster, scales perfectly. */
function drawDonut(
  doc: jsPDF,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  slices: Array<{ value: number; color: [number, number, number] }>,
): void {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    setFill(doc, INK_100);
    drawAnnulus(doc, cx, cy, outerR, innerR, 0, Math.PI * 2);
    return;
  }
  let acc = -Math.PI / 2; // start at top
  for (const sl of slices) {
    if (sl.value <= 0) continue;
    const angle = (sl.value / total) * Math.PI * 2;
    setFill(doc, sl.color);
    drawAnnulus(doc, cx, cy, outerR, innerR, acc, acc + angle);
    acc += angle;
  }
}

/** Filled annulus segment from start to end angle. Approximates the arc with
 *  short straight segments (1.5° resolution). */
function drawAnnulus(
  doc: jsPDF,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  start: number,
  end: number,
): void {
  const step = Math.PI / 120; // 1.5°
  const points: [number, number][] = [];
  // Outer arc
  for (let a = start; a < end; a += step) {
    points.push([cx + outerR * Math.cos(a), cy + outerR * Math.sin(a)]);
  }
  points.push([cx + outerR * Math.cos(end), cy + outerR * Math.sin(end)]);
  // Inner arc reverse
  for (let a = end; a > start; a -= step) {
    points.push([cx + innerR * Math.cos(a), cy + innerR * Math.sin(a)]);
  }
  points.push([cx + innerR * Math.cos(start), cy + innerR * Math.sin(start)]);

  if (points.length === 0) return;
  const [first, ...rest] = points;
  const lines: [number, number][] = rest.map(([x, y]) => [x - first[0], y - first[1]]);
  // jsPDF lines: array of [dx, dy] pairs and a single starting point
  doc.lines(lines, first[0], first[1], [1, 1], 'F', true);
}

function statusLabel(s: Anomaly['status']): string {
  switch (s) {
    case 'pending': return 'En attente';
    case 'confirmed': return 'Confirmée';
    case 'dismissed': return 'Écartée';
    case 'contested': return 'Contestée';
    default: return '—';
  }
}
