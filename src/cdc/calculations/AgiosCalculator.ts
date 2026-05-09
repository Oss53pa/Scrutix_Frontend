// ============================================================================
// CDC — Calcul d'agios sur découvert (méthode des nombres)
// TypeScript pur, déterministe. Jamais de LLM pour le calcul financier.
// Montants en BIGINT centimes.
// ============================================================================

import type {
  DailyPosition,
  AgiosResult,
  ResolutionResult,
} from '../types';

const CENTIMES = 100n;

export interface AgiosConfig {
  base: 360 | 365;
  plafondAutoriseCentimes: bigint;
}

const DEFAULT_CONFIG: AgiosConfig = {
  base: 360,
  plafondAutoriseCentimes: 0n,
};

export class AgiosCalculator {
  /**
   * Calcule les agios sur découvert par la méthode des nombres.
   *
   * agios = Σ (solde_débiteur_jour × 1 jour) × taux / base
   * base = 36000 si taux en %, 360 si taux en décimal
   *
   * On distingue découvert autorisé vs non autorisé selon le plafond.
   */
  calculate(
    positions: DailyPosition[],
    tauxAutorise: ResolutionResult,
    tauxNonAutorise: ResolutionResult,
    config: Partial<AgiosConfig> = {},
  ): AgiosResult {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    if (tauxAutorise.value === null && tauxNonAutorise.value === null) {
      throw new Error('Au moins un taux (autorisé ou non autorisé) doit être résolu');
    }

    const rateAutorise = tauxAutorise.value ?? 0;
    const rateNonAutorise = tauxNonAutorise.value ?? rateAutorise;
    const baseDivisor = BigInt(cfg.base) * CENTIMES; // base 36000 for percent

    let totalAgiosCentimes = 0n;
    let agiosAutoriseCentimes = 0n;
    let agiosNonAutoriseCentimes = 0n;
    let nombreJoursDebiteurs = 0;
    let sommeDebiteur = 0n;

    const details: AgiosResult['details'] = [];

    for (const pos of positions) {
      if (!pos.isDebit || pos.balanceCentimes >= 0n) continue;

      const soldeAbs = -pos.balanceCentimes; // positive centimes
      nombreJoursDebiteurs++;
      sommeDebiteur += soldeAbs;

      let agiosJour: bigint;
      let zone: 'autorise' | 'non_autorise';

      if (cfg.plafondAutoriseCentimes > 0n && soldeAbs > cfg.plafondAutoriseCentimes) {
        // Split: authorized portion + excess
        const portionAutorise = cfg.plafondAutoriseCentimes;
        const portionExces = soldeAbs - cfg.plafondAutoriseCentimes;

        const agiosAuth = this.computeDailyAgios(portionAutorise, rateAutorise, baseDivisor);
        const agiosExc = this.computeDailyAgios(portionExces, rateNonAutorise, baseDivisor);

        agiosAutoriseCentimes += agiosAuth;
        agiosNonAutoriseCentimes += agiosExc;
        agiosJour = agiosAuth + agiosExc;
        zone = 'non_autorise';
      } else {
        agiosJour = this.computeDailyAgios(soldeAbs, rateAutorise, baseDivisor);
        agiosAutoriseCentimes += agiosJour;
        zone = 'autorise';
      }

      totalAgiosCentimes += agiosJour;
      details.push({
        date: pos.date,
        soldeCentimes: pos.balanceCentimes,
        agiosCentimes: agiosJour,
        zone,
      });
    }

    const soldeDebiteurMoyen = nombreJoursDebiteurs > 0
      ? sommeDebiteur / BigInt(nombreJoursDebiteurs)
      : 0n;

    return {
      totalAgiosCentimes,
      agiosAutoriseCentimes,
      agiosNonAutoriseCentimes,
      nombreJoursDebiteurs,
      soldeDebiteurMoyen,
      tauxApplique: rateAutorise,
      tauxConvenu: rateAutorise,
      base: cfg.base,
      details,
    };
  }

  /**
   * Compare les agios facturés vs théoriques et retourne l'écart.
   */
  verifyAgios(
    agiosFacturesCentimes: bigint,
    positions: DailyPosition[],
    tauxAutorise: ResolutionResult,
    tauxNonAutorise: ResolutionResult,
    config: Partial<AgiosConfig> = {},
  ): {
    result: AgiosResult;
    ecartCentimes: bigint;
    isOvercharge: boolean;
  } {
    const result = this.calculate(positions, tauxAutorise, tauxNonAutorise, config);
    const ecartCentimes = agiosFacturesCentimes - result.totalAgiosCentimes;

    return {
      result,
      ecartCentimes,
      isOvercharge: ecartCentimes > 0n,
    };
  }

  /**
   * Agios journaliers: solde × taux / (base × 100)
   * taux en percent (ex: 12 pour 12%), base en centimes (36000)
   */
  private computeDailyAgios(
    soldeAbsCentimes: bigint,
    tauxPercent: number,
    baseDivisor: bigint,
  ): bigint {
    // solde * taux_numerator / (base * 100)
    // Use integer arithmetic: multiply first, divide last
    const tauxNum = BigInt(Math.round(tauxPercent * 1_000_000)); // 6 decimals
    return (soldeAbsCentimes * tauxNum) / (baseDivisor * 1_000_000n);
  }
}
