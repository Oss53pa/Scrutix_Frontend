import { useState, useCallback, useMemo } from 'react';
import { useSettingsStore } from '../store';
import { ClaudeService, ChatMessage } from '../services/ClaudeService';
import { encryptApiKey, decryptApiKey } from '../utils/crypto';
import type {
  Transaction,
  Anomaly,
  BankConditions,
  AIAuditResponse,
} from '../types';

interface CategoryResult {
  transactionId: string;
  category: string;
  confidence: number;
  type: string;
}

interface FraudAnalysis {
  transactionId: string;
  isSuspicious: boolean;
  riskScore: number;
  reasons: string[];
  recommendation: string;
}

interface ReportContent {
  title: string;
  executiveSummary: string;
  keyFindings: string[];
  detailedAnalysis: string;
  recommendations: string[];
  conclusion: string;
}

interface ChatContext {
  transactions?: Transaction[];
  anomalies?: Anomaly[];
  clientName?: string;
  bankConditions?: BankConditions;
}

interface UsageStats {
  totalTokensUsed: number;
  totalRequests: number;
  lastRequestAt: string | null;
  monthlyTokens: number;
  monthlyRequests: number;
}

export function useClaude() {
  const {
    claudeApi,
    updateClaudeApi,
    clearClaudeApiKey,
    updateClaudeUsage,
    resetMonthlyUsage,
    setConnectionStatus,
  } = useSettingsStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verifie si Claude est configure (cle API presente)
  const isConfigured = useMemo(() => {
    return Boolean(claudeApi.apiKey && claudeApi.apiKey.length > 0);
  }, [claudeApi.apiKey]);

  // Verifie si Claude est active
  const isEnabled = useMemo(() => {
    return claudeApi.isEnabled && isConfigured;
  }, [claudeApi.isEnabled, isConfigured]);

  // Obtient une instance du service Claude
  const getService = useCallback(async (): Promise<ClaudeService | null> => {
    if (!isConfigured) return null;

    try {
      let apiKey = claudeApi.apiKey;

      // Dechiffrer la cle si necessaire
      if (claudeApi.apiKeyIv) {
        apiKey = await decryptApiKey(claudeApi.apiKey, claudeApi.apiKeyIv);
      }

      return new ClaudeService({
        apiKey,
        model: claudeApi.model,
        temperature: claudeApi.temperature,
        maxTokens: claudeApi.maxTokens,
      });
    } catch (err) {
      console.error('Erreur creation service Claude:', err);
      setError('Impossible de dechiffrer la cle API');
      return null;
    }
  }, [claudeApi, isConfigured]);

  // Definir la cle API (avec chiffrement)
  const setApiKey = useCallback(async (key: string): Promise<void> => {
    setError(null);

    if (!key.trim()) {
      clearClaudeApiKey();
      return;
    }

    try {
      const { encrypted, iv } = await encryptApiKey(key);
      updateClaudeApi({
        apiKey: encrypted,
        apiKeyIv: iv,
      });
    } catch (err) {
      console.error('Erreur chiffrement cle API:', err);
      // Fallback: stocker en clair (moins securise)
      updateClaudeApi({
        apiKey: key,
        apiKeyIv: '',
      });
    }
  }, [updateClaudeApi, clearClaudeApiKey]);

  // Tester la connexion
  const testConnection = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const service = await getService();
      if (!service) {
        setConnectionStatus('error', 'Service non configure');
        return false;
      }

      const result = await service.validateApiKey();

      if (result.valid) {
        setConnectionStatus('connected');
        updateClaudeApi({ isEnabled: true });
        return true;
      } else {
        setConnectionStatus('error', result.error || 'Cle API invalide');
        setError(result.error || 'Cle API invalide');
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion';
      setConnectionStatus('error', message);
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getService, setConnectionStatus, updateClaudeApi]);

  // Categoriser des transactions
  const categorize = useCallback(async (
    transactions: Transaction[],
    existingCategories?: string[]
  ): Promise<CategoryResult[]> => {
    if (!isEnabled) {
      setError('Claude AI n\'est pas active');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = await getService();
      if (!service) throw new Error('Service non disponible');

      const results = await service.categorizeTransactions(transactions, existingCategories);
      const usage = service.getLastUsage();
      if (usage) {
        updateClaudeUsage(usage.inputTokens + usage.outputTokens);
      }

      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de categorisation';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, getService, updateClaudeUsage]);

  // Detecter les fraudes
  const detectFraud = useCallback(async (
    transactions: Transaction[],
    anomalies: Anomaly[]
  ): Promise<FraudAnalysis[]> => {
    if (!isEnabled) {
      setError('Claude AI n\'est pas active');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = await getService();
      if (!service) throw new Error('Service non disponible');

      const results = await service.detectFraudPatterns(transactions, anomalies);
      const usage = service.getLastUsage();
      if (usage) {
        updateClaudeUsage(usage.inputTokens + usage.outputTokens);
      }

      return results;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de detection de fraude';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, getService, updateClaudeUsage]);

  // Analyser les anomalies
  const analyze = useCallback(async (
    anomalies: Anomaly[],
    bankConditions?: BankConditions
  ): Promise<AIAuditResponse | null> => {
    if (!isEnabled) {
      setError('Claude AI n\'est pas active');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = await getService();
      if (!service) throw new Error('Service non disponible');

      const result = await service.analyzeAnomalies(anomalies, bankConditions);
      const usage = service.getLastUsage();
      if (usage) {
        updateClaudeUsage(usage.inputTokens + usage.outputTokens);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur d\'analyse';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, getService, updateClaudeUsage]);

  // Generer un rapport
  const generateReport = useCallback(async (
    clientName: string,
    period: { start: Date; end: Date },
    anomalies: Anomaly[],
    statistics: {
      totalTransactions: number;
      totalAmount: number;
      potentialSavings: number;
    }
  ): Promise<ReportContent | null> => {
    if (!isEnabled) {
      setError('Claude AI n\'est pas active');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = await getService();
      if (!service) throw new Error('Service non disponible');

      const result = await service.generateReport(clientName, period, anomalies, statistics);
      const usage = service.getLastUsage();
      if (usage) {
        updateClaudeUsage(usage.inputTokens + usage.outputTokens);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de generation de rapport';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, getService, updateClaudeUsage]);

  // Chat conversationnel
  const chat = useCallback(async (
    message: string,
    context?: ChatContext,
    history?: ChatMessage[]
  ): Promise<{ response: string; tokensUsed: number } | null> => {
    if (!isEnabled) {
      setError('Claude AI n\'est pas active');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = await getService();
      if (!service) throw new Error('Service non disponible');

      const result = await service.chat(message, context, history);
      updateClaudeUsage(result.tokensUsed);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de chat';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, getService, updateClaudeUsage]);

  // Statistiques d'utilisation
  const usage: UsageStats = useMemo(() => ({
    totalTokensUsed: claudeApi.usage.totalTokensUsed,
    totalRequests: claudeApi.usage.totalRequests,
    lastRequestAt: claudeApi.usage.lastRequestAt,
    monthlyTokens: claudeApi.usage.monthlyTokens,
    monthlyRequests: claudeApi.usage.monthlyRequests,
  }), [claudeApi.usage]);

  return {
    // State
    isEnabled,
    isConfigured,
    isLoading,
    error,

    // Configuration
    config: claudeApi,
    setApiKey,
    testConnection,
    clearApiKey: clearClaudeApiKey,

    // Operations IA
    categorize,
    detectFraud,
    analyze,
    generateReport,
    chat,

    // Usage
    usage,
    resetMonthlyUsage,
  };
}
