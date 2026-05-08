// ============================================================================
// ATLASBANX — Document Intelligence Engine
// Common types for multi-format, multi-strategy bank-conditions extraction.
// ============================================================================

/** Logical type of value we're trying to extract */
export type FieldKind = 'amount' | 'percentage' | 'count' | 'days' | 'text' | 'boolean';

/** What stage of the cascade produced this value */
export type ExtractionStrategy =
  | 'template'    // Bank-specific hard-coded template (highest confidence)
  | 'pattern'    // Generic regex pattern
  | 'tabular'    // Detected table cell adjacent to a label
  | 'semantic'   // Fuzzy label match + nearest number
  | 'ai'         // LLM-assisted extraction
  | 'default';   // Fallback default — value is NOT from the document

/** Source format of the document */
export type DocumentFormat =
  | 'pdf-native'  // PDF with extractable text layer
  | 'pdf-scan'    // Scanned/image-based PDF (OCR required)
  | 'excel'       // .xlsx / .xls / .csv
  | 'image'       // .png / .jpg
  | 'docx'        // Microsoft Word
  | 'unknown';

/** A single field extraction result with provenance */
export interface FieldExtraction {
  key: string;
  /** The extracted value (number for amount/percentage/count/days, string otherwise) */
  value: number | string | boolean | null;
  kind: FieldKind;
  /** 0-1 confidence score */
  confidence: number;
  /** How we found it */
  strategy: ExtractionStrategy;
  /** Raw text snippet from the document that supported this value */
  evidence?: string;
  /** If multiple candidates were found, the runners-up */
  alternatives?: { value: number | string; confidence: number; strategy: ExtractionStrategy; evidence?: string }[];
  /** Page number (1-indexed) where the value was found, if applicable */
  page?: number;
}

/** Definition of a field we know how to extract */
export interface FieldDefinition {
  /** Stable key — also the path to set on the output (dot notation: "accountFees.tenueCompte.particulier") */
  key: string;
  /** Human label (FR) */
  label: string;
  kind: FieldKind;
  /**
   * Synonyms / aliases for label matching. Order doesn't matter; case-insensitive
   * and accent-insensitive comparison applies.
   */
  aliases: string[];
  /** Default value used only when no extraction succeeds (UI shows it as "default") */
  default?: number | string | boolean;
  /** Reasonable min/max for sanity check (rejects extracted values outside range) */
  range?: { min: number; max: number };
  /** Unit hint — used to validate extracted text contains the unit (e.g., '%', 'FCFA') */
  unitHint?: '%' | 'FCFA' | 'XAF' | 'XOF' | 'days' | 'jours';
  /** Per-bank pattern overrides (highest priority) */
  templates?: Record<string, RegExp[]>;
  /** Generic patterns tried after templates */
  patterns?: RegExp[];
}

/** Pre-analysis output: what kind of document, which bank, language, etc. */
export interface DocumentAnalysis {
  format: DocumentFormat;
  pages: number;
  detectedBank?: { code: string; name: string; confidence: number };
  detectedLanguage: 'fr' | 'en' | 'mixed';
  hasTextLayer: boolean;
  needsOcr: boolean;
  /** Total length of recognized text (proxy for OCR quality) */
  textLength: number;
}

/** Final report produced by the engine */
export interface ExtractionReport {
  success: boolean;
  format: DocumentFormat;
  bankDetected?: { code: string; name: string; confidence: number };
  /** Per-field results, indexed by key */
  fields: Record<string, FieldExtraction>;
  /** Aggregate confidence (mean of all extracted-from-doc fields, ignoring defaults) */
  overallConfidence: number;
  /** How many fields came from the doc vs default */
  stats: {
    total: number;
    extracted: number;
    defaulted: number;
    failed: number;
  };
  /** Total processing time, in ms */
  processingTimeMs: number;
  /** Raw text — kept for debugging / manual review */
  rawText: string;
  /** Errors encountered — non-fatal */
  warnings: string[];
}

/** Options to control engine behavior */
export interface ExtractionOptions {
  /** Hint to skip OCR step if we know it's a native PDF */
  skipOcr?: boolean;
  /** Pin to a specific bank template (overrides detection) */
  bankCode?: string;
  /** Language hint for OCR */
  language?: 'fr' | 'en' | 'fr+en';
  /** Don't fall back to default values — leave fields null if not extracted */
  strictMode?: boolean;
  /** Progress callback */
  onProgress?: (progress: { stage: string; pct: number; message: string }) => void;
}

/** Adapter interface — every format has one */
export interface DocumentAdapter {
  /** Returns the unified text representation of the document */
  extract(input: File | Blob | ArrayBuffer | string, options?: ExtractionOptions): Promise<{
    text: string;
    pages: number;
    /** Tabular structures detected, if any. Each row is an ordered list of cells */
    tables?: string[][][];
    /** Raw word boxes for tabular reconstruction (PDF native) */
    words?: Array<{ text: string; x: number; y: number; page: number }>;
  }>;
}
