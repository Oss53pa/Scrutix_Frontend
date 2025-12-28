// ============================================================================
// SCRUTIX - Ollama Provider
// Implémentation du provider pour Ollama (modèles locaux)
// ============================================================================

import { BaseAIProvider } from './BaseAIProvider';
import {
  AIProviderType,
  AIProviderConfig,
  AIModel,
  AI_MODELS,
  AIErrorCode,
} from '../types';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_TIMEOUT_MS = 120000; // 2 minutes for local models

/**
 * Provider pour Ollama (modèles locaux)
 * Permet une utilisation 100% offline
 */
export class OllamaProvider extends BaseAIProvider {
  readonly name = 'Ollama (Local)';
  readonly type: AIProviderType = 'ollama';
  readonly models: AIModel[] = AI_MODELS.ollama;

  private baseUrl: string;

  constructor(config: AIProviderConfig) {
    super({
      ...config,
      provider: 'ollama',
    });
    this.baseUrl = config.baseUrl ?? DEFAULT_OLLAMA_URL;
  }

  // ============================================================================
  // Configuration Override
  // ============================================================================

  configure(config: AIProviderConfig): void {
    super.configure(config);
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
  }

  // ============================================================================
  // Connection Test
  // ============================================================================

  async testConnection(): Promise<{ valid: boolean; error?: string }> {
    try {
      // First check if Ollama is running
      const healthCheck = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      }).catch(() => null);

      if (!healthCheck || !healthCheck.ok) {
        return {
          valid: false,
          error: `Ollama n'est pas accessible à ${this.baseUrl}. Vérifiez que le serveur est démarré.`,
        };
      }

      // Check if the model is available
      const modelsData = await healthCheck.json() as { models?: Array<{ name: string }> };
      const modelName = this.config.model.split(':')[0];
      const modelExists = modelsData.models?.some(m => m.name.startsWith(modelName));

      if (!modelExists) {
        return {
          valid: false,
          error: `Le modèle "${this.config.model}" n'est pas installé. Exécutez: ollama pull ${this.config.model}`,
        };
      }

      // Try a simple completion
      await this.callAPI(
        [{ role: 'user', content: 'Réponds simplement "OK".' }],
        { maxTokens: 10 }
      );

      return { valid: true };
    } catch (error) {
      if (error instanceof OllamaAPIError) {
        return { valid: false, error: error.userMessage };
      }
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      return { valid: false, error: message };
    }
  }

  // ============================================================================
  // List Available Models
  // ============================================================================

  async listAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        return [];
      }
      const data = await response.json() as { models?: Array<{ name: string }> };
      return data.models?.map(m => m.name) || [];
    } catch {
      return [];
    }
  }

  // ============================================================================
  // Core API Implementation
  // ============================================================================

  protected async callAPI(
    messages: Array<{ role: string; content: string }>,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout ?? DEFAULT_TIMEOUT_MS
    );

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          stream: false,
          options: {
            num_predict: options?.maxTokens ?? this.config.maxTokens ?? 4000,
            temperature: options?.temperature ?? this.config.temperature ?? 0.3,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json() as OllamaResponse;

      // Validate response structure
      if (!data.message?.content) {
        throw new OllamaAPIError('Réponse API invalide', 'INVALID_REQUEST');
      }

      // Ollama doesn't provide token counts in the same way
      // Estimate based on response length (rough approximation)
      const estimatedInputTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
      const estimatedOutputTokens = Math.ceil(data.message.content.length / 4);

      return {
        content: data.message.content,
        inputTokens: data.prompt_eval_count || estimatedInputTokens,
        outputTokens: data.eval_count || estimatedOutputTokens,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new OllamaAPIError('Délai d\'attente dépassé', 'TIMEOUT');
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new OllamaAPIError(
          `Impossible de contacter Ollama à ${this.baseUrl}. Vérifiez que le serveur est démarré.`,
          'NETWORK'
        );
      }

      // Re-throw OllamaAPIError as-is
      if (error instanceof OllamaAPIError) {
        throw error;
      }

      // Wrap unknown errors
      throw new OllamaAPIError(
        error instanceof Error ? error.message : 'Erreur inconnue',
        'UNKNOWN'
      );
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async handleErrorResponse(response: Response): Promise<never> {
    const errorData = await response.json().catch(() => ({})) as {
      error?: string;
    };
    const errorMessage = errorData?.error || response.statusText;

    // Map HTTP status codes to error types
    switch (response.status) {
      case 404:
        throw new OllamaAPIError(
          `Modèle "${this.config.model}" non trouvé. Exécutez: ollama pull ${this.config.model}`,
          'INVALID_REQUEST',
          response.status
        );
      case 500:
      case 502:
      case 503:
      case 504:
        throw new OllamaAPIError(errorMessage, 'SERVER', response.status);
      default:
        throw new OllamaAPIError(errorMessage, 'UNKNOWN', response.status);
    }
  }
}

// ============================================================================
// Ollama-specific Error Class
// ============================================================================

export class OllamaAPIError extends Error {
  constructor(
    message: string,
    public readonly code: AIErrorCode,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'OllamaAPIError';
  }

  get isRetryable(): boolean {
    return ['NETWORK', 'TIMEOUT', 'SERVER'].includes(this.code);
  }

  get userMessage(): string {
    switch (this.code) {
      case 'NETWORK':
        return this.message || 'Ollama n\'est pas accessible. Vérifiez que le serveur est démarré (ollama serve).';
      case 'TIMEOUT':
        return 'Délai d\'attente dépassé. Le modèle local peut être lent, augmentez le timeout.';
      case 'INVALID_REQUEST':
        return this.message || 'Requête invalide.';
      case 'SERVER':
        return 'Erreur serveur Ollama. Vérifiez les logs du serveur.';
      default:
        return 'Une erreur inattendue s\'est produite.';
    }
  }
}

// ============================================================================
// Types
// ============================================================================

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}
