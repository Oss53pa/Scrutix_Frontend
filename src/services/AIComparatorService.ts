// ============================================================================
// SCRUTIX - AI Comparator Service
// Compare les resultats entre PROPH3T et providers premium
// ============================================================================

import { AIProviderFactory } from '../ai/AIProviderFactory';
import type { AIProviderConfig, IAIProvider, AICategoryResult } from '../ai/types';
import type { Transaction } from '../types';

export interface ComparisonResult {
  taskType: 'categorization' | 'anomaly_detection' | 'report';
  proph3t: ProviderResult;
  premium: ProviderResult;
  comparison: {
    agreementRate: number;    // 0-1
    timeDiffMs: number;       // premium - proph3t (positive = proph3t faster)
    costDiffXAF: number;      // premium cost (proph3t is 0)
  };
}

export interface ProviderResult {
  provider: string;
  model: string;
  timeMs: number;
  tokensUsed: number;
  costXAF: number;
  output: unknown;
  error?: string;
}

const USD_TO_XAF = 615;

export class AIComparatorService {
  /**
   * Compare la categorisation entre PROPH3T et un provider premium
   */
  async compareCategorization(
    transactions: Transaction[],
    premiumProvider?: string
  ): Promise<ComparisonResult> {
    const proph3tResult = await this.runCategorization(transactions, 'ollama');
    const premiumResult = await this.runCategorization(transactions, premiumProvider || 'claude');

    const agreementRate = this.calculateCategorizationAgreement(
      proph3tResult.output as AICategoryResult[],
      premiumResult.output as AICategoryResult[]
    );

    return {
      taskType: 'categorization',
      proph3t: proph3tResult,
      premium: premiumResult,
      comparison: {
        agreementRate,
        timeDiffMs: premiumResult.timeMs - proph3tResult.timeMs,
        costDiffXAF: premiumResult.costXAF,
      },
    };
  }

  /**
   * Compare la detection d'anomalies
   */
  async compareAnomalyDetection(
    transactions: Transaction[],
    premiumProvider?: string
  ): Promise<ComparisonResult> {
    const proph3tResult = await this.runAnomalyDetection(transactions, 'ollama');
    const premiumResult = await this.runAnomalyDetection(transactions, premiumProvider || 'claude');

    const proph3tAnomalies = (proph3tResult.output as Array<{ transactionId?: string }>) || [];
    const premiumAnomalies = (premiumResult.output as Array<{ transactionId?: string }>) || [];

    const agreementRate = this.calculateAnomalyAgreement(proph3tAnomalies, premiumAnomalies);

    return {
      taskType: 'anomaly_detection',
      proph3t: proph3tResult,
      premium: premiumResult,
      comparison: {
        agreementRate,
        timeDiffMs: premiumResult.timeMs - proph3tResult.timeMs,
        costDiffXAF: premiumResult.costXAF,
      },
    };
  }

  /**
   * Compare la generation de rapports
   */
  async compareReportGeneration(
    data: { transactions: Transaction[]; anomalies: unknown[] },
    premiumProvider?: string
  ): Promise<ComparisonResult> {
    const proph3tResult = await this.runReport(data, 'ollama');
    const premiumResult = await this.runReport(data, premiumProvider || 'claude');

    return {
      taskType: 'report',
      proph3t: proph3tResult,
      premium: premiumResult,
      comparison: {
        agreementRate: 0, // Not applicable for reports
        timeDiffMs: premiumResult.timeMs - proph3tResult.timeMs,
        costDiffXAF: premiumResult.costXAF,
      },
    };
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private async runCategorization(
    transactions: Transaction[],
    providerType: string
  ): Promise<ProviderResult> {
    const start = performance.now();
    try {
      const provider = this.getProviderForType(providerType);
      if (!provider) {
        return this.errorResult(providerType, 'Provider non disponible');
      }

      const results = await provider.categorizeTransactions(transactions);
      const usage = provider.getLastTokensUsed();
      const timeMs = performance.now() - start;

      return {
        provider: providerType,
        model: '',
        timeMs,
        tokensUsed: usage ? usage.input + usage.output : 0,
        costXAF: providerType === 'ollama' ? 0 : this.estimateCost(usage),
        output: results,
      };
    } catch (err) {
      return this.errorResult(providerType, err instanceof Error ? err.message : 'Erreur inconnue', performance.now() - start);
    }
  }

  private async runAnomalyDetection(
    transactions: Transaction[],
    providerType: string
  ): Promise<ProviderResult> {
    const start = performance.now();
    try {
      const provider = this.getProviderForType(providerType);
      if (!provider) {
        return this.errorResult(providerType, 'Provider non disponible');
      }

      const results = await provider.analyzeFraud(transactions);
      const usage = provider.getLastTokensUsed();
      const timeMs = performance.now() - start;

      return {
        provider: providerType,
        model: '',
        timeMs,
        tokensUsed: usage ? usage.input + usage.output : 0,
        costXAF: providerType === 'ollama' ? 0 : this.estimateCost(usage),
        output: results,
      };
    } catch (err) {
      return this.errorResult(providerType, err instanceof Error ? err.message : 'Erreur inconnue', performance.now() - start);
    }
  }

  private async runReport(
    data: { transactions: Transaction[]; anomalies: unknown[] },
    providerType: string
  ): Promise<ProviderResult> {
    const start = performance.now();
    try {
      const provider = this.getProviderForType(providerType);
      if (!provider) {
        return this.errorResult(providerType, 'Provider non disponible');
      }

      const result = await provider.generateReport({
        transactions: data.transactions,
        anomalies: data.anomalies as never[],
        metadata: {
          bankName: 'Comparaison',
          clientName: 'Test',
          period: { start: '', end: '' },
        },
      });
      const usage = provider.getLastTokensUsed();
      const timeMs = performance.now() - start;

      return {
        provider: providerType,
        model: '',
        timeMs,
        tokensUsed: usage ? usage.input + usage.output : 0,
        costXAF: providerType === 'ollama' ? 0 : this.estimateCost(usage),
        output: result,
      };
    } catch (err) {
      return this.errorResult(providerType, err instanceof Error ? err.message : 'Erreur inconnue', performance.now() - start);
    }
  }

  private getProviderForType(providerType: string): IAIProvider | null {
    // Use the factory's current provider if it matches
    const current = AIProviderFactory.getProvider();
    if (current) return current;
    return null;
  }

  private estimateCost(usage: { input: number; output: number } | null): number {
    if (!usage) return 0;
    // Rough estimate using Claude Sonnet pricing
    const costUSD = (usage.input / 1_000_000) * 3.0 + (usage.output / 1_000_000) * 15.0;
    return Math.round(costUSD * USD_TO_XAF);
  }

  private calculateCategorizationAgreement(
    a: AICategoryResult[] | null,
    b: AICategoryResult[] | null
  ): number {
    if (!a || !b || a.length === 0 || b.length === 0) return 0;

    let matches = 0;
    const total = Math.max(a.length, b.length);

    for (const itemA of a) {
      const itemB = b.find(x => x.transactionId === itemA.transactionId);
      if (itemB && itemB.category === itemA.category) {
        matches++;
      }
    }

    return total > 0 ? matches / total : 0;
  }

  private calculateAnomalyAgreement(
    a: Array<{ transactionId?: string }>,
    b: Array<{ transactionId?: string }>
  ): number {
    if (a.length === 0 && b.length === 0) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const idsA = new Set(a.map(x => x.transactionId).filter(Boolean));
    const idsB = new Set(b.map(x => x.transactionId).filter(Boolean));

    let intersection = 0;
    for (const id of idsA) {
      if (idsB.has(id)) intersection++;
    }

    const union = new Set([...idsA, ...idsB]).size;
    return union > 0 ? intersection / union : 0;
  }

  private errorResult(provider: string, error: string, timeMs = 0): ProviderResult {
    return {
      provider,
      model: '',
      timeMs,
      tokensUsed: 0,
      costXAF: 0,
      output: null,
      error,
    };
  }
}

// Singleton
let instance: AIComparatorService | null = null;

export function getAIComparator(): AIComparatorService {
  if (!instance) {
    instance = new AIComparatorService();
  }
  return instance;
}
