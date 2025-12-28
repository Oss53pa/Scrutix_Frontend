import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import * as pdfjsLib from 'pdfjs-dist';
import { v4 as uuidv4 } from 'uuid';
import {
  Transaction,
  TransactionType,
  ImportConfig,
  ImportResult,
  ImportError,
  ImportedRow,
  ColumnMapping,
} from '../types';
import { OcrService } from './OcrService';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Limite de taille de fichier (50 MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export class ImportService {
  /**
   * Parse a file (CSV, Excel, or PDF) and return transactions
   */
  static async parseFile(
    file: File,
    config: Partial<ImportConfig>
  ): Promise<ImportResult> {
    // Vérifier la taille du fichier
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        totalRows: 0,
        importedRows: 0,
        skippedRows: 0,
        errors: [{ row: 0, message: `Fichier trop volumineux. Taille maximale: 50 MB` }],
        transactions: [],
      };
    }

    const fileType = this.detectFileType(file);

    switch (fileType) {
      case 'csv':
        return this.parseCSV(file, config);
      case 'excel':
        return this.parseExcel(file, config);
      case 'pdf':
        return this.parsePDF(file, config);
      case 'image':
        return this.parseImage(file, config);
      default:
        return {
          success: false,
          totalRows: 0,
          importedRows: 0,
          skippedRows: 0,
          errors: [{ row: 0, message: `Type de fichier non supporté: ${file.type}` }],
          transactions: [],
        };
    }
  }

  /**
   * Detect file type from extension or MIME type
   */
  private static detectFileType(file: File): 'csv' | 'excel' | 'pdf' | 'image' | 'unknown' {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type;

    if (extension === 'csv' || mimeType === 'text/csv') {
      return 'csv';
    }
    if (
      extension === 'xlsx' ||
      extension === 'xls' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      return 'excel';
    }
    if (extension === 'pdf' || mimeType === 'application/pdf') {
      return 'pdf';
    }
    if (
      ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif'].includes(extension || '') ||
      mimeType.startsWith('image/')
    ) {
      return 'image';
    }

    return 'unknown';
  }

  /**
   * Parse CSV file
   */
  private static async parseCSV(
    file: File,
    config: Partial<ImportConfig>
  ): Promise<ImportResult> {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: config.hasHeader !== false,
        skipEmptyLines: true,
        dynamicTyping: false,
        encoding: 'UTF-8',
        complete: (results) => {
          const rows = results.data as ImportedRow[];
          const result = this.processRows(rows, config);
          resolve(result);
        },
        error: (error) => {
          resolve({
            success: false,
            totalRows: 0,
            importedRows: 0,
            skippedRows: 0,
            errors: [{ row: 0, message: `Erreur de parsing CSV: ${error.message}` }],
            transactions: [],
          });
        },
      });
    });
  }

  /**
   * Parse Excel file using ExcelJS
   */
  private static async parseExcel(
    file: File,
    config: Partial<ImportConfig>
  ): Promise<ImportResult> {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error('Aucune feuille trouvee dans le fichier Excel');
      }

      const rows: ImportedRow[] = [];
      let headers: string[] = [];

      worksheet.eachRow((row, rowNumber) => {
        const values = row.values as (string | number | Date | null)[];
        // Remove first empty element (ExcelJS uses 1-based indexing)
        const cleanValues = values.slice(1);

        if (rowNumber === 1 && config.hasHeader !== false) {
          // First row is headers
          headers = cleanValues.map((v) => String(v ?? `Col${cleanValues.indexOf(v) + 1}`));
        } else {
          // Data row
          const rowObj: ImportedRow = {};
          cleanValues.forEach((value, index) => {
            const key = headers[index] || `Col${index + 1}`;
            // Handle ExcelJS date objects
            if (value instanceof Date) {
              rowObj[key] = value;
            } else {
              rowObj[key] = value;
            }
          });
          rows.push(rowObj);
        }
      });

      return this.processRows(rows, config);
    } catch (error) {
      return {
        success: false,
        totalRows: 0,
        importedRows: 0,
        skippedRows: 0,
        errors: [
          {
            row: 0,
            message: `Erreur de parsing Excel: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          },
        ],
        transactions: [],
      };
    }
  }

  /**
   * Parse PDF file using pdfjs-dist, with OCR fallback for scanned PDFs
   */
  private static async parsePDF(
    file: File,
    config: Partial<ImportConfig>
  ): Promise<ImportResult> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const allTextLines: string[] = [];

      // Extraire le texte de chaque page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Grouper les items par ligne (même position Y)
        const lineMap = new Map<number, string[]>();

        for (const item of textContent.items) {
          if ('str' in item && item.str.trim()) {
            // Arrondir Y pour grouper les éléments sur la même ligne
            const y = Math.round(('transform' in item ? item.transform[5] : 0) / 5) * 5;
            if (!lineMap.has(y)) {
              lineMap.set(y, []);
            }
            lineMap.get(y)!.push(item.str);
          }
        }

        // Trier par Y décroissant (haut vers bas) et joindre
        const sortedLines = Array.from(lineMap.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([, items]) => items.join(' ').trim())
          .filter(line => line.length > 0);

        allTextLines.push(...sortedLines);
      }

      // Parser les lignes pour extraire les transactions
      let rows = this.parseTextLinesToRows(allTextLines);

      // Si aucune transaction trouvée, essayer l'OCR (PDF scanné probable)
      if (rows.length === 0) {
        console.log('[ImportService] Aucun texte exploitable, tentative OCR...');

        // Vérifier si le PDF est basé sur des images
        const isImageBased = await OcrService.isPdfImageBased(file);

        if (isImageBased || allTextLines.length < 10) {
          // Utiliser l'OCR pour extraire le texte
          const ocrResult = await OcrService.recognizePdf(file);

          if (ocrResult.success && ocrResult.text) {
            console.log(`[ImportService] OCR réussi (confiance: ${ocrResult.confidence.toFixed(1)}%)`);
            const ocrLines = ocrResult.text.split('\n').filter(line => line.trim().length > 0);
            rows = this.parseTextLinesToRows(ocrLines);
          }
        }
      }

      if (rows.length === 0) {
        return {
          success: false,
          totalRows: 0,
          importedRows: 0,
          skippedRows: 0,
          errors: [{
            row: 0,
            message: 'Aucune transaction détectée dans le PDF (texte et OCR). Vérifiez le format du relevé.',
          }],
          transactions: [],
        };
      }

      return this.processRows(rows, config);
    } catch (error) {
      return {
        success: false,
        totalRows: 0,
        importedRows: 0,
        skippedRows: 0,
        errors: [{
          row: 0,
          message: `Erreur de parsing PDF: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        }],
        transactions: [],
      };
    }
  }

  /**
   * Parse image file using OCR
   */
  private static async parseImage(
    file: File,
    config: Partial<ImportConfig>
  ): Promise<ImportResult> {
    try {
      console.log('[ImportService] Parsing image avec OCR...');

      const ocrResult = await OcrService.recognizeImage(file);

      if (!ocrResult.success) {
        return {
          success: false,
          totalRows: 0,
          importedRows: 0,
          skippedRows: 0,
          errors: [{
            row: 0,
            message: `Erreur OCR: ${ocrResult.error || 'Impossible de lire l\'image'}`,
          }],
          transactions: [],
        };
      }

      console.log(`[ImportService] OCR réussi (confiance: ${ocrResult.confidence.toFixed(1)}%)`);

      // Parser le texte OCR
      const lines = ocrResult.text.split('\n').filter(line => line.trim().length > 0);
      const rows = this.parseTextLinesToRows(lines);

      if (rows.length === 0) {
        return {
          success: false,
          totalRows: 0,
          importedRows: 0,
          skippedRows: 0,
          errors: [{
            row: 0,
            message: 'Aucune transaction détectée dans l\'image. Vérifiez la qualité et le format du relevé.',
          }],
          transactions: [],
        };
      }

      return this.processRows(rows, config);
    } catch (error) {
      return {
        success: false,
        totalRows: 0,
        importedRows: 0,
        skippedRows: 0,
        errors: [{
          row: 0,
          message: `Erreur de parsing image: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        }],
        transactions: [],
      };
    }
  }

  /**
   * Parse text lines from PDF into row objects
   */
  private static parseTextLinesToRows(lines: string[]): ImportedRow[] {
    const rows: ImportedRow[] = [];

    // Patterns pour détecter les transactions bancaires
    const datePattern = /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/;
    const amountPattern = /([+-]?\s*[\d\s]+[,.]\d{2})\s*(€|EUR|XAF|XOF|FCFA)?/i;

    for (const line of lines) {
      // Ignorer les lignes trop courtes ou les en-têtes typiques
      if (line.length < 10) continue;
      if (/^(date|libelle|montant|solde|debit|credit|référence)/i.test(line)) continue;

      // Chercher une date dans la ligne
      const dateMatch = line.match(datePattern);
      if (!dateMatch) continue;

      // Chercher des montants
      const amountMatches = line.match(new RegExp(amountPattern.source, 'gi'));
      if (!amountMatches || amountMatches.length === 0) continue;

      // Extraire la description (tout entre la date et les montants)
      const dateEnd = line.indexOf(dateMatch[1]) + dateMatch[1].length;
      const firstAmountStart = line.indexOf(amountMatches[0]);
      let description = '';

      if (firstAmountStart > dateEnd) {
        description = line.substring(dateEnd, firstAmountStart).trim();
      }

      // Nettoyer la description
      description = description.replace(/^\s*[-:]\s*/, '').trim();

      if (description.length < 3) {
        // Essayer de prendre le reste de la ligne après la date
        description = line.substring(dateEnd).replace(amountPattern, '').trim();
      }

      // Parser le montant principal
      const amountStr = amountMatches[0]
        .replace(/[€EUR XAF XOF FCFA]/gi, '')
        .replace(/\s/g, '')
        .replace(',', '.');

      const amount = parseFloat(amountStr);
      if (isNaN(amount)) continue;

      // Créer la ligne
      rows.push({
        date: dateMatch[1],
        description: description || 'Transaction',
        amount: amountStr,
        // Si plusieurs montants, le dernier est probablement le solde
        balance: amountMatches.length > 1
          ? amountMatches[amountMatches.length - 1]
              .replace(/[€EUR XAF XOF FCFA]/gi, '')
              .replace(/\s/g, '')
              .replace(',', '.')
          : undefined,
      });
    }

    return rows;
  }

  /**
   * Process parsed rows into transactions
   */
  private static processRows(
    rows: ImportedRow[],
    config: Partial<ImportConfig>
  ): ImportResult {
    const transactions: Transaction[] = [];
    const errors: ImportError[] = [];
    const skipRows = config.skipRows || 0;

    // Skip initial rows if specified
    const dataRows = rows.slice(skipRows);

    for (let i = 0; i < dataRows.length; i++) {
      const rowIndex = i + skipRows + 1; // 1-indexed for user display
      const row = dataRows[i];

      try {
        const transaction = this.rowToTransaction(row, config, rowIndex);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        errors.push({
          row: rowIndex,
          message: error instanceof Error ? error.message : 'Erreur de conversion',
        });
      }
    }

    return {
      success: errors.length === 0,
      totalRows: dataRows.length,
      importedRows: transactions.length,
      skippedRows: dataRows.length - transactions.length,
      errors,
      transactions,
    };
  }

  /**
   * Convert a row to a Transaction
   */
  private static rowToTransaction(
    row: ImportedRow,
    config: Partial<ImportConfig>,
    rowIndex: number
  ): Transaction | null {
    const mappings = config.columnMappings || this.autoDetectMappings(row);

    // Extract values using mappings
    const getValue = (field: keyof Transaction): unknown => {
      const mapping = mappings.find((m) => m.targetField === field);
      if (!mapping) return undefined;

      const value = row[mapping.sourceColumn];
      if (mapping.transform) {
        return mapping.transform(String(value ?? ''));
      }
      return value;
    };

    // Parse date
    const dateValue = getValue('date');
    const date = this.parseDate(dateValue, config.dateFormat);
    if (!date) {
      throw new Error(`Date invalide à la ligne ${rowIndex}`);
    }

    // Parse amount
    const amountValue = getValue('amount');
    const amount = this.parseAmount(amountValue, config);
    if (amount === null) {
      throw new Error(`Montant invalide à la ligne ${rowIndex}`);
    }

    // Parse description
    const description = String(getValue('description') || '').trim();
    if (!description) {
      throw new Error(`Description manquante à la ligne ${rowIndex}`);
    }

    // Optional fields
    const valueDateValue = getValue('valueDate');
    const valueDate = valueDateValue ? this.parseDate(valueDateValue, config.dateFormat) : date;

    const balanceValue = getValue('balance');
    const balance = balanceValue !== undefined ? this.parseAmount(balanceValue, config) : 0;

    const now = new Date();

    // Use provided accountNumber from config, or try to extract from row
    const accountNumber = (config as { accountNumber?: string }).accountNumber
      || String(getValue('accountNumber') || 'N/A');

    return {
      id: uuidv4(),
      clientId: config.clientId || 'default',
      accountNumber,
      bankCode: config.bankCode || 'UNKNOWN',
      date,
      valueDate: valueDate || date,
      amount,
      balance: balance || 0,
      description,
      reference: String(getValue('reference') || ''),
      type: this.detectTransactionType(amount, description),
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Auto-detect column mappings based on common header names
   */
  static autoDetectMappings(row: ImportedRow): ColumnMapping[] {
    const mappings: ColumnMapping[] = [];
    const keys = Object.keys(row);

    const patterns: Record<keyof Transaction, RegExp[]> = {
      date: [/date/i, /dt/i, /jour/i],
      valueDate: [/date.*valeur/i, /val.*date/i, /value.*date/i],
      amount: [/montant/i, /amount/i, /somme/i, /debit|credit/i],
      balance: [/solde/i, /balance/i],
      description: [/libelle|libellé/i, /description/i, /motif/i, /label/i],
      reference: [/ref|référence/i, /numero/i, /number/i],
      accountNumber: [/compte/i, /account/i, /iban/i],
    } as Record<keyof Transaction, RegExp[]>;

    for (const [field, regexes] of Object.entries(patterns)) {
      for (const key of keys) {
        if (regexes.some((regex) => regex.test(key))) {
          mappings.push({
            sourceColumn: key,
            targetField: field as keyof Transaction,
          });
          break;
        }
      }
    }

    return mappings;
  }

  /**
   * Parse a date from various formats
   */
  private static parseDate(value: unknown, format?: string): Date | null {
    if (!value) return null;

    // Already a Date
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    const str = String(value).trim();

    // Common date formats
    const formats = format
      ? [format]
      : [
          'dd/MM/yyyy',
          'dd-MM-yyyy',
          'yyyy-MM-dd',
          'MM/dd/yyyy',
          'd/M/yyyy',
          'dd/MM/yy',
        ];

    // Try parsing with different patterns
    for (const fmt of formats) {
      const date = this.parseDateWithFormat(str, fmt);
      if (date) return date;
    }

    // Try native Date parsing
    const nativeDate = new Date(str);
    if (!isNaN(nativeDate.getTime())) {
      return nativeDate;
    }

    return null;
  }

  /**
   * Parse date with specific format
   */
  private static parseDateWithFormat(str: string, format: string): Date | null {
    const parts = str.split(/[-/]/);
    const formatParts = format.toLowerCase().split(/[-/]/);

    if (parts.length !== formatParts.length) return null;

    let day = 1,
      month = 1,
      year = 2000;

    for (let i = 0; i < parts.length; i++) {
      const part = parseInt(parts[i], 10);
      const formatPart = formatParts[i];

      if (formatPart.includes('d')) day = part;
      else if (formatPart.includes('m')) month = part;
      else if (formatPart.includes('y')) {
        year = part < 100 ? 2000 + part : part;
      }
    }

    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  }

  /**
   * Parse amount from string with various formats
   */
  private static parseAmount(value: unknown, config: Partial<ImportConfig>): number | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number') return value;

    let str = String(value).trim();

    // Remove currency symbols
    str = str.replace(/[A-Za-z€$£¥]/g, '').trim();

    // Handle negative indicators
    const isNegative = str.startsWith('-') || str.startsWith('(') || str.endsWith('-');
    str = str.replace(/[()-]/g, '');

    // Handle decimal and thousands separators
    const decimalSep = config.decimalSeparator || ',';
    const thousandsSep = config.thousandsSeparator || ' ';

    // Remove thousands separator
    if (thousandsSep) {
      str = str.split(thousandsSep).join('');
    }

    // Replace decimal separator with dot
    if (decimalSep === ',') {
      str = str.replace(',', '.');
    }

    const num = parseFloat(str);

    if (isNaN(num)) return null;

    return isNegative ? -Math.abs(num) : num;
  }

  /**
   * Detect transaction type from amount and description
   */
  private static detectTransactionType(amount: number, description: string): TransactionType {
    const lowerDesc = description.toLowerCase();

    // Check for specific keywords
    if (/frais|commission|fee|cost|charge/i.test(lowerDesc)) {
      return TransactionType.FEE;
    }
    if (/int[eé]r[eê]t|agios|interest/i.test(lowerDesc)) {
      return TransactionType.INTEREST;
    }
    if (/virement|transfer|vir\b/i.test(lowerDesc)) {
      return TransactionType.TRANSFER;
    }
    if (/carte|card|cb\b|tpe/i.test(lowerDesc)) {
      return TransactionType.CARD;
    }
    if (/retrait|dab|gab|atm|withdrawal/i.test(lowerDesc)) {
      return TransactionType.ATM;
    }
    if (/ch[eè]que|check|chq/i.test(lowerDesc)) {
      return TransactionType.CHECK;
    }

    // Based on amount sign
    return amount >= 0 ? TransactionType.CREDIT : TransactionType.DEBIT;
  }

  /**
   * Get preview of file data (first N rows)
   */
  static async getPreview(
    file: File,
    maxRows: number = 10
  ): Promise<{ headers: string[]; rows: ImportedRow[] }> {
    const fileType = this.detectFileType(file);

    try {
      if (fileType === 'csv') {
        return new Promise((resolve) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            preview: maxRows,
            complete: (results) => {
              const rows = results.data as ImportedRow[];
              const headers = results.meta.fields || [];
              resolve({ headers, rows });
            },
            error: () => {
              resolve({ headers: [], rows: [] });
            },
          });
        });
      }

      if (fileType === 'excel') {
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          return { headers: [], rows: [] };
        }

        const rows: ImportedRow[] = [];
        let headers: string[] = [];
        let rowCount = 0;

        worksheet.eachRow((row, rowNumber) => {
          if (rowCount >= maxRows + 1) return; // +1 for header

          const values = row.values as (string | number | Date | null)[];
          const cleanValues = values.slice(1);

          if (rowNumber === 1) {
            headers = cleanValues.map((v) => String(v ?? `Col${cleanValues.indexOf(v) + 1}`));
          } else if (rowCount < maxRows) {
            const rowObj: ImportedRow = {};
            cleanValues.forEach((value, index) => {
              const key = headers[index] || `Col${index + 1}`;
              rowObj[key] = value instanceof Date ? value : value;
            });
            rows.push(rowObj);
          }
          rowCount++;
        });

        return { headers, rows };
      }
    } catch {
      // Return empty preview on error
    }

    return { headers: [], rows: [] };
  }
}
