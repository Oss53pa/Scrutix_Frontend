/**
 * @module AtlasBanx
 * @file src/scoring/types.ts
 * @description Types pour le module Risk Score (Bloc 2).
 *              Représente le score de risque global d'un client (0-100) et
 *              sa décomposition par dimension.
 * @author Atlas Studio
 * @version 1.0.0
 * @ohada-compliance true
 */

import type { Anomaly, Transaction } from '../types';

// ----------------------------------------------------------------------------
// LEVELS
// ----------------------------------------------------------------------------

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: 'Risque faible',
  moderate: 'Risque modéré',
  high: 'Risque élevé',
  critical: 'Risque critique',
};

export const RISK_LEVEL_DESCRIPTIONS: Record<RiskLevel, string> = {
  low: 'Conformité satisfaisante',
  moderate: 'Points de vigilance identifiés',
  high: 'Audit approfondi recommandé',
  critical: 'Action immédiate requise',
};

/**
 * Couleurs Tailwind associées à chaque niveau (utilisées par les badges).
 */
export const RISK_LEVEL_COLORS: Record<RiskLevel, { bg: string; text: string; ring: string }> = {
  low:      { bg: 'bg-green-100',  text: 'text-green-800',  ring: 'ring-green-300' },
  moderate: { bg: 'bg-amber-100',  text: 'text-amber-800',  ring: 'ring-amber-300' },
  high:     { bg: 'bg-orange-100', text: 'text-orange-800', ring: 'ring-orange-300' },
  critical: { bg: 'bg-red-100',    text: 'text-red-800',    ring: 'ring-red-400' },
};

// ----------------------------------------------------------------------------
// DIMENSIONS
// ----------------------------------------------------------------------------

/**
 * Décomposition du score en quatre dimensions pondérées.
 * Chaque champ contient le score brut (avant pondération) plafonné à son
 * poids maximal (40, 25, 20, 15). La somme = score final 0-100.
 */
export interface RiskDimensions {
  /** 40 pts max — anomalies pondérées par sévérité */
  anomalies: number;
  /** 25 pts max — ratio frais/volume vs benchmark sectoriel */
  fees: number;
  /** 20 pts max — taux de violations contractuelles */
  compliance: number;
  /** 15 pts max — patterns suspects (AML, ronds, pics) */
  patterns: number;
}

export const DIMENSION_LABELS: Record<keyof RiskDimensions, string> = {
  anomalies: 'Anomalies détectées',
  fees: 'Frais bancaires',
  compliance: 'Conformité contractuelle',
  patterns: 'Patterns suspects',
};

export const DIMENSION_WEIGHTS: Record<keyof RiskDimensions, number> = {
  anomalies: 40,
  fees: 25,
  compliance: 20,
  patterns: 15,
};

// ----------------------------------------------------------------------------
// SCORE
// ----------------------------------------------------------------------------

export interface RiskScore {
  /** Score global 0-100 */
  score: number;
  /** Niveau de risque dérivé du score */
  level: RiskLevel;
  /** Décomposition par dimension */
  dimensions: RiskDimensions;
  /** Métadonnées de calcul */
  metadata: RiskScoreMetadata;
  /** Date de calcul */
  computedAt: Date;
}

export interface RiskScoreMetadata {
  totalAnomalies: number;
  totalTransactions: number;
  totalAmount: number;
  totalFees: number;
  feeRatio: number;            // frais / volume (0-1)
  benchmarkRatio: number;      // benchmark sectoriel
  benchmarkOverrun: number;    // ratio appliqué / benchmark
  amlFlags: number;
  /** Période YYYY-MM */
  period?: string;
}

// ----------------------------------------------------------------------------
// HISTORY ROW (Supabase)
// ----------------------------------------------------------------------------

export interface RiskScoreHistoryRow {
  id: string;
  user_id: string;
  client_id: string;
  score: number;
  risk_level: RiskLevel;
  dimensions: RiskDimensions;
  metadata: RiskScoreMetadata;
  period: string | null;
  computed_at: string;
}

export interface RiskScoreHistoryEntry {
  id: string;
  clientId: string;
  score: number;
  level: RiskLevel;
  dimensions: RiskDimensions;
  metadata: RiskScoreMetadata;
  period: string | null;
  computedAt: Date;
}

// ----------------------------------------------------------------------------
// ENGINE INPUT
// ----------------------------------------------------------------------------

export interface RiskScoreInput {
  clientId: string;
  anomalies: Anomaly[];
  transactions: Transaction[];
  /** Indices supplémentaires (calculés ailleurs) */
  complianceRate?: number;     // 0-1, 1 = parfait
  amlFlags?: number;
  /** Comparaison MoM (3 derniers mois) — optionnel */
  feeMonthlyHistory?: number[];
  /** Code secteur du client pour le benchmark */
  sectorCode?: string;
  /** Période YYYY-MM */
  period?: string;
}
