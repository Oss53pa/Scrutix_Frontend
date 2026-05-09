// ============================================================================
// Tests — AgiosCalculator (méthode des nombres)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { AgiosCalculator } from '../calculations/AgiosCalculator';
import type { DailyPosition, ResolutionResult } from '../types';

function makeResolution(value: number): ResolutionResult {
  return {
    value,
    formula: null,
    receipt: {
      layerUsed: 2,
      sourceId: 'test',
      sourceLabel: 'Test',
      validFrom: new Date('2025-01-01'),
      validTo: null,
      supersededLayers: [],
      regulatoryViolations: [],
    },
    resolvedAt: new Date(),
  };
}

function makePositions(balances: number[]): DailyPosition[] {
  return balances.map((b, i) => ({
    date: new Date(2025, 0, i + 1),
    balanceCentimes: BigInt(Math.round(b * 100)),
    isDebit: b < 0,
  }));
}

describe('AgiosCalculator', () => {
  const calc = new AgiosCalculator();

  it('calcule les agios sur 30 jours débiteurs à 12%', () => {
    // 30 days at -1,000,000 FCFA, rate 12%, base 360
    const positions = makePositions(Array(30).fill(-1_000_000));
    const result = calc.calculate(
      positions,
      makeResolution(12),
      makeResolution(18),
      { base: 360, plafondAutoriseCentimes: 0n },
    );

    // agios = 1,000,000 * 30 * 12 / 36000 = 10,000 FCFA
    // Allow small rounding error from integer arithmetic (±10 centimes)
    expect(Number(result.totalAgiosCentimes)).toBeCloseTo(1_000_000, -2);
    expect(result.nombreJoursDebiteurs).toBe(30);
    expect(result.tauxApplique).toBe(12);
    expect(result.base).toBe(360);
  });

  it('sépare autorisé / non autorisé avec plafond', () => {
    // 10 days at -2,000,000 FCFA, plafond autorisé 1,000,000
    const positions = makePositions(Array(10).fill(-2_000_000));
    const result = calc.calculate(
      positions,
      makeResolution(12),
      makeResolution(18),
      { base: 360, plafondAutoriseCentimes: 100_000_000n }, // 1M FCFA in centimes
    );

    // Authorized: 1M * 10 * 12 / 36000 = 3,333.33 FCFA
    // Unauthorized: 1M * 10 * 18 / 36000 = 5,000 FCFA
    expect(Number(result.agiosAutoriseCentimes)).toBeGreaterThan(0);
    expect(Number(result.agiosNonAutoriseCentimes)).toBeGreaterThan(0);
    expect(result.nombreJoursDebiteurs).toBe(10);
    expect(result.details.every(d => d.zone === 'non_autorise')).toBe(true);
  });

  it('retourne 0 si aucun jour débiteur', () => {
    const positions = makePositions([500_000, 1_000_000, 200_000]);
    const result = calc.calculate(
      positions,
      makeResolution(12),
      makeResolution(18),
    );

    expect(Number(result.totalAgiosCentimes)).toBe(0);
    expect(result.nombreJoursDebiteurs).toBe(0);
  });

  it('détecte une surfacturation via verify', () => {
    const positions = makePositions(Array(30).fill(-1_000_000));
    // Bank charged 15,000 FCFA but theoretical is ~10,000
    const factures = 1_500_000n; // 15,000 FCFA in centimes

    const { ecartCentimes, isOvercharge } = calc.verifyAgios(
      factures,
      positions,
      makeResolution(12),
      makeResolution(18),
    );

    expect(isOvercharge).toBe(true);
    expect(Number(ecartCentimes)).toBeGreaterThan(0);
  });
});
