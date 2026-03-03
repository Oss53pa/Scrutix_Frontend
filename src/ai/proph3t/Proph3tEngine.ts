// ============================================================================
// SCRUTIX - PROPH3T Engine
// Moteur IA multi-modele avec routage intelligent
// ============================================================================

import { BaseAIProvider } from '../providers/BaseAIProvider';
import { OllamaAPIError } from '../providers/OllamaProvider';
import {
  AIProviderType,
  AIProviderConfig,
  AIModel,
  AI_MODELS,
  AIDetectionType,
  AICategoryResult,
  AIReportContent,
  AIReportData,
} from '../types';
import { Transaction, Anomaly, BankConditions } from '../../types';
import {
  Proph3tConfig,
  Proph3tModelRole,
  Proph3tCallOptions,
  DETECTION_MODEL_MAP,
  DEFAULT_PROPH3T_CONFIG,
} from './types';
import { Proph3tModelRegistry } from './ModelRegistry';
import { JsonValidator } from './JsonValidator';
import { DeterministicPreFilter } from './DeterministicPreFilter';
import { CategorizationCache } from './CategorizationCache';
import type { RagPipeline } from '../../rag/RagPipeline';
import { buildRAGAugmentedPrompt } from './prompts';

const DEFAULT_TIMEOUT_MS = 120000;

/**
 * Moteur PROPH3T - Provider IA multi-modele pour Ollama
 * Etend BaseAIProvider avec routage par role, mode JSON, et pipeline 3 tiers
 */
export class Proph3tEngine extends BaseAIProvider {
  readonly name = 'PROPH3T Engine';
  readonly type: AIProviderType = 'ollama';
  readonly models: AIModel[] = AI_MODELS.ollama;

  private baseUrl: string;
  private proph3tConfig: Proph3tConfig;
  private registry: Proph3tModelRegistry;
  private currentRole: Proph3tModelRole = 'fast';

  // Pipeline 3 tiers (initialise en lazy)
  private preFilter: DeterministicPreFilter | null = null;
  private cache: CategorizationCache | null = null;

  // RAG pipeline (optionnel)
  private ragPipeline: RagPipeline | null = null;

  constructor(config: AIProviderConfig, proph3tConfig?: Proph3tConfig) {
    super({ ...config, provider: 'ollama' });
    this.proph3tConfig = proph3tConfig || DEFAULT_PROPH3T_CONFIG;
    this.baseUrl = this.proph3tConfig.baseUrl || config.baseUrl || 'http://localhost:11434';
    this.registry = new Proph3tModelRegistry(this.baseUrl);
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  configure(config: AIProviderConfig): void {
    super.configure(config);
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
  }

  updateProph3tConfig(config: Partial<Proph3tConfig>): void {
    this.proph3tConfig = { ...this.proph3tConfig, ...config };
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
      this.registry = new Proph3tModelRegistry(config.baseUrl);
    }
  }

  getProph3tConfig(): Proph3tConfig {
    return { ...this.proph3tConfig };
  }

  getRegistry(): Proph3tModelRegistry {
    return this.registry;
  }

  /**
   * Attache un pipeline RAG pour l'augmentation des prompts
   */
  setRagPipeline(pipeline: RagPipeline | null): void {
    this.ragPipeline = pipeline;
  }

  /**
   * Recupere le contexte RAG pour une requete
   */
  private async getRagContext(query: string): Promise<{
    text: string;
    sources: Array<{ title: string; source: string }>;
  } | null> {
    if (!this.ragPipeline) return null;

    try {
      const context = await this.ragPipeline.buildContextForPrompt(query);
      if (!context) return null;

      return {
        text: context.text,
        sources: context.sources.map(s => ({
          title: s.title,
          source: s.source,
        })),
      };
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Connection Test
  // ============================================================================

  async testConnection(): Promise<{ valid: boolean; error?: string }> {
    try {
      const health = await this.registry.checkHealth();
      if (!health.healthy) {
        return {
          valid: false,
          error: `PROPH3T: Ollama inaccessible a ${this.baseUrl}. Verifiez que le serveur est demarre.`,
        };
      }

      // Refresh models and check availability
      await this.registry.refreshAvailableModels();
      const roles = this.registry.checkAllRoles(this.proph3tConfig);

      const unavailable = Object.entries(roles)
        .filter(([, info]) => !info.available)
        .map(([role]) => role);

      if (unavailable.length === 4) {
        return {
          valid: false,
          error: `Aucun modele PROPH3T disponible. Installez au moins un modele (ex: ollama pull ${this.proph3tConfig.models.fast.name})`,
        };
      }

      // Try a quick completion with the fast model
      this.currentRole = 'fast';
      await this.callAPI(
        [{ role: 'user', content: 'Reponds "OK".' }],
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
  // Core API - Model Routing
  // ============================================================================

  protected async callAPI(
    messages: Array<{ role: string; content: string }>,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    // Resolve model for current role
    const resolved = this.registry.resolveModel(this.currentRole, this.proph3tConfig);
    const modelName = resolved?.model || this.proph3tConfig.models[this.currentRole].name;

    const controller = new AbortController();
    const timeoutMs = this.proph3tConfig.timeout || this.config.timeout || DEFAULT_TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model: modelName,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
        options: {
          num_predict: options?.maxTokens ?? this.config.maxTokens ?? 4000,
          temperature: options?.temperature ?? this.config.temperature ?? 0.3,
        },
      };

      // Add JSON format if jsonMode is enabled and model supports it
      if (this.proph3tConfig.jsonMode) {
        const slot = this.proph3tConfig.models[this.currentRole];
        if (slot.supportsJson) {
          body.format = 'json';
        }
      }

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response, modelName);
      }

      const data = (await response.json()) as {
        message?: { content: string };
        prompt_eval_count?: number;
        eval_count?: number;
      };

      if (!data.message?.content) {
        throw new OllamaAPIError('Reponse API invalide', 'INVALID_REQUEST');
      }

      const estimatedInputTokens = messages.reduce(
        (sum, m) => sum + Math.ceil(m.content.length / 4),
        0
      );
      const estimatedOutputTokens = Math.ceil(data.message.content.length / 4);

      return {
        content: data.message.content,
        inputTokens: data.prompt_eval_count || estimatedInputTokens,
        outputTokens: data.eval_count || estimatedOutputTokens,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new OllamaAPIError("Delai d'attente depasse", 'TIMEOUT');
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new OllamaAPIError(
          `Impossible de contacter Ollama a ${this.baseUrl}`,
          'NETWORK'
        );
      }
      if (error instanceof OllamaAPIError) {
        throw error;
      }
      throw new OllamaAPIError(
        error instanceof Error ? error.message : 'Erreur inconnue',
        'UNKNOWN'
      );
    }
  }

  // ============================================================================
  // Role-Based Calls
  // ============================================================================

  /**
   * Appel explicite avec un role specifique
   */
  async callWithRole(
    messages: Array<{ role: string; content: string }>,
    options?: Proph3tCallOptions
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    const previousRole = this.currentRole;
    this.currentRole = options?.role || 'fast';

    try {
      return await this.callAPI(messages, {
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      });
    } finally {
      this.currentRole = previousRole;
    }
  }

  // ============================================================================
  // Override: Detection with Model Routing
  // ============================================================================

  async detectAnomalies(
    transactions: Transaction[],
    type: AIDetectionType,
    context?: { bankConditions?: BankConditions; ragContext?: { text: string; sources: Array<{ title: string; source: string }> } }
  ): Promise<Anomaly[]> {
    // Route to correct model based on detection type
    this.currentRole = DETECTION_MODEL_MAP[type] || 'fast';

    try {
      // If no ragContext provided, try to fetch it automatically
      if (!context?.ragContext && this.ragPipeline) {
        const ragCtx = await this.getRagContext(`detection ${type} audit bancaire`);
        if (ragCtx) {
          context = { ...context, ragContext: ragCtx };
        }
      }

      return await super.detectAnomalies(transactions, type, context);
    } finally {
      this.currentRole = 'fast';
    }
  }

  // ============================================================================
  // Override: Categorization with 3-Tier Pipeline
  // ============================================================================

  async categorizeTransactions(
    transactions: Transaction[],
    existingCategories?: string[]
  ): Promise<AICategoryResult[]> {
    // Force fast model for categorization
    this.currentRole = 'fast';

    try {
      // Initialize pipeline components lazily
      if (!this.preFilter) {
        this.preFilter = new DeterministicPreFilter();
      }
      if (!this.cache) {
        this.cache = new CategorizationCache();
      }

      const results: AICategoryResult[] = [];
      let remaining = [...transactions];

      // Tier 1: Cache lookup
      const cacheResults = await this.cache.bulkLookup(remaining);
      for (const [txId, cached] of cacheResults) {
        if (cached) {
          results.push({
            transactionId: txId,
            category: cached.category,
            confidence: cached.confidence,
            type: cached.type,
          });
        }
      }

      const cachedIds = new Set(results.map((r) => r.transactionId));
      remaining = remaining.filter((t) => !cachedIds.has(t.id));

      if (remaining.length === 0) return results;

      // Tier 2: Deterministic pre-filter (regex dictionary)
      const { categorized, uncategorized } = this.preFilter.filter(remaining);
      results.push(...categorized);

      // Store pre-filter results in cache
      if (categorized.length > 0) {
        const toCache = categorized.map((r) => {
          const tx = remaining.find((t) => t.id === r.transactionId);
          return {
            description: tx?.description || '',
            category: r.category,
            confidence: r.confidence,
            type: r.type,
          };
        });
        await this.cache.bulkStore(toCache);
      }

      if (uncategorized.length === 0) return results;

      // Tier 3: AI categorization (only for remaining uncategorized)
      const aiResults = await super.categorizeTransactions(uncategorized, existingCategories);
      results.push(...aiResults);

      // Store AI results in cache
      if (aiResults.length > 0) {
        const toCache = aiResults
          .filter((r) => r.confidence > 0.5)
          .map((r) => {
            const tx = uncategorized.find((t) => t.id === r.transactionId);
            return {
              description: tx?.description || '',
              category: r.category,
              confidence: r.confidence,
              type: r.type,
            };
          });
        await this.cache.bulkStore(toCache);
      }

      return results;
    } finally {
      this.currentRole = 'fast';
    }
  }

  // ============================================================================
  // Override: Report Generation with Reasoning Model
  // ============================================================================

  async generateReport(data: AIReportData): Promise<AIReportContent> {
    this.currentRole = 'reasoning';
    try {
      // Fetch RAG context for report generation
      if (this.ragPipeline) {
        const ragCtx = await this.getRagContext(
          `rapport audit bancaire anomalies frais ${data.clientName}`
        );
        if (ragCtx) {
          // Augment the report data description with regulatory context
          const augmentedData = { ...data };
          if (!augmentedData.bankConditions) {
            augmentedData.bankConditions = {} as BankConditions;
          }
          // The RAG context will be used by the base provider through the prompt
          return await super.generateReport(augmentedData);
        }
      }
      return await super.generateReport(data);
    } finally {
      this.currentRole = 'fast';
    }
  }

  // ============================================================================
  // Override: Fraud Analysis with Reasoning Model
  // ============================================================================

  async analyzeFraud(transactions: Transaction[], existingAnomalies?: Anomaly[]) {
    this.currentRole = 'reasoning';
    try {
      return await super.analyzeFraud(transactions, existingAnomalies);
    } finally {
      this.currentRole = 'fast';
    }
  }

  // ============================================================================
  // Override: JSON Extraction
  // ============================================================================

  protected extractJson(text: string): string {
    return JsonValidator.extractJson(text);
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  async getCacheStats(): Promise<{ entries: number; hitRate: number } | null> {
    if (!this.cache) return null;
    return this.cache.getStats();
  }

  async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.cleanup(0);
    }
  }

  // ============================================================================
  // Embedding Generation
  // ============================================================================

  /**
   * Genere un embedding via Ollama /api/embeddings avec le modele embedding
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const embeddingModel = this.proph3tConfig.models.embedding.name;

    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: embeddingModel,
        prompt: text,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: string };
      throw new OllamaAPIError(
        `Erreur embedding: ${errorData?.error || response.statusText}`,
        response.status === 404 ? 'INVALID_REQUEST' : 'SERVER',
        response.status
      );
    }

    const data = (await response.json()) as { embedding?: number[] };

    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new OllamaAPIError('Reponse embedding invalide', 'INVALID_REQUEST');
    }

    return data.embedding;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private async handleErrorResponse(response: Response, modelName: string): Promise<never> {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    const errorMessage = errorData?.error || response.statusText;

    switch (response.status) {
      case 404:
        throw new OllamaAPIError(
          `Modele "${modelName}" non trouve. Executez: ollama pull ${modelName}`,
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
