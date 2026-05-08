// ============================================================================
// ATLASBANX — Document Intelligence Engine — public API
// ============================================================================

export {
  DocumentIntelligenceEngine,
  getDocumentEngine,
} from './DocumentIntelligenceEngine';

export type {
  ExtractionReport,
  ExtractionOptions,
  FieldExtraction,
  FieldDefinition,
  ExtractionStrategy,
  DocumentFormat,
  DocumentAnalysis,
  DocumentAdapter,
  FieldKind,
} from './types';

export { FIELD_DEFINITIONS, FIELD_BY_KEY, getField } from './FieldRegistry';
