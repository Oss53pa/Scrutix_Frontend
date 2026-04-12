/**
 * @module AtlasBanx
 * @file src/ml/types.ts
 * @description Types du module ML / statistique propriétaire (Bloc 1).
 *              Cette couche s'insère ENTRE le filtre déterministe et les
 *              appels LLM pour réduire les faux positifs sur volumes
 *              importants (>10 000 transactions).
 * @author Atlas Studio
 * @version 1.0.0
 */

// ----------------------------------------------------------------------------
// FEATURE VECTOR
// ----------------------------------------------------------------------------

/**
 * Représentation numérique d'une transaction pour les détecteurs ML.
 * Construite par `StatisticalDetectionEngine.featurize()`.
 */
export interface TransactionFeatureVector {
  /** ID de la transaction d'origine */
  transactionId: string;
  /** Montant absolu (toujours >= 0) */
  amount: number;
  /** Jour de la semaine 0=dimanche...6=samedi */
  dayOfWeek: number;
  /** Heure 0-23 (0 si indisponible) */
  hour: number;
  /** Catégorie du marchand / libellé simplifié */
  merchantCategory: string;
  /** Nombre de transactions similaires dans les 30 derniers jours */
  frequency30d: number;
  /** Z-score vs historique du client */
  zscore: number;
  /** Timestamp unix ms */
  timestamp: number;
}

// ----------------------------------------------------------------------------
// DETECTOR OUTPUTS
// ----------------------------------------------------------------------------

export interface AnomalyScore {
  /** Score normalisé 0-1 (1 = très anormal) */
  score: number;
  /** Confiance du détecteur dans ce score 0-1 */
  confidence: number;
  /** Explication courte en français */
  reason: string;
}

export interface BenfordResult {
  /** Statistique chi-2 observée */
  chiSquare: number;
  /** Valeur seuil critique (degrees of freedom = 8) */
  criticalValue: number;
  /** p-value approximée */
  pValue: number;
  /** Chiffres qui dévient significativement de Benford */
  deviatingDigits: number[];
  /** Distribution observée des premiers chiffres [1..9] */
  observed: number[];
  /** Distribution attendue (Benford) */
  expected: number[];
  /** Niveau de risque déduit */
  riskLevel: 'low' | 'medium' | 'high';
  /** Nombre total de valeurs analysées */
  sampleSize: number;
}

export interface PatternResult {
  /** Identifiant du pattern : "weekly", "bi-weekly", "monthly", "escalating" */
  pattern: string;
  /** Cycle détecté en jours */
  cycleDays: number;
  /** Dates des occurrences */
  occurrences: Date[];
  /** Montant total agrégé */
  totalAmount: number;
  /** Score d'impact 0-1 (taille du pattern / taille du lot) */
  impactScore: number;
  /** Libellé marchand / description commune */
  label: string;
}

// ----------------------------------------------------------------------------
// STATISTICAL ANOMALY (output global)
// ----------------------------------------------------------------------------

export type StatisticalDetectorName =
  | 'isolation_forest'
  | 'zscore'
  | 'benford'
  | 'frequency';

export interface StatisticalAnomaly {
  transactionId: string;
  detectorName: StatisticalDetectorName;
  /** Score 0-1 (1 = très anormal) */
  score: number;
  confidence: number;
  explanation: string;
  suggestedAction: string;
}

// ----------------------------------------------------------------------------
// GLOBAL REPORT
// ----------------------------------------------------------------------------

export interface StatisticalReport {
  anomalies: StatisticalAnomaly[];
  /** Score global de risque 0-1 (fusion pondérée des 4 détecteurs) */
  globalRiskScore: number;
  /** Détails par détecteur */
  detectorBreakdown: Record<StatisticalDetectorName, {
    anomalyCount: number;
    avgScore: number;
    maxScore: number;
  }>;
  /** Analyse Benford (utile dans le rapport d'audit) */
  benford: BenfordResult | null;
  /** Patterns récurrents détectés */
  patterns: PatternResult[];
  /** Métriques du modèle (pour dashboard) */
  modelMetrics: ModelMetrics;
  /** Temps de calcul total en ms */
  processingTimeMs: number;
}

export interface ModelMetrics {
  /** Estimation de précision (basée sur contamination attendue vs détectée) */
  precision: number;
  /** Rappel estimé */
  recall: number;
  /** F1-score */
  f1Score: number;
  /** Taux estimé de faux positifs */
  falsePositiveRate: number;
  /** Dernier entraînement (pour lazy init) */
  lastTrainedAt: Date;
  /** Nombre de transactions vues */
  transactionCount: number;
}

// ----------------------------------------------------------------------------
// CLIENT HISTORY
// ----------------------------------------------------------------------------

/**
 * Historique client nécessaire pour le calcul des z-scores et patterns.
 * Fourni par l'appelant (agrégé sur les 90 derniers jours en général).
 */
export interface ClientHistory {
  clientId: string;
  /** Transactions triées chronologiquement (ancien → récent) */
  transactions: Array<{
    id: string;
    date: Date;
    amount: number;
    description: string;
    category?: string;
  }>;
  /** Fenêtre utilisée */
  windowDays: number;
}
