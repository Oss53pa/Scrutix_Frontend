// ============================================================================
// CDC — Audit des dates de valeur
// Vérifie les DV appliquées vs conventions/réglementation BCEAO
// Montants en BIGINT centimes.
// ============================================================================

import type {
  ValueDateResult,
  ResolutionResult,
} from '../types';

export interface ValueDateOperation {
  id: string;
  operationDate: Date;
  valueDateApplied: Date;
  montantCentimes: bigint;
  typeOperation: ValueDateOperationType;
  description: string;
}

export type ValueDateOperationType =
  | 'versement_especes'
  | 'retrait_especes'
  | 'cheque_sur_place'
  | 'cheque_hors_place'
  | 'virement_recu'
  | 'virement_emis'
  | 'autre';

const RUBRIC_MAP: Record<ValueDateOperationType, string> = {
  versement_especes: 'dv.versement_especes',
  retrait_especes: 'dv.retrait_especes',
  cheque_sur_place: 'dv.cheque_sur_place',
  cheque_hors_place: 'dv.cheque_hors_place',
  virement_recu: 'dv.virement_recu',
  virement_emis: 'dv.virement_emis',
  autre: 'dv.versement_especes', // fallback
};

// Default max days if no resolution available
const DEFAULT_MAX_DAYS: Record<ValueDateOperationType, number> = {
  versement_especes: 1,     // J+1 max (BCEAO)
  retrait_especes: 0,       // J min (BCEAO)
  cheque_sur_place: 3,      // J+3 ouvré (BCEAO)
  cheque_hors_place: 10,    // variable
  virement_recu: 0,         // J min (BCEAO)
  virement_emis: 1,         // J+1
  autre: 2,
};

export class ValueDateAuditor {
  /**
   * Audit a single operation's value date against resolved conditions.
   *
   * @param op        The operation with applied value date
   * @param dvResolution  Resolution result for the DV rubric (days)
   * @param tauxDecouvert Annual overdraft rate (for impact calculation)
   */
  auditOperation(
    op: ValueDateOperation,
    dvResolution: ResolutionResult | null,
    tauxDecouvert: number,
  ): ValueDateResult | null {
    const maxJours = dvResolution?.value ?? DEFAULT_MAX_DAYS[op.typeOperation];
    const ecart = this.calculateDaysDiff(op.operationDate, op.valueDateApplied);

    // For credits: value date should be close to operation date
    // For debits: value date should not be before operation date
    const isCredit = this.isCredit(op.typeOperation);

    let ecartExcessif: number;
    if (isCredit) {
      // Credit: DV later than allowed = unfavorable to client
      ecartExcessif = ecart - maxJours;
    } else {
      // Debit: DV earlier than operation = unfavorable to client
      ecartExcessif = -ecart; // negative ecart means DV before op date
      if (ecartExcessif < 0) ecartExcessif = 0; // DV after op date = OK for debit
    }

    if (ecartExcessif <= 0) return null;

    // Calculate financial impact: montant × taux × jours_excessifs / base
    const impactCentimes = this.calculateImpact(
      op.montantCentimes,
      tauxDecouvert,
      ecartExcessif,
    );

    const expectedDv = new Date(op.operationDate);
    expectedDv.setDate(expectedDv.getDate() + (isCredit ? maxJours : 0));

    return {
      operationDate: op.operationDate,
      valueDateApplied: op.valueDateApplied,
      valueDateExpected: expectedDv,
      ecartJours: ecart,
      ecartMaxAutorise: maxJours,
      impactCentimes,
      typeOperation: op.typeOperation,
    };
  }

  /**
   * Audit a batch of operations.
   */
  auditBatch(
    operations: ValueDateOperation[],
    dvResolutions: Map<string, ResolutionResult>, // keyed by rubric code
    tauxDecouvert: number,
  ): ValueDateResult[] {
    const results: ValueDateResult[] = [];

    for (const op of operations) {
      const rubric = RUBRIC_MAP[op.typeOperation];
      const resolution = dvResolutions.get(rubric) ?? null;
      const result = this.auditOperation(op, resolution, tauxDecouvert);
      if (result) results.push(result);
    }

    return results;
  }

  /**
   * Get the rubric code for a given operation type.
   */
  getRubricCode(type: ValueDateOperationType): string {
    return RUBRIC_MAP[type];
  }

  private calculateDaysDiff(d1: Date, d2: Date): number {
    const msPerDay = 86_400_000;
    return Math.round((d2.getTime() - d1.getTime()) / msPerDay);
  }

  private isCredit(type: ValueDateOperationType): boolean {
    return type === 'versement_especes' ||
           type === 'virement_recu' ||
           type === 'cheque_sur_place' ||
           type === 'cheque_hors_place';
  }

  private calculateImpact(
    montantCentimes: bigint,
    tauxAnnuelPercent: number,
    joursExcessifs: number,
  ): bigint {
    // impact = montant × taux × jours / 36000
    const tauxNum = BigInt(Math.round(tauxAnnuelPercent * 1_000_000));
    const jours = BigInt(joursExcessifs);
    return (montantCentimes * tauxNum * jours) / (36_000n * 1_000_000n);
  }
}
