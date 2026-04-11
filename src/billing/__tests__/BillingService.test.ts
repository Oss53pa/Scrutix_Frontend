import { describe, it, expect } from 'vitest';
import { BillingService } from '../BillingService';

describe('BillingService.computeTotals', () => {
  it('returns zeros for an empty line array', () => {
    const r = BillingService.computeTotals([], 18);
    expect(r.subtotal).toBe(0);
    expect(r.tax).toBe(0);
    expect(r.total).toBe(0);
  });

  it('computes the subtotal as quantity * unit price', () => {
    const r = BillingService.computeTotals(
      [{ quantity: 2, unitPriceFcfa: 50000 }, { quantity: 1, unitPriceFcfa: 25000 }],
      0,
    );
    expect(r.subtotal).toBe(125000);
    expect(r.tax).toBe(0);
    expect(r.total).toBe(125000);
  });

  it('applies the TVA rate to the subtotal', () => {
    const r = BillingService.computeTotals(
      [{ quantity: 1, unitPriceFcfa: 100000 }],
      18,
    );
    expect(r.subtotal).toBe(100000);
    expect(r.tax).toBe(18000);
    expect(r.total).toBe(118000);
  });

  it('rounds tax to the nearest FCFA (no centimes)', () => {
    const r = BillingService.computeTotals(
      [{ quantity: 1, unitPriceFcfa: 12345 }],
      18,
    );
    // 12345 * 0.18 = 2222.1 → rounded to 2222
    expect(r.tax).toBe(2222);
    expect(r.total).toBe(14567);
  });

  it('handles a zero tax rate (exonération)', () => {
    const r = BillingService.computeTotals(
      [{ quantity: 3, unitPriceFcfa: 75000 }],
      0,
    );
    expect(r.subtotal).toBe(225000);
    expect(r.tax).toBe(0);
    expect(r.total).toBe(225000);
  });

  it('handles fractional quantities', () => {
    const r = BillingService.computeTotals(
      [{ quantity: 1.5, unitPriceFcfa: 100000 }],
      18,
    );
    expect(r.subtotal).toBe(150000);
    expect(r.tax).toBe(27000);
    expect(r.total).toBe(177000);
  });

  it('sums many lines correctly', () => {
    const lines = Array.from({ length: 10 }, (_, i) => ({
      quantity: 1,
      unitPriceFcfa: 10000 * (i + 1),
    }));
    // 10k + 20k + ... + 100k = 550k
    const r = BillingService.computeTotals(lines, 18);
    expect(r.subtotal).toBe(550000);
    expect(r.tax).toBe(99000);
    expect(r.total).toBe(649000);
  });
});
