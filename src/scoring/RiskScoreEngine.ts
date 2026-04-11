/**
 * @module AtlasBanx
 * @file src/scoring/RiskScoreEngine.ts
 * @description Calcule le score de risque global d'un client (0-100) à
 *              partir d'un lot d'anomalies et de transactions.
 *
 *              Quatre dimensions pondérées :
 *                • Anomalies (40 pts)  — somme pondérée par sévérité,
 *                                        normalisée par volume de tx
 *                • Frais     (25 pts)  — écart au benchmark sectoriel +
 *                                        évolution MoM
 *                • Conformité (20 pts) — taux de violations contractuelles
 *                • Patterns  (15 pts)  — flags AML, montants ronds, pics
 *
 *              Le résultat est déterministe : mêmes inputs → même score.
 *              Aucun appel réseau, aucun side-effect.
 * @author Atlas Studio
 * @version 1.0.0
 * @ohada-compliance true
 */

import { AnomalyType, Severity } from '../types';
import type { Anomaly, Transaction } from '../types';
import {
  RiskScore,
  RiskScoreInput,
  RiskDimensions,
  RiskLevel,
  DIMENSION_WEIGHTS,
} from './types';
import { RiskScoreBenchmark } from './RiskScoreBenchmark';

// Points par sévérité (avant pondération volume)
const SEVERITY_POINTS: Record<Severity, number> = {
  [Severity.CRITICAL]: 10,
  [Severity.HIGH]: 5,
  [Severity.MEDIUM]: 2,
  [Severity.LOW]: 0.5,
};

// Anomalies AML / patterns
const PATTERN_ANOMALY_TYPES = new Set<AnomalyType>([
  AnomalyType.AML_ALERT,
  AnomalyType.SUSPICIOUS_TRANSACTION,
]);

// Anomalies de conformité
const COMPLIANCE_ANOMALY_TYPES = new Set<AnomalyType>([
  AnomalyType.COMPLIANCE_VIOLATION,
  AnomalyType.OHADA_NON_COMPLIANCE,
  AnomalyType.UNAUTHORIZED,
]);

export class RiskScoreEngine {
  /**
   * Calcule le score de risque pour un lot d'anomalies + transactions.
   * Méthode pure, déterministe.
   */
  static compute(input: RiskScoreInput): RiskScore {
    const { anomalies, transactions } = input;

    const dimAnomalies = this.scoreAnomalies(anomalies, transactions.length);
    const dimFees = this.scoreFees(transactions, input);
    const dimCompliance = this.scoreCompliance(anomalies, input.complianceRate);
    const dimPatterns = this.scorePatterns(anomalies, input.amlFlags);

    const dimensions: RiskDimensions = {
      anomalies: dimAnomalies,
      fees: dimFees,
      compliance: dimCompliance,
      patterns: dimPatterns,
    };

    const score = Math.round(dimAnomalies + dimFees + dimCompliance + dimPatterns);

    const totalAmount = transactions.reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalFees = this.sumFees(transactions);
    const benchmark = RiskScoreBenchmark.getBenchmark(input.sectorCode);
    const feeRatio = totalAmount > 0 ? totalFees / totalAmount : 0;
    const benchmarkOverrun = RiskScoreBenchmark.computeOverrun(feeRatio, benchmark);

    return {
      score,
      level: this.scoreToLevel(score),
      dimensions,
      metadata: {
        totalAnomalies: anomalies.length,
        totalTransactions: transactions.length,
        totalAmount,
        totalFees,
        feeRatio,
        benchmarkRatio: benchmark.expectedFeeRatio,
        benchmarkOverrun,
        amlFlags:
          input.amlFlags ??
          anomalies.filter((a) => a.type === AnomalyType.AML_ALERT).length,
        period: input.period,
      },
      computedAt: new Date(),
    };
  }

  // ==========================================================================
  // DIMENSION 1 — Anomalies (40 pts)
  // ==========================================================================

  private static scoreAnomalies(anomalies: Anomaly[], transactionCount: number): number {
    if (anomalies.length === 0) return 0;

    const rawPoints = anomalies.reduce((sum, a) => sum + (SEVERITY_POINTS[a.severity] ?? 0), 0);

    // Normalisation par volume : éviter de pénaliser un gros client juste
    // parce qu'il a plus de transactions. On rapporte le total à 1000 tx.
    const normalizationFactor = transactionCount > 0
      ? Math.min(1, 1000 / Math.max(transactionCount, 100))
      : 1;
    const normalized = rawPoints * normalizationFactor;

    return Math.min(DIMENSION_WEIGHTS.anomalies, normalized);
  }

  // ==========================================================================
  // DIMENSION 2 — Frais bancaires (25 pts)
  // ==========================================================================

  private static scoreFees(transactions: Transaction[], input: RiskScoreInput): number {
    const totalAmount = transactions.reduce((s, t) => s + Math.abs(t.amount), 0);
    if (totalAmount === 0) return 0;

    const totalFees = this.sumFees(transactions);
    const ratio = totalFees / totalAmount;
    const benchmark = RiskScoreBenchmark.getBenchmark(input.sectorCode);
    const overrun = RiskScoreBenchmark.computeOverrun(ratio, benchmark);

    let points = 0;
    if (overrun > 2.0) points += 10;       // > 200% du benchmark
    else if (overrun > 1.5) points += 5;   // > 150%
    else if (overrun > 1.2) points += 2;   // > 120%

    // Évolution MoM : 3 mois consécutifs en hausse > 20% → +5 pts
    const history = input.feeMonthlyHistory ?? [];
    if (history.length >= 3) {
      const last3 = history.slice(-3);
      const allIncreasing = last3.every((v, i) => i === 0 || v >= last3[i - 1] * 1.2);
      if (allIncreasing) points += 5;
    }

    return Math.min(DIMENSION_WEIGHTS.fees, points);
  }

  // ==========================================================================
  // DIMENSION 3 — Conformité contractuelle (20 pts)
  // ==========================================================================

  private static scoreCompliance(anomalies: Anomaly[], complianceRate?: number): number {
    // 1) Si on a un taux de conformité explicite (ex: depuis ComplianceAudit),
    //    on l'utilise directement.
    if (typeof complianceRate === 'number') {
      const rate = Math.max(0, Math.min(1, complianceRate));
      return (1 - rate) * DIMENSION_WEIGHTS.compliance;
    }

    // 2) Sinon, on dérive depuis les anomalies de type compliance/OHADA
    const complianceAnomalies = anomalies.filter((a) => COMPLIANCE_ANOMALY_TYPES.has(a.type));
    if (complianceAnomalies.length === 0) return 0;

    // Les violations contractuelles comptent double (poids x2)
    const points = complianceAnomalies.reduce((sum, a) => {
      const base = SEVERITY_POINTS[a.severity] ?? 0;
      return sum + base * 2;
    }, 0);

    return Math.min(DIMENSION_WEIGHTS.compliance, points);
  }

  // ==========================================================================
  // DIMENSION 4 — Patterns suspects (15 pts)
  // ==========================================================================

  private static scorePatterns(anomalies: Anomaly[], amlFlagsOverride?: number): number {
    const amlFlags =
      amlFlagsOverride ??
      anomalies.filter((a) => a.type === AnomalyType.AML_ALERT).length;
    const suspiciousFlags = anomalies.filter(
      (a) => a.type === AnomalyType.SUSPICIOUS_TRANSACTION,
    ).length;
    const patternFlags = anomalies.filter((a) => PATTERN_ANOMALY_TYPES.has(a.type)).length;

    let points = 0;
    points += amlFlags * 5;        // +5 par flag AML
    points += suspiciousFlags * 2; // +2 par flag suspect
    // Bonus pour cluster (≥3 patterns différents)
    if (patternFlags >= 3) points += 3;

    return Math.min(DIMENSION_WEIGHTS.patterns, points);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Identifie les transactions qui sont des frais bancaires et somme leurs
   * montants. Heuristique : type === FEE/INTEREST OU description contenant
   * "frais"/"commission"/"agios".
   */
  private static sumFees(transactions: Transaction[]): number {
    const FEE_KEYWORDS = /frais|commission|agios|interet|intérêt|cotis/i;
    return transactions.reduce((sum, t) => {
      const isFee =
        t.type === 'FEE' ||
        t.type === 'INTEREST' ||
        FEE_KEYWORDS.test(t.description ?? '');
      return isFee ? sum + Math.abs(t.amount) : sum;
    }, 0);
  }

  /**
   * Mapping score → niveau de risque selon les seuils du playbook.
   */
  static scoreToLevel(score: number): RiskLevel {
    if (score <= 25) return 'low';
    if (score <= 50) return 'moderate';
    if (score <= 75) return 'high';
    return 'critical';
  }
}
