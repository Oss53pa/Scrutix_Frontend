/**
 * @module AtlasBanx
 * @file src/ml/StatisticalDetectionEngine.ts
 * @description Orchestrateur de la couche ML/statistique. Appelle les 4
 *              détecteurs en parallèle, fusionne leurs scores avec les
 *              pondérations du playbook et produit un `StatisticalReport`
 *              consolidé.
 *
 *              Pondération des scores (playbook Bloc 1) :
 *                • Isolation Forest : 0.35
 *                • Z-Score          : 0.30
 *                • Benford          : 0.20
 *                • Frequency        : 0.15
 *
 *              Cette couche s'insère entre le filtre déterministe et les
 *              appels LLM. L'objectif est de réduire de 40-60% les faux
 *              positifs sur les gros volumes en ajoutant une validation
 *              statistique avant de solliciter un modèle de langage coûteux.
 * @author Atlas Studio
 * @version 1.0.0
 * @ohada-compliance true
 */

import type { Transaction } from '../types';
import type {
  TransactionFeatureVector,
  StatisticalAnomaly,
  StatisticalReport,
  StatisticalDetectorName,
  ClientHistory,
  ModelMetrics,
} from './types';
import { IsolationForestDetector } from './detectors/IsolationForestDetector';
import { ZScoreAnalyzer } from './detectors/ZScoreAnalyzer';
import { BenfordLawChecker } from './detectors/BenfordLawChecker';
import { FrequencyPatternDetector } from './detectors/FrequencyPatternDetector';

// Pondérations de fusion (voir playbook Bloc 1)
const WEIGHTS: Record<StatisticalDetectorName, number> = {
  isolation_forest: 0.35,
  zscore: 0.30,
  benford: 0.20,
  frequency: 0.15,
};

const ANOMALY_THRESHOLD = 0.5;

export class StatisticalDetectionEngine {
  /**
   * Point d'entrée principal. Exécute tous les détecteurs sur le lot
   * de transactions fourni et retourne un rapport consolidé.
   *
   * La méthode est pure et n'écrit rien en DB — elle se contente de
   * calculer. L'appelant (AIDetectionOrchestrator) décide quoi persister
   * et quand.
   */
  static detectAll(
    transactions: Transaction[],
    clientHistory: ClientHistory,
  ): StatisticalReport {
    const start = Date.now();

    // 1. Construire les feature vectors
    const vectors = this.featurize(transactions, clientHistory);

    // 2. Lancer les 4 détecteurs (en "parallèle" logique ici — les
    //    détecteurs étant pure TypeScript CPU-bound, un Promise.all
    //    n'apporterait rien. On enchaîne directement.)
    const isolationScores = IsolationForestDetector.detect(vectors);
    const zScores = ZScoreAnalyzer.detect(clientHistory);
    const benford = BenfordLawChecker.analyze(transactions.map((t) => Math.abs(t.amount)));
    const patterns = FrequencyPatternDetector.detect(clientHistory);
    const frequencyScores = FrequencyPatternDetector.detectScores(clientHistory);

    // 3. Fusionner les anomalies par transaction
    const anomalies: StatisticalAnomaly[] = [];

    for (const tx of transactions) {
      const iso = isolationScores.get(tx.id);
      const z = zScores.get(tx.id);
      const freq = frequencyScores.get(tx.id);

      if (iso && iso.score >= ANOMALY_THRESHOLD) {
        anomalies.push({
          transactionId: tx.id,
          detectorName: 'isolation_forest',
          score: iso.score,
          confidence: iso.confidence,
          explanation: iso.reason,
          suggestedAction: this.suggestAction('isolation_forest', iso.score),
        });
      }
      if (z && z.score >= ANOMALY_THRESHOLD) {
        anomalies.push({
          transactionId: tx.id,
          detectorName: 'zscore',
          score: z.score,
          confidence: z.confidence,
          explanation: z.reason,
          suggestedAction: this.suggestAction('zscore', z.score),
        });
      }
      if (freq && freq.score >= ANOMALY_THRESHOLD) {
        anomalies.push({
          transactionId: tx.id,
          detectorName: 'frequency',
          score: freq.score,
          confidence: freq.confidence,
          explanation: freq.reason,
          suggestedAction: this.suggestAction('frequency', freq.score),
        });
      }
    }

    // 4. Ajouter les anomalies Benford (au niveau du lot, pas par tx)
    if (benford && benford.riskLevel !== 'low') {
      // Benford ne pointe pas une transaction précise — on rattache au
      // premier flag comme marqueur global.
      const firstTxId = transactions[0]?.id;
      if (firstTxId) {
        anomalies.push({
          transactionId: firstTxId,
          detectorName: 'benford',
          score: benford.riskLevel === 'high' ? 0.9 : 0.6,
          confidence: 0.85,
          explanation: `Distribution des premiers chiffres non conforme à la loi de Benford (χ²=${benford.chiSquare.toFixed(1)}, p=${benford.pValue.toFixed(3)})`,
          suggestedAction:
            'Revue manuelle complète du lot — distribution statistiquement anormale, possible manipulation des montants',
        });
      }
    }

    // 5. Décomposition par détecteur
    const detectorBreakdown = {
      isolation_forest: summarizeScores([...isolationScores.values()]),
      zscore: summarizeScores([...zScores.values()]),
      benford: {
        anomalyCount: benford && benford.riskLevel !== 'low' ? 1 : 0,
        avgScore: benford ? benford.chiSquare / 30 : 0,
        maxScore: benford ? Math.min(1, benford.chiSquare / 30) : 0,
      },
      frequency: summarizeScores([...frequencyScores.values()]),
    };

    // 6. Score global pondéré
    const globalRiskScore = this.computeGlobalScore(detectorBreakdown);

    // 7. Métriques modèle
    const modelMetrics = this.computeMetrics(transactions.length, anomalies.length);

    return {
      anomalies,
      globalRiskScore,
      detectorBreakdown,
      benford,
      patterns,
      modelMetrics,
      processingTimeMs: Date.now() - start,
    };
  }

  // --------------------------------------------------------------------------
  // FEATURIZATION
  // --------------------------------------------------------------------------

  /**
   * Convertit des transactions en vecteurs de features pour les détecteurs.
   * Utilise l'historique client pour calculer les z-scores et les
   * fréquences sur 30 jours.
   */
  static featurize(
    transactions: Transaction[],
    clientHistory: ClientHistory,
  ): TransactionFeatureVector[] {
    // Pré-calcul de la moyenne et écart-type des montants historiques
    const histAmounts = clientHistory.transactions.map((t) => Math.abs(t.amount));
    const mean = average(histAmounts);
    const std = standardDeviation(histAmounts, mean);

    // Map de fréquence 30j par catégorie (label normalisé)
    const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const frequencyMap = new Map<string, number>();
    for (const tx of clientHistory.transactions) {
      if (tx.date.getTime() < thirtyDaysAgoMs) continue;
      const key = normalizeForCategory(tx.description);
      frequencyMap.set(key, (frequencyMap.get(key) ?? 0) + 1);
    }

    return transactions.map((tx) => {
      const absAmount = Math.abs(tx.amount);
      const z = std > 0 ? (absAmount - mean) / std : 0;
      const category = normalizeForCategory(tx.description);
      const frequency30d = frequencyMap.get(category) ?? 0;
      const timestamp = tx.date instanceof Date ? tx.date.getTime() : new Date(tx.date).getTime();
      const dateObj = new Date(timestamp);

      return {
        transactionId: tx.id,
        amount: absAmount,
        dayOfWeek: dateObj.getDay(),
        hour: dateObj.getHours(),
        merchantCategory: category,
        frequency30d,
        zscore: z,
        timestamp,
      };
    });
  }

  // --------------------------------------------------------------------------
  // GLOBAL SCORE FUSION
  // --------------------------------------------------------------------------

  static computeGlobalScore(
    breakdown: StatisticalReport['detectorBreakdown'],
  ): number {
    let score = 0;
    for (const detector of Object.keys(WEIGHTS) as StatisticalDetectorName[]) {
      const b = breakdown[detector];
      const weight = WEIGHTS[detector];
      // Utilise le score moyen pondéré par le nombre d'anomalies détectées
      const ratio = b.anomalyCount > 0 ? b.avgScore : 0;
      score += weight * ratio;
    }
    return Math.min(1, score);
  }

  // --------------------------------------------------------------------------
  // METRICS
  // --------------------------------------------------------------------------

  private static computeMetrics(
    transactionCount: number,
    anomalyCount: number,
  ): ModelMetrics {
    // Estimation simple basée sur la contamination attendue (5%).
    // Ces valeurs sont indicatives et seront affinées avec un vrai
    // ground truth quand on aura des anomalies validées par des humains.
    const expectedRate = 0.05;
    const detectedRate = transactionCount > 0 ? anomalyCount / transactionCount : 0;

    // Heuristique : si on détecte ~le taux attendu, précision ~85%
    const deviation = Math.abs(detectedRate - expectedRate);
    const precision = Math.max(0.5, 0.95 - deviation * 2);
    const recall = Math.min(1, 0.75 + detectedRate * 2);
    const f1Score = (2 * precision * recall) / (precision + recall);
    const falsePositiveRate = Math.max(0, 1 - precision);

    return {
      precision,
      recall,
      f1Score,
      falsePositiveRate,
      lastTrainedAt: new Date(),
      transactionCount,
    };
  }

  // --------------------------------------------------------------------------

  private static suggestAction(
    detector: StatisticalDetectorName,
    score: number,
  ): string {
    if (score > 0.8) {
      return 'Revue manuelle immédiate recommandée';
    }
    if (score > 0.6) {
      return 'Inclure dans le rapport avec demande d\'explication au client';
    }
    switch (detector) {
      case 'isolation_forest':
        return 'Vérifier si le contexte explique l\'écart (saisonnalité, événement ponctuel)';
      case 'zscore':
        return 'Comparer avec la moyenne sectorielle pour confirmer l\'anomalie';
      case 'benford':
        return 'Lancer une analyse Benford complémentaire sur un échantillon plus large';
      case 'frequency':
        return 'Vérifier si la récurrence est contractuelle (frais d\'abonnement)';
    }
  }

  static readonly WEIGHTS = WEIGHTS;
  static readonly ANOMALY_THRESHOLD = ANOMALY_THRESHOLD;
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function standardDeviation(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function normalizeForCategory(description: string): string {
  return description
    .toLowerCase()
    .replace(/[0-9]+/g, '')
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3)
    .sort()
    .join(' ')
    .trim();
}

function summarizeScores(
  scores: Array<{ score: number }>,
): { anomalyCount: number; avgScore: number; maxScore: number } {
  const flagged = scores.filter((s) => s.score >= ANOMALY_THRESHOLD);
  if (flagged.length === 0) {
    return { anomalyCount: 0, avgScore: 0, maxScore: 0 };
  }
  const avg = flagged.reduce((sum, s) => sum + s.score, 0) / flagged.length;
  const max = Math.max(...flagged.map((s) => s.score));
  return { anomalyCount: flagged.length, avgScore: avg, maxScore: max };
}
