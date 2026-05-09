// ============================================================================
// ATLASBANX - PROPH3T Intelligence Gateway Types
// Contrats TypeScript pour les 14 competences du moteur PROPH3T
// Ref: CDC PROPH3T v1.0
// ============================================================================

// ----------------------------------------------------------------------------
// Competence IDs (1..14)
// ----------------------------------------------------------------------------

export enum CompetenceId {
  /** Extraction CG bancaires */
  EXTRACTION_CG = 1,
  /** Extraction conventions client */
  EXTRACTION_CONVENTIONS = 2,
  /** Extraction avenants ponctuels */
  EXTRACTION_AVENANTS = 3,
  /** OCR augmente PDF scannes */
  OCR_AUGMENTE = 4,
  /** Categorisation operations */
  CATEGORISATION = 5,
  /** Identification banque/document */
  IDENTIFICATION = 6,
  /** Detection dimensions tarifaires */
  DIMENSIONS_TARIFAIRES = 7,
  /** Explication des ecarts */
  EXPLICATION_ECARTS = 8,
  /** Generation rapport audit */
  RAPPORT_AUDIT = 9,
  /** Q&A conversationnel */
  QA_CONVERSATIONNEL = 10,
  /** Detection anomalies statistiques */
  ANOMALIES_STATS = 11,
  /** Detection patterns frauduleux */
  PATTERNS_FRAUDULEUX = 12,
  /** Mapping rubriques inter-banques */
  MAPPING_RUBRIQUES = 13,
  /** Assistant saisie split-screen */
  ASSISTANT_SAISIE = 14,
}

// ----------------------------------------------------------------------------
// Zones de responsabilite
// ----------------------------------------------------------------------------

export type ValidationZone = 'green' | 'orange' | 'red';

export const COMPETENCE_ZONES: Record<CompetenceId, ValidationZone> = {
  [CompetenceId.EXTRACTION_CG]: 'orange',
  [CompetenceId.EXTRACTION_CONVENTIONS]: 'orange',
  [CompetenceId.EXTRACTION_AVENANTS]: 'orange',
  [CompetenceId.OCR_AUGMENTE]: 'orange',
  [CompetenceId.CATEGORISATION]: 'orange',
  [CompetenceId.IDENTIFICATION]: 'orange',
  [CompetenceId.DIMENSIONS_TARIFAIRES]: 'orange',
  [CompetenceId.EXPLICATION_ECARTS]: 'green',
  [CompetenceId.RAPPORT_AUDIT]: 'green',
  [CompetenceId.QA_CONVERSATIONNEL]: 'green',
  [CompetenceId.ANOMALIES_STATS]: 'orange',
  [CompetenceId.PATTERNS_FRAUDULEUX]: 'orange',
  [CompetenceId.MAPPING_RUBRIQUES]: 'orange',
  [CompetenceId.ASSISTANT_SAISIE]: 'green',
};

export const COMPETENCE_LABELS: Record<CompetenceId, string> = {
  [CompetenceId.EXTRACTION_CG]: 'Extraction CG bancaires',
  [CompetenceId.EXTRACTION_CONVENTIONS]: 'Extraction conventions client',
  [CompetenceId.EXTRACTION_AVENANTS]: 'Extraction avenants ponctuels',
  [CompetenceId.OCR_AUGMENTE]: 'OCR augmente PDF scannes',
  [CompetenceId.CATEGORISATION]: 'Categorisation operations',
  [CompetenceId.IDENTIFICATION]: 'Identification banque/document',
  [CompetenceId.DIMENSIONS_TARIFAIRES]: 'Detection dimensions tarifaires',
  [CompetenceId.EXPLICATION_ECARTS]: 'Explication des ecarts',
  [CompetenceId.RAPPORT_AUDIT]: 'Generation rapport audit',
  [CompetenceId.QA_CONVERSATIONNEL]: 'Q&A conversationnel',
  [CompetenceId.ANOMALIES_STATS]: 'Detection anomalies statistiques',
  [CompetenceId.PATTERNS_FRAUDULEUX]: 'Detection patterns frauduleux',
  [CompetenceId.MAPPING_RUBRIQUES]: 'Mapping rubriques inter-banques',
  [CompetenceId.ASSISTANT_SAISIE]: 'Assistant saisie split-screen',
};

// ----------------------------------------------------------------------------
// Model identifiers
// ----------------------------------------------------------------------------

export type IntelligenceModel =
  | 'ollama-llama3.1-70b'
  | 'ollama-qwen2.5-14b'
  | 'ollama-qwen2.5-7b'
  | 'claude-sonnet'
  | 'tesseract';

// ----------------------------------------------------------------------------
// Gateway Request / Response contracts
// ----------------------------------------------------------------------------

export interface IntelligenceRequest {
  competence_id: CompetenceId;
  context: Record<string, unknown>;
  client_consent_cloud?: boolean;
  user_id: string;
  organization_id: string;
}

export interface IntelligenceTrace {
  model_used: IntelligenceModel;
  competence_version: string;
  prompt_hash: string;
  confidence_score: number;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
}

export interface IntelligenceResponse {
  output: unknown;
  trace: IntelligenceTrace;
}

export interface IntelligenceError {
  error: string;
  code: 'INVALID_COMPETENCE' | 'VALIDATION_FAILED' | 'MODEL_UNAVAILABLE'
    | 'TIMEOUT' | 'CONFIDENCE_TOO_LOW' | 'CONSENT_REQUIRED' | 'RATE_LIMITED'
    | 'INTERNAL';
  competence_id?: CompetenceId;
  details?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Inference record (mirrors proph3t_inferences table)
// ----------------------------------------------------------------------------

export interface InferenceRecord {
  id: string;
  competence_id: CompetenceId;
  competence_version: string;
  model_used: string;
  prompt_hash: string;
  input_hash: string;
  output: unknown;
  confidence_score: number | null;
  validated_by: string | null;
  validated_at: string | null;
  source_document_id: string | null;
  source_bbox: BoundingBox | null;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Shared geometry / condition types (used across competences)
// ----------------------------------------------------------------------------

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ConditionUnit = 'percent' | 'fcfa' | 'days' | 'count';

export type ClientProfile = 'particulier' | 'pme' | 'corporate';

export interface ConditionDimensions {
  montant_centimes?: { min?: number; max?: number };
  profil?: ClientProfile;
  duree_jours?: { min?: number; max?: number };
  garantie?: string;
  devise?: string;
  canal?: 'agence' | 'ebanking' | 'mobile' | 'atm';
}

export interface ConditionFormula {
  type: 'fixed' | 'percentage' | 'tiered' | 'min_max' | 'formula';
  expression: string;
  tiers?: Array<{
    min: number;
    max: number | null;
    rate: number;
    unit: ConditionUnit;
  }>;
}

// ----------------------------------------------------------------------------
// C1 — Extraction CG bancaires
// ----------------------------------------------------------------------------

export interface C1Input {
  pdf_url: string;
  bank_id: string;
  effective_date_hint?: string;
  language: 'fr';
  expected_taxonomy: string[];
}

export interface ExtractedCondition {
  rubric_code: string;
  raw_label: string;
  value_numeric: number | null;
  value_formula: ConditionFormula | null;
  unit: ConditionUnit;
  dimensions: ConditionDimensions | null;
  pdf_page: number;
  pdf_bbox: BoundingBox;
  confidence: number;
  extraction_notes: string;
}

export interface C1Output {
  extracted_conditions: ExtractedCondition[];
  document_metadata: {
    detected_bank: string;
    detected_version: string;
    detected_effective_date: string | null;
    page_count: number;
    is_native_pdf: boolean;
  };
  unmapped_segments: Array<{
    page: number;
    bbox: BoundingBox;
    raw_text: string;
  }>;
}

// ----------------------------------------------------------------------------
// C2 — Extraction conventions client
// ----------------------------------------------------------------------------

export interface C2Input extends C1Input {
  parent_group_ref?: string;
}

export interface Derogation {
  rubric_code: string;
  bank_default_value: number;
  derogated_value: number;
  explicit_derogation_text: string;
  pdf_bbox: BoundingBox;
}

export interface C2Output extends C1Output {
  signatories: Array<{
    name: string;
    role: string;
    side: 'bank' | 'client';
  }>;
  signature_date: string;
  effective_period: { from: string; to: string | null };
  account_numbers_concerned: string[];
  parent_group_agreement_ref?: string;
  derogations: Derogation[];
}

// ----------------------------------------------------------------------------
// C3 — Extraction avenants ponctuels
// ----------------------------------------------------------------------------

export type AvenantFormat = 'pdf_signe' | 'eml' | 'image' | 'texte_saisi';

export interface C3Input {
  document_url: string;
  format: AvenantFormat;
  bank_id: string;
  client_id: string;
  language: 'fr';
}

export interface C3Output {
  engagement_score: number;
  conditions: ExtractedCondition[];
  effective_period: { from: string; to: string | null } | null;
  source_text: string;
  avenant_draft_created: boolean;
}

// ----------------------------------------------------------------------------
// C4 — OCR augmente PDF scannes
// ----------------------------------------------------------------------------

export interface C4Input {
  pdf_url: string;
  bank_id: string;
  pages?: number[];
  language: 'fr';
}

export interface OcrTableCell {
  row: number;
  col: number;
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface C4Output {
  pages: Array<{
    page_number: number;
    raw_text: string;
    tables: Array<{
      headers: string[];
      rows: OcrTableCell[][];
      bbox: BoundingBox;
    }>;
    overall_confidence: number;
  }>;
  is_native_pdf: boolean;
  fallback_used: boolean;
  fallback_model?: IntelligenceModel;
}

// ----------------------------------------------------------------------------
// C5 — Categorisation operations
// ----------------------------------------------------------------------------

export interface C5Input {
  operations: Array<{
    id: string;
    label: string;
    amount: number;
    date: string;
    bank_code?: string;
  }>;
  bank_id?: string;
}

export interface C5Output {
  categorized: Array<{
    operation_id: string;
    rubric_code: string;
    confidence: number;
    match_method: 'exact' | 'embedding' | 'llm';
  }>;
  uncategorized: Array<{
    operation_id: string;
    candidates: Array<{
      rubric_code: string;
      score: number;
    }>;
  }>;
}

// ----------------------------------------------------------------------------
// C6 — Identification banque/document
// ----------------------------------------------------------------------------

export interface C6Input {
  pdf_url?: string;
  text_content?: string;
  first_page_only?: boolean;
}

export type DocumentType =
  | 'conditions_generales'
  | 'convention'
  | 'avenant'
  | 'releve'
  | 'echelle_interets'
  | 'decompte_frais'
  | 'lettre_rm'
  | 'non_bancaire';

export interface C6Output {
  detected_bank: {
    code: string;
    name: string;
    confidence: number;
  };
  detected_document_type: {
    type: DocumentType;
    confidence: number;
  };
  signals: string[];
}

// ----------------------------------------------------------------------------
// C7 — Detection dimensions tarifaires
// ----------------------------------------------------------------------------

export interface C7Input {
  text: string;
  rubric_code?: string;
  bank_id?: string;
}

export type DimensionType =
  | 'montant'
  | 'profil'
  | 'duree'
  | 'garantie'
  | 'devise'
  | 'canal';

export interface DetectedDimension {
  type: DimensionType;
  values: ConditionDimensions;
  raw_text: string;
  is_cumulative: boolean;
  bbox?: BoundingBox;
  confidence: number;
}

export interface C7Output {
  dimensions: DetectedDimension[];
  has_tiers: boolean;
  tiers?: ConditionFormula['tiers'];
  conditional_rules: Array<{
    condition: string;
    effect: string;
    raw_text: string;
  }>;
}

// ----------------------------------------------------------------------------
// C8 — Explication des ecarts
// ----------------------------------------------------------------------------

export type EcartCode = 'E01' | 'E02' | 'E03' | 'E04' | 'E05' | 'E06' | 'E07' | 'E08';
export type Audience = 'daf' | 'comptable' | 'dirigeant';
export type Recoverability = 'forte' | 'moyenne' | 'faible';

export interface C8Input {
  ecart: {
    code: EcartCode;
    rubric: string;
    expected_value: number;
    actual_value: number;
    delta_fcfa: number;
    period: { from: string; to: string };
    operations_concerned: Array<Record<string, unknown>>;
    receipt: Record<string, unknown>;
  };
  audience: Audience;
  language: 'fr';
}

export interface C8Output {
  short_description: string;
  detailed_explanation: string;
  legal_basis: string | null;
  recommended_action: string;
  recoverability_assessment: Recoverability;
}

// ----------------------------------------------------------------------------
// C9 — Generation rapport audit
// ----------------------------------------------------------------------------

export type ReportTone = 'factuel' | 'assertif' | 'pedagogique';

export interface C9Input {
  analysis_id: string;
  client_name: string;
  period: { from: string; to: string };
  accounts: string[];
  ecarts: C8Input['ecart'][];
  tone: ReportTone;
  language: 'fr';
}

export interface C9Output {
  sections: {
    page_de_garde: string;
    resume_executif: string;
    vue_par_categorie: string;
    detail_ecarts_majeurs: string;
    plan_action: string;
    annexes: string;
  };
  total_ecarts: number;
  montant_recuperable_estime: number;
  validation_ok: boolean;
  validation_errors: string[];
}

// ----------------------------------------------------------------------------
// C10 — Q&A conversationnel
// ----------------------------------------------------------------------------

export interface C10Input {
  question: string;
  analysis_id?: string;
  conversation_history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  language: 'fr';
}

export interface C10Output {
  answer: string;
  sources: Array<{
    type: 'receipt' | 'regulation' | 'taxonomy';
    reference: string;
    excerpt: string;
  }>;
  requires_investigation: boolean;
}

// ----------------------------------------------------------------------------
// C11 — Detection anomalies statistiques
// ----------------------------------------------------------------------------

export type AnomalyType =
  | 'amount_outlier'
  | 'frequency_anomaly'
  | 'benford_deviation'
  | 'semantic_duplicate'
  | 'temporal_irregularity';

export type AnomalySeverity = 'low' | 'medium' | 'high';

export interface C11Input {
  operations: Array<Record<string, unknown>>;
  historical_operations?: Array<Record<string, unknown>>;
  bank_id?: string;
}

export interface StatisticalAnomaly {
  operation_id: string;
  anomaly_type: AnomalyType;
  severity: AnomalySeverity;
  confidence: number;
  explanation: string;
  suggested_investigation: string;
}

export interface C11Output {
  anomalies: StatisticalAnomaly[];
}

// ----------------------------------------------------------------------------
// C12 — Detection patterns frauduleux
// ----------------------------------------------------------------------------

export type FraudPattern =
  | 'plafonnement_sous_seuil'
  | 'dv_defavorable_systematique'
  | 'libelles_rotatifs'
  | 'decouvert_artificiel'
  | 'frais_sans_contrepartie';

export interface C12Input {
  operations: Array<Record<string, unknown>>;
  conditions: Array<Record<string, unknown>>;
  bank_id: string;
  period: { from: string; to: string };
}

export interface DetectedFraudPattern {
  pattern: FraudPattern;
  severity: AnomalySeverity;
  confidence: number;
  affected_operations: string[];
  description: string;
  evidence: string;
}

export interface C12Output {
  patterns: DetectedFraudPattern[];
}

// ----------------------------------------------------------------------------
// C13 — Mapping rubriques inter-banques
// ----------------------------------------------------------------------------

export interface C13Input {
  label: string;
  bank_id?: string;
  top_k?: number;
}

export interface C13Output {
  mappings: Array<{
    rubric_code: string;
    rubric_label: string;
    score: number;
    justification: string;
  }>;
  best_match: {
    rubric_code: string;
    confidence: number;
  } | null;
}

// ----------------------------------------------------------------------------
// C14 — Assistant saisie split-screen
// ----------------------------------------------------------------------------

export type AssistantSuggestionType =
  | 'mapping_zone'
  | 'coherence_inter_rubriques'
  | 'coherence_inter_banques'
  | 'completion'
  | 'violation_l1';

export interface C14Input {
  current_field: string;
  current_value?: string | number;
  rubric_code?: string;
  all_values: Record<string, unknown>;
  bank_id?: string;
  pdf_page?: number;
}

export interface AssistantSuggestion {
  type: AssistantSuggestionType;
  message: string;
  severity: 'info' | 'warning' | 'error';
  suggested_value?: string | number;
  reference?: string;
}

export interface C14Output {
  suggestions: AssistantSuggestion[];
}

// ----------------------------------------------------------------------------
// Competence input/output type map (for type-safe dispatch)
// ----------------------------------------------------------------------------

export interface CompetenceIOMap {
  [CompetenceId.EXTRACTION_CG]: { input: C1Input; output: C1Output };
  [CompetenceId.EXTRACTION_CONVENTIONS]: { input: C2Input; output: C2Output };
  [CompetenceId.EXTRACTION_AVENANTS]: { input: C3Input; output: C3Output };
  [CompetenceId.OCR_AUGMENTE]: { input: C4Input; output: C4Output };
  [CompetenceId.CATEGORISATION]: { input: C5Input; output: C5Output };
  [CompetenceId.IDENTIFICATION]: { input: C6Input; output: C6Output };
  [CompetenceId.DIMENSIONS_TARIFAIRES]: { input: C7Input; output: C7Output };
  [CompetenceId.EXPLICATION_ECARTS]: { input: C8Input; output: C8Output };
  [CompetenceId.RAPPORT_AUDIT]: { input: C9Input; output: C9Output };
  [CompetenceId.QA_CONVERSATIONNEL]: { input: C10Input; output: C10Output };
  [CompetenceId.ANOMALIES_STATS]: { input: C11Input; output: C11Output };
  [CompetenceId.PATTERNS_FRAUDULEUX]: { input: C12Input; output: C12Output };
  [CompetenceId.MAPPING_RUBRIQUES]: { input: C13Input; output: C13Output };
  [CompetenceId.ASSISTANT_SAISIE]: { input: C14Input; output: C14Output };
}

// ----------------------------------------------------------------------------
// Anti-hallucination: double-pass config
// ----------------------------------------------------------------------------

export interface DoublePassConfig {
  temperature_pass_1: number;
  temperature_pass_2: number;
  numeric_divergence_threshold: number;
}

export const DEFAULT_DOUBLE_PASS: DoublePassConfig = {
  temperature_pass_1: 0.0,
  temperature_pass_2: 0.3,
  numeric_divergence_threshold: 0.05,
};

// ----------------------------------------------------------------------------
// Competence version registry
// ----------------------------------------------------------------------------

export const COMPETENCE_VERSIONS: Record<CompetenceId, string> = {
  [CompetenceId.EXTRACTION_CG]: '1.0.0',
  [CompetenceId.EXTRACTION_CONVENTIONS]: '1.0.0',
  [CompetenceId.EXTRACTION_AVENANTS]: '1.0.0',
  [CompetenceId.OCR_AUGMENTE]: '1.0.0',
  [CompetenceId.CATEGORISATION]: '1.0.0',
  [CompetenceId.IDENTIFICATION]: '1.0.0',
  [CompetenceId.DIMENSIONS_TARIFAIRES]: '1.0.0',
  [CompetenceId.EXPLICATION_ECARTS]: '1.0.0',
  [CompetenceId.RAPPORT_AUDIT]: '1.0.0',
  [CompetenceId.QA_CONVERSATIONNEL]: '1.0.0',
  [CompetenceId.ANOMALIES_STATS]: '1.0.0',
  [CompetenceId.PATTERNS_FRAUDULEUX]: '1.0.0',
  [CompetenceId.MAPPING_RUBRIQUES]: '1.0.0',
  [CompetenceId.ASSISTANT_SAISIE]: '1.0.0',
};
