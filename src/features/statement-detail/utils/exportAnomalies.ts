// ============================================================================
// exportAnomalies — exports Excel / Word / PDF de la liste d'anomalies
// ============================================================================
// Utilisé depuis l'onglet Anomalies. Toutes les fonctions retournent un Blob
// ou déclenchent le téléchargement directement.
//
// Dépendances déjà présentes dans package.json :
//   - exceljs : Excel .xlsx
//   - jspdf + jspdf-autotable : PDF
//   - (Word .docx via Blob HTML — pas de dépendance docx-js requise)
// ============================================================================

import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Anomaly } from '../types/statement.types';

interface ExportContext {
  statementLabel?: string;
  periodLabel?: string;
  clientLabel?: string;
  bankLabel?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fcfa(centimes: number | undefined): string {
  if (!centimes) return '0';
  const u = Math.round(centimes / 100);
  return new Intl.NumberFormat('fr-FR').format(u).replace(/ /g, ' ');
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

// ---------------------------------------------------------------------------
// Excel — fichier .xlsx avec entête + tableau formaté
// ---------------------------------------------------------------------------

export async function exportAnomaliesExcel(
  anomalies: Anomaly[],
  ctx: ExportContext = {},
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AtlasBanx';
  wb.created = new Date();

  const ws = wb.addWorksheet('Anomalies', {
    pageSetup: { orientation: 'landscape', paperSize: 9 },
    views: [{ state: 'frozen', ySplit: 5 }],
  });

  // Métadonnées
  ws.mergeCells('A1:H1');
  ws.getCell('A1').value = 'AtlasBanx — Liste des anomalies';
  ws.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1E2640' } };
  ws.getCell('A1').alignment = { vertical: 'middle' };

  ws.getCell('A2').value = `Relevé : ${ctx.statementLabel ?? '—'}`;
  ws.getCell('A3').value = `Période : ${ctx.periodLabel ?? '—'}`;
  ws.getCell('A4').value = `Client : ${ctx.clientLabel ?? '—'} · Banque : ${ctx.bankLabel ?? '—'}`;
  ws.getCell('E2').value = `Généré le ${new Date().toLocaleString('fr-FR')}`;
  ws.getCell('E2').alignment = { horizontal: 'right' };
  ws.getCell('E2').font = { italic: true, size: 10, color: { argb: 'FF666666' } };

  // En-têtes de colonnes
  const headerRow = ws.addRow([
    'Sévérité', 'Type', 'Description', 'Date', 'Libellé transaction',
    'Montant transaction (FCFA)', 'Récupérable (FCFA)', 'Statut',
  ]);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2640' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
  });

  // Lignes
  for (const a of anomalies) {
    const txAmount = Math.round(Math.abs(a.transaction.amountCentimes) / 100);
    const recovery = a.potentialRecoveryCentimes != null ? Math.round(a.potentialRecoveryCentimes / 100) : 0;
    const row = ws.addRow([
      a.severity, a.type, a.title,
      a.transaction.date || '',
      a.transaction.label || '',
      txAmount, recovery, a.status,
    ]);
    // Couleur de sévérité
    const sevColor =
      a.severity === 'critical' ? 'FFB91C1C' :
      a.severity === 'high'     ? 'FFC2410C' :
      a.severity === 'medium'   ? 'FFA16207' :
                                  'FF6B7280';
    row.getCell(1).font = { bold: true, color: { argb: sevColor } };
    row.getCell(6).numFmt = '#,##0';
    row.getCell(7).numFmt = '#,##0';
    row.getCell(7).font = { bold: true };
  }

  // Ligne total
  const totalTx = anomalies.reduce((s, a) => s + Math.round(Math.abs(a.transaction.amountCentimes) / 100), 0);
  const totalRecovery = anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes != null ? Math.round(a.potentialRecoveryCentimes / 100) : 0), 0);
  const totalRow = ws.addRow(['', '', '', '', 'Total', totalTx, totalRecovery, '']);
  totalRow.font = { bold: true };
  totalRow.getCell(6).numFmt = '#,##0';
  totalRow.getCell(7).numFmt = '#,##0';
  totalRow.eachCell((cell) => {
    cell.border = { top: { style: 'double' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  });

  // Largeur de colonnes
  ws.columns = [
    { width: 11 }, { width: 24 }, { width: 38 }, { width: 12 }, { width: 36 },
    { width: 22 }, { width: 20 }, { width: 14 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `atlasbanx-anomalies-${dateStamp()}.xlsx`);
}

// ---------------------------------------------------------------------------
// Word — fichier .docx via HTML + Blob (compatible Word / LibreOffice)
// ---------------------------------------------------------------------------
// On utilise le format MIME "application/msword" avec un HTML enrichi : Word
// accepte ce format et le rend correctement. Avantage : pas de dépendance
// docx-js (gain de bundle ~200kB).

export async function exportAnomaliesWord(
  anomalies: Anomaly[],
  ctx: ExportContext = {},
): Promise<void> {
  const totalTx = anomalies.reduce((s, a) => s + Math.abs(a.transaction.amountCentimes), 0);
  const totalRecovery = anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0);

  const rows = anomalies.map((a) => `
    <tr>
      <td style="color:${sevColorHex(a.severity)};font-weight:bold;">${escapeHtml(a.severity)}</td>
      <td>${escapeHtml(a.type)}</td>
      <td>${escapeHtml(a.title)}</td>
      <td style="font-family:monospace;font-size:10px;">${escapeHtml(a.transaction.date || '')}</td>
      <td>${escapeHtml(a.transaction.label || '')}</td>
      <td style="text-align:right;font-family:monospace;">${fcfa(Math.abs(a.transaction.amountCentimes))}</td>
      <td style="text-align:right;font-family:monospace;font-weight:bold;">${a.potentialRecoveryCentimes ? fcfa(a.potentialRecoveryCentimes) : '—'}</td>
    </tr>`).join('');

  const html = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<title>Anomalies AtlasBanx</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e2640; }
  h1 { color: #1e2640; font-size: 18pt; margin-bottom: 4px; }
  .meta { color: #666; font-size: 10pt; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { background: #1e2640; color: #fff; padding: 6px; text-align: left; }
  td { padding: 5px; border-bottom: 1px solid #ddd; vertical-align: top; }
  tr.total td { background: #fef3c7; font-weight: bold; border-top: 2px solid #1e2640; }
  .note { font-size: 8pt; color: #666; margin-top: 12px; font-style: italic; }
</style>
</head>
<body>
  <h1>AtlasBanx — Liste des anomalies</h1>
  <div class="meta">
    <p><b>Relevé :</b> ${escapeHtml(ctx.statementLabel ?? '—')}<br>
    <b>Période :</b> ${escapeHtml(ctx.periodLabel ?? '—')}<br>
    <b>Client :</b> ${escapeHtml(ctx.clientLabel ?? '—')} · <b>Banque :</b> ${escapeHtml(ctx.bankLabel ?? '—')}<br>
    <b>Généré le :</b> ${new Date().toLocaleString('fr-FR')}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Sévérité</th><th>Type</th><th>Description</th><th>Date</th><th>Libellé transaction</th>
        <th style="text-align:right;">Montant tx (FCFA)</th><th style="text-align:right;">Récupérable (FCFA)</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total">
        <td colspan="5">Total</td>
        <td style="text-align:right;">${fcfa(totalTx)}</td>
        <td style="text-align:right;">${fcfa(totalRecovery)}</td>
      </tr>
    </tbody>
  </table>
  <p class="note">
    « Montant tx » = valeur totale de l'opération signalée. « Récupérable » = part jugée indue,
    réclamable à la banque. Plateforme d'audit bancaire UEMOA/CEMAC.
  </p>
</body>
</html>`;

  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  downloadBlob(blob, `atlasbanx-anomalies-${dateStamp()}.doc`);
}

// ---------------------------------------------------------------------------
// PDF — jsPDF + autotable
// ---------------------------------------------------------------------------

export function exportAnomaliesPdf(
  anomalies: Anomaly[],
  ctx: ExportContext = {},
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // En-tête
  doc.setFontSize(16);
  doc.setTextColor(30, 38, 64);
  doc.text('AtlasBanx — Liste des anomalies', 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Relevé : ${ctx.statementLabel ?? '—'}`, 14, 26);
  doc.text(`Période : ${ctx.periodLabel ?? '—'}`, 14, 31);
  doc.text(`Client : ${ctx.clientLabel ?? '—'} · Banque : ${ctx.bankLabel ?? '—'}`, 14, 36);
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 14, 41);

  // Table
  const totalTx = anomalies.reduce((s, a) => s + Math.abs(a.transaction.amountCentimes), 0);
  const totalRecovery = anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0);

  autoTable(doc, {
    startY: 48,
    head: [['Sévérité', 'Type', 'Description', 'Date', 'Libellé', 'Tx (FCFA)', 'Récupérable']],
    body: [
      ...anomalies.map((a) => [
        a.severity,
        a.type,
        a.title,
        a.transaction.date || '',
        (a.transaction.label || '').slice(0, 40),
        fcfa(Math.abs(a.transaction.amountCentimes)),
        a.potentialRecoveryCentimes ? fcfa(a.potentialRecoveryCentimes) : '—',
      ]),
      ['Total', '', '', '', '', fcfa(totalTx), fcfa(totalRecovery)],
    ],
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 38, 64], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 32 },
      2: { cellWidth: 50 },
      3: { cellWidth: 22 },
      4: { cellWidth: 60 },
      5: { cellWidth: 30, halign: 'right' },
      6: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === anomalies.length) {
        data.cell.styles.fillColor = [254, 243, 199];
        data.cell.styles.fontStyle = 'bold';
      }
      // Couleur de sévérité
      if (data.section === 'body' && data.column.index === 0 && data.row.index < anomalies.length) {
        const sev = anomalies[data.row.index]?.severity;
        if (sev) {
          data.cell.styles.textColor = sevColorRgb(sev);
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Note
  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 50;
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(
    '« Tx » = montant total de l\'opération signalée. « Récupérable » = part jugée indue, réclamable à la banque.',
    14, finalY + 6,
  );

  doc.save(`atlasbanx-anomalies-${dateStamp()}.pdf`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sevColorHex(severity: string): string {
  return severity === 'critical' ? '#b91c1c'
    : severity === 'high' ? '#c2410c'
    : severity === 'medium' ? '#a16207'
    : '#6b7280';
}

function sevColorRgb(severity: string): [number, number, number] {
  return severity === 'critical' ? [185, 28, 28]
    : severity === 'high' ? [194, 65, 12]
    : severity === 'medium' ? [161, 98, 7]
    : [107, 114, 128];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
