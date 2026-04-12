import { describe, it, expect } from 'vitest';
import { FrequencyPatternDetector } from '../detectors/FrequencyPatternDetector';
import type { ClientHistory } from '../types';

function day(iso: string): Date {
  return new Date(iso);
}

function makeHistory(
  transactions: Array<{ id: string; date: Date; amount: number; description: string }>,
): ClientHistory {
  return {
    clientId: 'c1',
    transactions,
    windowDays: 90,
  };
}

describe('FrequencyPatternDetector', () => {
  it('returns empty when nothing recurs', () => {
    const history = makeHistory([
      { id: '1', date: day('2026-01-01'), amount: 1000, description: 'Achat unique boulangerie' },
      { id: '2', date: day('2026-02-15'), amount: 5000, description: 'Facture eau nationale' },
    ]);
    const patterns = FrequencyPatternDetector.detect(history);
    expect(patterns).toHaveLength(0);
  });

  it('detects a weekly recurring fee', () => {
    const history = makeHistory([
      { id: '1', date: day('2026-01-05'), amount: 500, description: 'Commission hebdomadaire abonnement' },
      { id: '2', date: day('2026-01-12'), amount: 500, description: 'Commission hebdomadaire abonnement' },
      { id: '3', date: day('2026-01-19'), amount: 500, description: 'Commission hebdomadaire abonnement' },
      { id: '4', date: day('2026-01-26'), amount: 500, description: 'Commission hebdomadaire abonnement' },
    ]);
    const patterns = FrequencyPatternDetector.detect(history);
    expect(patterns.length).toBeGreaterThan(0);
    const weekly = patterns.find((p) => p.pattern === 'weekly');
    expect(weekly).toBeDefined();
    expect(weekly!.cycleDays).toBe(7);
    expect(weekly!.occurrences).toHaveLength(4);
  });

  it('detects a monthly recurring fee', () => {
    const history = makeHistory([
      { id: '1', date: day('2026-01-01'), amount: 2000, description: 'Frais mensuels tenue compte' },
      { id: '2', date: day('2026-02-01'), amount: 2000, description: 'Frais mensuels tenue compte' },
      { id: '3', date: day('2026-03-01'), amount: 2000, description: 'Frais mensuels tenue compte' },
      { id: '4', date: day('2026-04-01'), amount: 2000, description: 'Frais mensuels tenue compte' },
    ]);
    const patterns = FrequencyPatternDetector.detect(history);
    const monthly = patterns.find((p) => p.pattern === 'monthly');
    expect(monthly).toBeDefined();
    expect(monthly!.cycleDays).toBe(30);
  });

  it('detects an escalating pattern', () => {
    const history = makeHistory([
      { id: '1', date: day('2026-01-01'), amount: 1000, description: 'Commission retrait guichet' },
      { id: '2', date: day('2026-02-01'), amount: 2000, description: 'Commission retrait guichet' },
      { id: '3', date: day('2026-03-01'), amount: 3500, description: 'Commission retrait guichet' },
    ]);
    const patterns = FrequencyPatternDetector.detect(history);
    const escalating = patterns.find((p) => p.pattern === 'escalating');
    expect(escalating).toBeDefined();
  });

  it('scores transactions involved in a detected pattern', () => {
    const history = makeHistory([
      { id: '1', date: day('2026-01-05'), amount: 500, description: 'Commission hebdomadaire abonnement' },
      { id: '2', date: day('2026-01-12'), amount: 500, description: 'Commission hebdomadaire abonnement' },
      { id: '3', date: day('2026-01-19'), amount: 500, description: 'Commission hebdomadaire abonnement' },
      { id: '4', date: day('2026-01-26'), amount: 500, description: 'Commission hebdomadaire abonnement' },
    ]);
    const scores = FrequencyPatternDetector.detectScores(history);
    expect(scores.size).toBeGreaterThan(0);
    for (const s of scores.values()) {
      expect(s.score).toBeGreaterThan(0);
      expect(s.confidence).toBe(0.75);
    }
  });
});
