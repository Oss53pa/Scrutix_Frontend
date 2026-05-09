// ============================================================================
// CDC — Calcul de la CPFD (Commission du Plus Fort Découvert)
// cpfd = max(soldes_debiteurs_periode) × taux_cpfd
// Plafond BCEAO: CPFD ≤ X% des intérêts débiteurs
// Montants en BIGINT centimes.
// ============================================================================

import type {
  DailyPosition,
  CpfdResult,
  ResolutionResult,
} from '../types';

export class CpfdCalculator {
  /**
   * Calcule la CPFD sur une période.
   *
   * @param positions  Positions journalières du compte
   * @param tauxCpfd   Taux CPFD résolu via le moteur (rubric: decouverts.cpfd)
   * @param plafondCpfd Plafond CPFD en % des intérêts débiteurs (rubric: decouverts.cpfd_plafond, L1)
   * @param interetsDebiteursCentimes Total des intérêts débiteurs de la période (pour vérif plafond)
   */
  calculate(
    positions: DailyPosition[],
    tauxCpfd: ResolutionResult,
    plafondCpfd: ResolutionResult | null,
    interetsDebiteursCentimes: bigint,
  ): CpfdResult {
    if (tauxCpfd.value === null) {
      throw new Error('Taux CPFD non résolu');
    }

    // Find plus fort découvert (max abs debit balance)
    let plusFortDecouvertCentimes = 0n;
    let dateMaxDecouvert = new Date();

    for (const pos of positions) {
      if (pos.isDebit && pos.balanceCentimes < 0n) {
        const abs = -pos.balanceCentimes;
        if (abs > plusFortDecouvertCentimes) {
          plusFortDecouvertCentimes = abs;
          dateMaxDecouvert = pos.date;
        }
      }
    }

    // cpfd = plus_fort_decouvert × taux / 100
    const taux = tauxCpfd.value;
    const tauxNum = BigInt(Math.round(taux * 1_000_000));
    const cpfdCentimes =
      (plusFortDecouvertCentimes * tauxNum) / (100n * 1_000_000n);

    // Check regulatory cap
    let plafondReglementaireCentimes: bigint | null = null;
    let isViolation = false;

    if (plafondCpfd?.value !== null && plafondCpfd?.value !== undefined) {
      const plafondPct = plafondCpfd.value;
      const plafondNum = BigInt(Math.round(plafondPct * 1_000_000));
      plafondReglementaireCentimes =
        (interetsDebiteursCentimes * plafondNum) / (100n * 1_000_000n);

      if (cpfdCentimes > plafondReglementaireCentimes) {
        isViolation = true;
      }
    }

    return {
      cpfdCentimes,
      plusFortDecouvertCentimes,
      tauxCpfd: taux,
      plafondReglementaireCentimes,
      isViolation,
      dateMaxDecouvert,
    };
  }

  /**
   * Compare la CPFD facturée vs théorique.
   */
  verify(
    cpfdFactureeCentimes: bigint,
    positions: DailyPosition[],
    tauxCpfd: ResolutionResult,
    plafondCpfd: ResolutionResult | null,
    interetsDebiteursCentimes: bigint,
  ): {
    result: CpfdResult;
    ecartCentimes: bigint;
    isOvercharge: boolean;
  } {
    const result = this.calculate(
      positions,
      tauxCpfd,
      plafondCpfd,
      interetsDebiteursCentimes,
    );
    const ecartCentimes = cpfdFactureeCentimes - result.cpfdCentimes;

    return {
      result,
      ecartCentimes,
      isOvercharge: ecartCentimes > 0n,
    };
  }
}
