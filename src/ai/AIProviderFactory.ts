// ============================================================================
// SCRUTIX - AI Provider Factory
// Factory pour créer et gérer les instances de providers IA
// ============================================================================

import {
  AIProviderType,
  AIProviderConfig,
  AIModel,
  AI_MODELS,
  IAIProvider,
  DEFAULT_AI_CONFIG,
} from './types';
import {
  ClaudeProvider,
  OpenAIProvider,
  MistralProvider,
  OllamaProvider,
} from './providers';

/**
 * Factory pour créer des instances de providers IA
 * Implémente le pattern Singleton pour le provider actif
 */
class AIProviderFactoryClass {
  private currentProvider: IAIProvider | null = null;
  private currentConfig: AIProviderConfig | null = null;

  /**
   * Crée un nouveau provider basé sur la configuration
   */
  createProvider(config: AIProviderConfig): IAIProvider {
    switch (config.provider) {
      case 'claude':
        return new ClaudeProvider(config);
      case 'openai':
        return new OpenAIProvider(config);
      case 'mistral':
        return new MistralProvider(config);
      case 'ollama':
        return new OllamaProvider(config);
      case 'custom':
        // Pour un provider custom, on pourrait implémenter une classe générique
        // Pour l'instant, on utilise OpenAI comme base (API compatible)
        return new OpenAIProvider({
          ...config,
          // Le baseUrl serait utilisé pour l'API custom
        });
      default:
        throw new Error(`Provider inconnu: ${config.provider}`);
    }
  }

  /**
   * Configure et retourne le provider actif (singleton)
   */
  getProvider(config?: AIProviderConfig): IAIProvider | null {
    // Si une nouvelle config est fournie, créer un nouveau provider
    if (config && this.hasConfigChanged(config)) {
      this.currentProvider = this.createProvider(config);
      this.currentConfig = { ...config };
    }

    return this.currentProvider;
  }

  /**
   * Vérifie si la configuration a changé
   */
  private hasConfigChanged(newConfig: AIProviderConfig): boolean {
    if (!this.currentConfig) return true;

    return (
      this.currentConfig.provider !== newConfig.provider ||
      this.currentConfig.model !== newConfig.model ||
      this.currentConfig.apiKey !== newConfig.apiKey ||
      this.currentConfig.baseUrl !== newConfig.baseUrl
    );
  }

  /**
   * Met à jour la configuration du provider actif
   */
  updateConfig(updates: Partial<AIProviderConfig>): void {
    if (this.currentProvider && this.currentConfig) {
      const newConfig = { ...this.currentConfig, ...updates };
      this.currentProvider.configure(newConfig);
      this.currentConfig = newConfig;
    }
  }

  /**
   * Réinitialise le provider
   */
  reset(): void {
    this.currentProvider = null;
    this.currentConfig = null;
  }

  /**
   * Vérifie si un provider est configuré
   */
  hasProvider(): boolean {
    return this.currentProvider !== null;
  }

  /**
   * Retourne les modèles disponibles pour un type de provider
   */
  getModelsForProvider(providerType: AIProviderType): AIModel[] {
    return AI_MODELS[providerType] || [];
  }

  /**
   * Retourne le modèle par défaut pour un type de provider
   */
  getDefaultModel(providerType: AIProviderType): AIModel | undefined {
    const models = this.getModelsForProvider(providerType);
    return models.find(m => m.isDefault) || models[0];
  }

  /**
   * Retourne tous les providers disponibles
   */
  getAvailableProviders(): Array<{ type: AIProviderType; name: string; requiresApiKey: boolean }> {
    return [
      { type: 'claude', name: 'Anthropic Claude', requiresApiKey: true },
      { type: 'openai', name: 'OpenAI GPT', requiresApiKey: true },
      { type: 'mistral', name: 'Mistral AI', requiresApiKey: true },
      { type: 'ollama', name: 'Ollama (Local)', requiresApiKey: false },
    ];
  }

  /**
   * Crée une configuration par défaut pour un provider
   */
  createDefaultConfig(providerType: AIProviderType, apiKey?: string): AIProviderConfig {
    const defaultModel = this.getDefaultModel(providerType);

    return {
      ...DEFAULT_AI_CONFIG,
      provider: providerType,
      model: defaultModel?.id || '',
      apiKey: apiKey || '',
      baseUrl: providerType === 'ollama' ? 'http://localhost:11434' : undefined,
    };
  }

  /**
   * Teste la connexion pour une configuration donnée
   */
  async testConnection(config: AIProviderConfig): Promise<{ valid: boolean; error?: string }> {
    try {
      const provider = this.createProvider(config);
      return await provider.testConnection();
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}

// Export singleton
export const AIProviderFactory = new AIProviderFactoryClass();

// Export type pour utilisation externe
export type { AIProviderFactoryClass };
