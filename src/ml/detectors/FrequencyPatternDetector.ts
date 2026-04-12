/**
 * @module AtlasBanx
 * @file src/ml/detectors/FrequencyPatternDetector.ts
 * @description Détecte les patterns de frais récurrents sur cycles 7/14/30
 *              jours, ainsi que les séquences de frais qui augmentent
 *              progressivement.
 *
 *              L'algorithme :
 *                1. Regroupe les transactions par libellé normalisé
 *                   (lowercase, strip digits, tokens significatifs)
 *                2. Pour chaque groupe ≥ 3 occurrences, calcule les
 *                   intervalles entre transactions successives (en jours)
 *                3. Si les intervalles sont proches d'un cycle canonique
 *                   (7/14/30 j ±20%), flag le groupe comme pattern
 *                   récurrent
 *                4. Vérifie aussi l'escalade : montants monotones
 *                   croissants sur 3+ occurrences → pattern "escalating"
 *
 *              Cette méthode est une "autocorrélation-lite" adaptée au
 *              domaine bancaire : plus simple qu'une FFT et plus rapide
 *              que la détection déterministe actuelle qui scanne les
 *              paires de transactions en O(n²).
 * @author Atlas Studio
 * @version 1.0.0
 */

import type { PatternResult, AnomalyScore, ClientHistory } from '../types';

const MIN_OCCURRENCES = 3;
const CYCLE_TOLERANCE = 0.2; // ±20%
const CANONICAL_CYCLES = [
  { days: 7, label: 'weekly' },
  { days: 14, label: 'bi-weekly' },
  { days: 30, label: 'monthly' },
];

interface GroupedTransaction {
  id: string;
  date: Date;
  amount: number;
  description: string;
}

export class FrequencyPatternDetector {
  /**
   * Détecte les patterns récurrents dans un historique client.
   * Retourne la liste des patterns trouvés, triée par impact décroissant.
   */
  static detect(history: ClientHistory): PatternResult[] {
    const grouped = this.groupByNormalizedLabel(history.transactions);
    const patterns: PatternResult[] = [];
    const totalAmountAll = history.transactions.reduce(
      (s, t) => s + Math.abs(t.amount),
      0,
    );

    for (const [label, group] of grouped.entries()) {
      if (group.length < MIN_OCCURRENCES) continue;

      // Trier par date
      group.sort((a, b) => a.date.getTime() - b.date.getTime());

      // 1. Détecter un cycle canonique
      const intervals = this.computeIntervalsInDays(group);
      const cycleMatch = this.matchCanonicalCycle(intervals);

      // 2. Détecter une escalade
      const escalating = this.isEscalating(group);

      if (!cycleMatch && !escalating) continue;

      const total = group.reduce((s, g) => s + Math.abs(g.amount), 0);
      const impactScore = totalAmountAll > 0 ? total / totalAmountAll : 0;

      if (cycleMatch) {
        patterns.push({
          pattern: cycleMatch.label,
          cycleDays: cycleMatch.days,
          occurrences: group.map((g) => g.date),
          totalAmount: total,
          impactScore,
          label,
        });
      }

      if (escalating) {
        patterns.push({
          pattern: 'escalating',
          cycleDays: cycleMatch?.days ?? 0,
          occurrences: group.map((g) => g.date),
          totalAmount: total,
          impactScore,
          label: `${label} (montants croissants)`,
        });
      }
    }

    return patterns.sort((a, b) => b.impactScore - a.impactScore);
  }

  /**
   * Retourne un score par transaction impliquée dans un pattern.
   * Pour l'orchestrateur final.
   */
  static detectScores(history: ClientHistory): Map<string, AnomalyScore> {
    const patterns = this.detect(history);
    const scores = new Map<string, AnomalyScore>();

    for (const pattern of patterns) {
      // On retrouve les transactions source par label + dates
      const transactions = history.transactions.filter((t) =>
        pattern.occurrences.some((occ) => occ.getTime() === t.date.getTime()),
      );

      for (const tx of transactions) {
        const existing = scores.get(tx.id);
        const score = Math.min(1, 0.4 + pattern.impactScore * 0.6);
        if (!existing || existing.score < score) {
          scores.set(tx.id, {
            score,
            confidence: 0.75,
            reason: `Pattern ${pattern.pattern} détecté : "${pattern.label}"`,
          });
        }
      }
    }

    return scores;
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  /**
   * Normalise un libellé pour regrouper des transactions identiques.
   *   • lowercase
   *   • retire les chiffres (dates, références, numéros de document)
   *   • retire les mots courts (stop-words implicites)
   *   • tokens triés pour insensibilité à l'ordre
   */
  private static normalizeLabel(description: string): string {
    return description
      .toLowerCase()
      .replace(/[0-9]+/g, '')
      .replace(/[^\p{L}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 6)
      .sort()
      .join(' ')
      .trim();
  }

  private static groupByNormalizedLabel(
    transactions: ClientHistory['transactions'],
  ): Map<string, GroupedTransaction[]> {
    const groups = new Map<string, GroupedTransaction[]>();
    for (const tx of transactions) {
      const label = this.normalizeLabel(tx.description);
      if (!label) continue;
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push({
        id: tx.id,
        date: tx.date,
        amount: tx.amount,
        description: tx.description,
      });
    }
    return groups;
  }

  private static computeIntervalsInDays(group: GroupedTransaction[]): number[] {
    const intervals: number[] = [];
    for (let i = 1; i < group.length; i++) {
      const diffMs = group[i].date.getTime() - group[i - 1].date.getTime();
      const days = diffMs / (1000 * 60 * 60 * 24);
      intervals.push(days);
    }
    return intervals;
  }

  /**
   * Vérifie si les intervalles correspondent à un cycle canonique (7/14/30j).
   * Les intervalles doivent être majoritairement (≥60%) dans la tolérance.
   */
  private static matchCanonicalCycle(
    intervals: number[],
  ): { days: number; label: string } | null {
    if (intervals.length === 0) return null;

    for (const cycle of CANONICAL_CYCLES) {
      const matching = intervals.filter((d) => {
        const deviation = Math.abs(d - cycle.days) / cycle.days;
        return deviation <= CYCLE_TOLERANCE;
      });
      if (matching.length / intervals.length >= 0.6) {
        return cycle;
      }
    }
    return null;
  }

  /**
   * True si les montants absolus sont monotones strictement croissants.
   */
  private static isEscalating(group: GroupedTransaction[]): boolean {
    if (group.length < MIN_OCCURRENCES) return false;
    for (let i = 1; i < group.length; i++) {
      if (Math.abs(group[i].amount) <= Math.abs(group[i - 1].amount)) {
        return false;
      }
    }
    return true;
  }

  static readonly CANONICAL_CYCLES = CANONICAL_CYCLES;
  static readonly MIN_OCCURRENCES = MIN_OCCURRENCES;
}
