// ============================================================================
// SCRUTIX - PROPH3T Module Index
// Re-exports pour le moteur PROPH3T
// ============================================================================

// Types
export type {
  Proph3tModelRole,
  Proph3tModelSlot,
  Proph3tConfig,
  Proph3tCallOptions,
  Proph3tJsonResponse,
} from './types';

export {
  DEFAULT_PROPH3T_MODELS,
  DEFAULT_PROPH3T_CONFIG,
  DETECTION_MODEL_MAP,
} from './types';

// Model Registry
export { Proph3tModelRegistry } from './ModelRegistry';

// Engine (exported after Sprint 2)
export { Proph3tEngine } from './Proph3tEngine';

// JSON Validator (exported after Sprint 2)
export { JsonValidator } from './JsonValidator';

// Deterministic Pre-Filter (exported after Sprint 3)
export { DeterministicPreFilter } from './DeterministicPreFilter';

// Categorization Cache (exported after Sprint 3)
export { CategorizationCache } from './CategorizationCache';
