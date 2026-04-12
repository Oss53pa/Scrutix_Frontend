import { describe, it, expect } from 'vitest';
import { BenfordLawChecker } from '../detectors/BenfordLawChecker';

describe('BenfordLawChecker', () => {
  it('returns null below minimum sample size', () => {
    const r = BenfordLawChecker.analyze([1, 2, 3]);
    expect(r).toBeNull();
  });

  it('flags a uniform distribution as high risk (very un-Benford)', () => {
    // 90 valeurs uniformément distribuées sur [100, 1000)
    // → chaque chiffre initial a ~1/9 ≈ 11% de probabilité, très loin de Benford
    const amounts: number[] = [];
    for (let i = 0; i < 90; i++) {
      amounts.push(100 + (i * 900) / 90);
    }
    const r = BenfordLawChecker.analyze(amounts);
    expect(r).not.toBeNull();
    expect(r!.riskLevel).not.toBe('low');
    expect(r!.chiSquare).toBeGreaterThan(0);
  });

  it('returns low risk for a sample following Benford', () => {
    // Génère un jeu synthétique qui suit approximativement Benford
    // en utilisant des puissances de 10 et des valeurs naturelles.
    const amounts: number[] = [];
    // Pour chaque chiffre 1..9, on en ajoute N_d proportionnels à P(d)
    const P = [0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];
    const totalTarget = 500;
    for (let d = 1; d <= 9; d++) {
      const count = Math.round(P[d - 1] * totalTarget);
      for (let i = 0; i < count; i++) {
        // Valeur aléatoire dont le premier chiffre est d
        const magnitude = 10 ** (1 + (i % 3));
        amounts.push(d * magnitude + (i % 10));
      }
    }
    const r = BenfordLawChecker.analyze(amounts);
    expect(r).not.toBeNull();
    expect(r!.riskLevel).toBe('low');
  });

  it('ignores negative and zero amounts', () => {
    const amounts = [...Array(60).fill(0), ...Array(60).fill(-100)];
    const r = BenfordLawChecker.analyze(amounts);
    // Pas assez de montants positifs → null
    expect(r).toBeNull();
  });

  it('computes observed/expected arrays of length 9', () => {
    const amounts: number[] = [];
    for (let i = 1; i <= 200; i++) amounts.push(i);
    const r = BenfordLawChecker.analyze(amounts);
    expect(r).not.toBeNull();
    expect(r!.observed).toHaveLength(9);
    expect(r!.expected).toHaveLength(9);
    // Les proportions doivent sommer à ~1
    const sum = r!.observed.reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1, 1);
  });

  it('produces a pValue between 0 and 1', () => {
    const amounts = Array.from({ length: 100 }, (_, i) => (i + 1) * 100);
    const r = BenfordLawChecker.analyze(amounts);
    expect(r).not.toBeNull();
    expect(r!.pValue).toBeGreaterThanOrEqual(0);
    expect(r!.pValue).toBeLessThanOrEqual(1);
  });
});
