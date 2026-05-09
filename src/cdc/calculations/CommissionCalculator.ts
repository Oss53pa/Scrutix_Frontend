// ============================================================================
// CDC — Calcul de la Commission de Mouvement
// commission = Σ operations_debitrices_eligibles × taux
// Montants en BIGINT centimes.
// ============================================================================

import type {
  CommissionMouvementResult,
  CommissionAssiette,
  ResolutionResult,
} from '../types';

export interface OperationDebitrice {
  id: string;
  date: Date;
  montantCentimes: bigint;
  description: string;
  type: OperationType;
  isAgioOrCommission: boolean;
}

export type OperationType =
  | 'virement_interne'
  | 'virement_externe'
  | 'retrait_especes'
  | 'prelevement'
  | 'cheque'
  | 'carte'
  | 'frais'
  | 'agios'
  | 'autre';

export class CommissionCalculator {
  /**
   * Calcule la commission de mouvement sur les opérations débitrices éligibles.
   */
  calculate(
    operations: OperationDebitrice[],
    tauxResolution: ResolutionResult,
    assietteResolution: ResolutionResult | null,
  ): CommissionMouvementResult {
    if (tauxResolution.value === null) {
      throw new Error('Taux de commission de mouvement non résolu');
    }

    const taux = tauxResolution.value;
    const assiette = this.determineAssiette(assietteResolution);

    let assietteCentimes = 0n;
    let operationsEligibles = 0;
    let operationsExclues = 0;

    for (const op of operations) {
      if (this.isEligible(op, assiette)) {
        assietteCentimes += op.montantCentimes;
        operationsEligibles++;
      } else {
        operationsExclues++;
      }
    }

    // commission = assiette × taux / 100
    const tauxNum = BigInt(Math.round(taux * 1_000_000));
    const totalCommissionCentimes =
      (assietteCentimes * tauxNum) / (100n * 1_000_000n);

    return {
      totalCommissionCentimes,
      assietteCentimes,
      tauxApplique: taux,
      tauxConvenu: taux,
      operationsEligibles,
      operationsExclues,
      assiette,
    };
  }

  /**
   * Compare la commission facturée vs théorique.
   */
  verify(
    commissionFactureeCentimes: bigint,
    operations: OperationDebitrice[],
    tauxResolution: ResolutionResult,
    assietteResolution: ResolutionResult | null,
  ): {
    result: CommissionMouvementResult;
    ecartCentimes: bigint;
    isOvercharge: boolean;
  } {
    const result = this.calculate(operations, tauxResolution, assietteResolution);
    const ecartCentimes = commissionFactureeCentimes - result.totalCommissionCentimes;

    return {
      result,
      ecartCentimes,
      isOvercharge: ecartCentimes > 0n,
    };
  }

  private determineAssiette(
    resolution: ResolutionResult | null,
  ): CommissionAssiette {
    if (!resolution || resolution.value === null) return 'tous_debits';

    // value stores the assiette type as a numeric code
    // 0=tous_debits, 1=hors_retraits, 2=hors_virements, 3=hors_prelevements, 4=hors_agios
    const assietteMap: Record<number, CommissionAssiette> = {
      0: 'tous_debits',
      1: 'hors_retraits_especes',
      2: 'hors_virements_internes',
      3: 'hors_prelevements',
      4: 'hors_agios_commissions',
    };
    return assietteMap[resolution.value] ?? 'tous_debits';
  }

  private isEligible(
    op: OperationDebitrice,
    assiette: CommissionAssiette,
  ): boolean {
    switch (assiette) {
      case 'tous_debits':
        return true;
      case 'hors_retraits_especes':
        return op.type !== 'retrait_especes';
      case 'hors_virements_internes':
        return op.type !== 'virement_interne';
      case 'hors_prelevements':
        return op.type !== 'prelevement';
      case 'hors_agios_commissions':
        return !op.isAgioOrCommission;
    }
  }
}
