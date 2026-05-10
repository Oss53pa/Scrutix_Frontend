// ============================================================================
// AnomalyActions — matrice rôle × statut × sévérité
// ============================================================================
// Spec onglets 2-5 §1.3.4 : la liste exacte des actions disponibles dépend
// simultanément du rôle de l'utilisateur, du statut courant de l'anomalie,
// et de sa sévérité. Cette fonction est la source de vérité unique pour
// l'UI (boutons d'action) et les permissions backend (validation côté API).
//
// Tests exhaustifs dans __tests__/anomalyActions.test.ts.
// ============================================================================

import type { Anomaly, DialogAction } from '../types/statement.types';
import type { CabinetRole } from '../../../workspace/types';

/**
 * Renvoie la liste des actions disponibles pour cette combinaison
 * (rôle, anomalie). Liste vide si aucune action ne peut être prise.
 */
export function getAvailableActions(
  userRole: CabinetRole,
  anomaly: Anomaly,
): DialogAction[] {
  const { status, severity } = anomaly;

  // Lecture seule : aucune action
  if (userRole === 'consultation') return [];

  // === Statut: detected ===
  // Peu importe la sévérité, n'importe qui sauf consultation peut qualifier
  // ou marquer faux positif.
  if (status === 'detected') {
    return [
      { label: 'Qualifier',     primary: true,   opens: 'qualifyDialog' },
      { label: 'Faux positif',  secondary: true, opens: 'falsePositiveDialog' },
    ];
  }

  // === Statut: qualified ===
  if (status === 'qualified') {
    // Sévérités basses : clôture immédiate possible
    if (severity === 'low' || severity === 'medium') {
      return [
        { label: 'Clôturer', primary: true, opens: 'closeDialog' },
      ];
    }
    // Sévérités élevées : senior+ doit valider, junior attend
    if (userRole === 'junior') return [];
    return [
      { label: 'Valider',                primary: true,   opens: 'validateDialog' },
      { label: 'Rejeter qualification',  secondary: true, opens: 'rejectDialog' },
    ];
  }

  // === Statut: validated ===
  if (status === 'validated') {
    // Sévérités non-critique : clôture par senior+
    if (severity !== 'critical') {
      if (userRole === 'junior') return [];
      return [
        { label: 'Clôturer', primary: true, opens: 'closeDialog' },
      ];
    }
    // Sévérité critique : signature DG obligatoire
    if (userRole !== 'dg') return [];
    return [
      { label: 'Signer et clôturer',     primary: true,   opens: 'signDialog' },
      { label: 'Renvoyer pour revue',    secondary: true, opens: 'rejectDialog' },
    ];
  }

  // === Statuts terminaux (signed/closed/false_positive) ===
  return [];
}

// ============================================================================
// Workflow steps — conversion sévérité → étapes affichables
// ============================================================================

export interface WorkflowStepDef {
  key: 'detected' | 'qualified' | 'validated' | 'signed' | 'closed';
  label: string;
}

/**
 * Renvoie le nombre d'étapes attendues selon la sévérité (CDC + spec).
 *   low/medium → 2 étapes : Détectée → Qualifiée
 *   high       → 3 étapes : Détectée → Qualifiée → Validée
 *   critical   → 4 étapes : Détectée → Qualifiée → Validée → Signée
 */
export function getWorkflowSteps(severity: Anomaly['severity']): WorkflowStepDef[] {
  const steps: WorkflowStepDef[] = [
    { key: 'detected',  label: 'Détectée' },
    { key: 'qualified', label: 'Qualifiée' },
  ];
  if (severity === 'high' || severity === 'critical') {
    steps.push({ key: 'validated', label: 'Validée' });
  }
  if (severity === 'critical') {
    steps.push({ key: 'signed', label: 'Signée' });
  }
  return steps;
}

/**
 * Statut requis pour considérer l'anomalie comme totalement traitée
 * (= peut apparaître dans un rapport signé).
 */
export function requiredFinalStatus(severity: Anomaly['severity']): Anomaly['status'] {
  if (severity === 'critical') return 'signed';
  if (severity === 'high')     return 'validated';
  return 'qualified';
}

/**
 * TRUE si l'anomalie a atteint son statut final attendu et peut être
 * incluse dans un rapport signé / une lettre de réclamation.
 */
export function isFullyRatified(anomaly: Anomaly): boolean {
  const required = requiredFinalStatus(anomaly.severity);
  if (anomaly.status === 'closed') return true;
  // Ordre : detected < qualified < validated < signed
  const order: Record<Anomaly['status'], number> = {
    detected: 0,
    qualified: 1,
    validated: 2,
    signed: 3,
    closed: 4,
    false_positive: -1,
  };
  return order[anomaly.status] >= order[required];
}
