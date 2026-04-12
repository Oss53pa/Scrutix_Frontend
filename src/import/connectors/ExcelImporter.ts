/**
 * @module AtlasBanx
 * @file src/import/connectors/ExcelImporter.ts
 * @description Importateur Excel (.xlsx / .xls) via ExcelJS (déjà en deps).
 *              Support multi-onglets, mapping de colonnes identique au CSV.
 *              Limité à 100 000 lignes par fichier.
 * @author Atlas Studio
 * @version 1.0.0
 */

import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import type {
  BankConnector,
  ImportSource,
  ConnectorConfig,
} from '../types';
import type { Transaction } from '../../types';
import { TransactionType } from '../../types';

const MAX_ROWS = 100_000;

export class ExcelImporter implements BankConnector {
  readonly id = 'excel_universal';
  readonly name = 'Excel (.xlsx / .xls)';
  readonly country = ['*'];
  readonly type = 'excel' as const;

  isAvailable(): boolean {
    return true;
  }

  async import(source: ImportSource, config: ConnectorConfig): Promise<Transaction[]> {
    if (!source.file) throw new Error('Fichier Excel requis');
    if (!config.columnMapping) throw new Error('Mapping de colonnes requis');

    const workbook = new ExcelJS.Workbook();
    const buffer = await source.file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const sheetIndex = config.sheetIndex ?? 0;
    const sheet = workbook.worksheets[sheetIndex];
    if (!sheet) throw new Error(`Onglet ${sheetIndex + 1} introuvable`);

    const rows = sheet.getSheetValues() as (string | number | null | undefined)[][];
    if (rows.length < 2) throw new Error('Feuille vide ou header manquant');

    // rows[0] est undefined (ExcelJS est 1-based), rows[1] = header
    const header = (rows[1] ?? []).map((h) => String(h ?? '').trim());
    const mapping = config.columnMapping;

    const getIdx = (col: string) => header.indexOf(col);
    const dateIdx = getIdx(mapping.date);
    const descIdx = getIdx(mapping.description);
    const debitIdx = getIdx(mapping.debit);
    const creditIdx = getIdx(mapping.credit);
    const balanceIdx = mapping.balance ? getIdx(mapping.balance) : -1;
    const refIdx = mapping.reference ? getIdx(mapping.reference) : -1;

    if (dateIdx === -1 || descIdx === -1) {
      throw new Error('Colonnes date et description introuvables');
    }

    const transactions: Transaction[] = [];

    for (let i = 2; i < rows.length && i < MAX_ROWS + 2; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      const rawDate = row[dateIdx];
      const date = this.parseExcelDate(rawDate);
      if (!date) continue;

      const description = String(row[descIdx] ?? '').trim();
      const debit = debitIdx >= 0 ? Number(row[debitIdx]) || 0 : 0;
      const credit = creditIdx >= 0 ? Number(row[creditIdx]) || 0 : 0;
      const amount = credit > 0 ? credit : -Math.abs(debit);
      const balance = balanceIdx >= 0 ? Number(row[balanceIdx]) || 0 : 0;
      const reference = refIdx >= 0 ? String(row[refIdx] ?? '').trim() : undefined;

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
   * Liste les noms d'onglets du fichier pour sélection.
   */
  async listSheets(file: File): Promise<string[]> {
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);
    return workbook.worksheets.map((s) => s.name);
  }

  // --------------------------------------------------------------------------

  private parseExcelDate(value: unknown): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
      // Numéro de série Excel (jours depuis 1900-01-01)
      const epoch = new Date(1899, 11, 30);
      epoch.setDate(epoch.getDate() + value);
      return epoch;
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  static readonly MAX_ROWS = MAX_ROWS;
}
