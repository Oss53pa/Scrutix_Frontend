import { describe, it, expect } from 'vitest';
import { IsolationForestDetector } from '../detectors/IsolationForestDetector';
import type { TransactionFeatureVector } from '../types';

function makeVector(
  id: string,
  amount: number,
  zscore = 0,
  frequency30d = 5,
  hour = 12,
): TransactionFeatureVector {
  return {
    transactionId: id,
    amount,
    dayOfWeek: 1,
    hour,
    merchantCategory: 'generic',
    frequency30d,
    zscore,
    timestamp: Date.now(),
  };
}

describe('IsolationForestDetector', () => {
  it('returns low-confidence zero scores when sample is too small', () => {
    const vectors = [makeVector('a', 100), makeVector('b', 200)];
    const result = IsolationForestDetector.detect(vectors);
    expect(result.size).toBe(2);
    for (const score of result.values()) {
      expect(score.score).toBe(0);
      expect(score.confidence).toBe(0);
    }
  });

  it('flags a clear outlier in a homogeneous sample', () => {
    const vectors: TransactionFeatureVector[] = [];
    // 40 normal values around 100
    for (let i = 0; i < 40; i++) {
      vectors.push(makeVector(`n-${i}`, 100 + i, 0, 5, 12));
    }
    // One extreme outlier at 100 000
    vectors.push(makeVector('outlier', 100000, 6, 100, 3));

    const result = IsolationForestDetector.detect(vectors);
    const outlierScore = result.get('outlier');
    expect(outlierScore).toBeDefined();
    expect(outlierScore!.score).toBeGreaterThan(0.4);
  });

  it('does not flag normal transactions', () => {
    const vectors: TransactionFeatureVector[] = [];
    for (let i = 0; i < 50; i++) {
      vectors.push(makeVector(`n-${i}`, 10000 + i * 10, 0.1, 5, 12));
    }
    const result = IsolationForestDetector.detect(vectors);
    // Au plus quelques-uns aux extrêmes
    const flagged = [...result.values()].filter((s) => s.score >= 0.5);
    expect(flagged.length).toBeLessThanOrEqual(5);
  });

  it('getAnomalyThreshold returns a stable 0.5', () => {
    expect(IsolationForestDetector.getAnomalyThreshold()).toBe(0.5);
  });

  it('exposes CONTAMINATION_EXPECTED and MIN_SAMPLES', () => {
    expect(IsolationForestDetector.CONTAMINATION_EXPECTED).toBe(0.05);
    expect(IsolationForestDetector.MIN_SAMPLES).toBe(30);
  });
});
