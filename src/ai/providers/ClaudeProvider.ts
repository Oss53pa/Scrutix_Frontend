// ============================================================================
// ATLASBANX - Claude Provider
// Calls the Anthropic Claude API via the Supabase Edge Function `claude-proxy`.
// The user's API key is stored server-side (atlasbanx.user_ai_keys), never
// exposed to the browser. Authentication uses the user's Supabase session JWT.
// ============================================================================

import { BaseAIProvider } from './BaseAIProvider';
import { getSupabaseClient } from '../../lib/supabase';
import {
  AIProviderType,
  AIProviderConfig,
  AIModel,
  AI_MODELS,
  AIErrorCode,
} from '../types';

const DEFAULT_TIMEOUT_MS = 60000;

/**
 * URL of the Edge Function. Derived from the Supabase URL at runtime.
 * Returns null if Supabase isn't configured (e.g. demo mode) — provider
 * fails gracefully with an explicit error.
 */
function getProxyUrl(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url || url === 'votre-supabase-url') return null;
  return `${url.replace(/\/$/, '')}/functions/v1/claude-proxy`;
}

/**
 * Provider pour Anthropic Claude
 */
export class ClaudeProvider extends BaseAIProvider {
  readonly name = 'Anthropic Claude';
  readonly type: AIProviderType = 'claude';
  readonly models: AIModel[] = AI_MODELS.claude;

  constructor(config: AIProviderConfig) {
    super({
      ...config,
      provider: 'claude',
    });
  }

  // ============================================================================
  // Connection Test
  // ============================================================================

  async testConnection(): Promise<{ valid: boolean; error?: string }> {
    // Validation goes through the proxy's `action: "validate"` path.
    // The user's stored key is read server-side, a tiny test call is made
    // to Anthropic, and the validated_at timestamp is updated on success.
    const proxyUrl = getProxyUrl();
    if (!proxyUrl) return { valid: false, error: 'Supabase non configuré' };

    const supabase = getSupabaseClient();
    if (!supabase) return { valid: false, error: 'Supabase non configuré' };

    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return { valid: false, error: 'Session expirée' };

    try {
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: 'validate', model: this.config.model }),
      });
      const data = (await res.json().catch(() => ({}))) as { valid?: boolean; error?: string };
      if (!res.ok) {
        return { valid: false, error: data.error || res.statusText };
      }
      return { valid: data.valid === true, error: data.valid ? undefined : data.error };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : 'Erreur inconnue' };
    }
  }

  // ============================================================================
  // Core API Implementation
  // ============================================================================

  protected async callAPI(
    messages: Array<{ role: string; content: string }>,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    const proxyUrl = getProxyUrl();
    if (!proxyUrl) {
      throw new ClaudeAPIError('Supabase non configuré', 'AUTH');
    }

    const supabase = getSupabaseClient();
    if (!supabase) throw new ClaudeAPIError('Supabase non configuré', 'AUTH');

    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      throw new ClaudeAPIError('Session expirée — reconnectez-vous', 'AUTH');
    }

    // Convert system messages to Claude format (system messages become user context)
    const claudeMessages = this.convertMessagesToClaudeFormat(messages);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout ?? DEFAULT_TIMEOUT_MS
    );

    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4000,
          temperature: options?.temperature ?? this.config.temperature ?? 0.3,
          messages: claudeMessages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json() as ClaudeResponse;

      // Validate response structure
      if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
        throw new ClaudeAPIError('Réponse API invalide', 'INVALID_REQUEST');
      }

      return {
        content: data.content[0]?.text || '',
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ClaudeAPIError('Délai d\'attente dépassé', 'TIMEOUT');
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ClaudeAPIError('Impossible de contacter le proxy Claude', 'NETWORK');
      }

      // Re-throw ClaudeAPIError as-is
      if (error instanceof ClaudeAPIError) {
        throw error;
      }

      // Wrap unknown errors
      throw new ClaudeAPIError(
        error instanceof Error ? error.message : 'Erreur inconnue',
        'UNKNOWN'
      );
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private convertMessagesToClaudeFormat(
    messages: Array<{ role: string; content: string }>
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const result: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    let systemContent = '';

    // Extract system messages
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemContent += (systemContent ? '\n\n' : '') + msg.content;
      }
    }

    // If we have system content, prepend it as a user message with context markers
    if (systemContent) {
      result.push({
        role: 'user',
        content: `[INSTRUCTIONS SYSTÈME]\n${systemContent}\n[FIN INSTRUCTIONS]`,
      });
      result.push({
        role: 'assistant',
        content: 'Compris. Je suivrai ces instructions.',
      });
    }

    // Add regular messages
    for (const msg of messages) {
      if (msg.role !== 'system') {
        result.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    return result;
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const errorData = await response.json().catch(() => ({})) as {
      error?: { message?: string; type?: string };
    };
    const errorMessage = errorData?.error?.message || response.statusText;

    // Map HTTP status codes to error types
    switch (response.status) {
      case 401:
        throw new ClaudeAPIError(errorMessage, 'AUTH', response.status);
      case 429: {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
        throw new ClaudeAPIError(errorMessage, 'RATE_LIMIT', response.status, retryAfter);
      }
      case 400:
        throw new ClaudeAPIError(errorMessage, 'INVALID_REQUEST', response.status);
      case 500:
      case 502:
      case 503:
      case 504:
        throw new ClaudeAPIError(errorMessage, 'SERVER', response.status);
      default:
        throw new ClaudeAPIError(errorMessage, 'UNKNOWN', response.status);
    }
  }
}

// ============================================================================
// Claude-specific Error Class
// ============================================================================

export class ClaudeAPIError extends Error {
  constructor(
    message: string,
    public readonly code: AIErrorCode,
    public readonly statusCode?: number,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'ClaudeAPIError';
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
        return 'Erreur serveur Claude. Réessayez dans quelques instants.';
      default:
        return 'Une erreur inattendue s\'est produite.';
    }
  }
}

// ============================================================================
// Types
// ============================================================================

interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
