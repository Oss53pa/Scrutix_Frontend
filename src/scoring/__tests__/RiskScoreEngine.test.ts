import { describe, it, expect } from 'vitest';
import { RiskScoreEngine } from '../RiskScoreEngine';
import { AnomalyType, Severity, TransactionType } from '../../types';
import type { Anomaly, Transaction } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `tx-${Math.random().toString(36).slice(2, 8)}`,
    clientId: 'client-1',
    accountNumber: '1234567890',
    bankCode: 'SGCI',
    bankName: 'SGCI',
    date: new Date('2026-01-15'),
    valueDate: new Date('2026-01-15'),
    amount: 100000,
    balance: 1000000,
    description: 'Virement reçu',
    type: TransactionType.CREDIT,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeAnomaly(severity: Severity, type: AnomalyType = AnomalyType.OVERCHARGE): Anomaly {
  return {
    id: `a-${Math.random().toString(36).slice(2, 8)}`,
    type,
    severity,
    confidence: 0.9,
    amount: 5000,
    transactions: [],
    evidence: [],
    recommendation: '',
    status: 'pending',
    detectedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RiskScoreEngine.compute', () => {
  it('returns score 0 / level low for an empty input', () => {
    const result = RiskScoreEngine.compute({
      clientId: 'c1',
      anomalies: [],
      transactions: [],
    });
    expect(result.score).toBe(0);
    expect(result.level).toBe('low');
    expect(result.dimensions.anomalies).toBe(0);
    expect(result.dimensions.fees).toBe(0);
  });

  it('caps the anomalies dimension at 40 even with many critical anomalies', () => {
    const anomalies = Array.from({ length: 20 }, () => makeAnomaly(Severity.CRITICAL));
    const transactions = Array.from({ length: 100 }, () => makeTx());
    const result = RiskScoreEngine.compute({
      clientId: 'c1',
      anomalies,
      transactions,
    });
    expect(result.dimensions.anomalies).toBeLessThanOrEqual(40);
  });

  it('classifies score 0-25 as low', () => {
    expect(RiskScoreEngine.scoreToLevel(0)).toBe('low');
    expect(RiskScoreEngine.scoreToLevel(25)).toBe('low');
  });

  it('classifies score 26-50 as moderate', () => {
    expect(RiskScoreEngine.scoreToLevel(26)).toBe('moderate');
    expect(RiskScoreEngine.scoreToLevel(50)).toBe('moderate');
  });

  it('classifies score 51-75 as high', () => {
    expect(RiskScoreEngine.scoreToLevel(51)).toBe('high');
    expect(RiskScoreEngine.scoreToLevel(75)).toBe('high');
  });

  it('classifies score 76-100 as critical', () => {
    expect(RiskScoreEngine.scoreToLevel(76)).toBe('critical');
    expect(RiskScoreEngine.scoreToLevel(100)).toBe('critical');
  });

  it('weights critical anomalies more heavily than low ones', () => {
    const lowOnly = RiskScoreEngine.compute({
      clientId: 'c1',
      anomalies: Array.from({ length: 5 }, () => makeAnomaly(Severity.LOW)),
      transactions: [makeTx()],
    });
    const criticalOnly = RiskScoreEngine.compute({
      clientId: 'c1',
      anomalies: Array.from({ length: 5 }, () => makeAnomaly(Severity.CRITICAL)),
      transactions: [makeTx()],
    });
    expect(criticalOnly.score).toBeGreaterThan(lowOnly.score);
  });

  it('credits compliance dimension when complianceRate is given', () => {
    const result = RiskScoreEngine.compute({
      clientId: 'c1',
      anomalies: [],
      transactions: [makeTx()],
      complianceRate: 0.5, // 50% conforme
    });
    // (1 - 0.5) * 20 = 10 points
    expect(result.dimensions.compliance).toBe(10);
  });

  it('counts AML alerts in the patterns dimension', () => {
    const result = RiskScoreEngine.compute({
      clientId: 'c1',
      anomalies: [
        makeAnomaly(Severity.HIGH, AnomalyType.AML_ALERT),
        makeAnomaly(Severity.HIGH, AnomalyType.AML_ALERT),
      ],
      transactions: [makeTx()],
    });
    // 2 AML * 5 pts = 10
    expect(result.dimensions.patterns).toBe(10);
  });

  it('caps the patterns dimension at 15', () => {
    const result = RiskScoreEngine.compute({
      clientId: 'c1',
      anomalies: Array.from({ length: 10 }, () => makeAnomaly(Severity.HIGH, AnomalyType.AML_ALERT)),
      transactions: [makeTx()],
    });
    expect(result.dimensions.patterns).toBeLessThanOrEqual(15);
  });

  it('detects fees from FEE-type transactions and computes feeRatio', () => {
    const transactions: Transaction[] = [
      makeTx({ amount: 100000, type: TransactionType.CREDIT }),
      makeTx({ amount: 5000, type: TransactionType.FEE, description: 'Frais de tenue de compte' }),
      makeTx({ amount: 1000, type: TransactionType.FEE, description: 'Commission virement' }),
    ];
    const result = RiskScoreEngine.compute({
      clientId: 'c1',
      anomalies: [],
      transactions,
    });
    expect(result.metadata.totalFees).toBeCloseTo(6000, 0);
    expect(result.metadata.totalAmount).toBeCloseTo(106000, 0);
    expect(result.metadata.feeRatio).toBeGreaterThan(0);
  });

  it('produces a deterministic score for the same inputs', () => {
    const input = {
      clientId: 'c1',
      anomalies: [makeAnomaly(Severity.HIGH), makeAnomaly(Severity.MEDIUM)],
      transactions: [makeTx(), makeTx()],
    };
    const a = RiskScoreEngine.compute(input);
    const b = RiskScoreEngine.compute(input);
    expect(a.score).toBe(b.score);
    expect(a.dimensions).toEqual(b.dimensions);
  });

  it('escalates compliance score to 20 when complianceRate is 0', () => {
    const result = RiskScoreEngine.compute({
      clientId: 'c1',
      anomalies: [],
      transactions: [makeTx()],
      complianceRate: 0,
    });
    expect(result.dimensions.compliance).toBe(20);
  });
});
