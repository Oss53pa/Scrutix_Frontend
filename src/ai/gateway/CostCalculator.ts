// ============================================================================
// SCRUTIX - Cost Calculator
// Calcul des couts par provider et modele
// ============================================================================

import type { AIProviderType } from '../types';

/** Taux de change USD -> XAF */
const USD_TO_XAF = 615;

/**
 * Tables de couts par provider et modele (USD par 1M tokens)
 */
interface CostTable {
  inputPer1M: number;
  outputPer1M: number;
}

const COST_TABLES: Record<string, CostTable> = {
  // Claude
  'claude-sonnet-4-20250514': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-opus-4-1-20250414': { inputPer1M: 15.0, outputPer1M: 75.0 },
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-haiku-20240307': { inputPer1M: 0.25, outputPer1M: 1.25 },

  // OpenAI
  'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.0 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'gpt-4-turbo': { inputPer1M: 10.0, outputPer1M: 30.0 },
  'gpt-3.5-turbo': { inputPer1M: 0.50, outputPer1M: 1.50 },

  // Mistral
  'mistral-large-latest': { inputPer1M: 2.0, outputPer1M: 6.0 },
  'mistral-medium-latest': { inputPer1M: 2.7, outputPer1M: 8.1 },
  'mistral-small-latest': { inputPer1M: 0.2, outputPer1M: 0.6 },
  'codestral-latest': { inputPer1M: 0.2, outputPer1M: 0.6 },
};

/**
 * Couts par defaut par provider (si modele non trouve)
 */
const DEFAULT_PROVIDER_COSTS: Record<AIProviderType, CostTable> = {
  claude: { inputPer1M: 3.0, outputPer1M: 15.0 },
  openai: { inputPer1M: 2.50, outputPer1M: 10.0 },
  mistral: { inputPer1M: 2.0, outputPer1M: 6.0 },
  ollama: { inputPer1M: 0, outputPer1M: 0 }, // Gratuit (local)
  custom: { inputPer1M: 0, outputPer1M: 0 },
};

/**
 * Calculateur de couts pour les appels IA
 */
export class CostCalculator {
  /**
   * Calcule le cout d'un appel
   */
  calculateCost(
    provider: AIProviderType,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): { costUSD: number; costXAF: number } {
    // PROPH3T/Ollama = gratuit
    if (provider === 'ollama') {
      return { costUSD: 0, costXAF: 0 };
    }

    const costs = COST_TABLES[model] || DEFAULT_PROVIDER_COSTS[provider];

    const inputCost = (inputTokens / 1_000_000) * costs.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * costs.outputPer1M;
    const totalUSD = inputCost + outputCost;

    return {
      costUSD: totalUSD,
      costXAF: Math.round(totalUSD * USD_TO_XAF),
    };
  }

  /**
   * Retourne le cout pour un provider et modele
   */
  getProviderCost(provider: AIProviderType, model?: string): CostTable {
    if (model && COST_TABLES[model]) {
      return COST_TABLES[model];
    }
    return DEFAULT_PROVIDER_COSTS[provider] || { inputPer1M: 0, outputPer1M: 0 };
  }

  /**
   * Compare les couts entre providers pour un meme nombre de tokens
   */
  compareCosts(
    inputTokens: number,
    outputTokens: number,
    providers: Array<{ provider: AIProviderType; model: string }>
  ): Array<{ provider: AIProviderType; model: string; costUSD: number; costXAF: number }> {
    return providers
      .map(({ provider, model }) => ({
        provider,
        model,
        ...this.calculateCost(provider, model, inputTokens, outputTokens),
      }))
      .sort((a, b) => a.costUSD - b.costUSD);
  }

  /**
   * Retourne le taux de change USD -> XAF
   */
  getExchangeRate(): number {
    return USD_TO_XAF;
  }

  /**
   * Formate un cout en XAF
   */
  formatCostXAF(costXAF: number): string {
    if (costXAF === 0) return '0 FCFA';
    if (costXAF < 1) return '< 1 FCFA';
    return `${costXAF.toLocaleString('fr-FR')} FCFA`;
  }
}
