// ============================================================================
// ATLASBANX — Bank statement extractor — types
// ============================================================================
// Generic types that work across ANY bank format. The extractor is built
// around the principle that every modern bank statement is a table whose
// columns can be discovered automatically by reading the header row.
// ============================================================================

import type { Transaction } from '../../types';

/** A word/token from the PDF with its position on the page */
export interface PositionedItem {
  text: string;
  /** Page number (1-indexed) */
  page: number;
  /** Bottom-left corner X (PDF coords, page-relative) */
  x: number;
  /** Bottom-left corner Y */
  y: number;
  /** Width in PDF units (best effort) */
  width?: number;
  /** Height in PDF units (best effort) */
  height?: number;
}

/** A line of items grouped by similar Y on a single page */
export interface ReconstructedRow {
  page: number;
  y: number;
  items: PositionedItem[];
}

/** A logical column detected in the table */
export interface DetectedColumn {
  /** Stable role assigned by the detector */
  role: ColumnRole;
  /** Original header label (free text, "Débit (XOF)" etc.) */
  label: string;
  /** Header X (left edge) */
  xLeft: number;
  /** X at which the next column starts — the right boundary */
  xRight: number;
  /** Page on which the header was detected (assumed identical across pages) */
  page: number;
}

/** Logical column types we know how to consume */
export type ColumnRole =
  | 'date'         // primary operation date
  | 'value_date'   // date de valeur (some banks have it as a separate column)
  | 'description' // libellé / wording / object
  | 'reference'    // chèque #, reference, swift id
  | 'debit'        // separate debit column
  | 'credit'       // separate credit column
  | 'amount'       // single amount column (signed or unsigned, in some banks)
  | 'type'         // débit/crédit indicator (D/C, +/-, etc.)
  | 'balance'      // running balance
  | 'currency'
  | 'unknown';

/** Detected table structure for a statement */
export interface TableStructure {
  columns: DetectedColumn[];
  /** Y of the header row on the page */
  headerY: number;
  /** Page where the header was detected */
  headerPage: number;
  /** Heuristic confidence in this structure (0-1) */
  confidence: number;
}

/** A row reconstructed and mapped to columns */
export interface MappedRow {
  page: number;
  y: number;
  /** Cell text per column role; undefined if column not present */
  cells: Partial<Record<ColumnRole, string>>;
  /** Raw items for diagnostic / fallback */
  items: PositionedItem[];
}

/** A reconstructed transaction candidate (before final sanity checks) */
export interface ExtractedTransaction {
  date?: Date;
  valueDate?: Date;
  description: string;
  reference?: string;
  /** Positive for credit, negative for debit, 0 if unknown */
  amount: number;
  balance?: number;
  currency?: string;
  /** Was this row a continuation of a multi-line transaction? */
  multiline: boolean;
  /** Confidence in the parse (0-1) */
  confidence: number;
  /** Free-text warnings (date format unclear, amount in unexpected column, etc.) */
  warnings: string[];
  /** The mapped row used to build this transaction (debug) */
  source?: MappedRow;
}

export interface ExtractionStats {
  totalPages: number;
  itemCount: number;
  rowCount: number;
  headerDetected: boolean;
  headerConfidence: number;
  transactionCount: number;
  averageConfidence: number;
  ocrUsed: boolean;
  durationMs: number;
}

export interface ExtractionResult {
  success: boolean;
  transactions: Transaction[];
  /** Pre-domain-mapping candidates with provenance */
  candidates: ExtractedTransaction[];
  stats: ExtractionStats;
  warnings: string[];
  /** Hint for the UI when nothing comes out */
  diagnostic?: string;
}

export interface ExtractionOptions {
  /** Force OCR even if a text layer is present (for benchmarking) */
  forceOcr?: boolean;
  /** Skip OCR entirely (for fast preview) */
  skipOcr?: boolean;
  /** Currency hint */
  defaultCurrency?: 'XAF' | 'XOF' | 'EUR' | 'USD';
  /** Bank code hint (used to pick a template if available) */
  bankCode?: string;
  /** Tolerance to group items into the same row, in PDF units */
  rowYTolerance?: number;
  /** Progress callback */
  onProgress?: (p: { stage: string; pct: number; message: string }) => void;
}
