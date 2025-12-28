// ============================================================================
// SCRUTIX - Mistral Provider
// Implémentation du provider pour Mistral AI
// ============================================================================

import { BaseAIProvider } from './BaseAIProvider';
import {
  AIProviderType,
  AIProviderConfig,
  AIModel,
  AI_MODELS,
  AIErrorCode,
} from '../types';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 60000;

/**
 * Provider pour Mistral AI
 */
export class MistralProvider extends BaseAIProvider {
  readonly name = 'Mistral AI';
  readonly type: AIProviderType = 'mistral';
  readonly models: AIModel[] = AI_MODELS.mistral;

  constructor(config: AIProviderConfig) {
    super({
      ...config,
      provider: 'mistral',
    });
  }

  // ============================================================================
  // Connection Test
  // ============================================================================

  async testConnection(): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.callAPI(
        [{ role: 'user', content: 'Réponds simplement "OK" pour valider la connexion.' }],
        { maxTokens: 10 }
      );
      return { valid: true };
    } catch (error) {
      if (error instanceof MistralAPIError) {
        return { valid: false, error: error.userMessage };
      }
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      return { valid: false, error: message };
    }
  }

  // ============================================================================
  // Core API Implementation
  // ============================================================================

  protected async callAPI(
    messages: Array<{ role: string; content: string }>,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    // Validate API key
    if (!this.config.apiKey || this.config.apiKey.trim() === '') {
      throw new MistralAPIError('Clé API non configurée', 'AUTH');
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout ?? DEFAULT_TIMEOUT_MS
    );

    try {
      const response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4000,
          temperature: options?.temperature ?? this.config.temperature ?? 0.3,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json() as MistralResponse;

      // Validate response structure
      if (!data.choices || data.choices.length === 0) {
        throw new MistralAPIError('Réponse API invalide', 'INVALID_REQUEST');
      }

      return {
        content: data.choices[0]?.message?.content || '',
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new MistralAPIError('Délai d\'attente dépassé', 'TIMEOUT');
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new MistralAPIError('Impossible de contacter l\'API Mistral', 'NETWORK');
      }

      // Re-throw MistralAPIError as-is
      if (error instanceof MistralAPIError) {
        throw error;
      }

      // Wrap unknown errors
      throw new MistralAPIError(
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
      message?: string;
      error?: { message?: string };
    };
    const errorMessage = errorData?.message || errorData?.error?.message || response.statusText;

    // Map HTTP status codes to error types
    switch (response.status) {
      case 401:
        throw new MistralAPIError(errorMessage, 'AUTH', response.status);
      case 429: {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
        throw new MistralAPIError(errorMessage, 'RATE_LIMIT', response.status, retryAfter);
      }
      case 400:
        throw new MistralAPIError(errorMessage, 'INVALID_REQUEST', response.status);
      case 500:
      case 502:
      case 503:
      case 504:
        throw new MistralAPIError(errorMessage, 'SERVER', response.status);
      default:
        throw new MistralAPIError(errorMessage, 'UNKNOWN', response.status);
    }
  }
}

// ============================================================================
// Mistral-specific Error Class
// ============================================================================

export class MistralAPIError extends Error {
  constructor(
    message: string,
    public readonly code: AIErrorCode,
    public readonly statusCode?: number,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'MistralAPIError';
  }

  get isRetryable(): boolean {
    return ['NETWORK', 'RATE_LIMIT', 'TIMEOUT', 'SERVER'].includes(this.code);
  }

  get userMessage(): string {
    switch (this.code) {
      case 'NETWORK':
        return 'Erreur de connexion. Vérifiez votre accès internet.';
      case 'AUTH':
        return 'Clé API invalide ou expirée. Veuillez vérifier vos paramètres.';
      case 'RATE_LIMIT':
        return `Limite d'appels API atteinte. Réessayez dans ${this.retryAfter || 60} secondes.`;
      case 'TIMEOUT':
        return 'Délai d\'attente dépassé. L\'opération a pris trop de temps.';
      case 'INVALID_REQUEST':
        return 'Requête invalide. Contactez le support si le problème persiste.';
      case 'SERVER':
        return 'Erreur serveur Mistral. Réessayez dans quelques instants.';
      default:
        return 'Une erreur inattendue s\'est produite.';
    }
  }
}

// ============================================================================
// Types
// ============================================================================

interface MistralResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
