// ============================================================================
// ATLASBANX — Benchmark expert report (B4)
// ============================================================================
// Generates an expert-level PDF report on the conditions benchmark, using the
// same Ink Navy + Champagne Gold palette as PremiumReportService. Native
// vector PDF text — fully searchable.
//
// Sections:
//   1. Cover (title, scope, period, narrative source)
//   2. Synthèse exécutive (LLM if available, deterministic fallback)
//   3. Profil d'agressivité (vector bar chart, ranked)
//   4. Distribution & outliers (per key rubric: median, Q1-Q3, fences, dots)
//   5. Conformité réglementaire (per-bank score + violation table)
//   6. Évolution intra-banque (focus bank tariff timeline)
//   7. CEMAC vs UEMOA (zone median table)
//   8. Dérives tarifaires (top 15 by magnitude)
//   9. Panier de coûts client-type (4 profils, ranked)
//  10. Trend forecast (top rising rubriques per focus bank)
//  11. Recommandations Proph3t (numbered, severity-coded)
//  12. Méthodologie + glossaire
//  13. Footer paginated with audit ID
// ============================================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Bank, ConditionGrid } from '../types';
import { formatCurrency } from '../utils';
import {
  computeAggressiveness,
  computeCostBasket,
  computeDistribution,
  detectOutliers,
  forecastBank,
  getActiveGrid,
  getNumericValue,
  getZone,
  PROFILE_BASKETS,
  quantile,
  type ClientProfile,
  type RubricRef,
} from './conditionsAnalytics';
import { checkCohortCompliance } from './regulatoryCompliance';
import { produceFullReportNarrative, summarizeCompliance } from './proph3tBenchmark';
import {
  auditLog,
  AuditEventType,
} from './auditTrail';

// ───────────────────────────────────────────────────────────────────────────
// PALETTE (mirror of PremiumReportService)
// ───────────────────────────────────────────────────────────────────────────

const INK_950: [number, number, number] = [7, 11, 31];
const INK_900: [number, number, number] = [16, 24, 48];
const INK_700: [number, number, number] = [40, 52, 88];
const INK_500: [number, number, number] = [88, 100, 132];
const INK_300: [number, number, number] = [168, 178, 200];
const INK_100: [number, number, number] = [228, 232, 240];
const GOLD_700: [number, number, number] = [156, 113, 53];
const GOLD_500: [number, number, number] = [201, 149, 74];
const GOLD_300: [number, number, number] = [222, 192, 120];
const GOLD_100: [number, number, number] = [248, 240, 220];
const CANVAS_50: [number, number, number] = [253, 251, 246];
const WHITE: [number, number, number] = [255, 255, 255];
const RED: [number, number, number] = [185, 28, 28];
const ORANGE: [number, number, number] = [217, 119, 6];
const GREEN: [number, number, number] = [21, 128, 61];

// ───────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ───────────────────────────────────────────────────────────────────────────

export interface BenchmarkReportArgs {
  banks: Bank[];
  rubrics: RubricRef[];
  /** Cabinet / org name shown on cover and footer */
  cabinet?: { name: string; tagline?: string };
  /** Bank to use for evolution / forecast sections (defaults to first with grid) */
  focusBankId?: string;
  /** Client profile for the cost basket section (defaults to particulier_basique) */
  profile?: ClientProfile;
  /** Audit ID for the footer */
  auditId?: string;
}

export class BenchmarkReportService {
  static async download(args: BenchmarkReportArgs, filename?: string): Promise<void> {
    const doc = await this.build(args);
    const stamp = new Date().toISOString().slice(0, 10);
    const name = filename || `benchmark-tarifaire-atlasbanx-${stamp}.pdf`;
    doc.save(name);

    auditLog({
      eventType: AuditEventType.REPORT_EXPORTED_PDF,
      resourceType: 'report',
      action: 'exported',
      payload: {
        filename: name,
        kind: 'benchmark',
        bankCount: args.banks.length,
        rubricCount: args.rubrics.length,
      },
    });
  }

  static async build(args: BenchmarkReportArgs): Promise<jsPDF> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const ctx = createCtx(doc, args);

    // Generate the narrative once — used by the cover, exec summary and
    // every section. This single call orchestrates all LLM/deterministic.
    const narrative = await produceFullReportNarrative(args.banks, args.rubrics, {
      focusBankId: args.focusBankId,
      profile: args.profile,
    });
    ctx.narrative = narrative;

    drawCover(ctx);
    drawExecutiveSummary(ctx);
    drawAggressivenessSection(ctx);
    drawDistributionsSection(ctx);
    drawComplianceSection(ctx);
    drawEvolutionSection(ctx);
    drawZoneSection(ctx);
    drawDriftSection(ctx);
    drawBasketSection(ctx);
    drawForecastSection(ctx);
    drawRecommendationsSection(ctx);
    drawMethodology(ctx);

    paginateFooters(ctx);
    return doc;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// CONTEXT
// ───────────────────────────────────────────────────────────────────────────

interface DrawCtx {
  doc: jsPDF;
  args: BenchmarkReportArgs;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  // Resolved at build time
  narrative?: Awaited<ReturnType<typeof produceFullReportNarrative>>;
  focusBank: Bank | null;
}

function createCtx(doc: jsPDF, args: BenchmarkReportArgs): DrawCtx {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const focusBank = args.focusBankId
    ? args.banks.find((b) => b.id === args.focusBankId) ?? null
    : args.banks.find((b) => (b.conditionGrids?.length ?? 0) > 0) ?? null;
  return { doc, args, pageWidth, pageHeight, margin: 18, contentWidth: pageWidth - 36, focusBank };
}

// ───────────────────────────────────────────────────────────────────────────
// COVER
// ───────────────────────────────────────────────────────────────────────────

function drawCover(ctx: DrawCtx): void {
  const { doc, args, pageWidth, pageHeight } = ctx;
  setFill(doc, INK_950); doc.rect(0, 0, pageWidth, pageHeight, 'F');
  setFill(doc, GOLD_700); doc.rect(0, 0, 8, pageHeight, 'F');
  setFill(doc, GOLD_500); doc.rect(8, 0, 2, pageHeight, 'F');

  setFont(doc, 'GrandHotel', 56); setColor(doc, GOLD_500);
  doc.text('AtlasBanx', 24, 50);

  setFont(doc, 'Inter', 9, 'normal'); setColor(doc, GOLD_300);
  doc.text('BENCHMARK TARIFAIRE — INTELLIGENCE BANCAIRE', 24, 58, { charSpace: 1.2 });

  setDraw(doc, GOLD_500); doc.setLineWidth(0.3); doc.line(24, 64, pageWidth - 24, 64);

  const titleY = pageHeight / 2 - 30;
  setFont(doc, 'Inter', 11, 'normal'); setColor(doc, GOLD_300);
  doc.text('RAPPORT D’AUDIT TARIFAIRE', 24, titleY, { charSpace: 2.5 });

  setFont(doc, 'Inter', 26, 'bold'); setColor(doc, WHITE);
  doc.text('Conditions de banque', 24, titleY + 14);
  doc.text(`${args.banks.length} banques · ${args.rubrics.length} rubriques`, 24, titleY + 26);

  if (ctx.narrative?.executiveSummary.headline) {
    setFont(doc, 'Inter', 11, 'normal'); setColor(doc, INK_300);
    const lines = doc.splitTextToSize(ctx.narrative.executiveSummary.headline, pageWidth - 48);
    doc.text(lines, 24, titleY + 40);
  }

  // Bottom card
  const cardY = pageHeight - 110;
  setFill(doc, INK_900); doc.rect(0, cardY, pageWidth, 60, 'F');
  setFill(doc, GOLD_500); doc.rect(0, cardY, 4, 60, 'F');

  setFont(doc, 'Inter', 8, 'normal'); setColor(doc, GOLD_300);
  doc.text('PÉRIMÈTRE', 24, cardY + 10, { charSpace: 1.5 });

  setFont(doc, 'Inter', 11, 'normal'); setColor(doc, INK_100);
  const cemacCount = args.banks.filter((b) => getZone(b) === 'CEMAC').length;
  const uemoaCount = args.banks.filter((b) => getZone(b) === 'UEMOA').length;
  doc.text(`${cemacCount} banque(s) CEMAC · ${uemoaCount} banque(s) UEMOA`, 24, cardY + 18);

  const totalGrids = args.banks.reduce((s, b) => s + (b.conditionGrids?.length ?? 0), 0);
  doc.text(`${totalGrids} version(s) de grille analysées`, 24, cardY + 26);

  setFont(doc, 'Inter', 8, 'normal'); setColor(doc, GOLD_300);
  doc.text('SOURCE DE L’ANALYSE', pageWidth / 2 + 8, cardY + 10, { charSpace: 1.5 });

  setFont(doc, 'Inter', 11, 'normal'); setColor(doc, INK_100);
  const srcLabel =
    ctx.narrative?.source === 'llm' ? 'Proph3t · IA + statistiques'
    : ctx.narrative?.source === 'mixed' ? 'Proph3t · IA partielle + statistiques'
    : 'Statistiques déterministes';
  doc.text(srcLabel, pageWidth / 2 + 8, cardY + 18);

  // Footer
  const footY = pageHeight - 28;
  setFill(doc, INK_950); doc.rect(0, footY, pageWidth, 28, 'F');
  setFont(doc, 'Inter', 7, 'normal'); setColor(doc, INK_300);
  doc.text(args.cabinet?.name ? `Préparé par ${args.cabinet.name}` : 'Préparé par AtlasBanx', 24, footY + 10);
  if (args.auditId) {
    doc.text(`Référence : ${args.auditId.toUpperCase()}`, 24, footY + 16, { charSpace: 0.5 });
  }
  doc.text(`Émis le ${new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`, 24, footY + 22);
  setColor(doc, GOLD_500);
  doc.text('CONFIDENTIEL', pageWidth - 24, footY + 22, { align: 'right', charSpace: 1.5 });
}

// ───────────────────────────────────────────────────────────────────────────
// EXECUTIVE SUMMARY
// ───────────────────────────────────────────────────────────────────────────

function drawExecutiveSummary(ctx: DrawCtx): void {
  const { doc, narrative } = ctx;
  doc.addPage();
  drawPageHeader(ctx, 'Synthèse exécutive');

  let y = 48;
  if (!narrative) return;

  // Headline banner
  setFill(doc, INK_900);
  doc.rect(ctx.margin, y, ctx.contentWidth, 18, 'F');
  setFill(doc, GOLD_500); doc.rect(ctx.margin, y, 3, 18, 'F');
  setFont(doc, 'Inter', 9, 'normal'); setColor(doc, GOLD_300);
  doc.text('VERDICT D’AUDIT', ctx.margin + 8, y + 7, { charSpace: 2 });
  setFont(doc, 'Inter', 12, 'bold'); setColor(doc, WHITE);
  const hLines = doc.splitTextToSize(narrative.executiveSummary.headline, ctx.contentWidth - 14);
  doc.text(hLines.slice(0, 1), ctx.margin + 8, y + 14);
  y += 26;

  // Bullets
  setFont(doc, 'Inter', 11, 'bold'); setColor(doc, INK_900);
  doc.text('Faits clés', ctx.margin, y);
  y += 6;
  setFont(doc, 'Inter', 10, 'normal'); setColor(doc, INK_700);
  for (const b of narrative.executiveSummary.bullets) {
    if (y > ctx.pageHeight - 50) {
      doc.addPage(); drawPageHeader(ctx, 'Synthèse exécutive (suite)'); y = 48;
    }
    const lines = doc.splitTextToSize(`•  ${b}`, ctx.contentWidth - 4);
    doc.text(lines, ctx.margin + 2, y);
    y += lines.length * 4.6 + 2;
  }
  y += 4;

  // Recommendations
  setFont(doc, 'Inter', 11, 'bold'); setColor(doc, INK_900);
  doc.text('Recommandations', ctx.margin, y);
  y += 6;
  narrative.executiveSummary.recommendations.forEach((rec, idx) => {
    if (y > ctx.pageHeight - 40) {
      doc.addPage(); drawPageHeader(ctx, 'Synthèse exécutive (suite)'); y = 48;
    }
    setFill(doc, GOLD_100); setDraw(doc, GOLD_300); doc.setLineWidth(0.2);
    const recLines = doc.splitTextToSize(rec, ctx.contentWidth - 14);
    const h = 8 + recLines.length * 4.5;
    doc.roundedRect(ctx.margin, y, ctx.contentWidth, h, 1.5, 1.5, 'FD');
    setFill(doc, INK_900);
    doc.roundedRect(ctx.margin + 4, y + 3, 7, 7, 1, 1, 'F');
    setFont(doc, 'Inter', 8, 'bold'); setColor(doc, GOLD_300);
    doc.text(String(idx + 1), ctx.margin + 7.5, y + 8, { align: 'center' });
    setFont(doc, 'Inter', 10, 'normal'); setColor(doc, INK_900);
    doc.text(recLines, ctx.margin + 14, y + 7);
    y += h + 3;
  });
}

// ───────────────────────────────────────────────────────────────────────────
// AGGRESSIVENESS
// ───────────────────────────────────────────────────────────────────────────

function drawAggressivenessSection(ctx: DrawCtx): void {
  const { doc, args } = ctx;
  doc.addPage(); drawPageHeader(ctx, 'Profil d’agressivité tarifaire');

  let y = 48;
  setFont(doc, 'Inter', 10, 'normal'); setColor(doc, INK_700);
  const intro = 'Pour chaque banque, on calcule la part des rubriques où elle se positionne au-dessus du Q3 (cher) et en-dessous du Q1 (compétitif) du marché. Le score net (cher − compétitif) qualifie son positionnement global.';
  doc.text(doc.splitTextToSize(intro, ctx.contentWidth), ctx.margin, y);
  y += 16;

  const scores = computeAggressiveness(args.banks, args.rubrics);
  if (scores.length === 0) {
    setFont(doc, 'Inter', 10, 'italic'); setColor(doc, INK_500);
    doc.text('Pas assez de données pour calculer le profil d’agressivité (n<3 par rubrique).', ctx.margin, y);
    return;
  }

  // Bar chart — score from -1 to +1, sorted descending
  const labelW = 50;
  const chartX = ctx.margin + labelW;
  const chartW = ctx.contentWidth - labelW - 30;
  const midX = chartX + chartW / 2;

  scores.forEach((s) => {
    if (y > ctx.pageHeight - 30) { doc.addPage(); drawPageHeader(ctx, 'Profil d’agressivité (suite)'); y = 48; }
    setFont(doc, 'Inter', 9, 'normal'); setColor(doc, INK_800 ?? INK_700);
    doc.text(s.bankName.slice(0, 22), ctx.margin, y + 4);

    setDraw(doc, INK_100); doc.setLineWidth(0.2);
    doc.line(midX, y, midX, y + 6);

    const barLen = Math.abs(s.score) * (chartW / 2);
    if (s.score > 0) {
      setFill(doc, RED);
      doc.rect(midX, y + 1, barLen, 4, 'F');
    } else if (s.score < 0) {
      setFill(doc, GREEN);
      doc.rect(midX - barLen, y + 1, barLen, 4, 'F');
    }
    setFont(doc, 'Inter', 8, 'bold'); setColor(doc, INK_900);
    doc.text(`${s.score > 0 ? '+' : ''}${s.score.toFixed(2)}`, ctx.margin + ctx.contentWidth - 24, y + 4);
    y += 8;
  });

  // Insights from narrative
  y += 6;
  if (ctx.narrative?.sectionInsights.benchmark) {
    setFont(doc, 'Inter', 11, 'bold'); setColor(doc, INK_900);
    doc.text('Lecture experte', ctx.margin, y); y += 6;
    setFont(doc, 'Inter', 10, 'normal'); setColor(doc, INK_700);
    for (const p of ctx.narrative.sectionInsights.benchmark.paragraphs) {
      if (y > ctx.pageHeight - 30) { doc.addPage(); drawPageHeader(ctx, 'Profil d’agressivité (suite)'); y = 48; }
      const lines = doc.splitTextToSize(p, ctx.contentWidth);
      doc.text(lines, ctx.margin, y);
      y += lines.length * 4.6 + 3;
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// DISTRIBUTIONS
// ───────────────────────────────────────────────────────────────────────────

function drawDistributionsSection(ctx: DrawCtx): void {
  const { doc, args } = ctx;
  doc.addPage(); drawPageHeader(ctx, 'Distribution des rubriques clés');

  let y = 48;
  // Pick a handful of high-signal rubriques
  const keyRubrics = args.rubrics.filter((r) =>
    [
      'accountFees.tenueCompte.particulier',
      'accountFees.tenueCompte.entreprise',
      'creditFees.tauxDecouvertAutorise',
      'creditFees.tauxUsureLegal',
      'cardFees.visaClassic',
      'cardFees.visaGold',
      'transferFees.virementInternational.swift',
      'checkFees.oppositionCheque',
    ].includes(r.path),
  );

  for (const r of keyRubrics) {
    const samples = args.banks
      .map((b) => {
        const grid = getActiveGrid(b);
        if (!grid) return null;
        const v = getNumericValue(grid, r.path);
        if (v == null || v === 0) return null;
        return { bankId: b.id, bankCode: b.code, bankName: b.name, zone: getZone(b), value: v };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const { distribution: dist, outliers } = detectOutliers(samples);
    if (!dist || dist.n < 3) continue;
    if (y > ctx.pageHeight - 60) { doc.addPage(); drawPageHeader(ctx, 'Distributions (suite)'); y = 48; }

    setFont(doc, 'Inter', 11, 'bold'); setColor(doc, INK_900);
    doc.text(r.label, ctx.margin, y);
    setFont(doc, 'Inter', 8, 'normal'); setColor(doc, INK_500);
    doc.text(`unité : ${r.unit} · n=${dist.n}`, ctx.margin + ctx.contentWidth, y, { align: 'right' });
    y += 5;

    // Stat row
    setFont(doc, 'Inter', 8, 'normal'); setColor(doc, INK_700);
    const stats = `min ${dist.min.toFixed(2)} · Q1 ${dist.q1.toFixed(2)} · médiane ${dist.median.toFixed(2)} · Q3 ${dist.q3.toFixed(2)} · max ${dist.max.toFixed(2)} · CV ${(dist.cv * 100).toFixed(0)}%`;
    doc.text(stats, ctx.margin, y); y += 4;

    // Boxplot
    const boxY = y + 2; const boxH = 10;
    const range = dist.max - dist.min || 1;
    const xMin = ctx.margin;
    const xMax = ctx.margin + ctx.contentWidth;
    const xMap = (v: number) => xMin + ((v - dist.min) / range) * (xMax - xMin);

    setDraw(doc, INK_300); doc.setLineWidth(0.3);
    doc.line(xMap(dist.min), boxY + boxH / 2, xMap(dist.q1), boxY + boxH / 2);
    doc.line(xMap(dist.q3), boxY + boxH / 2, xMap(dist.max), boxY + boxH / 2);
    setFill(doc, GOLD_300);
    doc.rect(xMap(dist.q1), boxY, xMap(dist.q3) - xMap(dist.q1), boxH, 'F');
    setDraw(doc, INK_900); doc.setLineWidth(0.6);
    doc.line(xMap(dist.median), boxY, xMap(dist.median), boxY + boxH);

    // Outlier dots in red
    for (const o of outliers) {
      setFill(doc, o.severity === 'extreme' ? RED : ORANGE);
      doc.circle(xMap(o.value), boxY + boxH / 2, 0.9, 'F');
    }
    y += boxH + 4;

    // Outlier labels
    if (outliers.length > 0) {
      setFont(doc, 'Inter', 7, 'normal'); setColor(doc, INK_500);
      const labels = outliers.slice(0, 4).map((o) => `${o.bankCode} (z=${o.zScore.toFixed(1)})`);
      doc.text('Outliers : ' + labels.join(', '), ctx.margin, y);
      y += 5;
    } else {
      y += 2;
    }
    y += 4;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// COMPLIANCE
// ───────────────────────────────────────────────────────────────────────────

function drawComplianceSection(ctx: DrawCtx): void {
  const { doc, args } = ctx;
  doc.addPage(); drawPageHeader(ctx, 'Conformité réglementaire');

  let y = 48;
  setFont(doc, 'Inter', 10, 'normal'); setColor(doc, INK_700);
  const intro = 'Confrontation des grilles actives au cadre L1 (BCEAO en UEMOA, COBAC en CEMAC). Un dépassement critique du taux d’usure ou de la commission de mouvement constitue une infraction d’ordre public ouvrant droit à restitution.';
  doc.text(doc.splitTextToSize(intro, ctx.contentWidth), ctx.margin, y);
  y += 16;

  const summary = summarizeCompliance(args.banks);
  // Summary tile row
  const tiles = [
    { l: 'SCORE MOYEN', v: `${summary.overallScore}/100`, tone: summary.overallScore >= 80 ? GREEN : summary.overallScore >= 60 ? ORANGE : RED },
    { l: 'BANQUES CONFORMES', v: `${summary.perfect}/${summary.total}`, tone: INK_900 },
    { l: 'CRITIQUES DÉTECTÉES', v: `${summary.withCritical}`, tone: summary.withCritical > 0 ? RED : GREEN },
  ];
  const tileW = (ctx.contentWidth - 12) / 3;
  tiles.forEach((t, i) => {
    const x = ctx.margin + i * (tileW + 6);
    setFill(doc, CANVAS_50); doc.roundedRect(x, y, tileW, 22, 1.5, 1.5, 'F');
    setFill(doc, t.tone); doc.rect(x, y, 1.6, 22, 'F');
    setFont(doc, 'Inter', 7, 'normal'); setColor(doc, INK_500);
    doc.text(t.l, x + 5, y + 7, { charSpace: 0.7 });
    setFont(doc, 'Inter', 14, 'bold'); setColor(doc, t.tone);
    doc.text(t.v, x + 5, y + 17);
  });
  y += 30;

  const reports = checkCohortCompliance(args.banks);
  if (reports.length === 0) {
    setFont(doc, 'Inter', 10, 'italic'); setColor(doc, INK_500);
    doc.text('Aucune banque dans le périmètre n’a de plafond applicable documenté.', ctx.margin, y);
    return;
  }

  // Table of violations (per-bank)
  autoTable(doc, {
    startY: y,
    margin: { left: ctx.margin, right: ctx.margin },
    head: [['Banque', 'Zone', 'Score', 'Critiques', 'Sévères', 'Médiums']],
    body: reports.map((r) => [
      r.bankName,
      r.zone ?? '—',
      `${r.score}/100`,
      String(r.criticalCount),
      String(r.highCount),
      String(r.mediumCount),
    ]),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5, textColor: INK_700, lineColor: INK_100, lineWidth: 0.1 },
    headStyles: { fillColor: INK_900, textColor: GOLD_300, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: CANVAS_50 },
  });
  // @ts-expect-error jspdf-autotable
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // Detailed violations (top 10 most severe)
  const allViolations = reports.flatMap((r) => r.violations).sort((a, b) => {
    const sevRank = { critical: 0, high: 1, medium: 2 };
    return sevRank[a.limit.severity] - sevRank[b.limit.severity];
  });
  if (allViolations.length > 0) {
    if (y > ctx.pageHeight - 50) { doc.addPage(); drawPageHeader(ctx, 'Conformité (suite)'); y = 48; }
    setFont(doc, 'Inter', 11, 'bold'); setColor(doc, INK_900);
    doc.text('Violations détaillées', ctx.margin, y); y += 4;
    autoTable(doc, {
      startY: y,
      margin: { left: ctx.margin, right: ctx.margin },
      head: [['Banque', 'Rubrique', 'Plafond', 'Observé', 'Dépassement', 'Référence']],
      body: allViolations.slice(0, 12).map((v) => [
        v.bankCode,
        v.limit.rubricLabel,
        `${v.limit.limit} ${v.limit.unit}`,
        `${v.observed} ${v.limit.unit}`,
        `${v.breachPct.toFixed(0)}%`,
        v.limit.reference,
      ]),
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: INK_700, lineColor: INK_100 },
      headStyles: { fillColor: INK_700, textColor: GOLD_300, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: CANVAS_50 },
      columnStyles: {
        4: { halign: 'right', textColor: RED, fontStyle: 'bold' },
        5: { textColor: INK_500, fontSize: 7 },
      },
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// EVOLUTION (focus bank)
// ───────────────────────────────────────────────────────────────────────────

function drawEvolutionSection(ctx: DrawCtx): void {
  const { doc, focusBank } = ctx;
  if (!focusBank) return;
  doc.addPage(); drawPageHeader(ctx, `Évolution intra-banque — ${focusBank.name}`);

  let y = 48;
  const grids = [...(focusBank.conditionGrids ?? [])].sort(
    (a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime(),
  );
  if (grids.length < 2) {
    setFont(doc, 'Inter', 10, 'italic'); setColor(doc, INK_500);
    doc.text('Au moins 2 versions de grille sont requises pour analyser une évolution.', ctx.margin, y);
    return;
  }

  // Per-rubric diff table
  const rows = ctx.args.rubrics
    .map((r) => {
      const series = grids.map((g) => getNumericValue(g, r.path));
      const first = series.find((v) => v != null);
      const last = [...series].reverse().find((v) => v != null);
      if (first == null || last == null || first === 0) return null;
      const deltaPct = ((last - first) / first) * 100;
      if (Math.abs(deltaPct) < 0.5) return null;
      return { rubric: r, first, last, deltaPct, series };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));

  autoTable(doc, {
    startY: y,
    margin: { left: ctx.margin, right: ctx.margin },
    head: [['Rubrique', 'V1', 'Vn', 'Δ', 'Δ%']],
    body: rows.slice(0, 18).map((r) => [
      r.rubric.label,
      `${r.first} ${r.rubric.unit}`,
      `${r.last} ${r.rubric.unit}`,
      `${(r.last - r.first).toFixed(2)}`,
      `${r.deltaPct > 0 ? '+' : ''}${r.deltaPct.toFixed(1)}%`,
    ]),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: INK_700 },
    headStyles: { fillColor: INK_900, textColor: GOLD_300, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: CANVAS_50 },
    columnStyles: {
      4: { halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const txt = String(data.cell.text[0] ?? '');
        if (txt.startsWith('+')) data.cell.styles.textColor = RED;
        else if (txt.startsWith('-')) data.cell.styles.textColor = GREEN;
      }
    },
  });
}

// ───────────────────────────────────────────────────────────────────────────
// ZONE COMPARE
// ───────────────────────────────────────────────────────────────────────────

function drawZoneSection(ctx: DrawCtx): void {
  const { doc, args } = ctx;
  doc.addPage(); drawPageHeader(ctx, 'CEMAC vs UEMOA');

  let y = 48;
  setFont(doc, 'Inter', 10, 'normal'); setColor(doc, INK_700);
  doc.text('Médiane par zone monétaire (parité fixe XAF↔XOF). Échantillon = banques de la zone disposant d’une grille active.', ctx.margin, y);
  y += 12;

  const cemac: Record<string, number[]> = {};
  const uemoa: Record<string, number[]> = {};
  for (const b of args.banks) {
    const grid = getActiveGrid(b);
    if (!grid) continue;
    const z = getZone(b);
    if (!z) continue;
    for (const r of args.rubrics) {
      const v = getNumericValue(grid, r.path);
      if (v == null || v === 0) continue;
      const bucket = z === 'CEMAC' ? cemac : uemoa;
      (bucket[r.path] = bucket[r.path] || []).push(v);
    }
  }

  const rows = args.rubrics
    .map((r) => {
      const c = cemac[r.path] ?? [];
      const u = uemoa[r.path] ?? [];
      if (c.length === 0 && u.length === 0) return null;
      const cm = c.length ? quantile(c, 0.5) : null;
      const um = u.length ? quantile(u, 0.5) : null;
      const delta = cm != null && um != null && um !== 0 ? ((cm - um) / um) * 100 : null;
      return { rubric: r, cm, um, cn: c.length, un: u.length, delta };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  autoTable(doc, {
    startY: y,
    margin: { left: ctx.margin, right: ctx.margin },
    head: [['Rubrique', `CEMAC (n=)`, `UEMOA (n=)`, 'Écart %']],
    body: rows.map((row) => [
      row.rubric.label,
      row.cm != null ? `${row.cm.toFixed(2)} (${row.cn})` : '—',
      row.um != null ? `${row.um.toFixed(2)} (${row.un})` : '—',
      row.delta != null ? `${row.delta > 0 ? '+' : ''}${row.delta.toFixed(1)}%` : '—',
    ]),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: INK_700 },
    headStyles: { fillColor: INK_900, textColor: GOLD_300, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: CANVAS_50 },
  });
}

// ───────────────────────────────────────────────────────────────────────────
// DRIFT
// ───────────────────────────────────────────────────────────────────────────

function drawDriftSection(ctx: DrawCtx): void {
  const { doc, args } = ctx;
  doc.addPage(); drawPageHeader(ctx, 'Dérives tarifaires (>10%)');

  let y = 48;
  const drifts: Array<{ bank: Bank; rubric: RubricRef; from: number; to: number; deltaPct: number; fromDate: Date; toDate: Date }> = [];
  for (const b of args.banks) {
    const grids = [...(b.conditionGrids ?? [])].sort(
      (a, c) => new Date(a.effectiveDate).getTime() - new Date(c.effectiveDate).getTime(),
    );
    for (let i = 1; i < grids.length; i++) {
      for (const r of args.rubrics) {
        const a = getNumericValue(grids[i - 1], r.path);
        const c = getNumericValue(grids[i], r.path);
        if (a == null || c == null || a === 0) continue;
        const delta = ((c - a) / a) * 100;
        if (Math.abs(delta) >= 10) {
          drifts.push({
            bank: b,
            rubric: r,
            from: a,
            to: c,
            deltaPct: delta,
            fromDate: new Date(grids[i - 1].effectiveDate),
            toDate: new Date(grids[i].effectiveDate),
          });
        }
      }
    }
  }
  drifts.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));

  if (drifts.length === 0) {
    setFont(doc, 'Inter', 10, 'italic'); setColor(doc, INK_500);
    doc.text('Aucune dérive >10 % entre deux versions consécutives. Marché stable sur la cohorte.', ctx.margin, y);
    return;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: ctx.margin, right: ctx.margin },
    head: [['Banque', 'Rubrique', 'De', 'Vers', 'Δ', 'Période']],
    body: drifts.slice(0, 18).map((d) => [
      d.bank.code,
      d.rubric.label,
      `${d.from} ${d.rubric.unit}`,
      `${d.to} ${d.rubric.unit}`,
      `${d.deltaPct > 0 ? '+' : ''}${d.deltaPct.toFixed(0)}%`,
      `${formatShort(d.fromDate)} → ${formatShort(d.toDate)}`,
    ]),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: INK_700 },
    headStyles: { fillColor: INK_900, textColor: GOLD_300, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: CANVAS_50 },
    columnStyles: {
      4: { halign: 'right', fontStyle: 'bold' },
      5: { textColor: INK_500, fontSize: 7 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const txt = String(data.cell.text[0] ?? '');
        if (txt.startsWith('+')) data.cell.styles.textColor = RED;
        else if (txt.startsWith('-')) data.cell.styles.textColor = GREEN;
      }
    },
  });
}

// ───────────────────────────────────────────────────────────────────────────
// COST BASKET
// ───────────────────────────────────────────────────────────────────────────

function drawBasketSection(ctx: DrawCtx): void {
  const { doc, args } = ctx;
  doc.addPage(); drawPageHeader(ctx, 'Panier de coûts client-type');

  let y = 48;
  const profile = args.profile ?? 'particulier_basique';
  const profileLabel = PROFILE_BASKETS[profile].label;
  setFont(doc, 'Inter', 10, 'normal'); setColor(doc, INK_700);
  doc.text(`Profil retenu : ${profileLabel}. Coût annuel total = somme des frais récurrents pondérés par leurs occurrences typiques.`, ctx.margin, y);
  y += 12;

  const baskets = computeCostBasket(args.banks, profile);
  if (baskets.length === 0) {
    setFont(doc, 'Inter', 10, 'italic'); setColor(doc, INK_500);
    doc.text('Aucune banque ne dispose d’assez de données pour calculer le panier.', ctx.margin, y);
    return;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: ctx.margin, right: ctx.margin },
    head: [['Rang', 'Banque', 'Zone', 'Coût annuel', 'Couverture', 'Écart vs moins cher']],
    body: baskets.map((b, i) => [
      String(i + 1),
      b.bankName,
      b.zone ?? '—',
      formatCurrency(b.totalAnnual, 'XAF'),
      `${(b.coverage * 100).toFixed(0)}%`,
      i === 0 ? '—' : `+${formatCurrency(b.totalAnnual - baskets[0].totalAnnual, 'XAF')}`,
    ]),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5, textColor: INK_700 },
    headStyles: { fillColor: INK_900, textColor: GOLD_300, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: CANVAS_50 },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', textColor: GOLD_700 },
      3: { halign: 'right', fontStyle: 'bold' },
    },
  });
}

// ───────────────────────────────────────────────────────────────────────────
// FORECAST
// ───────────────────────────────────────────────────────────────────────────

function drawForecastSection(ctx: DrawCtx): void {
  const { doc, focusBank } = ctx;
  if (!focusBank) return;
  doc.addPage(); drawPageHeader(ctx, `Tendances projetées — ${focusBank.name}`);

  let y = 48;
  const forecasts = forecastBank(focusBank, ctx.args.rubrics)
    .filter((f) => f.cagrPct != null)
    .sort((a, b) => (b.cagrPct ?? 0) - (a.cagrPct ?? 0));

  if (forecasts.length === 0) {
    setFont(doc, 'Inter', 10, 'italic'); setColor(doc, INK_500);
    doc.text('Pas assez d’historique pour projeter une tendance.', ctx.margin, y);
    return;
  }

  setFont(doc, 'Inter', 10, 'normal'); setColor(doc, INK_700);
  doc.text('Extrapolation linéaire des grilles passées. À utiliser comme signal de surveillance, pas comme prévision contractuelle.', ctx.margin, y);
  y += 12;

  autoTable(doc, {
    startY: y,
    margin: { left: ctx.margin, right: ctx.margin },
    head: [['Rubrique', 'Actuel', '+6 mois', '+12 mois', 'CAGR', 'Risque']],
    body: forecasts.slice(0, 14).map((f) => {
      const last = f.history[f.history.length - 1].value;
      return [
        f.rubricLabel,
        last.toFixed(2),
        f.forecast6m != null ? f.forecast6m.toFixed(2) : '—',
        f.forecast12m != null ? f.forecast12m.toFixed(2) : '—',
        f.cagrPct != null ? `${f.cagrPct > 0 ? '+' : ''}${f.cagrPct.toFixed(1)}%` : '—',
        `${Math.round(f.riskScore)}/100`,
      ];
    }),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: INK_700 },
    headStyles: { fillColor: INK_900, textColor: GOLD_300, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: CANVAS_50 },
    columnStyles: {
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right' },
    },
  });
}

// ───────────────────────────────────────────────────────────────────────────
// PROPH3T RECOMMENDATIONS
// ───────────────────────────────────────────────────────────────────────────

function drawRecommendationsSection(ctx: DrawCtx): void {
  const { doc, narrative } = ctx;
  if (!narrative) return;

  doc.addPage(); drawPageHeader(ctx, 'Recommandations Proph3t');

  let y = 48;
  setFont(doc, 'Inter', 10, 'normal'); setColor(doc, INK_700);
  const introTxt = narrative.source === 'llm'
    ? 'Recommandations enrichies par le moteur d’analyse Proph3t (IA + statistiques).'
    : narrative.source === 'mixed'
      ? 'Recommandations partiellement enrichies par Proph3t — sections concernées indiquées.'
      : 'Recommandations déterministes (moteur Proph3t indisponible). Activer une instance dans Paramètres → Intelligence pour enrichir l’analyse.';
  doc.text(doc.splitTextToSize(introTxt, ctx.contentWidth), ctx.margin, y);
  y += 14;

  // Each section with its actions
  const sections: Array<{ id: keyof typeof narrative.sectionInsights; label: string }> = [
    { id: 'benchmark',  label: 'Benchmark inter-banques' },
    { id: 'compliance', label: 'Conformité réglementaire' },
    { id: 'drift',      label: 'Dérives tarifaires' },
    { id: 'basket',     label: 'Panier client' },
    { id: 'evolution',  label: 'Évolution intra-banque' },
    { id: 'zone',       label: 'CEMAC vs UEMOA' },
    { id: 'forecast',   label: 'Tendances projetées' },
  ];

  for (const sec of sections) {
    const insight = narrative.sectionInsights[sec.id];
    if (!insight || insight.actions.length === 0) continue;
    if (y > ctx.pageHeight - 50) { doc.addPage(); drawPageHeader(ctx, 'Recommandations (suite)'); y = 48; }

    setFill(doc, INK_900);
    doc.roundedRect(ctx.margin, y, ctx.contentWidth, 8, 1, 1, 'F');
    setFont(doc, 'Inter', 9, 'bold'); setColor(doc, GOLD_300);
    doc.text(sec.label.toUpperCase(), ctx.margin + 4, y + 5.5, { charSpace: 1.2 });
    setFont(doc, 'Inter', 8, 'normal'); setColor(doc, GOLD_300);
    doc.text(insight.source === 'llm' ? 'IA' : 'DET', ctx.margin + ctx.contentWidth - 4, y + 5.5, { align: 'right', charSpace: 1 });
    y += 11;

    for (const action of insight.actions) {
      if (y > ctx.pageHeight - 30) { doc.addPage(); drawPageHeader(ctx, 'Recommandations (suite)'); y = 48; }
      setFont(doc, 'Inter', 10, 'normal'); setColor(doc, INK_700);
      const lines = doc.splitTextToSize(action, ctx.contentWidth - 4);
      doc.text(lines, ctx.margin + 2, y);
      y += lines.length * 4.6 + 2;
    }
    y += 4;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// METHODOLOGY
// ───────────────────────────────────────────────────────────────────────────

function drawMethodology(ctx: DrawCtx): void {
  const { doc } = ctx;
  doc.addPage(); drawPageHeader(ctx, 'Méthodologie & glossaire');

  let y = 48;
  const sections = [
    {
      title: 'Source des données',
      body: 'Le benchmark s’appuie exclusivement sur les grilles tarifaires importées dans le coffre AtlasBanx. Chaque grille comporte une date d’effet, un statut (active / archivée / brouillon) et un document source archivé.',
    },
    {
      title: 'Profil d’agressivité',
      body: 'Pour chaque banque, on compte la part de rubriques où elle est au-dessus du Q3 (cher) versus en-dessous du Q1 (compétitif) du marché. Le score net (cher − compétitif) varie de -1 à +1.',
    },
    {
      title: 'Détection d’outliers',
      body: 'Méthode de Tukey : un point est outlier s’il sort de [Q1 − 1.5×IQR, Q3 + 1.5×IQR]. Le z-score qualifie la sévérité (>3σ = extrême, >2σ = fort, sinon léger).',
    },
    {
      title: 'Conformité réglementaire',
      body: 'Confrontation aux plafonds BCEAO (UEMOA) et COBAC (CEMAC). Score 100 = aucune violation. Pondérations : critique = -25, sévère = -10, médium = -3.',
    },
    {
      title: 'Panier de coûts',
      body: 'Coût annuel total pour un profil-type (basique, premium, PME, entreprise) calculé à partir d’un mix de fréquences réalistes (12 mois, 4 chéquiers/an, etc.). Volet indicatif — à recalibrer au volume réel du client.',
    },
    {
      title: 'Forecast tarifaire',
      body: 'Régression linéaire sur les versions historiques de grille pour chaque rubrique. CAGR = taux de croissance annualisé. Saisonnalité détectée si plusieurs hausses sur le même mois calendaire.',
    },
    {
      title: 'Couche Proph3t',
      body: 'Quand un moteur Ollama Proph3t est connecté, les commentaires de section et la synthèse exécutive sont enrichis par un modèle IA. La donnée brute reste calculée par les fonctions déterministes — l’IA ne fait que reformuler et nuancer.',
    },
  ];

  sections.forEach((s) => {
    if (y > ctx.pageHeight - 40) { doc.addPage(); drawPageHeader(ctx, 'Méthodologie (suite)'); y = 48; }
    setFont(doc, 'Inter', 11, 'bold'); setColor(doc, INK_900);
    doc.text(s.title, ctx.margin, y);
    y += 5;
    setFont(doc, 'Inter', 10, 'normal'); setColor(doc, INK_700);
    const lines = doc.splitTextToSize(s.body, ctx.contentWidth);
    doc.text(lines, ctx.margin, y);
    y += lines.length * 4.6 + 6;
  });
}

// ───────────────────────────────────────────────────────────────────────────
// FOOTER PAGINATION
// ───────────────────────────────────────────────────────────────────────────

function paginateFooters(ctx: DrawCtx): void {
  const { doc, args, pageWidth, pageHeight } = ctx;
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (p === 1) continue;
    setDraw(doc, INK_100); doc.setLineWidth(0.2);
    doc.line(ctx.margin, pageHeight - 14, pageWidth - ctx.margin, pageHeight - 14);
    setFont(doc, 'Inter', 7, 'normal'); setColor(doc, INK_500);
    doc.text(args.cabinet?.name ?? 'AtlasBanx', ctx.margin, pageHeight - 8);
    if (args.auditId) {
      doc.text(`Réf. ${args.auditId}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    }
    doc.text(`${p} / ${total}`, pageWidth - ctx.margin, pageHeight - 8, { align: 'right' });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// HEADER
// ───────────────────────────────────────────────────────────────────────────

function drawPageHeader(ctx: DrawCtx, title: string): void {
  const { doc, pageWidth } = ctx;
  setFill(doc, INK_900); doc.rect(0, 0, pageWidth, 22, 'F');
  setFill(doc, GOLD_500); doc.rect(0, 22, pageWidth, 1.2, 'F');
  setFont(doc, 'GrandHotel', 18); setColor(doc, GOLD_300);
  doc.text('AtlasBanx', ctx.margin, 14);
  setFont(doc, 'Inter', 8, 'normal'); setColor(doc, GOLD_300);
  doc.text('BENCHMARK TARIFAIRE', pageWidth - ctx.margin, 14, { align: 'right', charSpace: 2 });
  setFont(doc, 'Inter', 14, 'bold'); setColor(doc, INK_900);
  doc.text(title, ctx.margin, 38);
}

// ───────────────────────────────────────────────────────────────────────────
// LOW-LEVEL HELPERS
// ───────────────────────────────────────────────────────────────────────────

const INK_800 = INK_700;
function setFill(doc: jsPDF, [r, g, b]: [number, number, number]): void { doc.setFillColor(r, g, b); }
function setDraw(doc: jsPDF, [r, g, b]: [number, number, number]): void { doc.setDrawColor(r, g, b); }
function setColor(doc: jsPDF, [r, g, b]: [number, number, number]): void { doc.setTextColor(r, g, b); }
function setFont(doc: jsPDF, family: 'Inter' | 'GrandHotel' | 'courier', size: number, weight: 'normal' | 'bold' | 'italic' = 'normal'): void {
  let fam = 'helvetica';
  let style: 'normal' | 'bold' | 'italic' | 'bolditalic' = weight;
  if (family === 'courier') fam = 'courier';
  else if (family === 'GrandHotel') { fam = 'times'; style = 'italic'; }
  try { doc.setFont(fam, style); } catch { doc.setFont('helvetica', weight); }
  doc.setFontSize(size);
}

function formatShort(d: Date): string {
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}
