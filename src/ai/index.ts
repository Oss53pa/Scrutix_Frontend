// ============================================================================
// SCRUTIX - AI Module Index
// Point d'entree principal pour le module IA
// ============================================================================

// Types
export * from './types';

// Providers
export {
  BaseAIProvider,
  ClaudeProvider,
  ClaudeAPIError,
  OpenAIProvider,
  OpenAIAPIError,
  MistralProvider,
  MistralAPIError,
  OllamaProvider,
  OllamaAPIError,
} from './providers';

// Factory
export { AIProviderFactory } from './AIProviderFactory';

// Services
export {
  AIDetectionOrchestrator,
  aiDetectionOrchestrator,
  type OrchestrationResult,
  type OrchestrationOptions,
  type OrchestrationProgress,
} from './services/AIDetectionOrchestrator';

// PROPH3T Engine
export {
  Proph3tEngine,
  Proph3tModelRegistry,
  JsonValidator,
  DeterministicPreFilter,
  CategorizationCache,
  DEFAULT_PROPH3T_MODELS,
  DEFAULT_PROPH3T_CONFIG,
  DETECTION_MODEL_MAP,
} from './proph3t';

export type {
  Proph3tModelRole,
  Proph3tModelSlot,
  Proph3tConfig,
  Proph3tCallOptions,
  Proph3tJsonResponse,
} from './proph3t';
