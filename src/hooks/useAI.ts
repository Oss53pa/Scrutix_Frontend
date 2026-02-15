// ============================================================================
// SCRUTIX - useAI Hook
// Hook React pour l'intégration IA multi-fournisseur
// ============================================================================

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSettingsStore } from '../store';
import {
  AIProviderFactory,
  AIProviderConfig,
  AIProviderType,
  AIDetectionType,
  AIChatMessage,
  AIChatContext,
  AIChatResponse,
  AICategoryResult,
  AIFraudAnalysis,
  AIReportContent,
  AIReportData,
  AIFeatureFlags,
  IAIProvider,
  AI_MODELS,
  aiDetectionOrchestrator,
  OrchestrationResult,
  OrchestrationProgress,
} from '../ai';
import { encryptApiKey } from '../utils/crypto';
import type { Transaction, Anomaly, BankConditions } from '../types';

/**
 * État d'utilisation IA
 */
interface AIUsageState {
  totalTokensUsed: number;
  totalRequests: number;
  lastRequestAt: string | null;
  monthlyTokens: number;
  monthlyRequests: number;
}

/**
 * Résultat du hook useAI
 */
interface UseAIResult {
  // État
  isEnabled: boolean;
  isConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  provider: AIProviderType;

  // Configuration
  config: AIProviderConfig;
  features: AIFeatureFlags;
  availableProviders: Array<{ type: AIProviderType; name: string; requiresApiKey: boolean }>;
  availableModels: typeof AI_MODELS[AIProviderType];

  // Actions de configuration
  setProvider: (provider: AIProviderType) => void;
  setModel: (model: string) => void;
  setApiKey: (key: string) => Promise<void>;
  setTemperature: (temp: number) => void;
  setMaxTokens: (tokens: number) => void;
  setBaseUrl: (url: string) => void;
  toggleFeature: (feature: keyof AIFeatureFlags) => void;

  // Test & validation
  testConnection: () => Promise<boolean>;
  clearApiKey: () => void;

  // Opérations IA
  categorize: (transactions: Transaction[], existingCategories?: string[]) => Promise<AICategoryResult[]>;
  detectFraud: (transactions: Transaction[], existingAnomalies?: Anomaly[]) => Promise<AIFraudAnalysis[]>;
  generateReport: (data: AIReportData) => Promise<AIReportContent | null>;
  chat: (message: string, context?: AIChatContext, history?: AIChatMessage[]) => Promise<AIChatResponse | null>;

  // Détection orchestrée
  runDetection: (transactions: Transaction[], types?: AIDetectionType[], options?: {
    bankConditions?: BankConditions;
    onProgress?: (progress: OrchestrationProgress) => void;
  }) => Promise<OrchestrationResult>;
  runBasicDetection: (transactions: Transaction[], options?: {
    bankConditions?: BankConditions;
    onProgress?: (progress: OrchestrationProgress) => void;
  }) => Promise<OrchestrationResult>;
  runExtendedDetection: (transactions: Transaction[], options?: {
    bankConditions?: BankConditions;
    onProgress?: (progress: OrchestrationProgress) => void;
  }) => Promise<OrchestrationResult>;

  // Usage
  usage: AIUsageState;
  resetMonthlyUsage: () => void;
}

/**
 * Hook principal pour l'intégration IA
 */
export function useAI(): UseAIResult {
  const {
    aiSettings,
    updateAIProvider,
    updateAIFeatures,
    updateAIUsage,
    clearAIApiKey,
    resetAIMonthlyUsage,
    setAIConnectionStatus,
  } = useSettingsStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerInstance, setProviderInstance] = useState<IAIProvider | null>(null);

  // Configuration actuelle
  const config = aiSettings?.provider || {
    provider: 'claude' as AIProviderType,
    model: 'claude-sonnet-4-20250514',
    temperature: 0.3,
    maxTokens: 4000,
    apiKey: '',
  };

  const features = aiSettings?.features || {
    categorization: true,
    fraudDetection: true,
    reportGeneration: true,
    chat: true,
    duplicates: true,
    ghostFees: true,
    overcharges: true,
    interestErrors: true,
    valueDate: false,
    suspicious: false,
    compliance: false,
    cashflow: false,
    reconciliation: false,
    multiBank: false,
    ohada: false,
    amlLcbFt: false,
    fees: false,
  };

  // Vérifie si l'IA est configurée
  const isConfigured = useMemo(() => {
    // Ollama n'a pas besoin de clé API
    if (config.provider === 'ollama') {
      return Boolean(config.model);
    }
    return Boolean(config.apiKey && config.apiKey.length > 0);
  }, [config.apiKey, config.model, config.provider]);

  // Vérifie si l'IA est activée
  const isEnabled = useMemo(() => {
    return aiSettings?.isConfigured && isConfigured;
  }, [aiSettings?.isConfigured, isConfigured]);

  // Providers disponibles
  const availableProviders = useMemo(() => {
    return AIProviderFactory.getAvailableProviders();
  }, []);

  // Modèles disponibles pour le provider actuel
  const availableModels = useMemo(() => {
    return AI_MODELS[config.provider] || [];
  }, [config.provider]);

  // Initialise le provider
  const initializeProvider = useCallback(async (): Promise<IAIProvider | null> => {
    if (!isConfigured) return null;

    try {
      const apiKey = config.apiKey;

      // Déchiffrer la clé si nécessaire
      if (config.apiKeyEncrypted) {
        // Note: on suppose que apiKeyEncrypted contient l'IV
        // La logique de déchiffrement dépend de l'implémentation
      }

      const providerConfig: AIProviderConfig = {
        ...config,
        apiKey,
      };

      const provider = AIProviderFactory.getProvider(providerConfig);
      setProviderInstance(provider);

      // Configurer l'orchestrateur
      if (provider) {
        aiDetectionOrchestrator.setProvider(provider);
      }

      return provider;
    } catch (err) {
      console.error('Erreur initialisation provider:', err);
      setError('Impossible d\'initialiser le provider IA');
      return null;
    }
  }, [config, isConfigured]);

  // Effet pour initialiser le provider au changement de config
  useEffect(() => {
    if (isConfigured) {
      initializeProvider();
    }
  }, [isConfigured, config.provider, config.model]);

  // ============================================================================
  // Actions de configuration
  // ============================================================================

  const setProvider = useCallback((provider: AIProviderType) => {
    const defaultModel = AIProviderFactory.getDefaultModel(provider);
    updateAIProvider({
      provider,
      model: defaultModel?.id || '',
      baseUrl: provider === 'ollama' ? 'http://localhost:11434' : undefined,
    });
    AIProviderFactory.reset();
  }, [updateAIProvider]);

  const setModel = useCallback((model: string) => {
    updateAIProvider({ model });
  }, [updateAIProvider]);

  const setApiKey = useCallback(async (key: string): Promise<void> => {
    setError(null);

    if (!key.trim()) {
      clearAIApiKey();
      return;
    }

    try {
      const { encrypted, iv } = await encryptApiKey(key);
      updateAIProvider({
        apiKey: encrypted,
        apiKeyEncrypted: iv,
      });
    } catch (err) {
      console.error('Erreur chiffrement clé API:', err);
      // Fallback: stocker en clair
      updateAIProvider({
        apiKey: key,
        apiKeyEncrypted: '',
      });
    }
  }, [updateAIProvider, clearAIApiKey]);

  const setTemperature = useCallback((temp: number) => {
    updateAIProvider({ temperature: Math.max(0, Math.min(1, temp)) });
  }, [updateAIProvider]);

  const setMaxTokens = useCallback((tokens: number) => {
    updateAIProvider({ maxTokens: Math.max(100, Math.min(8000, tokens)) });
  }, [updateAIProvider]);

  const setBaseUrl = useCallback((url: string) => {
    updateAIProvider({ baseUrl: url });
  }, [updateAIProvider]);

  const toggleFeature = useCallback((feature: keyof AIFeatureFlags) => {
    updateAIFeatures({ [feature]: !features[feature] });
  }, [features, updateAIFeatures]);

  // ============================================================================
  // Test & validation
  // ============================================================================

  const testConnection = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const provider = await initializeProvider();
      if (!provider) {
        setAIConnectionStatus('error', 'Service non configuré');
        return false;
      }

      const result = await provider.testConnection();

      if (result.valid) {
        setAIConnectionStatus('connected');
        return true;
      } else {
        setAIConnectionStatus('error', result.error || 'Connexion échouée');
        setError(result.error || 'Connexion échouée');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion';
      setAIConnectionStatus('error', message);
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [initializeProvider, setAIConnectionStatus]);

  // ============================================================================
  // Opérations IA
  // ============================================================================

  const categorize = useCallback(async (
    transactions: Transaction[],
    existingCategories?: string[]
  ): Promise<AICategoryResult[]> => {
    if (!isEnabled || !features.categorization) {
      setError('La catégorisation IA n\'est pas activée');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const provider = providerInstance || await initializeProvider();
      if (!provider) throw new Error('Service non disponible');

      const results = await provider.categorizeTransactions(transactions, existingCategories);
      const usage = provider.getLastTokensUsed();
      if (usage) {
        updateAIUsage(usage.input + usage.output);
      }

      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de catégorisation';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, features.categorization, providerInstance, initializeProvider, updateAIUsage]);

  const detectFraud = useCallback(async (
    transactions: Transaction[],
    existingAnomalies?: Anomaly[]
  ): Promise<AIFraudAnalysis[]> => {
    if (!isEnabled || !features.fraudDetection) {
      setError('La détection de fraude IA n\'est pas activée');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const provider = providerInstance || await initializeProvider();
      if (!provider) throw new Error('Service non disponible');

      const results = await provider.analyzeFraud(transactions, existingAnomalies);
      const usage = provider.getLastTokensUsed();
      if (usage) {
        updateAIUsage(usage.input + usage.output);
      }

      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de détection de fraude';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, features.fraudDetection, providerInstance, initializeProvider, updateAIUsage]);

  const generateReport = useCallback(async (data: AIReportData): Promise<AIReportContent | null> => {
    if (!isEnabled || !features.reportGeneration) {
      setError('La génération de rapport IA n\'est pas activée');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const provider = providerInstance || await initializeProvider();
      if (!provider) throw new Error('Service non disponible');

      const result = await provider.generateReport(data);
      const usage = provider.getLastTokensUsed();
      if (usage) {
        updateAIUsage(usage.input + usage.output);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de génération de rapport';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, features.reportGeneration, providerInstance, initializeProvider, updateAIUsage]);

  const chat = useCallback(async (
    message: string,
    context?: AIChatContext,
    history?: AIChatMessage[]
  ): Promise<AIChatResponse | null> => {
    if (!isEnabled || !features.chat) {
      setError('Le chat IA n\'est pas activé');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const provider = providerInstance || await initializeProvider();
      if (!provider) throw new Error('Service non disponible');

      const result = await provider.chat(history || [], { context });
      updateAIUsage(result.tokensUsed.total);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de chat';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, features.chat, providerInstance, initializeProvider, updateAIUsage]);

  // ============================================================================
  // Détection orchestrée
  // ============================================================================

  const runDetection = useCallback(async (
    transactions: Transaction[],
    types?: AIDetectionType[],
    options?: {
      bankConditions?: BankConditions;
      onProgress?: (progress: OrchestrationProgress) => void;
    }
  ): Promise<OrchestrationResult> => {
    if (!isEnabled) {
      return {
        success: false,
        results: [],
        allAnomalies: [],
        summary: {
          totalDetections: 0,
          totalAnomalies: 0,
          totalAmount: 0,
          byType: {} as Record<AIDetectionType, number>,
          bySeverity: {},
        },
        tokensUsed: 0,
        processingTime: 0,
        errors: [{ type: AIDetectionType.DUPLICATES, error: 'IA non activée' }],
      };
    }

    setIsLoading(true);
    setError(null);

    try {
      // S'assurer que le provider est initialisé
      const provider = providerInstance || await initializeProvider();
      if (provider) {
        aiDetectionOrchestrator.setProvider(provider);
      }

      // Déterminer les types à exécuter
      const enabledTypes = types || aiDetectionOrchestrator.getEnabledTypesFromFlags(features);

      const result = await aiDetectionOrchestrator.runDetections(
        transactions,
        {
          enabledTypes,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          batchSize: 50,
          includeRegulatoryReferences: true,
        },
        {
          enabledTypes,
          bankConditions: options?.bankConditions,
          onProgress: options?.onProgress,
        }
      );

      updateAIUsage(result.tokensUsed);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de détection';
      setError(message);
      return {
        success: false,
        results: [],
        allAnomalies: [],
        summary: {
          totalDetections: 0,
          totalAnomalies: 0,
          totalAmount: 0,
          byType: {} as Record<AIDetectionType, number>,
          bySeverity: {},
        },
        tokensUsed: 0,
        processingTime: 0,
        errors: [{ type: AIDetectionType.DUPLICATES, error: message }],
      };
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, providerInstance, initializeProvider, features, config, updateAIUsage]);

  const runBasicDetection = useCallback(async (
    transactions: Transaction[],
    options?: {
      bankConditions?: BankConditions;
      onProgress?: (progress: OrchestrationProgress) => void;
    }
  ): Promise<OrchestrationResult> => {
    return runDetection(transactions, [
      AIDetectionType.DUPLICATES,
      AIDetectionType.GHOST_FEES,
      AIDetectionType.OVERCHARGES,
      AIDetectionType.INTEREST_ERRORS,
    ], options);
  }, [runDetection]);

  const runExtendedDetection = useCallback(async (
    transactions: Transaction[],
    options?: {
      bankConditions?: BankConditions;
      onProgress?: (progress: OrchestrationProgress) => void;
    }
  ): Promise<OrchestrationResult> => {
    return runDetection(transactions, [
      AIDetectionType.VALUE_DATE,
      AIDetectionType.SUSPICIOUS,
      AIDetectionType.COMPLIANCE,
      AIDetectionType.CASHFLOW,
      AIDetectionType.RECONCILIATION,
      AIDetectionType.MULTI_BANK,
      AIDetectionType.OHADA,
      AIDetectionType.AML_LCB_FT,
      AIDetectionType.FEES,
    ], options);
  }, [runDetection]);

  // ============================================================================
  // Usage
  // ============================================================================

  const usage: AIUsageState = useMemo(() => ({
    totalTokensUsed: (aiSettings?.usage?.totalTokensInput || 0) + (aiSettings?.usage?.totalTokensOutput || 0),
    totalRequests: aiSettings?.usage?.totalRequests || 0,
    lastRequestAt: aiSettings?.usage?.lastRequestAt
      ? (typeof aiSettings.usage.lastRequestAt === 'string'
          ? aiSettings.usage.lastRequestAt
          : aiSettings.usage.lastRequestAt.toISOString())
      : null,
    monthlyTokens: aiSettings?.usage?.monthlyUsed || 0,
    monthlyRequests: aiSettings?.usage?.totalRequests || 0,
  }), [aiSettings?.usage]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // État
    isEnabled,
    isConfigured,
    isLoading,
    error,
    provider: config.provider,

    // Configuration
    config,
    features,
    availableProviders,
    availableModels,

    // Actions de configuration
    setProvider,
    setModel,
    setApiKey,
    setTemperature,
    setMaxTokens,
    setBaseUrl,
    toggleFeature,

    // Test & validation
    testConnection,
    clearApiKey: clearAIApiKey,

    // Opérations IA
    categorize,
    detectFraud,
    generateReport,
    chat,

    // Détection orchestrée
    runDetection,
    runBasicDetection,
    runExtendedDetection,

    // Usage
    usage,
    resetMonthlyUsage: resetAIMonthlyUsage,
  };
}

// Export par défaut
export default useAI;
