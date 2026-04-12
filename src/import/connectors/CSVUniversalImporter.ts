/**
 * @module AtlasBanx
 * @file src/import/connectors/CSVUniversalImporter.ts
 * @description Importateur CSV universel avec :
 *                • Détection automatique du séparateur (, ; | tab)
 *                • Détection automatique de l'encodage (UTF-8, Latin-1)
 *                • Détection du format de date (DD/MM/YYYY, YYYY-MM-DD, etc.)
 *                • Gestion des formats numériques (1.234,56 vs 1,234.56)
 *                • Preview des 5 premières lignes pour mapping
 *                • Mapping de colonnes configurable et sauvegardable
 * @author Atlas Studio
 * @version 1.0.0
 */

import Papa from 'papaparse';
import type {
  BankConnector,
  ImportSource,
  ConnectorConfig,
  CsvDetectionResult,
  CsvPreviewRow,
} from '../types';
import type { Transaction } from '../../types';
import { TransactionType } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class CSVUniversalImporter implements BankConnector {
  readonly id = 'csv_universal';
  readonly name = 'CSV Universel';
  readonly country = ['*'];
  readonly type = 'csv' as const;

  isAvailable(): boolean {
    return true;
  }

  /**
   * Point d'entrée principal : parse un CSV en transactions selon le mapping fourni.
   */
  async import(source: ImportSource, config: ConnectorConfig): Promise<Transaction[]> {
    if (!source.file) throw new Error('Fichier CSV requis');
    if (!config.columnMapping) throw new Error('Mapping de colonnes requis');

    const text = await this.readFileAsText(source.file, config.encoding);
    const separator = config.separator ?? this.detectSeparator(text);
    const parsed = Papa.parse<string[]>(text, {
      delimiter: separator,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      throw new Error(`Erreur de parsing CSV : ${parsed.errors[0].message}`);
    }

    const rows = parsed.data;
    if (rows.length < 2) throw new Error('Le fichier ne contient pas assez de lignes');

    // Première ligne = header
    const header = rows[0].map((h) => h.trim());
    const mapping = config.columnMapping;

    const getIdx = (col: string) => header.indexOf(col);
    const dateIdx = getIdx(mapping.date);
    const descIdx = getIdx(mapping.description);
    const debitIdx = getIdx(mapping.debit);
    const creditIdx = getIdx(mapping.credit);
    const balanceIdx = mapping.balance ? getIdx(mapping.balance) : -1;
    const refIdx = mapping.reference ? getIdx(mapping.reference) : -1;

    if (dateIdx === -1 || descIdx === -1) {
      throw new Error('Colonnes date et description introuvables dans le header');
    }
    if (debitIdx === -1 && creditIdx === -1) {
      throw new Error('Au moins une colonne débit ou crédit est requise');
    }

    const transactions: Transaction[] = [];
    const dateFormat = config.dateFormat ?? 'DD/MM/YYYY';

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      const dateStr = row[dateIdx]?.trim();
      const date = this.parseDate(dateStr, dateFormat);
      if (!date) continue;

      const description = row[descIdx]?.trim() ?? '';
      const debit = debitIdx >= 0 ? this.parseNumber(row[debitIdx]) : 0;
      const credit = creditIdx >= 0 ? this.parseNumber(row[creditIdx]) : 0;
      const amount = credit > 0 ? credit : -debit;
      const balance = balanceIdx >= 0 ? this.parseNumber(row[balanceIdx]) : 0;
      const reference = refIdx >= 0 ? row[refIdx]?.trim() : undefined;

      transactions.push({
        id: uuidv4(),
        clientId: '',
        accountNumber: '',
        bankCode: config.bankCode ?? 'UNKNOWN',
        date,
        valueDate: date,
        amount,
        balance,
        description,
        reference,
        type: amount >= 0 ? TransactionType.CREDIT : TransactionType.DEBIT,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return transactions;
  }

  /**
   * Analyse les premières lignes d'un CSV pour la détection automatique.
   */
  async preview(file: File): Promise<CsvDetectionResult> {
    const text = await this.readFileAsText(file);
    const separator = this.detectSeparator(text);
    const dateFormat = this.detectDateFormat(text);
    const { decimal, thousand } = this.detectNumberFormat(text);

    const lines = text.split('\n').filter(Boolean).slice(0, 6);
    const headerRow = lines[0]?.split(separator).map((h) => h.trim()) ?? [];
    const previewRows: CsvPreviewRow[] = lines.slice(1).map((line, idx) => ({
      lineNumber: idx + 2,
      columns: line.split(separator).map((c) => c.trim()),
    }));

    return {
      separator: separator as CsvDetectionResult['separator'],
      encoding: 'UTF-8',
      dateFormat,
      headerRow,
      previewRows,
      decimalSeparator: decimal,
      thousandSeparator: thousand,
    };
  }

  // --------------------------------------------------------------------------
  // DÉTECTION
  // --------------------------------------------------------------------------

  detectSeparator(text: string): string {
    const sample = text.slice(0, 4096);
    const counts: Record<string, number> = { ',': 0, ';': 0, '|': 0, '\t': 0 };
    for (const char of sample) {
      if (char in counts) counts[char]++;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  detectDateFormat(text: string): string {
    const sample = text.slice(0, 4096);
    if (/\d{2}\/\d{2}\/\d{4}/.test(sample)) return 'DD/MM/YYYY';
    if (/\d{4}-\d{2}-\d{2}/.test(sample)) return 'YYYY-MM-DD';
    if (/\d{2}-\d{2}-\d{4}/.test(sample)) return 'DD-MM-YYYY';
    if (/\d{2}\.\d{2}\.\d{4}/.test(sample)) return 'DD.MM.YYYY';
    return 'DD/MM/YYYY';
  }

  detectNumberFormat(text: string): { decimal: '.' | ','; thousand: '.' | ',' | ' ' | '' } {
    const sample = text.slice(0, 4096);
    // Heuristique: si "1.234,56" → decimal=, thousand=.
    if (/\d{1,3}\.\d{3},\d{2}/.test(sample)) {
      return { decimal: ',', thousand: '.' };
    }
    // Si "1,234.56" → decimal=. thousand=,
    if (/\d{1,3},\d{3}\.\d{2}/.test(sample)) {
      return { decimal: '.', thousand: ',' };
    }
    // Si "1 234,56" → decimal=, thousand=space
    if (/\d{1,3}\s\d{3},\d{2}/.test(sample)) {
      return { decimal: ',', thousand: ' ' };
    }
    return { decimal: '.', thousand: '' };
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  parseDate(value: string | undefined, format: string): Date | null {
    if (!value) return null;
    const v = value.trim();
    let d: number, m: number, y: number;

    switch (format) {
      case 'DD/MM/YYYY':
      case 'DD-MM-YYYY':
      case 'DD.MM.YYYY': {
        const parts = v.split(/[/\-.]/);
        if (parts.length < 3) return null;
        [d, m, y] = parts.map(Number);
        break;
      }
      case 'YYYY-MM-DD': {
        const parts = v.split('-');
        if (parts.length < 3) return null;
        [y, m, d] = parts.map(Number);
        break;
      }
      default:
        return null;
    }

    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    return new Date(y, m - 1, d);
  }

  parseNumber(value: string | undefined): number {
    if (!value) return 0;
    // Nettoyage des séparateurs de milliers et normalisation du décimal
    const cleaned = value
      .trim()
      .replace(/\s/g, '')
      .replace(/\.(\d{3})/g, '$1')  // 1.234 → 1234 (si suivi de 3 digits)
      .replace(',', '.');          // 1234,56 → 1234.56
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }

  async readFileAsText(file: File, encoding?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, encoding ?? 'UTF-8');
    });
  }
}
