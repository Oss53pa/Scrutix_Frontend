/**
 * @module AtlasBanx
 * @file src/ml/detectors/ZScoreAnalyzer.ts
 * @description Analyseur de z-score glissant par catégorie de frais.
 *
 *              Pour chaque catégorie (account_fees, card_fees, international,
 *              etc.), on calcule la moyenne et l'écart-type sur les 12 mois
 *              glissants, puis on flag les mois dont le montant s'écarte
 *              significativement (|z| > 2.5 = warning, |z| > 3.5 = critical).
 *
 *              Correction saisonnière africaine :
 *                • Pics autorisés en décembre (fêtes de fin d'année)
 *                • Pics autorisés pendant le Ramadan (variable, approximé)
 *
 *              Cette analyse est un complément du module `AccountFeesAudit`
 *              existant : elle apporte une détection *statistique* en plus
 *              des règles déterministes.
 * @author Atlas Studio
 * @version 1.0.0
 */

import type { AnomalyScore, ClientHistory } from '../types';

const WARNING_Z = 2.5;
const CRITICAL_Z = 3.5;
const MIN_MONTHS = 3;   // sous ce seuil pas d'analyse z-score

// Catégories de frais — mots-clés français pour le regroupement heuristique
const FEE_CATEGORIES: Record<string, RegExp> = {
  account_fees: /tenue de compte|frais (mensuels|trimestriels|annuels) de compte|abonnement/i,
  card_fees: /carte (bancaire|visa|mastercard)|cotisation carte|renouvellement carte/i,
  transfer_fees: /virement|transfert|commission de virement/i,
  international: /change|devise|international|swift|commission de change/i,
  withdrawal_fees: /retrait|dab|guichet automatique/i,
  interest: /agios|intérêts|intérets|interet|découvert/i,
  other: /commission|frais divers|frais de dossier/i,
};

interface MonthBucket {
  yearMonth: string; // YYYY-MM
  totalByCategory: Record<string, number>;
  countByCategory: Record<string, number>;
}

export interface ZScoreFinding {
  transactionId: string;
  category: string;
  yearMonth: string;
  amount: number;
  zscore: number;
  severity: 'warning' | 'critical';
  mean: number;
  stdDev: number;
}

export class ZScoreAnalyzer {
  /**
   * Analyse l'historique d'un client et retourne les z-scores par mois
   * et par catégorie. Les observations saisonnières (décembre, Ramadan)
   * sont exclues des anomalies.
   */
  static analyze(history: ClientHistory): ZScoreFinding[] {
    const buckets = this.aggregateByMonth(history);
    if (buckets.size < MIN_MONTHS) return [];

    const findings: ZScoreFinding[] = [];
    const categories = Object.keys(FEE_CATEGORIES);

    for (const category of categories) {
      const monthlyAmounts: Array<{ yearMonth: string; total: number }> = [];
      for (const [yearMonth, bucket] of buckets) {
        const total = bucket.totalByCategory[category] ?? 0;
        monthlyAmounts.push({ yearMonth, total });
      }

      if (monthlyAmounts.length < MIN_MONTHS) continue;

      // Stats sur les mois NON saisonniers uniquement
      const nonSeasonal = monthlyAmounts.filter((m) => !isSeasonalMonth(m.yearMonth));
      if (nonSeasonal.length < MIN_MONTHS) continue;

      const amounts = nonSeasonal.map((m) => m.total);
      const mean = average(amounts);
      const stdDev = standardDeviation(amounts, mean);
      if (stdDev === 0) continue; // pas de variance, rien à détecter

      // Scanner toutes les transactions individuelles sur les mois anormaux
      for (const { yearMonth, total } of monthlyAmounts) {
        if (isSeasonalMonth(yearMonth)) continue;
        const z = (total - mean) / stdDev;
        if (Math.abs(z) < WARNING_Z) continue;

        // Trouver la transaction la plus représentative du mois anormal
        const matching = history.transactions.filter(
          (t) =>
            monthKey(t.date) === yearMonth &&
            FEE_CATEGORIES[category].test(t.description),
        );
        const flagged = matching.length > 0 ? matching[0] : null;
        if (!flagged) continue;

        findings.push({
          transactionId: flagged.id,
          category,
          yearMonth,
          amount: flagged.amount,
          zscore: z,
          severity: Math.abs(z) >= CRITICAL_Z ? 'critical' : 'warning',
          mean,
          stdDev,
        });
      }
    }

    return findings;
  }

  /**
   * Retourne un score par transaction pour l'orchestrateur.
   */
  static detect(history: ClientHistory): Map<string, AnomalyScore> {
    const findings = this.analyze(history);
    const scores = new Map<string, AnomalyScore>();
    for (const f of findings) {
      const z = Math.abs(f.zscore);
      const score = Math.min(1, (z - WARNING_Z) / (CRITICAL_Z - WARNING_Z + 1.5));
      scores.set(f.transactionId, {
        score,
        confidence: 0.8,
        reason: `${f.category}: z=${f.zscore.toFixed(1)} sur ${f.yearMonth} (moy ${f.mean.toFixed(0)}, σ ${f.stdDev.toFixed(0)})`,
      });
    }
    return scores;
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  private static aggregateByMonth(history: ClientHistory): Map<string, MonthBucket> {
    const buckets = new Map<string, MonthBucket>();
    for (const tx of history.transactions) {
      const key = monthKey(tx.date);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { yearMonth: key, totalByCategory: {}, countByCategory: {} };
        buckets.set(key, bucket);
      }
      const category = this.categorize(tx.description);
      if (!category) continue;
      bucket.totalByCategory[category] = (bucket.totalByCategory[category] ?? 0) + Math.abs(tx.amount);
      bucket.countByCategory[category] = (bucket.countByCategory[category] ?? 0) + 1;
    }
    return buckets;
  }

  private static categorize(description: string): string | null {
    for (const [category, regex] of Object.entries(FEE_CATEGORIES)) {
      if (regex.test(description)) return category;
    }
    return null;
  }

  static readonly WARNING_Z = WARNING_Z;
  static readonly CRITICAL_Z = CRITICAL_Z;
  static readonly FEE_CATEGORIES = FEE_CATEGORIES;
}

// ----------------------------------------------------------------------------

function monthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function isSeasonalMonth(yearMonth: string): boolean {
  const month = parseInt(yearMonth.slice(5, 7), 10);
  // Décembre : pic fêtes de fin d'année
  if (month === 12) return true;
  // Ramadan approximatif 2024-2028 — variable, ici on couvre mars-avril
  if (month === 3 || month === 4) return true;
  return false;
}

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
