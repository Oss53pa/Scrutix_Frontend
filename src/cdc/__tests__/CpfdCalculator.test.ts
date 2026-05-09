// ============================================================================
// Tests — CpfdCalculator
// ============================================================================

import { describe, it, expect } from 'vitest';
import { CpfdCalculator } from '../calculations/CpfdCalculator';
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

describe('CpfdCalculator', () => {
  const calc = new CpfdCalculator();

  it('calcule la CPFD sur le plus fort découvert', () => {
    const positions: DailyPosition[] = [
      { date: new Date('2025-01-01'), balanceCentimes: -500_000_00n, isDebit: true },
      { date: new Date('2025-01-15'), balanceCentimes: -2_000_000_00n, isDebit: true }, // max
      { date: new Date('2025-01-30'), balanceCentimes: -800_000_00n, isDebit: true },
    ];

    const result = calc.calculate(
      positions,
      makeResolution(0.5), // 0.5% CPFD
      null,
      10_000_00n, // interets debiteurs
    );

    // CPFD = 2,000,000 * 0.5 / 100 = 10,000 FCFA
    expect(Number(result.cpfdCentimes)).toBe(1_000_000); // 10,000 * 100 centimes
    expect(Number(result.plusFortDecouvertCentimes)).toBe(200_000_000); // 2M * 100
    expect(result.tauxCpfd).toBe(0.5);
  });

  it('détecte une violation réglementaire du plafond CPFD', () => {
    const positions: DailyPosition[] = [
      { date: new Date('2025-01-15'), balanceCentimes: -10_000_000_00n, isDebit: true },
    ];

    const interetsDebiteurs = 500_000n; // 5,000 FCFA in centimes
    // CPFD = 10M * 1% = 100,000 FCFA
    // Plafond = 50% of 5,000 = 2,500 FCFA → VIOLATION

    const result = calc.calculate(
      positions,
      makeResolution(1.0),
      makeResolution(50), // 50% cap
      interetsDebiteurs,
    );

    expect(result.isViolation).toBe(true);
    expect(result.plafondReglementaireCentimes).not.toBeNull();
  });
});
