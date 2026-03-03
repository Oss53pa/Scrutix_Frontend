// ============================================================================
// SCRUTIX - OCR Pipeline Module
// Pipeline OCR multi-couches pour l'extraction de releves bancaires
// ============================================================================

export { OcrPipeline } from './OcrPipeline';
export { PreAnalysisLayer } from './PreAnalysisLayer';
export { ExtractionLayer } from './ExtractionLayer';
export { ValidationLayer } from './ValidationLayer';
export { StructurationLayer } from './StructurationLayer';
export { TemplateExtractor } from './TemplateExtractor';

export type {
  OcrDocumentAnalysis,
  OcrDocumentType,
  OcrExtractionMode,
  OcrValidationResult,
  OcrValidationWarning,
  OcrCorrection,
  OcrStructuredOutput,
  OcrExtractedRow,
  OcrStatementMetadata,
  OcrPipelineOptions,
  OcrPipelineProgress,
} from './OcrPipelineTypes';

export type {
  ZoneDefinition,
  BankTemplateConfig,
} from './TemplateExtractor';
