// ============================================================================
// SCRUTIX - AI Module Index
// Point d'entrée principal pour le module IA
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
