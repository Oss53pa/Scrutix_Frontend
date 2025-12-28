/**
 * AIModelRouter - Service de routage intelligent des modeles Claude
 *
 * Optimise le rapport cout/precision en dirigeant chaque module d'analyse
 * vers le modele le plus adapte a sa complexite.
 */

// ============================================================================
// TYPES
// ============================================================================

export type ModelTier = 'haiku' | 'sonnet' | 'opus';

export type AnalysisModule =
  // Modules simples (Haiku)
  | 'doublons'
  | 'parsing'
  | 'conformite_ohada'
  | 'rapprochement'
  | 'tresorerie'
  | 'categorisation'
  // Modules complexes (Sonnet)
  | 'frais_bancaires'
  | 'calcul_agios'
  | 'dates_valeur'
  | 'aml'
  | 'operations_suspectes'
  | 'fraude'
  // Modules critiques (Opus)
  | 'rapport_final'
  | 'contestation_banque'
  | 'synthese_client'
  | 'chat';

export interface ModelConfig {
  modelId: string;
  displayName: string;
  tier: ModelTier;
  inputCostPer1M: number;  // USD per 1M tokens
  outputCostPer1M: number; // USD per 1M tokens
  maxTokens: number;
  temperature: number;
  description: string;
}

export interface ModuleConfig {
  module: AnalysisModule;
  tier: ModelTier;
  description: string;
  avgInputTokens: number;  // Estimation moyenne de tokens d'entree
  avgOutputTokens: number; // Estimation moyenne de tokens de sortie
}

export interface CostEstimate {
  module: AnalysisModule;
  model: ModelTier;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  costXAF: number;
}

export interface BatchCostEstimate {
  modules: CostEstimate[];
  totalCostUSD: number;
  totalCostXAF: number;
  breakdown: Record<ModelTier, { count: number; costUSD: number }>;
}

// ============================================================================
// CONFIGURATION DES MODELES
// ============================================================================

export const MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  haiku: {
    modelId: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    tier: 'haiku',
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
    maxTokens: 4096,
    temperature: 0.2,
    description: 'Rapide et economique pour les taches simples',
  },
  sonnet: {
    modelId: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    tier: 'sonnet',
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    maxTokens: 8192,
    temperature: 0.3,
    description: 'Equilibre precision/cout pour analyses complexes',
  },
  opus: {
    modelId: 'claude-opus-4-1-20250414',
    displayName: 'Claude Opus 4',
    tier: 'opus',
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
    maxTokens: 8192,
    temperature: 0.4,
    description: 'Maximum de precision pour rapports et contestations',
  },
};

// ============================================================================
// CONFIGURATION DES MODULES
// ============================================================================

const HAIKU_MODULES: ModuleConfig[] = [
  {
    module: 'doublons',
    tier: 'haiku',
    description: 'Detection de transactions en double',
    avgInputTokens: 2000,
    avgOutputTokens: 500,
  },
  {
    module: 'parsing',
    tier: 'haiku',
    description: 'Extraction et structuration des donnees',
    avgInputTokens: 3000,
    avgOutputTokens: 1000,
  },
  {
    module: 'conformite_ohada',
    tier: 'haiku',
    description: 'Verification conformite plan comptable OHADA',
    avgInputTokens: 1500,
    avgOutputTokens: 800,
  },
  {
    module: 'rapprochement',
    tier: 'haiku',
    description: 'Rapprochement bancaire automatique',
    avgInputTokens: 4000,
    avgOutputTokens: 1500,
  },
  {
    module: 'tresorerie',
    tier: 'haiku',
    description: 'Analyse des flux de tresorerie',
    avgInputTokens: 2500,
    avgOutputTokens: 800,
  },
  {
    module: 'categorisation',
    tier: 'haiku',
    description: 'Categorisation automatique des transactions',
    avgInputTokens: 3000,
    avgOutputTokens: 1200,
  },
];

const SONNET_MODULES: ModuleConfig[] = [
  {
    module: 'frais_bancaires',
    tier: 'sonnet',
    description: 'Analyse des frais et detection surfacturation',
    avgInputTokens: 4000,
    avgOutputTokens: 2000,
  },
  {
    module: 'calcul_agios',
    tier: 'sonnet',
    description: 'Verification calcul interets (methode Hambourg)',
    avgInputTokens: 5000,
    avgOutputTokens: 2500,
  },
  {
    module: 'dates_valeur',
    tier: 'sonnet',
    description: 'Controle dates valeur vs reglementation CEMAC/UEMOA',
    avgInputTokens: 3500,
    avgOutputTokens: 1800,
  },
  {
    module: 'aml',
    tier: 'sonnet',
    description: 'Detection patterns blanchiment (AML/CFT)',
    avgInputTokens: 6000,
    avgOutputTokens: 3000,
  },
  {
    module: 'operations_suspectes',
    tier: 'sonnet',
    description: 'Identification operations atypiques',
    avgInputTokens: 5000,
    avgOutputTokens: 2500,
  },
  {
    module: 'fraude',
    tier: 'sonnet',
    description: 'Detection patterns de fraude',
    avgInputTokens: 5500,
    avgOutputTokens: 2800,
  },
];

const OPUS_MODULES: ModuleConfig[] = [
  {
    module: 'rapport_final',
    tier: 'opus',
    description: 'Generation rapport d\'audit complet',
    avgInputTokens: 8000,
    avgOutputTokens: 6000,
  },
  {
    module: 'contestation_banque',
    tier: 'opus',
    description: 'Redaction argumentaire juridique de contestation',
    avgInputTokens: 6000,
    avgOutputTokens: 4000,
  },
  {
    module: 'synthese_client',
    tier: 'opus',
    description: 'Synthese executive pour le client',
    avgInputTokens: 5000,
    avgOutputTokens: 3000,
  },
  {
    module: 'chat',
    tier: 'opus',
    description: 'Assistant conversationnel Paloma',
    avgInputTokens: 2000,
    avgOutputTokens: 1000,
  },
];

// Fusion de toutes les configurations
export const MODULE_CONFIGS: Record<AnalysisModule, ModuleConfig> = {
  ...Object.fromEntries(HAIKU_MODULES.map(m => [m.module, m])),
  ...Object.fromEntries(SONNET_MODULES.map(m => [m.module, m])),
  ...Object.fromEntries(OPUS_MODULES.map(m => [m.module, m])),
} as Record<AnalysisModule, ModuleConfig>;

// Routage rapide module -> tier
export const MODEL_ROUTING: Record<AnalysisModule, ModelTier> = {
  // Haiku
  doublons: 'haiku',
  parsing: 'haiku',
  conformite_ohada: 'haiku',
  rapprochement: 'haiku',
  tresorerie: 'haiku',
  categorisation: 'haiku',
  // Sonnet
  frais_bancaires: 'sonnet',
  calcul_agios: 'sonnet',
  dates_valeur: 'sonnet',
  aml: 'sonnet',
  operations_suspectes: 'sonnet',
  fraude: 'sonnet',
  // Opus
  rapport_final: 'opus',
  contestation_banque: 'opus',
  synthese_client: 'opus',
  chat: 'opus',
};

// Taux de change USD -> XAF (a mettre a jour periodiquement)
const USD_TO_XAF = 615;

// ============================================================================
// SERVICE DE ROUTAGE
// ============================================================================

export class AIModelRouter {
  private usageHistory: Array<{
    module: AnalysisModule;
    inputTokens: number;
    outputTokens: number;
    costUSD: number;
    timestamp: Date;
  }> = [];

  /**
   * Obtient la configuration du modele pour un module donne
   */
  getModelForModule(module: AnalysisModule): ModelConfig {
    const tier = MODEL_ROUTING[module];
    return MODEL_CONFIGS[tier];
  }

  /**
   * Obtient le tier de modele pour un module
   */
  getTierForModule(module: AnalysisModule): ModelTier {
    return MODEL_ROUTING[module];
  }

  /**
   * Obtient l'ID du modele Claude pour un module
   */
  getModelIdForModule(module: AnalysisModule): string {
    return this.getModelForModule(module).modelId;
  }

  /**
   * Obtient la configuration complete d'un module
   */
  getModuleConfig(module: AnalysisModule): ModuleConfig {
    return MODULE_CONFIGS[module];
  }

  /**
   * Liste tous les modules d'un tier
   */
  getModulesByTier(tier: ModelTier): ModuleConfig[] {
    return Object.values(MODULE_CONFIGS).filter(m => m.tier === tier);
  }

  /**
   * Estime le cout d'un appel pour un module
   */
  estimateCost(
    module: AnalysisModule,
    inputTokens?: number,
    outputTokens?: number
  ): CostEstimate {
    const config = this.getModuleConfig(module);
    const modelConfig = this.getModelForModule(module);

    const input = inputTokens ?? config.avgInputTokens;
    const output = outputTokens ?? config.avgOutputTokens;

    const inputCost = (input / 1_000_000) * modelConfig.inputCostPer1M;
    const outputCost = (output / 1_000_000) * modelConfig.outputCostPer1M;
    const totalCostUSD = inputCost + outputCost;

    return {
      module,
      model: config.tier,
      inputTokens: input,
      outputTokens: output,
      costUSD: totalCostUSD,
      costXAF: Math.round(totalCostUSD * USD_TO_XAF),
    };
  }

  /**
   * Estime le cout d'un batch de modules
   */
  estimateBatchCost(modules: AnalysisModule[]): BatchCostEstimate {
    const estimates = modules.map(m => this.estimateCost(m));

    const breakdown: Record<ModelTier, { count: number; costUSD: number }> = {
      haiku: { count: 0, costUSD: 0 },
      sonnet: { count: 0, costUSD: 0 },
      opus: { count: 0, costUSD: 0 },
    };

    for (const est of estimates) {
      breakdown[est.model].count++;
      breakdown[est.model].costUSD += est.costUSD;
    }

    const totalCostUSD = estimates.reduce((sum, e) => sum + e.costUSD, 0);

    return {
      modules: estimates,
      totalCostUSD,
      totalCostXAF: Math.round(totalCostUSD * USD_TO_XAF),
      breakdown,
    };
  }

  /**
   * Estime le cout d'une analyse complete (tous les modules)
   */
  estimateFullAnalysisCost(): BatchCostEstimate {
    const allModules = Object.keys(MODULE_CONFIGS) as AnalysisModule[];
    // Exclure 'chat' et 'rapport_final' qui sont optionnels
    const analysisModules = allModules.filter(
      m => !['chat', 'rapport_final', 'contestation_banque', 'synthese_client'].includes(m)
    );
    return this.estimateBatchCost(analysisModules);
  }

  /**
   * Enregistre l'utilisation reelle d'un appel
   */
  recordUsage(
    module: AnalysisModule,
    inputTokens: number,
    outputTokens: number
  ): void {
    const modelConfig = this.getModelForModule(module);
    const inputCost = (inputTokens / 1_000_000) * modelConfig.inputCostPer1M;
    const outputCost = (outputTokens / 1_000_000) * modelConfig.outputCostPer1M;

    this.usageHistory.push({
      module,
      inputTokens,
      outputTokens,
      costUSD: inputCost + outputCost,
      timestamp: new Date(),
    });
  }

  /**
   * Obtient les statistiques d'utilisation
   */
  getUsageStats(since?: Date): {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUSD: number;
    totalCostXAF: number;
    byModule: Record<string, { calls: number; costUSD: number }>;
    byTier: Record<ModelTier, { calls: number; costUSD: number }>;
  } {
    const history = since
      ? this.usageHistory.filter(u => u.timestamp >= since)
      : this.usageHistory;

    const byModule: Record<string, { calls: number; costUSD: number }> = {};
    const byTier: Record<ModelTier, { calls: number; costUSD: number }> = {
      haiku: { calls: 0, costUSD: 0 },
      sonnet: { calls: 0, costUSD: 0 },
      opus: { calls: 0, costUSD: 0 },
    };

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUSD = 0;

    for (const usage of history) {
      totalInputTokens += usage.inputTokens;
      totalOutputTokens += usage.outputTokens;
      totalCostUSD += usage.costUSD;

      if (!byModule[usage.module]) {
        byModule[usage.module] = { calls: 0, costUSD: 0 };
      }
      byModule[usage.module].calls++;
      byModule[usage.module].costUSD += usage.costUSD;

      const tier = MODEL_ROUTING[usage.module];
      byTier[tier].calls++;
      byTier[tier].costUSD += usage.costUSD;
    }

    return {
      totalCalls: history.length,
      totalInputTokens,
      totalOutputTokens,
      totalCostUSD,
      totalCostXAF: Math.round(totalCostUSD * USD_TO_XAF),
      byModule,
      byTier,
    };
  }

  /**
   * Efface l'historique d'utilisation
   */
  clearUsageHistory(): void {
    this.usageHistory = [];
  }

  /**
   * Obtient les parametres recommandes pour un module
   */
  getRecommendedParams(module: AnalysisModule): {
    modelId: string;
    maxTokens: number;
    temperature: number;
  } {
    const modelConfig = this.getModelForModule(module);
    const moduleConfig = this.getModuleConfig(module);

    return {
      modelId: modelConfig.modelId,
      maxTokens: Math.min(
        modelConfig.maxTokens,
        moduleConfig.avgOutputTokens * 2 // Marge de securite
      ),
      temperature: modelConfig.temperature,
    };
  }

  /**
   * Formate le cout pour affichage
   */
  formatCost(costUSD: number): string {
    const costXAF = Math.round(costUSD * USD_TO_XAF);
    if (costXAF < 1) {
      return '< 1 FCFA';
    }
    return `${costXAF.toLocaleString('fr-FR')} FCFA`;
  }

  /**
   * Compare les couts entre tiers pour un meme module
   */
  compareTierCosts(
    module: AnalysisModule
  ): Record<ModelTier, { costUSD: number; costXAF: number; ratio: number }> {
    const moduleConfig = this.getModuleConfig(module);
    const input = moduleConfig.avgInputTokens;
    const output = moduleConfig.avgOutputTokens;

    const costs: Record<ModelTier, { costUSD: number; costXAF: number; ratio: number }> = {
      haiku: { costUSD: 0, costXAF: 0, ratio: 1 },
      sonnet: { costUSD: 0, costXAF: 0, ratio: 1 },
      opus: { costUSD: 0, costXAF: 0, ratio: 1 },
    };

    for (const tier of ['haiku', 'sonnet', 'opus'] as ModelTier[]) {
      const config = MODEL_CONFIGS[tier];
      const inputCost = (input / 1_000_000) * config.inputCostPer1M;
      const outputCost = (output / 1_000_000) * config.outputCostPer1M;
      costs[tier].costUSD = inputCost + outputCost;
      costs[tier].costXAF = Math.round(costs[tier].costUSD * USD_TO_XAF);
    }

    // Calculer le ratio par rapport a Haiku
    const haikuCost = costs.haiku.costUSD;
    if (haikuCost > 0) {
      costs.haiku.ratio = 1;
      costs.sonnet.ratio = Math.round(costs.sonnet.costUSD / haikuCost);
      costs.opus.ratio = Math.round(costs.opus.costUSD / haikuCost);
    }

    return costs;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: AIModelRouter | null = null;

export function getAIModelRouter(): AIModelRouter {
  if (!instance) {
    instance = new AIModelRouter();
  }
  return instance;
}

export function resetAIModelRouter(): void {
  instance = null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Obtient rapidement le model ID pour un module
 */
export function getModelId(module: AnalysisModule): string {
  return MODEL_CONFIGS[MODEL_ROUTING[module]].modelId;
}

/**
 * Obtient rapidement le tier pour un module
 */
export function getTier(module: AnalysisModule): ModelTier {
  return MODEL_ROUTING[module];
}

/**
 * Liste des modules par categorie
 */
export const MODULES_BY_CATEGORY = {
  detection: ['doublons', 'frais_bancaires', 'operations_suspectes', 'fraude', 'aml'] as AnalysisModule[],
  verification: ['calcul_agios', 'dates_valeur', 'conformite_ohada'] as AnalysisModule[],
  analyse: ['tresorerie', 'rapprochement', 'categorisation'] as AnalysisModule[],
  rapports: ['rapport_final', 'contestation_banque', 'synthese_client'] as AnalysisModule[],
  autre: ['parsing', 'chat'] as AnalysisModule[],
};
