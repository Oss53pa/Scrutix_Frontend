import { describe, it, expect } from 'vitest';
import { handleC9 } from '../../ai/proph3t/intelligence/handlers/C9RapportHandler';
import type { C9Input } from '../../ai/proph3t/intelligence/types';

function makeC9Input(overrides: Partial<C9Input> = {}): C9Input {
  return {
    analysis_id: 'a0000000-0000-4000-8000-000000000099',
    client_name: 'SARL Test Industries',
    period: { from: '2024-01-01', to: '2024-03-31' },
    accounts: ['CI001-12345-001', 'CI001-12345-002'],
    ecarts: [
      {
        code: 'E02',
        rubric: 'compte.tenue_mensuelle',
        expected_value: 5000,
        actual_value: 7500,
        delta_fcfa: 2500,
        period: { from: '2024-01-01', to: '2024-03-31' },
        operations_concerned: [{ id: 'op1' }],
        receipt: {},
      },
      {
        code: 'E03',
        rubric: 'decouverts.taux_autorise',
        expected_value: 120000,
        actual_value: 180000,
        delta_fcfa: 60000,
        period: { from: '2024-01-01', to: '2024-03-31' },
        operations_concerned: [{ id: 'op2' }, { id: 'op3' }],
        receipt: {},
      },
      {
        code: 'E01',
        rubric: 'cartes.cotisation_debit',
        expected_value: 10000,
        actual_value: 15000,
        delta_fcfa: 5000,
        period: { from: '2024-01-01', to: '2024-03-31' },
        operations_concerned: [{ id: 'op4' }],
        receipt: {},
      },
    ],
    tone: 'factuel',
    language: 'fr',
    ...overrides,
  };
}

describe('C9 — Generation rapport audit', () => {
  it('generates all 6 sections', () => {
    const result = handleC9(makeC9Input());

    expect(result.sections.page_de_garde).toBeDefined();
    expect(result.sections.resume_executif).toBeDefined();
    expect(result.sections.vue_par_categorie).toBeDefined();
    expect(result.sections.detail_ecarts_majeurs).toBeDefined();
    expect(result.sections.plan_action).toBeDefined();
    expect(result.sections.annexes).toBeDefined();
  });

  it('page de garde contains client info', () => {
    const result = handleC9(makeC9Input());

    expect(result.sections.page_de_garde).toContain('SARL Test Industries');
    expect(result.sections.page_de_garde).toContain('2024-01-01');
    expect(result.sections.page_de_garde).toContain('CI001-12345-001');
  });

  it('resume executif shows total and recoverable', () => {
    const result = handleC9(makeC9Input());

    // Total delta = 2500 + 60000 + 5000 = 67500
    expect(result.sections.resume_executif).toContain('67 500 FCFA');
    // Recoverable = 75% of 67500 ≈ 50625
    expect(result.total_ecarts).toBe(3);
    expect(result.montant_recuperable_estime).toBe(Math.round(67500 * 0.75));
  });

  it('vue par categorie groups by ecart code', () => {
    const result = handleC9(makeC9Input());

    expect(result.sections.vue_par_categorie).toContain('E01');
    expect(result.sections.vue_par_categorie).toContain('E02');
    expect(result.sections.vue_par_categorie).toContain('E03');
  });

  it('detail ecarts majeurs uses C8 for explanation', () => {
    const result = handleC9(makeC9Input());

    // The largest ecart is E03 (60000), should appear first
    expect(result.sections.detail_ecarts_majeurs).toContain('decouverts.taux_autorise');
    expect(result.sections.detail_ecarts_majeurs).toContain('60 000 FCFA');
    // Should contain recoverability assessment
    expect(result.sections.detail_ecarts_majeurs).toMatch(/forte|moyenne|faible/);
  });

  it('plan action prioritizes by amount', () => {
    const result = handleC9(makeC9Input());

    // 60000 is > 10000 so should be PRIORITE MOYENNE
    expect(result.sections.plan_action).toContain('PRIORITE');
  });

  it('annexes list all ecarts', () => {
    const result = handleC9(makeC9Input());

    expect(result.sections.annexes).toContain('compte.tenue_mensuelle');
    expect(result.sections.annexes).toContain('decouverts.taux_autorise');
    expect(result.sections.annexes).toContain('cartes.cotisation_debit');
  });

  it('validates report — all amounts from source data', () => {
    const result = handleC9(makeC9Input());

    expect(result.validation_ok).toBe(true);
    expect(result.validation_errors).toHaveLength(0);
  });

  it('adapts tone for assertif', () => {
    const factuel = handleC9(makeC9Input({ tone: 'factuel' }));
    const assertif = handleC9(makeC9Input({ tone: 'assertif' }));

    expect(factuel.sections.resume_executif).toContain('presente les resultats');
    expect(assertif.sections.resume_executif).toContain('met en evidence');
  });

  it('adapts tone for pedagogique', () => {
    const result = handleC9(makeC9Input({ tone: 'pedagogique' }));

    expect(result.sections.resume_executif).toContain('objectif d\'expliquer');
  });

  it('handles single ecart', () => {
    const result = handleC9(makeC9Input({
      ecarts: [{
        code: 'E07',
        rubric: 'divers.frais_mystere',
        expected_value: 0,
        actual_value: 25000,
        delta_fcfa: 25000,
        period: { from: '2024-01-01', to: '2024-03-31' },
        operations_concerned: [],
        receipt: {},
      }],
    }));

    expect(result.total_ecarts).toBe(1);
    expect(result.sections.vue_par_categorie).toContain('E07');
  });

  it('works through orchestrator dispatch', async () => {
    const { dispatch } = await import('../../ai/proph3t/intelligence/orchestrator');
    const { CompetenceId } = await import('../../ai/proph3t/intelligence/types');

    const result = await dispatch(
      CompetenceId.RAPPORT_AUDIT,
      makeC9Input(),
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
    );

    expect(result.success).toBe(true);
    if (result.success) {
      const output = result.response.output as { total_ecarts: number; validation_ok: boolean };
      expect(output.total_ecarts).toBe(3);
      expect(output.validation_ok).toBe(true);
      expect(result.response.trace.confidence_score).toBe(90);
    }
  });
});
