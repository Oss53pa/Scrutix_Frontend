// ============================================================================
// riskScore — fonction unique de calcul du score de risque (0-100)
// ============================================================================
// Doit être utilisée partout où un score est affiché (header de la page
// relevé, rapport PDF, SynthèsePage, etc.) pour garantir que l'utilisateur
// voit toujours le MÊME chiffre. Toute divergence est un bug.
//
// Barème (basé sur la gravité, pondérations audit-grade) :
//   - Critical (LCB-FT, fraude potentielle) : -25 pt
//   - High     (commission excessive, agio errone)         : -15 pt
//   - Medium   (frais en double, date de valeur)           : -8  pt
//   - Low      (informationnel)                            : -3  pt
//
// Les anomalies fermées (closed) ou marquées faux positif (false_positive)
// sont exclues du calcul — l'auditeur a tranché, elles ne pèsent plus.
// ============================================================================

import type { Anomaly } from '../types/statement.types';

export const SEVERITY_WEIGHTS = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
} as const;

/** Calcule un score 0-100 (plus haut = mieux). 100 = aucune anomalie. */
export function computeRiskScore(anomalies: Anomaly[]): number {
  let score = 100;
  for (const a of anomalies) {
    if (a.status === 'false_positive' || a.status === 'closed') continue;
    score -= SEVERITY_WEIGHTS[a.severity] ?? 0;
  }
  return Math.max(0, Math.min(100, score));
}

/** Libellé qualitatif associé à un score. */
export function riskScoreLabel(score: number): 'maîtrisé' | 'modéré' | 'élevé' {
  if (score >= 80) return 'maîtrisé';
  if (score >= 50) return 'modéré';
  return 'élevé';
}

/** Tonalité visuelle associée à un score. */
export function riskScoreTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}
