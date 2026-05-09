// ============================================================================
// ATLASBANX — Anomaly workflow state machine (V3)
// ============================================================================
// Cycle de vie 3 acteurs (junior → senior → DG) avec gating par sévérité.
//
// State machine:
//   detected ──qualify──▶ qualified ──validate──▶ validated ──sign──▶ signed
//      │                     │                       │                  │
//      └─────dismiss─────────┴───────dismiss─────────┴──contest─────────┘
//                                                                       │
//                                                                  resolved
//
// Severity gating (decides which final state is required):
//   CRITICAL → must reach 'signed' (DG mandatory)
//   HIGH     → must reach 'validated' (senior mandatory)
//   MEDIUM   → 'qualified' is enough
//   LOW      → 'qualified' is enough
//
// On each transition we capture (userId, name, role, at) so the audit
// trail can reconstruct who did what when. Stored as the workflow
// payload alongside the anomaly itself.
// ============================================================================

import type { Severity } from '../types';
import type { CabinetRole } from './types';

export type AnomalyWorkflowStatus =
  | 'detected'    // raw output from a detector, no human action
  | 'qualified'   // junior+ confirmed: "yes, this is a real anomaly"
  | 'validated'   // senior+ approved: "include in the audit report"
  | 'signed'      // DG signed: locked, evidentiary value
  | 'dismissed'   // anyone qualified+: "false positive" + reason
  | 'contested'   // bank disputed it (post-réclamation)
  | 'resolved';   // bank refunded / re-booked the entry

export interface AnomalyActor {
  userId: string;
  name: string;
  role: CabinetRole;
  at: Date;
}

export interface AnomalyComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: CabinetRole;
  body: string;
  at: Date;
  /** Optional @mention(s) of other workspace members. */
  mentions?: string[];
}

export interface AnomalyWorkflow {
  status: AnomalyWorkflowStatus;
  /** Severity at detection time — drives the gating matrix. */
  severity: Severity;

  // Cycle steps — populated as transitions happen.
  qualifiedBy?: AnomalyActor;
  validatedBy?: AnomalyActor;
  signedBy?: AnomalyActor;
  dismissedBy?: AnomalyActor & { reason: string };
  contestedBy?: AnomalyActor;
  resolvedBy?: AnomalyActor & { recovered: number };

  /** Currently assigned workspace member (for the pipeline view). */
  assignedTo?: { userId: string; name: string; role: CabinetRole };

  /** Free-form discussion thread. */
  comments: AnomalyComment[];
}

// ───────────────────────────────────────────────────────────────────────────
// SEVERITY GATING
// ───────────────────────────────────────────────────────────────────────────

/**
 * Returns the minimum status an anomaly must reach to count as
 * "fully ratified" given its severity. Below this status, the anomaly
 * shouldn't appear in a signed audit report.
 */
export function requiredFinalStatus(severity: Severity): AnomalyWorkflowStatus {
  switch (severity) {
    case 'CRITICAL': return 'signed';      // DG mandatory
    case 'HIGH':     return 'validated';   // senior mandatory
    case 'MEDIUM':   return 'qualified';
    case 'LOW':      return 'qualified';
    default:         return 'qualified';
  }
}

export function isFullyRatified(workflow: AnomalyWorkflow): boolean {
  const required = requiredFinalStatus(workflow.severity);
  return STATUS_RANK[workflow.status] >= STATUS_RANK[required];
}

const STATUS_RANK: Record<AnomalyWorkflowStatus, number> = {
  detected: 0,
  qualified: 1,
  validated: 2,
  signed: 3,
  dismissed: -1,   // out-of-band (terminal)
  contested: -1,   // out-of-band
  resolved: 99,    // ultimate success
};

// ───────────────────────────────────────────────────────────────────────────
// TRANSITION GUARDS
// ───────────────────────────────────────────────────────────────────────────

export interface TransitionPolicy {
  allowed: boolean;
  reason?: string;
}

export function canTransition(
  workflow: AnomalyWorkflow,
  to: AnomalyWorkflowStatus,
  actorRole: CabinetRole,
): TransitionPolicy {
  // Terminal states — no transitions out except resolved
  if (workflow.status === 'signed' && to !== 'contested' && to !== 'resolved') {
    return { allowed: false, reason: 'Anomalie signée — verrouillée pour valeur probante.' };
  }
  if (workflow.status === 'dismissed') {
    return { allowed: false, reason: 'Anomalie écartée — nouvelle qualification impossible.' };
  }
  if (workflow.status === 'resolved') {
    return { allowed: false, reason: 'Anomalie résolue — cycle terminé.' };
  }

  // Forward transitions — must respect role gating
  switch (to) {
    case 'qualified':
      if (workflow.status !== 'detected') return { allowed: false, reason: 'Doit partir de l\'état détecté.' };
      if (!['junior', 'senior', 'dg'].includes(actorRole)) {
        return { allowed: false, reason: 'Réservé aux junior et au-dessus.' };
      }
      return { allowed: true };

    case 'validated':
      if (workflow.status !== 'qualified') return { allowed: false, reason: 'Doit être qualifiée d\'abord.' };
      if (!['senior', 'dg'].includes(actorRole)) {
        return { allowed: false, reason: 'Réservé aux senior et DG.' };
      }
      return { allowed: true };

    case 'signed':
      if (workflow.status !== 'validated') return { allowed: false, reason: 'Doit être validée d\'abord.' };
      if (actorRole !== 'dg') {
        return { allowed: false, reason: 'Signature DG uniquement.' };
      }
      return { allowed: true };

    case 'dismissed':
      if (!['junior', 'senior', 'dg'].includes(actorRole)) {
        return { allowed: false, reason: 'Réservé aux junior et au-dessus.' };
      }
      return { allowed: true };

    case 'contested':
      // Contestation comes from outside (the bank) — anyone can record it
      return { allowed: true };

    case 'resolved':
      if (!['senior', 'dg'].includes(actorRole)) {
        return { allowed: false, reason: 'Réservé aux senior et DG.' };
      }
      return { allowed: true };

    default:
      return { allowed: false, reason: `Transition inconnue: ${to}` };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// HELPERS — derive "next action" for the UI
// ───────────────────────────────────────────────────────────────────────────

export interface NextAction {
  to: AnomalyWorkflowStatus;
  label: string;
  description: string;
  /** Roles that can take this action. */
  allowedRoles: CabinetRole[];
}

export function nextActionsFor(workflow: AnomalyWorkflow): NextAction[] {
  const out: NextAction[] = [];

  if (workflow.status === 'detected') {
    out.push({
      to: 'qualified',
      label: 'Qualifier',
      description: 'Confirmer qu\'il s\'agit bien d\'une anomalie réelle.',
      allowedRoles: ['junior', 'senior', 'dg'],
    });
    out.push({
      to: 'dismissed',
      label: 'Écarter',
      description: 'Marquer comme faux positif.',
      allowedRoles: ['junior', 'senior', 'dg'],
    });
  }
  if (workflow.status === 'qualified') {
    out.push({
      to: 'validated',
      label: 'Valider',
      description: 'Approuver pour inclusion dans le rapport d\'audit.',
      allowedRoles: ['senior', 'dg'],
    });
    out.push({
      to: 'dismissed',
      label: 'Écarter',
      description: 'Réviser : marquer comme non pertinent.',
      allowedRoles: ['senior', 'dg'],
    });
  }
  if (workflow.status === 'validated') {
    out.push({
      to: 'signed',
      label: 'Signer',
      description: 'Verrouiller pour valeur probante (irréversible).',
      allowedRoles: ['dg'],
    });
  }
  if (workflow.status === 'signed') {
    out.push({
      to: 'contested',
      label: 'Marquer contestée',
      description: 'La banque conteste après réception de la réclamation.',
      allowedRoles: ['junior', 'senior', 'dg'],
    });
    out.push({
      to: 'resolved',
      label: 'Marquer résolue',
      description: 'La banque a remboursé / refait l\'écriture.',
      allowedRoles: ['senior', 'dg'],
    });
  }
  return out;
}

/**
 * Initial workflow snapshot for a freshly detected anomaly.
 */
export function initWorkflow(severity: Severity): AnomalyWorkflow {
  return {
    status: 'detected',
    severity,
    comments: [],
  };
}
