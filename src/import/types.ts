/**
 * @module AtlasBanx
 * @file src/import/types.ts
 * @description Types du module Import étendu (Bloc 7).
 * @author Atlas Studio
 * @version 1.0.0
 */

import type { Transaction } from '../types';

export type ConnectorType = 'ocr' | 'csv' | 'excel' | 'api' | 'open_banking';

export interface ImportSource {
  file?: File;
  apiEndpoint?: string;
  credentials?: Record<string, string>;
}

export interface ConnectorConfig {
  bankCode?: string;
  columnMapping?: ColumnMappingConfig;
  dateFormat?: string;
  separator?: string;
  encoding?: string;
  sheetIndex?: number;
}

export interface ColumnMappingConfig {
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance?: string;
  reference?: string;
  valueDate?: string;
  currency?: string;
}

export interface BankConnector {
  id: string;
  name: string;
  country: string[];
  type: ConnectorType;
  isAvailable(): boolean;
  import(source: ImportSource, config: ConnectorConfig): Promise<Transaction[]>;
}

export interface ImportHistoryEntry {
  id: string;
  userId: string;
  clientId: string | null;
  connectorId: string;
  fileName: string;
  fileHash: string | null;
  fileSizeBytes: number | null;
  transactionsCount: number;
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
  status: 'success' | 'partial' | 'failed';
  errorMessage: string | null;
  importedAt: Date;
}

export interface CsvPreviewRow {
  /** Numéro de ligne (1-based) */
  lineNumber: number;
  /** Colonnes brutes */
  columns: string[];
}

export interface CsvDetectionResult {
  separator: ',' | ';' | '|' | '\t';
  encoding: string;
  dateFormat: string;
  headerRow: string[];
  previewRows: CsvPreviewRow[];
  decimalSeparator: '.' | ',';
  thousandSeparator: '.' | ',' | ' ' | '';
}

export type ImportWizardStep = 'source' | 'upload' | 'validation' | 'confirmation';
