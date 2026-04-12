/**
 * @module AtlasBanx
 * @file src/ml/detectors/BenfordLawChecker.ts
 * @description Test de conformité à la loi de Benford sur les premiers
 *              chiffres d'un lot de montants.
 *
 *              La loi de Benford prédit que dans un jeu de données
 *              "naturelles" (non fabriquées), la distribution des premiers
 *              chiffres significatifs suit :
 *                P(d) = log10(1 + 1/d)
 *              soit environ 30% pour 1, 17% pour 2, etc.
 *
 *              Un écart significatif au test chi-2 suggère que les montants
 *              sont artificiellement générés (fraude, manipulation). C'est
 *              un indicateur reconnu en audit judiciaire.
 *
 *              Applicable en priorité sur :
 *                • les montants de frais bancaires
 *                • les agios / intérêts
 *                • les commissions de change
 * @author Atlas Studio
 * @version 1.0.0
 */

import type { BenfordResult } from '../types';

// Distribution attendue (loi de Benford)
// P(d) = log10(1 + 1/d) pour d = 1..9
const BENFORD_EXPECTED: readonly number[] = [
  0.30103, // 1
  0.17609, // 2
  0.12494, // 3
  0.09691, // 4
  0.07918, // 5
  0.06695, // 6
  0.05799, // 7
  0.05115, // 8
  0.04576, // 9
];

// Valeur critique du chi-2 pour 8 degrés de liberté (9 - 1)
// Source : table chi-2, alpha = 0.05 → 15.507
const CHI_SQUARE_CRITICAL_95 = 15.507;
// alpha = 0.01 → 20.090 (haute confiance)
const CHI_SQUARE_CRITICAL_99 = 20.090;

const MIN_SAMPLES = 50; // sous ce seuil, test non significatif

export class BenfordLawChecker {
  /**
   * Exécute le test de Benford sur un tableau de montants.
   * Les montants négatifs ou nuls sont ignorés, seuls les montants
   * strictement positifs sont retenus.
   */
  static analyze(amounts: number[]): BenfordResult | null {
    const positive = amounts.filter((v) => v > 0);
    if (positive.length < MIN_SAMPLES) return null;

    // 1. Extraction du premier chiffre significatif
    const counts = new Array<number>(9).fill(0);
    let total = 0;
    for (const amount of positive) {
      const firstDigit = this.firstDigit(amount);
      if (firstDigit >= 1 && firstDigit <= 9) {
        counts[firstDigit - 1] += 1;
        total += 1;
      }
    }
    if (total < MIN_SAMPLES) return null;

    // 2. Distribution observée en proportions
    const observed = counts.map((c) => c / total);
    const expected = BENFORD_EXPECTED.map((p) => p);

    // 3. Statistique chi-2 :
    //    χ² = Σ ((O_i - E_i)² / E_i)   avec O_i et E_i en effectifs
    //    (pas en proportions)
    let chiSquare = 0;
    const expectedCounts = expected.map((p) => p * total);
    for (let i = 0; i < 9; i++) {
      const o = counts[i];
      const e = expectedCounts[i];
      if (e > 0) {
        chiSquare += (o - e) ** 2 / e;
      }
    }

    // 4. Détection des chiffres déviants (résiduel standardisé > 2)
    const deviatingDigits: number[] = [];
    for (let i = 0; i < 9; i++) {
      const e = expectedCounts[i];
      if (e === 0) continue;
      const standardizedResidual = (counts[i] - e) / Math.sqrt(e);
      if (Math.abs(standardizedResidual) > 2) {
        deviatingDigits.push(i + 1);
      }
    }

    // 5. Niveau de risque
    let riskLevel: 'low' | 'medium' | 'high';
    if (chiSquare >= CHI_SQUARE_CRITICAL_99) riskLevel = 'high';
    else if (chiSquare >= CHI_SQUARE_CRITICAL_95) riskLevel = 'medium';
    else riskLevel = 'low';

    // 6. p-value approximée par Wilson-Hilferty (rapide, précis à ~1e-3)
    const pValue = this.chiSquarePValue(chiSquare, 8);

    return {
      chiSquare,
      criticalValue: CHI_SQUARE_CRITICAL_95,
      pValue,
      deviatingDigits,
      observed,
      expected,
      riskLevel,
      sampleSize: total,
    };
  }

  // --------------------------------------------------------------------------

  private static firstDigit(value: number): number {
    const abs = Math.abs(value);
    if (abs === 0) return 0;
    // Normaliser en décalant à [1, 10)
    const log = Math.floor(Math.log10(abs));
    const scaled = abs / Math.pow(10, log);
    return Math.floor(scaled);
  }

  /**
   * Approximation de la p-value d'une loi chi-2 via la transformation
   * de Wilson-Hilferty. Pour k degrés de liberté :
   *   Z ≈ ((χ²/k)^(1/3) - (1 - 2/(9k))) / sqrt(2/(9k))
   * Puis on utilise une approximation de la CDF normale (Abramowitz).
   */
  private static chiSquarePValue(chiSquare: number, df: number): number {
    if (chiSquare <= 0) return 1;
    if (df <= 0) return 1;
    const ratio = chiSquare / df;
    const cbrt = Math.cbrt(ratio);
    const mean = 1 - 2 / (9 * df);
    const variance = 2 / (9 * df);
    const z = (cbrt - mean) / Math.sqrt(variance);
    // Approximation de 1 - Φ(z)
    return 1 - this.normalCdf(z);
  }

  /**
   * CDF de la loi normale standard via l'approximation Abramowitz-Stegun 7.1.26.
   * Précis à ~7.5e-8.
   */
  private static normalCdf(z: number): number {
    const sign = z < 0 ? -1 : 1;
    const x = Math.abs(z) / Math.sqrt(2);
    // A&S 7.1.26
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y =
      1 -
      (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
  }

  static readonly BENFORD_EXPECTED = BENFORD_EXPECTED;
  static readonly MIN_SAMPLES = MIN_SAMPLES;
}
