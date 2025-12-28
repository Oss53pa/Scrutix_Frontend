/**
 * PrintService - Service pour l'impression A4 Portrait
 * Gère l'impression du contenu uniquement, sans l'interface de l'application
 */

export interface PrintOptions {
  title?: string;
  hideElements?: string[];
  showElements?: string[];
  beforePrint?: () => void;
  afterPrint?: () => void;
}

export class PrintService {
  private static originalBodyContent: string | null = null;
  private static printStylesId = 'print-service-styles';

  /**
   * Imprimer un élément spécifique (par ID ou ref)
   * Isole le contenu à imprimer du reste de l'application
   */
  static printElement(elementId: string, options: PrintOptions = {}): void {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`[PrintService] Element with id "${elementId}" not found`);
      return;
    }

    this.printContent(element.innerHTML, options);
  }

  /**
   * Imprimer du contenu HTML directement
   */
  static printContent(htmlContent: string, options: PrintOptions = {}): void {
    const { title, beforePrint, afterPrint } = options;

    // Callback avant impression
    beforePrint?.();

    // Créer une iframe cachée pour l'impression
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.top = '-10000px';
    printFrame.style.left = '-10000px';
    printFrame.style.width = '210mm'; // A4 width
    printFrame.style.height = '297mm'; // A4 height
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!frameDoc) {
      console.error('[PrintService] Could not access iframe document');
      document.body.removeChild(printFrame);
      return;
    }

    // Construire le document d'impression
    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title || 'Document Scrutix'}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 10mm 15mm 10mm;
          }

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #1a1a1a;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Typography */
          h1 { font-size: 20pt; margin-bottom: 12pt; color: #1e3a8a; }
          h2 { font-size: 16pt; margin-bottom: 10pt; color: #1e3a8a; }
          h3 { font-size: 14pt; margin-bottom: 8pt; color: #374151; }
          h4 { font-size: 12pt; margin-bottom: 6pt; color: #374151; }
          p { margin-bottom: 8pt; }

          /* Tables */
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 12pt 0;
            font-size: 9pt;
          }

          th, td {
            border: 1px solid #d1d5db;
            padding: 6pt 8pt;
            text-align: left;
          }

          th {
            background-color: #1e3a8a;
            color: white;
            font-weight: 600;
          }

          tr:nth-child(even) {
            background-color: #f9fafb;
          }

          /* Cards/Boxes */
          .card, .box {
            border: 1px solid #e5e7eb;
            border-radius: 4pt;
            padding: 12pt;
            margin: 8pt 0;
            break-inside: avoid;
          }

          /* Badges */
          .badge {
            display: inline-block;
            padding: 2pt 8pt;
            border-radius: 10pt;
            font-size: 8pt;
            font-weight: 600;
          }

          .badge-success { background: #dcfce7; color: #166534; }
          .badge-warning { background: #fef3c7; color: #92400e; }
          .badge-error, .badge-danger { background: #fee2e2; color: #dc2626; }
          .badge-info { background: #dbeafe; color: #1e40af; }

          /* Stats */
          .stat-value {
            font-size: 18pt;
            font-weight: 700;
            color: #1e3a8a;
          }

          .stat-label {
            font-size: 9pt;
            color: #6b7280;
            text-transform: uppercase;
          }

          /* Page breaks */
          .page-break { page-break-before: always; }
          .avoid-break { break-inside: avoid; }

          /* Header/Footer */
          .print-header {
            padding-bottom: 12pt;
            border-bottom: 2px solid #1e3a8a;
            margin-bottom: 16pt;
          }

          .print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 8pt;
            border-top: 1px solid #e5e7eb;
            font-size: 8pt;
            color: #6b7280;
            text-align: center;
          }

          /* Logo/Brand */
          .brand {
            font-size: 18pt;
            font-weight: 700;
            color: #1e3a8a;
          }

          /* Grid for stats */
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12pt;
            margin: 16pt 0;
          }

          .stat-box {
            text-align: center;
            padding: 12pt;
            border: 1px solid #e5e7eb;
            border-radius: 4pt;
          }

          /* Colors */
          .text-primary { color: #1e3a8a; }
          .text-success { color: #16a34a; }
          .text-warning { color: #eab308; }
          .text-danger { color: #dc2626; }
          .text-muted { color: #6b7280; }

          .bg-primary { background-color: #1e3a8a; color: white; }
          .bg-success { background-color: #dcfce7; }
          .bg-warning { background-color: #fef3c7; }
          .bg-danger { background-color: #fee2e2; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `);
    frameDoc.close();

    // Attendre le chargement puis imprimer
    printFrame.onload = () => {
      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();

        // Nettoyer après un délai
        setTimeout(() => {
          document.body.removeChild(printFrame);
          afterPrint?.();
        }, 1000);
      }, 250);
    };
  }

  /**
   * Imprimer la page courante avec isolation du contenu
   * Cache l'interface et n'imprime que le contenu principal
   */
  static printCurrentPage(contentSelector: string = 'main', options: PrintOptions = {}): void {
    const { beforePrint, afterPrint } = options;

    // Injecter les styles d'impression temporaires
    this.injectPrintStyles(contentSelector);

    // Callback avant impression
    beforePrint?.();

    // Déclencher l'impression
    window.print();

    // Nettoyer après impression
    window.onafterprint = () => {
      this.removePrintStyles();
      afterPrint?.();
      window.onafterprint = null;
    };
  }

  /**
   * Injecter des styles d'impression temporaires
   */
  private static injectPrintStyles(contentSelector: string): void {
    // Supprimer les anciens styles si présents
    this.removePrintStyles();

    const style = document.createElement('style');
    style.id = this.printStylesId;
    style.textContent = `
      @media print {
        body > *:not(${contentSelector}) {
          display: none !important;
        }

        ${contentSelector} {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Supprimer les styles d'impression temporaires
   */
  private static removePrintStyles(): void {
    const existingStyle = document.getElementById(this.printStylesId);
    if (existingStyle) {
      existingStyle.remove();
    }
  }

  /**
   * Générer un aperçu avant impression dans une nouvelle fenêtre
   */
  static openPrintPreview(htmlContent: string, title: string = 'Aperçu impression'): Window | null {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      console.error('[PrintService] Could not open print preview window');
      return null;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body {
            font-family: 'Segoe UI', sans-serif;
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .print-preview-container {
            background: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            padding: 20mm;
            min-height: 297mm;
          }
          .print-actions {
            position: fixed;
            top: 10px;
            right: 10px;
            display: flex;
            gap: 10px;
          }
          .print-actions button {
            padding: 10px 20px;
            cursor: pointer;
            border: none;
            border-radius: 4px;
            font-weight: 600;
          }
          .btn-print {
            background: #1e3a8a;
            color: white;
          }
          .btn-close {
            background: #e5e7eb;
            color: #374151;
          }
          @media print {
            .print-actions { display: none; }
            body { background: white; padding: 0; }
            .print-preview-container { box-shadow: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="print-actions">
          <button class="btn-print" onclick="window.print()">🖨️ Imprimer</button>
          <button class="btn-close" onclick="window.close()">✕ Fermer</button>
        </div>
        <div class="print-preview-container">
          ${htmlContent}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();

    return printWindow;
  }
}
