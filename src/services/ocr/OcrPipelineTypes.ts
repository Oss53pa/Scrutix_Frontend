// ============================================================================
// SCRUTIX - OCR Pipeline Types
// Types pour le pipeline OCR multi-couches
// ============================================================================

/**
 * Type de document detecte
 */
export type OcrDocumentType =
  | 'bank_statement'
  | 'check'
  | 'invoice'
  | 'receipt'
  | 'unknown';

/**
 * Mode d'extraction OCR
 */
export type OcrExtractionMode = 'template' | 'vision_ai' | 'tesseract_ai';

/**
 * Analyse initiale du document (Layer 1)
 */
export interface OcrDocumentAnalysis {
  /** Type de document detecte */
  docType: OcrDocumentType;
  /** Rotation detectee en degres (0, 90, 180, 270) */
  rotation: number;
  /** Estimation du contraste (0-1, 1 = bon) */
  contrast: number;
  /** Code banque detecte (si applicable) */
  bankCode: string | null;
  /** Nom de la banque detecte */
  bankName: string | null;
  /** Mode d'extraction recommande */
  recommendedMode: OcrExtractionMode;
  /** Confiance globale (0-1) */
  confidence: number;
  /** Template detecte (si applicable) */
  templateCode: string | null;
}

/**
 * Resultat de validation (Layer 3)
 */
export interface OcrValidationResult {
  /** Validation reussie */
  isValid: boolean;
  /** Score de confiance global */
  confidence: number;
  /** Avertissements */
  warnings: OcrValidationWarning[];
  /** Corrections appliquees */
  corrections: OcrCorrection[];
}

/**
 * Avertissement de validation
 */
export interface OcrValidationWarning {
  type: 'balance' | 'date_order' | 'amount_format' | 'currency' | 'duplicate';
  message: string;
  severity: 'low' | 'medium' | 'high';
  rowIndex?: number;
}

/**
 * Correction appliquee
 */
export interface OcrCorrection {
  field: string;
  rowIndex: number;
  originalValue: string;
  correctedValue: string;
  reason: string;
}

/**
 * Sortie structuree du pipeline (Layer 4)
 */
export interface OcrStructuredOutput {
  /** Transactions extraites */
  rows: OcrExtractedRow[];
  /** Metadonnees du releve */
  metadata: OcrStatementMetadata;
  /** Resultat de validation */
  validation: OcrValidationResult;
  /** Mode d'extraction utilise */
  extractionMode: OcrExtractionMode;
  /** Temps de traitement par couche (ms) */
  layerTiming: {
    preAnalysis: number;
    extraction: number;
    validation: number;
    structuration: number;
    total: number;
  };
}

/**
 * Ligne extraite du releve
 */
export interface OcrExtractedRow {
  /** Date d'operation */
  date: string;
  /** Date de valeur (si disponible) */
  valueDate?: string;
  /** Libelle */
  description: string;
  /** Montant debit (positif) */
  debit?: number;
  /** Montant credit (positif) */
  credit?: number;
  /** Solde apres operation */
  balance?: number;
  /** Reference (si disponible) */
  reference?: string;
  /** Confiance d'extraction (0-1) */
  confidence: number;
}

/**
 * Metadonnees du releve bancaire
 */
export interface OcrStatementMetadata {
  /** Code banque */
  bankCode?: string;
  /** Nom de la banque */
  bankName?: string;
  /** Numero de compte */
  accountNumber?: string;
  /** Titulaire */
  accountHolder?: string;
  /** Devise */
  currency: string;
  /** Periode debut */
  periodStart?: string;
  /** Periode fin */
  periodEnd?: string;
  /** Solde initial */
  openingBalance?: number;
  /** Solde final */
  closingBalance?: number;
}

/**
 * Options du pipeline OCR
 */
export interface OcrPipelineOptions {
  /** Forcer un mode d'extraction */
  forceMode?: OcrExtractionMode;
  /** Code banque connu */
  bankCode?: string;
  /** Langue (defaut: 'fra') */
  language?: string;
  /** Callback de progression */
  onProgress?: (progress: OcrPipelineProgress) => void;
}

/**
 * Progression du pipeline
 */
export interface OcrPipelineProgress {
  /** Couche en cours */
  layer: 'pre_analysis' | 'extraction' | 'validation' | 'structuration';
  /** Progression de la couche (0-1) */
  progress: number;
  /** Message descriptif */
  message: string;
}
