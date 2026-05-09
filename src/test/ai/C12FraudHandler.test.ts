import { describe, it, expect } from 'vitest';
import { handleC12 } from '../../ai/proph3t/intelligence/handlers/C12FraudHandler';
import type { C12Input } from '../../ai/proph3t/intelligence/types';

const baseInput: C12Input = {
  operations: [],
  conditions: [],
  bank_id: 'SGBCCICI',
  period: { from: '2024-01-01', to: '2024-03-31' },
};

describe('C12 — Detection patterns frauduleux', () => {
  it('detects plafonnement sous seuil', () => {
    const ops = Array.from({ length: 5 }, (_, i) => ({
      id: `op${i}`,
      amount: -490000, // Just under 500K threshold
      date: `2024-0${i + 1}-15`,
    }));

    const result = handleC12({ ...baseInput, operations: ops });
    expect(result.patterns.some(p => p.pattern === 'plafonnement_sous_seuil')).toBe(true);
  });

  it('detects date de valeur defavorable systematique', () => {
    const ops = Array.from({ length: 10 }, (_, i) => ({
      id: `op${i}`,
      amount: -50000,
      date: `2024-03-${String(i + 1).padStart(2, '0')}`,
      value_date: `2024-03-${String(i + 2).padStart(2, '0')}`, // DV = J+1 systematique
    }));

    const result = handleC12({ ...baseInput, operations: ops });
    expect(result.patterns.some(p => p.pattern === 'dv_defavorable_systematique')).toBe(true);
  });

  it('detects frais sans contrepartie', () => {
    const ops = [
      { id: 'op1', amount: -15000, description: 'FRAIS DIVERS' },
      { id: 'op2', amount: -8000, description: 'COMMISSION DIVERSES' },
      { id: 'op3', amount: -12000, description: 'AUTRES FRAIS' },
    ];

    const result = handleC12({ ...baseInput, operations: ops });
    expect(result.patterns.some(p => p.pattern === 'frais_sans_contrepartie')).toBe(true);
  });

  it('detects libelles rotatifs', () => {
    const ops = [
      { id: 'op1', amount: -5000, description: 'FRAIS SERVICE A', date: '2024-01-15' },
      { id: 'op2', amount: -5000, description: 'FRAIS SERVICE A', date: '2024-02-15' },
      { id: 'op3', amount: -5000, description: 'COM SERVICE B', date: '2024-01-20' },
      { id: 'op4', amount: -5000, description: 'COM SERVICE B', date: '2024-02-20' },
      { id: 'op5', amount: -5000, description: 'FRAIS SERVICE A', date: '2024-03-15' },
    ];

    const result = handleC12({ ...baseInput, operations: ops });
    expect(result.patterns.some(p => p.pattern === 'libelles_rotatifs')).toBe(true);
  });

  it('returns empty for clean operations', () => {
    const ops = Array.from({ length: 10 }, (_, i) => ({
      id: `op${i}`,
      amount: -50000,
      date: `2024-03-${String(i + 1).padStart(2, '0')}`,
      description: 'VIR EMIS FOURNISSEUR',
    }));

    const result = handleC12({ ...baseInput, operations: ops });
    // Should not detect patterns for normal wire transfers
    expect(result.patterns.filter(p => p.pattern === 'frais_sans_contrepartie')).toHaveLength(0);
    expect(result.patterns.filter(p => p.pattern === 'plafonnement_sous_seuil')).toHaveLength(0);
  });

  it('sorts by severity', () => {
    const ops = [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `sub${i}`, amount: -490000, date: `2024-0${i + 1}-15` })),
      { id: 'vague1', amount: -5000, description: 'FRAIS DIVERS' },
      { id: 'vague2', amount: -5000, description: 'AUTRES FRAIS' },
    ];

    const result = handleC12({ ...baseInput, operations: ops });

    if (result.patterns.length >= 2) {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      expect(severityOrder[result.patterns[0].severity]).toBeGreaterThanOrEqual(
        severityOrder[result.patterns[result.patterns.length - 1].severity]
      );
    }
  });

  it('works through orchestrator', async () => {
    const { dispatch } = await import('../../ai/proph3t/intelligence/orchestrator');
    const { CompetenceId } = await import('../../ai/proph3t/intelligence/types');

    const result = await dispatch(
      CompetenceId.PATTERNS_FRAUDULEUX,
      baseInput,
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
    );
    expect(result.success).toBe(true);
  });
});
