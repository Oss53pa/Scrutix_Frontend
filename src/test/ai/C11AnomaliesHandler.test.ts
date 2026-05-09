import { describe, it, expect } from 'vitest';
import { handleC11 } from '../../ai/proph3t/intelligence/handlers/C11AnomaliesHandler';
import type { C11Input } from '../../ai/proph3t/intelligence/types';

describe('C11 — Detection anomalies statistiques', () => {
  it('detects amount outliers via Z-score', () => {
    const ops = [
      ...Array.from({ length: 20 }, (_, i) => ({ id: `op${i}`, amount: -5000, date: '2024-03-15' })),
      { id: 'outlier', amount: -500000, date: '2024-03-15' },
    ];
    const result = handleC11({ operations: ops });

    expect(result.anomalies.some(a => a.anomaly_type === 'amount_outlier' && a.operation_id === 'outlier')).toBe(true);
  });

  it('detects semantic duplicates (same date, same amount)', () => {
    const ops = [
      { id: 'op1', amount: -25000, date: '2024-03-15', description: 'FRAIS TENUE DE COMPTE' },
      { id: 'op2', amount: -25000, date: '2024-03-15', description: 'FRAIS TENUE COMPTE' },
    ];
    const result = handleC11({ operations: ops });

    expect(result.anomalies.some(a => a.anomaly_type === 'semantic_duplicate')).toBe(true);
  });

  it('does not flag different-date same-amount as duplicates', () => {
    const ops = [
      { id: 'op1', amount: -25000, date: '2024-03-15', description: 'FRAIS TDC' },
      { id: 'op2', amount: -25000, date: '2024-04-15', description: 'FRAIS TDC' },
    ];
    const result = handleC11({ operations: ops });

    expect(result.anomalies.filter(a => a.anomaly_type === 'semantic_duplicate')).toHaveLength(0);
  });

  it('handles empty input', () => {
    const result = handleC11({ operations: [] });
    expect(result.anomalies).toHaveLength(0);
  });

  it('needs minimum data for Z-score', () => {
    const result = handleC11({ operations: [{ id: '1', amount: -5000, date: '2024-01-01' }] });
    expect(result.anomalies.filter(a => a.anomaly_type === 'amount_outlier')).toHaveLength(0);
  });

  it('sorts by severity then confidence', () => {
    const ops = [
      ...Array.from({ length: 20 }, (_, i) => ({ id: `op${i}`, amount: -5000, date: '2024-03-15' })),
      { id: 'outlier1', amount: -1000000, date: '2024-03-15' },
      { id: 'dup1', amount: -5000, date: '2024-03-15', description: 'FRAIS A' },
      { id: 'dup2', amount: -5000, date: '2024-03-15', description: 'FRAIS A' },
    ];
    const result = handleC11({ operations: ops });

    if (result.anomalies.length >= 2) {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      for (let i = 1; i < result.anomalies.length; i++) {
        expect(severityOrder[result.anomalies[i - 1].severity]).toBeGreaterThanOrEqual(
          severityOrder[result.anomalies[i].severity]
        );
      }
    }
  });

  it('works through orchestrator', async () => {
    const { dispatch } = await import('../../ai/proph3t/intelligence/orchestrator');
    const { CompetenceId } = await import('../../ai/proph3t/intelligence/types');

    const result = await dispatch(
      CompetenceId.ANOMALIES_STATS,
      { operations: [{ id: '1', amount: -5000, date: '2024-01-01' }] },
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
    );
    expect(result.success).toBe(true);
  });
});
