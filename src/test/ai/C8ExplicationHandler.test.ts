import { describe, it, expect } from 'vitest';
import { handleC8 } from '../../ai/proph3t/intelligence/handlers/C8ExplicationHandler';
import type { C8Input } from '../../ai/proph3t/intelligence/types';

function makeC8Input(overrides: Partial<C8Input['ecart']> = {}, audience: C8Input['audience'] = 'daf'): C8Input {
  return {
    ecart: {
      code: 'E02',
      rubric: 'compte.tenue_mensuelle',
      expected_value: 5000,
      actual_value: 7500,
      delta_fcfa: 2500,
      period: { from: '2024-01-01', to: '2024-03-31' },
      operations_concerned: [{ id: 'op1', amount: 7500 }],
      receipt: { source: 'convention', version: '2024-01' },
      ...overrides,
    },
    audience,
    language: 'fr',
  };
}

describe('C8 — Explication des ecarts', () => {
  it('generates short description with amount and code', () => {
    const result = handleC8(makeC8Input());

    expect(result.short_description).toContain('E02');
    expect(result.short_description).toContain('2 500 FCFA');
    expect(result.short_description).toContain('compte.tenue_mensuelle');
  });

  it('generates detailed explanation with period and amounts', () => {
    const result = handleC8(makeC8Input());

    expect(result.detailed_explanation).toContain('2024-01-01');
    expect(result.detailed_explanation).toContain('2024-03-31');
    expect(result.detailed_explanation).toContain('5 000 FCFA');
    expect(result.detailed_explanation).toContain('7 500 FCFA');
    expect(result.detailed_explanation).toContain('2 500 FCFA');
  });

  it('includes legal basis for E02', () => {
    const result = handleC8(makeC8Input());

    expect(result.legal_basis).not.toBeNull();
    expect(result.legal_basis).toContain('Article 1103');
  });

  it('returns null legal basis for E01', () => {
    const result = handleC8(makeC8Input({ code: 'E01' }));
    expect(result.legal_basis).toBeNull();
  });

  it('includes legal basis for E03 (interest errors)', () => {
    const result = handleC8(makeC8Input({ code: 'E03' }));
    expect(result.legal_basis).toContain('COBAC');
  });

  it('generates recommendation for positive delta (overcharge)', () => {
    const result = handleC8(makeC8Input());

    expect(result.recommended_action).toContain('reclamation');
    expect(result.recommended_action).toContain('2 500 FCFA');
  });

  it('generates recommendation for negative delta (undercharge)', () => {
    const result = handleC8(makeC8Input({ delta_fcfa: -1000 }));

    expect(result.recommended_action).toContain('faveur du client');
  });

  it('assesses recoverability as forte for E02 with legal basis', () => {
    const result = handleC8(makeC8Input());
    expect(result.recoverability_assessment).toBe('forte');
  });

  it('assesses recoverability as faible for tiny amounts', () => {
    const result = handleC8(makeC8Input({ delta_fcfa: 500 }));
    expect(result.recoverability_assessment).toBe('faible');
  });

  it('adapts detail level for dirigeant audience', () => {
    const dafResult = handleC8(makeC8Input({}, 'daf'));
    const dirigeantResult = handleC8(makeC8Input({}, 'dirigeant'));

    // DAF gets more detail (technical paragraphs)
    expect(dafResult.detailed_explanation.length).toBeGreaterThan(dirigeantResult.detailed_explanation.length);
  });

  it('works through orchestrator dispatch', async () => {
    const { dispatch } = await import('../../ai/proph3t/intelligence/orchestrator');
    const { CompetenceId } = await import('../../ai/proph3t/intelligence/types');

    const result = await dispatch(
      CompetenceId.EXPLICATION_ECARTS,
      makeC8Input(),
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
    );

    expect(result.success).toBe(true);
    if (result.success) {
      const output = result.response.output as { short_description: string };
      expect(output.short_description).toContain('E02');
      expect(result.response.trace.confidence_score).toBe(85);
    }
  });
});
