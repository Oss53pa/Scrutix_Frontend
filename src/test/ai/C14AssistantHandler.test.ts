import { describe, it, expect } from 'vitest';
import { handleC14 } from '../../ai/proph3t/intelligence/handlers/C14AssistantHandler';
import type { C14Input } from '../../ai/proph3t/intelligence/types';

describe('C14 — Assistant saisie split-screen', () => {
  it('warns when value is out of typical range', () => {
    const input: C14Input = {
      current_field: 'tenueCompte',
      current_value: 100000,
      rubric_code: 'compte.tenue_mensuelle',
      all_values: {},
    };
    const result = handleC14(input);

    expect(result.suggestions.some(s => s.type === 'coherence_inter_banques')).toBe(true);
    expect(result.suggestions.some(s => s.severity === 'warning')).toBe(true);
  });

  it('suggests median when value is out of range', () => {
    const input: C14Input = {
      current_field: 'tenueCompte',
      current_value: 500000,
      rubric_code: 'compte.tenue_mensuelle',
      all_values: {},
    };
    const result = handleC14(input);

    const rangeSuggestion = result.suggestions.find(s => s.type === 'coherence_inter_banques');
    expect(rangeSuggestion?.suggested_value).toBe(5000);
  });

  it('detects L1 violation for excessive interest rate', () => {
    const input: C14Input = {
      current_field: 'tauxAutorise',
      current_value: 22,
      rubric_code: 'decouverts.taux_autorise',
      all_values: {},
    };
    const result = handleC14(input);

    expect(result.suggestions.some(s => s.type === 'violation_l1')).toBe(true);
    expect(result.suggestions.some(s => s.severity === 'error')).toBe(true);
  });

  it('detects incoherence: taux non autorise <= taux autorise', () => {
    const input: C14Input = {
      current_field: 'tauxNonAutorise',
      current_value: 12,
      rubric_code: 'decouverts.taux_non_autorise',
      all_values: {
        'decouverts.taux_autorise': 14,
      },
    };
    const result = handleC14(input);

    expect(result.suggestions.some(s =>
      s.type === 'coherence_inter_rubriques' && s.severity === 'error'
    )).toBe(true);
  });

  it('suggests completion when card fees without opposition', () => {
    const input: C14Input = {
      current_field: 'visaClassic',
      current_value: 15000,
      rubric_code: 'cartes.cotisation_debit',
      all_values: {
        'cartes.cotisation_debit': 15000,
        'cartes.cotisation_credit': 50000,
      },
    };
    const result = handleC14(input);

    expect(result.suggestions.some(s => s.type === 'completion')).toBe(true);
  });

  it('suggests completion when overdraft rate without CPFD', () => {
    const input: C14Input = {
      current_field: 'tauxAutorise',
      current_value: 14,
      rubric_code: 'decouverts.taux_autorise',
      all_values: {
        'creditFees.tauxDecouvertAutorise': 14,
      },
    };
    const result = handleC14(input);

    expect(result.suggestions.some(s =>
      s.type === 'completion' && s.message.includes('CPFD')
    )).toBe(true);
  });

  it('returns no suggestions for normal values', () => {
    const input: C14Input = {
      current_field: 'abonnement',
      current_value: 3000,
      rubric_code: 'ebanking.abonnement',
      all_values: {},
    };
    const result = handleC14(input);

    // Should have no warnings (value is within range)
    const warnings = result.suggestions.filter(s => s.severity === 'warning' || s.severity === 'error');
    expect(warnings).toHaveLength(0);
  });

  it('works through orchestrator dispatch', async () => {
    const { dispatch } = await import('../../ai/proph3t/intelligence/orchestrator');
    const { CompetenceId } = await import('../../ai/proph3t/intelligence/types');

    const result = await dispatch(
      CompetenceId.ASSISTANT_SAISIE,
      {
        current_field: 'tauxAutorise',
        current_value: 25,
        rubric_code: 'decouverts.taux_autorise',
        all_values: {},
      },
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
    );

    expect(result.success).toBe(true);
    if (result.success) {
      const output = result.response.output as { suggestions: Array<{ type: string }> };
      // 25% should trigger L1 violation + out of range
      expect(output.suggestions.length).toBeGreaterThan(0);
    }
  });
});
