// ============================================================================
// anomalyRecovery — détermine si une anomalie est financièrement récupérable
// ============================================================================
// Deux conventions de nommage des types d'anomalies coexistent dans le code :
//   - UPPERCASE (AnomalyType enum, src/types/index.ts) : utilisé par
//     AnalysisService et les détecteurs algo
//   - lowercase (statement.types.ts) : utilisé par la page-relevé et
//     persisté dans atlasbanx.anomalies (Supabase)
//
// Pour calculer le « récupérable estimé » de façon cohérente partout,
// on normalise la clé et on confronte aux deux Sets.
//
// Un type est NON-RÉCUPÉRABLE quand l'argent flagué est parti vers un
// tiers et que la banque n'a rien à rembourser (LCB-FT, suspect, etc.)
// ou quand le signalement est informationnel (trésorerie, rapprochement).
// ============================================================================

/** Types UPPERCASE non récupérables (depuis AnomalyType enum). */
const NON_RECOVERABLE_UPPER = new Set<string>([
  'AML_ALERT',
  'SUSPICIOUS_TRANSACTION',
  'CASHFLOW_ANOMALY',
  'RECONCILIATION_GAP',
  'MULTI_BANK_ISSUE',
]);

/** Types lowercase non récupérables (depuis la page-relevé statement.types). */
const NON_RECOVERABLE_LOWER = new Set<string>([
  'lcb_ft',
  'pays_gafi_risque',
  'beneficiaire_inedit',
  'montant_anormal',
]);

/**
 * Retourne true si le montant flagué pour ce type est réellement
 * récupérable auprès de la banque, false sinon.
 *
 * Exemples :
 *   isRecoverableAnomalyType('AML_ALERT')           → false (LCB-FT, argent parti)
 *   isRecoverableAnomalyType('pays_gafi_risque')    → false (idem)
 *   isRecoverableAnomalyType('commission_excessive') → true  (banque doit rembourser)
 *   isRecoverableAnomalyType('DUPLICATE_FEE')       → true  (idem)
 */
export function isRecoverableAnomalyType(type: string | undefined | null): boolean {
  if (!type) return false;
  const t = String(type);
  if (NON_RECOVERABLE_UPPER.has(t)) return false;
  if (NON_RECOVERABLE_LOWER.has(t.toLowerCase())) return false;
  return true;
}

/**
 * Somme les montants des anomalies récupérables.
 * Le champ utilisé en priorité dépend de la convention :
 *   - .amount (centimes ou unités) — convention AnalysisService
 *   - .potentialRecoveryCentimes / 100 — convention page-relevé
 */
export function sumRecoverableAmount<
  T extends {
    type?: string;
    amount?: number;
    potentialRecoveryCentimes?: number;
  },
>(anomalies: T[]): number {
  return anomalies
    .filter((a) => isRecoverableAnomalyType(a.type))
    .reduce((sum, a) => {
      if (typeof a.potentialRecoveryCentimes === 'number') {
        return sum + a.potentialRecoveryCentimes / 100;
      }
      if (typeof a.amount === 'number') return sum + a.amount;
      return sum;
    }, 0);
}
