import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { Anomaly, AnalysisResult, ANOMALY_TYPE_LABELS, SEVERITY_LABELS, Severity } from '../types';
import { formatCurrency, formatDate } from '../utils';
import {
  auditLog,
  auditLogCritical,
  AuditEventType,
  generateIntegrityCertificate,
  formatCertificateForPdf,
} from './auditTrail';

interface ReportData {
  title: string;
  clientName: string;
  period: { start: Date; end: Date };
  anomalies: Anomaly[];
  statistics: AnalysisResult['statistics'];
  summary: AnalysisResult['summary'];
  includeAIAnalysis?: boolean;
  aiSummary?: string;
  cabinetInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
}

export class ReportService {
  /**
   * Generate PDF report
   */
  static generatePDF(data: ReportData): Blob {
    return this.buildReportDoc(data).output('blob');
  }

  /**
   * Internal builder — returns the jsPDF doc instance so we can append extra
   * pages (e.g. the integrity certificate) before serializing.
   */
  private static buildReportDoc(data: ReportData): jsPDF {
    // Créer le document en A4 Portrait explicitement
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Colors
    const primaryColor: [number, number, number] = [30, 58, 138]; // blue-900
    const successColor: [number, number, number] = [22, 163, 74]; // green-600
    const dangerColor: [number, number, number] = [220, 38, 38]; // red-600
    const warningColor: [number, number, number] = [234, 179, 8]; // yellow-500

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('ATLASBANX', 14, 18);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Rapport d\'Audit Bancaire', 14, 28);

    doc.setFontSize(10);
    doc.text(`Généré le ${formatDate(new Date())}`, pageWidth - 14, 18, { align: 'right' });

    yPos = 55;

    // Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(data.title, 14, yPos);
    yPos += 10;

    // Client info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Client: ${data.clientName}`, 14, yPos);
    yPos += 6;
    doc.text(`Période: ${formatDate(data.period.start)} - ${formatDate(data.period.end)}`, 14, yPos);
    yPos += 15;

    // Summary boxes
    const boxWidth = (pageWidth - 42) / 4;
    const boxHeight = 25;
    const boxY = yPos;

    // Box 1: Anomalies
    doc.setFillColor(254, 243, 199); // yellow-100
    doc.roundedRect(14, boxY, boxWidth, boxHeight, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Anomalies', 14 + boxWidth / 2, boxY + 8, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...warningColor);
    doc.text(String(data.statistics.totalAnomalies), 14 + boxWidth / 2, boxY + 19, { align: 'center' });

    // Box 2: Savings
    doc.setFillColor(220, 252, 231); // green-100
    doc.roundedRect(14 + boxWidth + 4, boxY, boxWidth, boxHeight, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Économies', 14 + boxWidth + 4 + boxWidth / 2, boxY + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...successColor);
    doc.text(formatCurrency(data.statistics.potentialSavings, 'XAF'), 14 + boxWidth + 4 + boxWidth / 2, boxY + 19, { align: 'center' });

    // Box 3: Critical
    doc.setFillColor(254, 226, 226); // red-100
    doc.roundedRect(14 + (boxWidth + 4) * 2, boxY, boxWidth, boxHeight, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Critiques', 14 + (boxWidth + 4) * 2 + boxWidth / 2, boxY + 8, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dangerColor);
    const criticalCount = (data.statistics.anomaliesBySeverity[Severity.CRITICAL] || 0) +
      (data.statistics.anomaliesBySeverity[Severity.HIGH] || 0);
    doc.text(String(criticalCount), 14 + (boxWidth + 4) * 2 + boxWidth / 2, boxY + 19, { align: 'center' });

    // Box 4: Status
    const statusColor = data.summary.status === 'CRITICAL' ? dangerColor :
      data.summary.status === 'WARNING' ? warningColor : successColor;
    const statusBg = data.summary.status === 'CRITICAL' ? [254, 226, 226] :
      data.summary.status === 'WARNING' ? [254, 243, 199] : [220, 252, 231];
    doc.setFillColor(statusBg[0], statusBg[1], statusBg[2]);
    doc.roundedRect(14 + (boxWidth + 4) * 3, boxY, boxWidth, boxHeight, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Statut', 14 + (boxWidth + 4) * 3 + boxWidth / 2, boxY + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...statusColor);
    const statusLabel = data.summary.status === 'CRITICAL' ? 'CRITIQUE' :
      data.summary.status === 'WARNING' ? 'ATTENTION' : 'OK';
    doc.text(statusLabel, 14 + (boxWidth + 4) * 3 + boxWidth / 2, boxY + 19, { align: 'center' });

    yPos = boxY + boxHeight + 15;

    // Key findings
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('Points clés', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    data.summary.keyFindings.forEach((finding) => {
      doc.text(`• ${finding}`, 18, yPos);
      yPos += 6;
    });
    yPos += 10;

    // Anomalies table
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('Détail des anomalies', 14, yPos);
    yPos += 5;

    const tableData = data.anomalies.map((a, i) => [
      String(i + 1),
      ANOMALY_TYPE_LABELS[a.type],
      SEVERITY_LABELS[a.severity],
      formatCurrency(a.amount, 'XAF'),
      `${(a.confidence * 100).toFixed(0)}%`,
      a.recommendation.substring(0, 50) + '...',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Type', 'Sévérité', 'Montant', 'Confiance', 'Description']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30 },
        4: { cellWidth: 20 },
        5: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14 },
    });

    // @ts-expect-error - autoTable adds finalY to doc
    yPos = doc.lastAutoTable.finalY + 15;

    // Check if need new page
    if (yPos > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      yPos = 20;
    }

    // Recommendations
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('Recommandations', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    data.summary.recommendations.forEach((rec, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${rec}`, pageWidth - 28);
      doc.text(lines, 14, yPos);
      yPos += lines.length * 5 + 3;
    });

    // AI Analysis section (if enabled)
    if (data.includeAIAnalysis && data.aiSummary) {
      yPos += 10;
      if (yPos > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFillColor(243, 232, 255); // purple-100
      doc.roundedRect(14, yPos - 5, pageWidth - 28, 30, 3, 3, 'F');

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(126, 34, 206); // purple-700
      doc.text('🧠 Analyse IA', 18, yPos + 5);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(88, 28, 135); // purple-800
      const aiLines = doc.splitTextToSize(data.aiSummary, pageWidth - 36);
      doc.text(aiLines.slice(0, 3), 18, yPos + 14);
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} / ${pageCount} - AtlasBanx © ${new Date().getFullYear()} - Document confidentiel`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    return doc;
  }

  /**
   * Generate Excel report
   */
  static async generateExcel(data: ReportData): Promise<Blob> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AtlasBanx';
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Résumé');

    // Title
    summarySheet.getCell('A1').value = 'RAPPORT D\'AUDIT BANCAIRE';
    summarySheet.getCell('A1').font = { bold: true, size: 16 };
    summarySheet.mergeCells('A1:B1');

    // Info
    summarySheet.getCell('A3').value = 'Client';
    summarySheet.getCell('B3').value = data.clientName;
    summarySheet.getCell('A4').value = 'Période';
    summarySheet.getCell('B4').value = `${formatDate(data.period.start)} - ${formatDate(data.period.end)}`;
    summarySheet.getCell('A5').value = 'Date de génération';
    summarySheet.getCell('B5').value = formatDate(new Date());

    // Stats
    summarySheet.getCell('A7').value = 'STATISTIQUES';
    summarySheet.getCell('A7').font = { bold: true };
    summarySheet.getCell('A8').value = 'Anomalies détectées';
    summarySheet.getCell('B8').value = data.statistics.totalAnomalies;
    summarySheet.getCell('A9').value = 'Économies potentielles';
    summarySheet.getCell('B9').value = data.statistics.potentialSavings;
    summarySheet.getCell('B9').numFmt = '#,##0" FCFA"';
    summarySheet.getCell('A10').value = 'Taux d\'anomalie';
    summarySheet.getCell('B10').value = `${data.statistics.anomalyRate.toFixed(1)}%`;
    summarySheet.getCell('A11').value = 'Statut';
    summarySheet.getCell('B11').value = data.summary.status;

    // Key findings
    let row = 13;
    summarySheet.getCell(`A${row}`).value = 'POINTS CLÉS';
    summarySheet.getCell(`A${row}`).font = { bold: true };
    row++;
    data.summary.keyFindings.forEach(f => {
      summarySheet.getCell(`A${row}`).value = `• ${f}`;
      row++;
    });

    row += 2;
    summarySheet.getCell(`A${row}`).value = 'RECOMMANDATIONS';
    summarySheet.getCell(`A${row}`).font = { bold: true };
    row++;
    data.summary.recommendations.forEach((r, i) => {
      summarySheet.getCell(`A${row}`).value = `${i + 1}. ${r}`;
      row++;
    });

    summarySheet.getColumn('A').width = 25;
    summarySheet.getColumn('B').width = 50;

    // Anomalies sheet
    const anomaliesSheet = workbook.addWorksheet('Anomalies');
    anomaliesSheet.columns = [
      { header: '#', key: 'num', width: 5 },
      { header: 'Type', key: 'type', width: 25 },
      { header: 'Sévérité', key: 'severity', width: 12 },
      { header: 'Montant (FCFA)', key: 'amount', width: 18 },
      { header: 'Confiance', key: 'confidence', width: 12 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Transactions', key: 'txCount', width: 12 },
      { header: 'Date détection', key: 'date', width: 15 },
    ];

    // Style header
    anomaliesSheet.getRow(1).font = { bold: true };
    anomaliesSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    anomaliesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    data.anomalies.forEach((a, i) => {
      anomaliesSheet.addRow({
        num: i + 1,
        type: ANOMALY_TYPE_LABELS[a.type],
        severity: SEVERITY_LABELS[a.severity],
        amount: a.amount,
        confidence: `${(a.confidence * 100).toFixed(0)}%`,
        description: a.recommendation,
        txCount: a.transactions.length,
        date: formatDate(a.detectedAt),
      });
    });

    // Transactions sheet
    const transactionsSheet = workbook.addWorksheet('Transactions');
    transactionsSheet.columns = [
      { header: 'Anomalie', key: 'anomaly', width: 25 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Montant (FCFA)', key: 'amount', width: 18 },
      { header: 'Solde', key: 'balance', width: 18 },
      { header: 'Référence', key: 'reference', width: 15 },
    ];

    transactionsSheet.getRow(1).font = { bold: true };
    transactionsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    transactionsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    data.anomalies.forEach(a => {
      a.transactions.forEach(t => {
        transactionsSheet.addRow({
          anomaly: ANOMALY_TYPE_LABELS[a.type],
          date: formatDate(t.date),
          description: t.description,
          amount: t.amount,
          balance: t.balance,
          reference: t.reference || '',
        });
      });
    });

    // Generate blob
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /**
   * Download blob as file
   */
  static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate a PDF with a cryptographic integrity certificate appended as the
   * last page. Requires a reportId so we can pull the audit trail chain for
   * this report. The certificate is legal-grade proof that the report was
   * produced by AtlasBanx and has not been tampered with since generation.
   */
  static async generatePDFWithCertificate(
    data: ReportData,
    reportId: string,
  ): Promise<Blob> {
    const doc = this.buildReportDoc(data);

    const certificate = await generateIntegrityCertificate(reportId);
    const lines = formatCertificateForPdf(certificate);

    doc.addPage();
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    let y = 15;
    const lineHeight = 4;
    for (const line of lines) {
      if (y > 285) {
        doc.addPage();
        y = 15;
      }
      doc.text(line, 14, y);
      y += lineHeight;
    }
    doc.setFont('helvetica', 'normal');

    return doc.output('blob');
  }

  /**
   * Generate and download PDF.
   *
   * When `reportId` is provided, appends a cryptographic integrity certificate
   * as the last page and records a REPORT_EXPORTED_PDF audit event.
   */
  static async downloadPDF(
    data: ReportData,
    filename?: string,
    reportId?: string,
  ): Promise<void> {
    const blob = reportId
      ? await this.generatePDFWithCertificate(data, reportId)
      : this.generatePDF(data);

    const name = filename || `rapport-audit-${data.clientName.replace(/\s+/g, '-').toLowerCase()}-${formatDate(new Date()).replace(/\//g, '-')}.pdf`;
    this.downloadBlob(blob, name);

    // Audit trail — export is a critical event (legal evidence)
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
            totalAmount: data.statistics.totalAmount,
          },
        });
      } catch (err) {
        // logCritical throws on failure — we don't want to block the download,
        // but we do want to surface the issue in the console.
        console.warn('[ReportService] audit log for REPORT_EXPORTED_PDF failed:', err);
      }
    } else {
      auditLog({
        eventType: AuditEventType.REPORT_EXPORTED_PDF,
        resourceType: 'report',
        action: 'exported',
        payload: { filename: name, anomalyCount: data.anomalies.length },
      });
    }
  }

  /**
   * Generate and download Excel
   */
  static async downloadExcel(data: ReportData, filename?: string): Promise<void> {
    const blob = await this.generateExcel(data);
    const name = filename || `rapport-audit-${data.clientName.replace(/\s+/g, '-').toLowerCase()}-${formatDate(new Date()).replace(/\//g, '-')}.xlsx`;
    this.downloadBlob(blob, name);
  }
}
