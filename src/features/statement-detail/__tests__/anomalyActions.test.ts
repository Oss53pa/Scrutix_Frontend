// ============================================================================
// Tests — getAvailableActions(role, anomaly) — matrice exhaustive
// ============================================================================
// Spec onglets 2-5 §1.3.4 : la liste exacte des actions est strictement
// déterminée par (rôle × statut × sévérité). Cette suite teste TOUTES
// les combinaisons critiques pour éviter toute régression.
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  getAvailableActions,
  getWorkflowSteps,
  requiredFinalStatus,
  isFullyRatified,
} from '../workflow/anomalyActions';
import type { Anomaly } from '../types/statement.types';
import type { CabinetRole } from '../../../workspace/types';

function makeAnomaly(over: Partial<Anomaly> = {}): Anomaly {
  return {
    id: 'a',
    statementId: 's',
    type: 'commission_excessive',
    severity: 'medium',
    status: 'detected',
    title: 't',
    description: 'd',
    transaction: { id: 'tx', date: '2026-01-01', label: 'L', amountCentimes: -100_000 },
    detection: { algorithm: 'algo', confidence: 0.9, rule: 'r' },
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

const ROLES: CabinetRole[] = ['dg', 'senior', 'junior', 'consultation'];

// ============================================================================
// Statut: detected
// ============================================================================

describe('getAvailableActions — statut detected', () => {
  it.each(ROLES.filter((r) => r !== 'consultation'))(
    'rôle %s : peut qualifier ou marquer faux positif',
    (role) => {
      const a = makeAnomaly({ status: 'detected', severity: 'medium' });
      const actions = getAvailableActions(role, a);
      expect(actions.map((x) => x.opens)).toEqual(['qualifyDialog', 'falsePositiveDialog']);
    },
  );

  it('rôle consultation : aucune action', () => {
    const a = makeAnomaly({ status: 'detected' });
    expect(getAvailableActions('consultation', a)).toEqual([]);
  });
});

// ============================================================================
// Statut: qualified
// ============================================================================

describe('getAvailableActions — statut qualified', () => {
  describe('sévérité low/medium → clôture immédiate', () => {
    it.each(['low', 'medium'] as const)('sévérité %s : tout sauf consultation peut clôturer', (sev) => {
      const a = makeAnomaly({ status: 'qualified', severity: sev });
      for (const r of ['dg', 'senior', 'junior'] as const) {
        const actions = getAvailableActions(r, a);
        expect(actions.map((x) => x.opens)).toEqual(['closeDialog']);
      }
      expect(getAvailableActions('consultation', a)).toEqual([]);
    });
  });

  describe('sévérité high/critical → senior+ doit valider', () => {
    it.each(['high', 'critical'] as const)('sévérité %s : junior ne peut rien faire', (sev) => {
      const a = makeAnomaly({ status: 'qualified', severity: sev });
      expect(getAvailableActions('junior', a)).toEqual([]);
    });

    it.each(['high', 'critical'] as const)('sévérité %s : senior peut valider ou rejeter', (sev) => {
      const a = makeAnomaly({ status: 'qualified', severity: sev });
      const actions = getAvailableActions('senior', a);
      expect(actions.map((x) => x.opens)).toEqual(['validateDialog', 'rejectDialog']);
    });

    it.each(['high', 'critical'] as const)('sévérité %s : dg peut valider ou rejeter', (sev) => {
      const a = makeAnomaly({ status: 'qualified', severity: sev });
      const actions = getAvailableActions('dg', a);
      expect(actions.map((x) => x.opens)).toEqual(['validateDialog', 'rejectDialog']);
    });
  });
});

// ============================================================================
// Statut: validated
// ============================================================================

describe('getAvailableActions — statut validated', () => {
  describe('sévérité non-critical → clôture senior+', () => {
    it.each(['low', 'medium', 'high'] as const)('sévérité %s : senior peut clôturer', (sev) => {
      const a = makeAnomaly({ status: 'validated', severity: sev });
      const actions = getAvailableActions('senior', a);
      expect(actions.map((x) => x.opens)).toEqual(['closeDialog']);
    });

    it.each(['low', 'medium', 'high'] as const)('sévérité %s : junior ne peut pas clôturer', (sev) => {
      const a = makeAnomaly({ status: 'validated', severity: sev });
      expect(getAvailableActions('junior', a)).toEqual([]);
    });
  });

  describe('sévérité critical → DG only', () => {
    it('junior ne peut rien faire', () => {
      const a = makeAnomaly({ status: 'validated', severity: 'critical' });
      expect(getAvailableActions('junior', a)).toEqual([]);
    });

    it('senior ne peut rien faire (DG only)', () => {
      const a = makeAnomaly({ status: 'validated', severity: 'critical' });
      expect(getAvailableActions('senior', a)).toEqual([]);
    });

    it('DG peut signer ou renvoyer pour revue', () => {
      const a = makeAnomaly({ status: 'validated', severity: 'critical' });
      const actions = getAvailableActions('dg', a);
      expect(actions.map((x) => x.opens)).toEqual(['signDialog', 'rejectDialog']);
    });
  });
});

// ============================================================================
// Statuts terminaux
// ============================================================================

describe('getAvailableActions — statuts terminaux', () => {
  it.each(['signed', 'closed', 'false_positive'] as const)('statut %s : aucune action', (status) => {
    for (const r of ROLES) {
      const a = makeAnomaly({ status });
      expect(getAvailableActions(r, a)).toEqual([]);
    }
  });
});

// ============================================================================
// Workflow steps (par sévérité)
// ============================================================================

describe('getWorkflowSteps', () => {
  it('low/medium → 2 étapes (Détectée → Qualifiée)', () => {
    expect(getWorkflowSteps('low').map((s) => s.key)).toEqual(['detected', 'qualified']);
    expect(getWorkflowSteps('medium').map((s) => s.key)).toEqual(['detected', 'qualified']);
  });

  it('high → 3 étapes (+ Validée)', () => {
    expect(getWorkflowSteps('high').map((s) => s.key)).toEqual(['detected', 'qualified', 'validated']);
  });

  it('critical → 4 étapes (+ Signée)', () => {
    expect(getWorkflowSteps('critical').map((s) => s.key))
      .toEqual(['detected', 'qualified', 'validated', 'signed']);
  });
});

// ============================================================================
// Required final status
// ============================================================================

describe('requiredFinalStatus', () => {
  it('low/medium → qualified', () => {
    expect(requiredFinalStatus('low')).toBe('qualified');
    expect(requiredFinalStatus('medium')).toBe('qualified');
  });
  it('high → validated', () => {
    expect(requiredFinalStatus('high')).toBe('validated');
  });
  it('critical → signed', () => {
    expect(requiredFinalStatus('critical')).toBe('signed');
  });
});

// ============================================================================
// isFullyRatified
// ============================================================================

describe('isFullyRatified', () => {
  it('critical doit être signed pour être ratifiée', () => {
    expect(isFullyRatified(makeAnomaly({ severity: 'critical', status: 'validated' }))).toBe(false);
    expect(isFullyRatified(makeAnomaly({ severity: 'critical', status: 'signed' }))).toBe(true);
    expect(isFullyRatified(makeAnomaly({ severity: 'critical', status: 'closed' }))).toBe(true);
  });

  it('medium ratifiée dès qualified', () => {
    expect(isFullyRatified(makeAnomaly({ severity: 'medium', status: 'qualified' }))).toBe(true);
    expect(isFullyRatified(makeAnomaly({ severity: 'medium', status: 'detected' }))).toBe(false);
  });

  it('false_positive jamais ratifiée', () => {
    expect(isFullyRatified(makeAnomaly({ severity: 'high', status: 'false_positive' }))).toBe(false);
  });

  it('high ratifiée dès validated', () => {
    expect(isFullyRatified(makeAnomaly({ severity: 'high', status: 'validated' }))).toBe(true);
    expect(isFullyRatified(makeAnomaly({ severity: 'high', status: 'qualified' }))).toBe(false);
  });
});
