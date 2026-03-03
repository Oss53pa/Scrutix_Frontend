// ============================================================================
// SCRUTIX - Premium Gateway
// Routage intelligent des taches IA vers PROPH3T ou providers premium
// ============================================================================

import { AIProviderFactory } from '../AIProviderFactory';
import { CostCalculator } from './CostCalculator';
import { BudgetTracker } from './BudgetTracker';
import type { AIProviderType, IAIProvider } from '../types';
import {
  DEFAULT_GATEWAY_CONFIG,
  type GatewayConfig,
  type GatewayTaskType,
  type GatewayBudgetStatus,
} from './GatewayTypes';

/**
 * Gateway Premium IA
 * Decide quel provider utiliser pour chaque tache selon la strategie,
 * le budget, et les fallbacks
 */
export class PremiumGateway {
  private config: GatewayConfig;
  private costCalculator: CostCalculator;
  private budgetTracker: BudgetTracker;

  constructor(config?: Partial<GatewayConfig>) {
    this.config = { ...DEFAULT_GATEWAY_CONFIG, ...config };
    this.costCalculator = new CostCalculator();
    this.budgetTracker = new BudgetTracker(
      this.config.monthlyBudgetXAF,
      this.config.alertThreshold
    );
  }

  /**
   * Met a jour la configuration
   */
  updateConfig(config: Partial<GatewayConfig>): void {
    this.config = { ...this.config, ...config };
    this.budgetTracker.configure(
      this.config.monthlyBudgetXAF,
      this.config.alertThreshold
    );
  }

  /**
   * Determine le provider a utiliser pour une tache
   */
  async getProviderForTask(taskType: GatewayTaskType): Promise<AIProviderType> {
    const strategy = this.config.strategy;

    switch (strategy) {
      case 'proph3t_only':
        return 'ollama';

      case 'premium_preferred':
        return await this.getPremiumPreferredProvider(taskType);

      case 'hybrid':
        return await this.getHybridProvider(taskType);

      case 'cost_optimized':
        return await this.getCostOptimizedProvider(taskType);

      default:
        return 'ollama';
    }
  }

  /**
   * Route une tache et enregistre l'utilisation
   */
  async recordTaskUsage(
    taskType: GatewayTaskType,
    provider: AIProviderType,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<void> {
    const { costUSD, costXAF } = this.costCalculator.calculateCost(
      provider, model, inputTokens, outputTokens
    );

    await this.budgetTracker.recordUsage({
      provider,
      model,
      taskType,
      inputTokens,
      outputTokens,
      costUSD,
      costXAF,
    });
  }

  /**
   * Retourne le status du budget
   */
  async getBudgetStatus(): Promise<GatewayBudgetStatus> {
    return await this.budgetTracker.getBudgetStatus();
  }

  /**
   * Retourne l'utilisation par provider
   */
  async getUsageByProvider() {
    return await this.budgetTracker.getUsageByProvider();
  }

  /**
   * Retourne la configuration actuelle
   */
  getConfig(): GatewayConfig {
    return { ...this.config };
  }

  /**
   * Retourne le calculateur de couts
   */
  getCostCalculator(): CostCalculator {
    return this.costCalculator;
  }

  // ============================================================================
  // Strategies privees
  // ============================================================================

  /**
   * Premium preferred: utilise premium si budget le permet
   */
  private async getPremiumPreferredProvider(taskType: GatewayTaskType): Promise<AIProviderType> {
    // Embeddings toujours en local
    if (taskType === 'embedding') return 'ollama';

    // Verifier le budget
    if (this.config.autoFallback) {
      const shouldFallback = await this.budgetTracker.shouldSwitchToProph3t();
      if (shouldFallback) return 'ollama';
    }

    // Utiliser Claude par defaut pour les taches premium
    return 'claude';
  }

  /**
   * Hybrid: routage par tache
   */
  private async getHybridProvider(taskType: GatewayTaskType): Promise<AIProviderType> {
    const routing = this.config.taskRouting[taskType];

    if (routing === 'auto') {
      return await this.getPremiumPreferredProvider(taskType);
    }

    // Verifier le budget avant d'utiliser un provider payant
    if (routing !== 'ollama' && this.config.autoFallback) {
      const shouldFallback = await this.budgetTracker.shouldSwitchToProph3t();
      if (shouldFallback) return 'ollama';
    }

    return routing;
  }

  /**
   * Cost optimized: le moins cher possible
   */
  private async getCostOptimizedProvider(taskType: GatewayTaskType): Promise<AIProviderType> {
    // Embeddings toujours en local
    if (taskType === 'embedding') return 'ollama';

    // PROPH3T est toujours le moins cher (gratuit)
    // Pour les taches critiques (rapport, fraude), on peut preferer un provider premium
    const criticalTasks: GatewayTaskType[] = ['report', 'fraud'];

    if (criticalTasks.includes(taskType)) {
      // Verifier le budget
      if (this.config.autoFallback) {
        const shouldFallback = await this.budgetTracker.shouldSwitchToProph3t();
        if (shouldFallback) return 'ollama';
      }
      // Utiliser Mistral (bon rapport qualite/prix)
      return 'mistral';
    }

    // Pour tout le reste, PROPH3T
    return 'ollama';
  }
}
