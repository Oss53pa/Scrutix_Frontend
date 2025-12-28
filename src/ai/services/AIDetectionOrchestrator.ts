// ============================================================================
// SCRUTIX - AI Detection Orchestrator
// Orchestrateur pour toutes les détections IA
// ============================================================================

import {
  AIDetectionType,
  AIDetectionConfig,
  AIDetectionResult,
  AIFeatureFlags,
  IAIProvider,
  AI_DETECTION_LABELS,
  DEFAULT_DETECTION_CONFIG,
} from '../types';
import { Transaction, Anomaly, BankConditions, AnomalyType } from '../../types';
import { AIProviderFactory } from '../AIProviderFactory';

/**
 * Résultat complet d'une orchestration de détection
 */
export interface OrchestrationResult {
  success: boolean;
  results: AIDetectionResult[];
  allAnomalies: Anomaly[];
  summary: {
    totalDetections: number;
    totalAnomalies: number;
    totalAmount: number;
    byType: Record<AIDetectionType, number>;
    bySeverity: Record<string, number>;
  };
  tokensUsed: number;
  processingTime: number;
  errors: Array<{ type: AIDetectionType; error: string }>;
}

/**
 * Options pour l'orchestration
 */
export interface OrchestrationOptions {
  enabledTypes?: AIDetectionType[];
  bankConditions?: BankConditions;
  onProgress?: (progress: OrchestrationProgress) => void;
  batchSize?: number;
}

/**
 * Progress de l'orchestration
 */
export interface OrchestrationProgress {
  currentType: AIDetectionType;
  currentIndex: number;
  totalTypes: number;
  percentage: number;
  message: string;
}

/**
 * Orchestrateur de détection IA
 * Coordonne l'exécution de tous les types de détection
 */
export class AIDetectionOrchestrator {
  private provider: IAIProvider | null = null;

  constructor(provider?: IAIProvider) {
    this.provider = provider || null;
  }

  /**
   * Configure le provider à utiliser
   */
  setProvider(provider: IAIProvider): void {
    this.provider = provider;
  }

  /**
   * Exécute toutes les détections activées
   */
  async runDetections(
    transactions: Transaction[],
    config: AIDetectionConfig,
    options?: OrchestrationOptions
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const results: AIDetectionResult[] = [];
    const allAnomalies: Anomaly[] = [];
    const errors: Array<{ type: AIDetectionType; error: string }> = [];
    let totalTokens = 0;

    // Récupérer le provider
    const provider = this.provider || AIProviderFactory.getProvider();
    if (!provider) {
      return {
        success: false,
        results: [],
        allAnomalies: [],
        summary: this.createEmptySummary(),
        tokensUsed: 0,
        processingTime: Date.now() - startTime,
        errors: [{ type: AIDetectionType.DUPLICATES, error: 'Aucun provider IA configuré' }],
      };
    }

    // Types à exécuter
    const typesToRun = options?.enabledTypes || config.enabledTypes;
    const totalTypes = typesToRun.length;

    // Exécuter chaque type de détection
    for (let i = 0; i < typesToRun.length; i++) {
      const detectionType = typesToRun[i];
      const label = AI_DETECTION_LABELS[detectionType];

      // Rapport de progression
      if (options?.onProgress) {
        options.onProgress({
          currentType: detectionType,
          currentIndex: i,
          totalTypes,
          percentage: Math.round((i / totalTypes) * 100),
          message: `${label.icon} Analyse: ${label.label}...`,
        });
      }

      try {
        const detectionStart = Date.now();

        // Exécuter la détection
        const anomalies = await provider.detectAnomalies(
          transactions,
          detectionType,
          { bankConditions: options?.bankConditions }
        );

        const tokensUsed = provider.getLastTokensUsed();
        const tokens = (tokensUsed?.input || 0) + (tokensUsed?.output || 0);
        totalTokens += tokens;

        // Créer le résultat
        const result: AIDetectionResult = {
          type: detectionType,
          anomalies,
          summary: this.createDetectionSummary(anomalies, detectionType),
          tokensUsed: tokens,
          processingTime: Date.now() - detectionStart,
          confidence: anomalies.length > 0
            ? anomalies.reduce((sum, a) => sum + a.confidence, 0) / anomalies.length
            : 0,
        };

        results.push(result);
        allAnomalies.push(...anomalies);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        errors.push({ type: detectionType, error: errorMessage });
        console.error(`Erreur détection ${detectionType}:`, error);
      }
    }

    // Progression finale
    if (options?.onProgress) {
      options.onProgress({
        currentType: typesToRun[typesToRun.length - 1],
        currentIndex: totalTypes,
        totalTypes,
        percentage: 100,
        message: 'Analyse terminée',
      });
    }

    return {
      success: errors.length === 0,
      results,
      allAnomalies,
      summary: this.createSummary(allAnomalies, results),
      tokensUsed: totalTokens,
      processingTime: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Exécute une détection spécifique
   */
  async runSingleDetection(
    transactions: Transaction[],
    type: AIDetectionType,
    options?: { bankConditions?: BankConditions }
  ): Promise<AIDetectionResult> {
    const startTime = Date.now();

    const provider = this.provider || AIProviderFactory.getProvider();
    if (!provider) {
      throw new Error('Aucun provider IA configuré');
    }

    const anomalies = await provider.detectAnomalies(transactions, type, options);
    const tokensUsed = provider.getLastTokensUsed();

    return {
      type,
      anomalies,
      summary: this.createDetectionSummary(anomalies, type),
      tokensUsed: (tokensUsed?.input || 0) + (tokensUsed?.output || 0),
      processingTime: Date.now() - startTime,
      confidence: anomalies.length > 0
        ? anomalies.reduce((sum, a) => sum + a.confidence, 0) / anomalies.length
        : 0,
    };
  }

  /**
   * Exécute les détections de base (4 types)
   */
  async runBasicDetections(
    transactions: Transaction[],
    options?: OrchestrationOptions
  ): Promise<OrchestrationResult> {
    return this.runDetections(transactions, {
      ...DEFAULT_DETECTION_CONFIG,
      enabledTypes: [
        AIDetectionType.DUPLICATES,
        AIDetectionType.GHOST_FEES,
        AIDetectionType.OVERCHARGES,
        AIDetectionType.INTEREST_ERRORS,
      ],
    }, options);
  }

  /**
   * Exécute les détections étendues (9 types additionnels)
   */
  async runExtendedDetections(
    transactions: Transaction[],
    options?: OrchestrationOptions
  ): Promise<OrchestrationResult> {
    return this.runDetections(transactions, {
      ...DEFAULT_DETECTION_CONFIG,
      enabledTypes: [
        AIDetectionType.VALUE_DATE,
        AIDetectionType.SUSPICIOUS,
        AIDetectionType.COMPLIANCE,
        AIDetectionType.CASHFLOW,
        AIDetectionType.RECONCILIATION,
        AIDetectionType.MULTI_BANK,
        AIDetectionType.OHADA,
        AIDetectionType.AML_LCB_FT,
        AIDetectionType.FEES,
      ],
    }, options);
  }

  /**
   * Exécute toutes les détections (base + étendue)
   */
  async runAllDetections(
    transactions: Transaction[],
    options?: OrchestrationOptions
  ): Promise<OrchestrationResult> {
    return this.runDetections(transactions, {
      ...DEFAULT_DETECTION_CONFIG,
      enabledTypes: Object.values(AIDetectionType),
    }, options);
  }

  /**
   * Convertit les feature flags en types de détection actifs
   */
  getEnabledTypesFromFlags(flags: AIFeatureFlags): AIDetectionType[] {
    const types: AIDetectionType[] = [];

    // Base
    if (flags.duplicates) types.push(AIDetectionType.DUPLICATES);
    if (flags.ghostFees) types.push(AIDetectionType.GHOST_FEES);
    if (flags.overcharges) types.push(AIDetectionType.OVERCHARGES);
    if (flags.interestErrors) types.push(AIDetectionType.INTEREST_ERRORS);

    // Étendue
    if (flags.valueDate) types.push(AIDetectionType.VALUE_DATE);
    if (flags.suspicious) types.push(AIDetectionType.SUSPICIOUS);
    if (flags.compliance) types.push(AIDetectionType.COMPLIANCE);
    if (flags.cashflow) types.push(AIDetectionType.CASHFLOW);
    if (flags.reconciliation) types.push(AIDetectionType.RECONCILIATION);
    if (flags.multiBank) types.push(AIDetectionType.MULTI_BANK);
    if (flags.ohada) types.push(AIDetectionType.OHADA);
    if (flags.amlLcbFt) types.push(AIDetectionType.AML_LCB_FT);
    if (flags.fees) types.push(AIDetectionType.FEES);

    return types;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private createDetectionSummary(anomalies: Anomaly[], type: AIDetectionType): string {
    const label = AI_DETECTION_LABELS[type];
    if (anomalies.length === 0) {
      return `${label.icon} ${label.label}: Aucune anomalie détectée`;
    }

    const totalAmount = anomalies.reduce((sum, a) => sum + a.amount, 0);
    return `${label.icon} ${label.label}: ${anomalies.length} anomalie(s) détectée(s), ${totalAmount.toLocaleString('fr-FR')} FCFA`;
  }

  private createSummary(
    anomalies: Anomaly[],
    results: AIDetectionResult[]
  ): OrchestrationResult['summary'] {
    const byType: Record<AIDetectionType, number> = {} as Record<AIDetectionType, number>;
    const bySeverity: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    for (const result of results) {
      byType[result.type] = result.anomalies.length;
    }

    for (const anomaly of anomalies) {
      bySeverity[anomaly.severity] = (bySeverity[anomaly.severity] || 0) + 1;
    }

    return {
      totalDetections: results.length,
      totalAnomalies: anomalies.length,
      totalAmount: anomalies.reduce((sum, a) => sum + a.amount, 0),
      byType,
      bySeverity,
    };
  }

  private createEmptySummary(): OrchestrationResult['summary'] {
    return {
      totalDetections: 0,
      totalAnomalies: 0,
      totalAmount: 0,
      byType: {} as Record<AIDetectionType, number>,
      bySeverity: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      },
    };
  }
}

// Export singleton instance
export const aiDetectionOrchestrator = new AIDetectionOrchestrator();
