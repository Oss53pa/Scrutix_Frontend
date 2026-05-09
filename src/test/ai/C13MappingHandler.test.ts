import { describe, it, expect } from 'vitest';
import { handleC13 } from '../../ai/proph3t/intelligence/handlers/C13MappingHandler';
import type { C13Input } from '../../ai/proph3t/intelligence/types';

describe('C13 — Mapping rubriques inter-banques', () => {
  it('maps standard bank fee label to rubric', () => {
    const input: C13Input = { label: 'FRAIS TENUE DE COMPTE' };
    const result = handleC13(input);

    expect(result.best_match).not.toBeNull();
    expect(result.mappings.length).toBeGreaterThan(0);
    // Should find tenue de compte rubric
    expect(result.mappings.some(m => m.rubric_code.includes('compte'))).toBe(true);
  });

  it('maps commission mouvement', () => {
    const input: C13Input = { label: 'Commission de mouvement' };
    const result = handleC13(input);

    expect(result.best_match).not.toBeNull();
    expect(result.mappings.some(m =>
      m.rubric_code.includes('commission') || m.rubric_code.includes('mouvement')
    )).toBe(true);
  });

  it('maps virement international', () => {
    const input: C13Input = { label: 'Virement SWIFT international' };
    const result = handleC13(input);

    expect(result.mappings.some(m => m.rubric_code.includes('swift') || m.rubric_code.includes('international'))).toBe(true);
  });

  it('maps CPFD', () => {
    const input: C13Input = { label: 'CPFD' };
    const result = handleC13(input);

    expect(result.best_match).not.toBeNull();
    // DeterministicPreFilter should catch CPFD
    expect(result.mappings.some(m => m.rubric_code.includes('cpfd') || m.justification.includes('deterministe'))).toBe(true);
  });

  it('respects top_k parameter', () => {
    const input: C13Input = { label: 'frais bancaires divers', top_k: 3 };
    const result = handleC13(input);

    expect(result.mappings.length).toBeLessThanOrEqual(3);
  });

  it('returns empty for completely unknown labels', () => {
    const input: C13Input = { label: 'XYZQWERTY123' };
    const result = handleC13(input);

    expect(result.best_match).toBeNull();
    expect(result.mappings).toHaveLength(0);
  });

  it('includes justification for each mapping', () => {
    const input: C13Input = { label: 'Carte Visa Classic cotisation annuelle' };
    const result = handleC13(input);

    for (const m of result.mappings) {
      expect(m.justification.length).toBeGreaterThan(0);
    }
  });

  it('works through orchestrator dispatch', async () => {
    const { dispatch } = await import('../../ai/proph3t/intelligence/orchestrator');
    const { CompetenceId } = await import('../../ai/proph3t/intelligence/types');

    const result = await dispatch(
      CompetenceId.MAPPING_RUBRIQUES,
      { label: 'Agios debiteurs trimestriels' },
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
    );

    expect(result.success).toBe(true);
    if (result.success) {
      const output = result.response.output as { best_match: { rubric_code: string } | null };
      expect(output.best_match).not.toBeNull();
    }
  });
});
