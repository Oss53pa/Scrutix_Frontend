// ============================================================================
// ATLASBANX - PROPH3T Intelligence Module Index
// ============================================================================

// Core types
export {
  CompetenceId,
  type ValidationZone,
  COMPETENCE_ZONES,
  COMPETENCE_LABELS,
  COMPETENCE_VERSIONS,
  type IntelligenceModel,
  type IntelligenceRequest,
  type IntelligenceTrace,
  type IntelligenceResponse,
  type IntelligenceError,
  type InferenceRecord,
  type BoundingBox,
  type ConditionUnit,
  type ClientProfile,
  type ConditionDimensions,
  type ConditionFormula,
  type CompetenceIOMap,
  type DoublePassConfig,
  DEFAULT_DOUBLE_PASS,
} from './types';

// Competence-specific types
export type {
  C1Input, C1Output, ExtractedCondition,
  C2Input, C2Output, Derogation,
  C3Input, C3Output, AvenantFormat,
  C4Input, C4Output, OcrTableCell,
  C5Input, C5Output,
  C6Input, C6Output, DocumentType,
  C7Input, C7Output, DimensionType, DetectedDimension,
  C8Input, C8Output, EcartCode, Audience, Recoverability,
  C9Input, C9Output, ReportTone,
  C10Input, C10Output,
  C11Input, C11Output, AnomalyType, AnomalySeverity, StatisticalAnomaly,
  C12Input, C12Output, FraudPattern, DetectedFraudPattern,
  C13Input, C13Output,
  C14Input, C14Output, AssistantSuggestionType, AssistantSuggestion,
} from './types';

// Zod schemas
export {
  IntelligenceRequestSchema,
  IntelligenceTraceSchema,
  COMPETENCE_INPUT_SCHEMAS,
  COMPETENCE_OUTPUT_SCHEMAS,
  C1InputSchema, C1OutputSchema,
  C2InputSchema, C2OutputSchema,
  C3InputSchema, C3OutputSchema,
  C5InputSchema, C5OutputSchema,
  C6InputSchema, C6OutputSchema,
  C8InputSchema, C8OutputSchema,
  C9InputSchema, C9OutputSchema,
  C11OutputSchema,
  C12OutputSchema,
  C13InputSchema, C13OutputSchema,
} from './schemas';

// Orchestrator
export { orchestrate, dispatch } from './orchestrator';
export type { OrchestratorResult } from './orchestrator';

// Handlers (all 14 competences)
export { handleC1 } from './handlers/C1ExtractionCGHandler';
export { handleC2 } from './handlers/C2ConventionHandler';
export { handleC3 } from './handlers/C3AvenantHandler';
export { handleC4 } from './handlers/C4OcrHandler';
export { handleC5, handleC5WithLlm } from './handlers/C5CategorisationHandler';
export { handleC6 } from './handlers/C6IdentificationHandler';
export { handleC7 } from './handlers/C7DimensionsHandler';
export { handleC8, handleC8WithLlm } from './handlers/C8ExplicationHandler';
export { handleC9, handleC9WithLlm } from './handlers/C9RapportHandler';
export { handleC10, handleC10WithLlm } from './handlers/C10QAHandler';

// LLM enrichment utilities
export { setLlmEngine, getLlmEngine, isLlmAvailable, llmCall, llmCallJson, llmDoublePass } from './llmEnricher';
export { handleC11 } from './handlers/C11AnomaliesHandler';
export { handleC12 } from './handlers/C12FraudHandler';
export { handleC13 } from './handlers/C13MappingHandler';
export { handleC14 } from './handlers/C14AssistantHandler';
