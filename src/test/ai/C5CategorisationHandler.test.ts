import { describe, it, expect } from 'vitest';
import { handleC5 } from '../../ai/proph3t/intelligence/handlers/C5CategorisationHandler';
import type { C5Input } from '../../ai/proph3t/intelligence/types';

describe('C5 — Categorisation des operations', () => {
  it('categorizes standard bank fees', () => {
    const input: C5Input = {
      operations: [
        { id: 'op1', label: 'FRAIS TENUE DE COMPTE MARS 2024', amount: 5000, date: '2024-03-31' },
        { id: 'op2', label: 'COM/MVT 03/24', amount: 12500, date: '2024-03-31' },
        { id: 'op3', label: 'AGIOS DEC AUTORISE', amount: 45000, date: '2024-03-31' },
      ],
    };
    const result = handleC5(input);

    expect(result.categorized).toHaveLength(3);
    expect(result.uncategorized).toHaveLength(0);

    // Tenue de compte → compte.*
    expect(result.categorized[0].rubric_code).toContain('compte.');
    expect(result.categorized[0].match_method).toBe('exact');
    expect(result.categorized[0].confidence).toBeGreaterThanOrEqual(85);

    // Commission mouvement → decouverts.commission_mouvement
    expect(result.categorized[1].rubric_code).toBe('decouverts.commission_mouvement');

    // Agios → decouverts.taux_autorise
    expect(result.categorized[2].rubric_code).toContain('decouverts.');
  });

  it('categorizes card and transfer operations', () => {
    const input: C5Input = {
      operations: [
        { id: 'op1', label: 'RETRAIT DAB SGBCI', amount: 100000, date: '2024-03-15' },
        { id: 'op2', label: 'VIR EMIS BNP PARIS', amount: 500000, date: '2024-03-20' },
        { id: 'op3', label: 'PAIEMENT CARTE VISA TPE', amount: 25000, date: '2024-03-22' },
        { id: 'op4', label: 'CHQ 1234567', amount: 150000, date: '2024-03-25' },
      ],
    };
    const result = handleC5(input);

    expect(result.categorized).toHaveLength(4);
    expect(result.categorized[0].rubric_code).toContain('cartes.retrait_dab');
    expect(result.categorized[1].rubric_code).toContain('virements.');
    expect(result.categorized[2].rubric_code).toContain('cartes.paiement');
    expect(result.categorized[3].rubric_code).toContain('cheques.');
  });

  it('handles SWIFT and international transfers', () => {
    const input: C5Input = {
      operations: [
        { id: 'op1', label: 'FRAIS SWIFT VIR INTERNATIONAL', amount: 15000, date: '2024-03-10' },
        { id: 'op2', label: 'TRANSFERT INTERNATIONAL EUR', amount: 1000000, date: '2024-03-12' },
      ],
    };
    const result = handleC5(input);

    expect(result.categorized).toHaveLength(2);
    expect(result.categorized[0].rubric_code).toContain('virements.international');
    expect(result.categorized[1].rubric_code).toContain('virements.international');
  });

  it('flags unknown labels as uncategorized', () => {
    const input: C5Input = {
      operations: [
        { id: 'op1', label: 'OPERATION SPECIALE REF XYZ', amount: 50000, date: '2024-03-15' },
        { id: 'op2', label: 'REGULARISATION INTERNE 042', amount: 10000, date: '2024-03-18' },
      ],
    };
    const result = handleC5(input);

    expect(result.categorized).toHaveLength(0);
    expect(result.uncategorized).toHaveLength(2);
    expect(result.uncategorized[0].operation_id).toBe('op1');
  });

  it('handles mixed categorized and uncategorized', () => {
    const input: C5Input = {
      operations: [
        { id: 'op1', label: 'FRAIS TENUE COMPTE', amount: 5000, date: '2024-03-31' },
        { id: 'op2', label: 'OPERATION MYSTERE', amount: 999, date: '2024-03-15' },
        { id: 'op3', label: 'COTISATION CARTE VISA', amount: 15000, date: '2024-03-01' },
      ],
    };
    const result = handleC5(input);

    expect(result.categorized).toHaveLength(2);
    expect(result.uncategorized).toHaveLength(1);
    expect(result.uncategorized[0].operation_id).toBe('op2');
  });

  it('handles mobile money operations', () => {
    const input: C5Input = {
      operations: [
        { id: 'op1', label: 'MTN MONEY TRANSFERT', amount: 50000, date: '2024-03-15' },
        { id: 'op2', label: 'ORANGE MONEY DEPOT', amount: 100000, date: '2024-03-16' },
      ],
    };
    const result = handleC5(input);

    expect(result.categorized).toHaveLength(2);
    expect(result.categorized[0].rubric_code).toContain('mobile_money');
  });

  it('handles empty input gracefully', () => {
    const input: C5Input = { operations: [] };
    const result = handleC5(input);

    expect(result.categorized).toHaveLength(0);
    expect(result.uncategorized).toHaveLength(0);
  });

  it('works through orchestrator dispatch', async () => {
    const { dispatch } = await import('../../ai/proph3t/intelligence/orchestrator');
    const { CompetenceId } = await import('../../ai/proph3t/intelligence/types');

    const result = await dispatch(
      CompetenceId.CATEGORISATION,
      {
        operations: [
          { id: 'op1', label: 'FRAIS TENUE COMPTE', amount: 5000, date: '2024-03-31' },
          { id: 'op2', label: 'CPFD T1 2024', amount: 25000, date: '2024-03-31' },
        ],
      },
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
    );

    expect(result.success).toBe(true);
    if (result.success) {
      const output = result.response.output as { categorized: Array<{ rubric_code: string }> };
      expect(output.categorized).toHaveLength(2);
      expect(output.categorized[1].rubric_code).toBe('decouverts.cpfd');
      expect(result.response.trace.competence_version).toBe('1.0.0');
    }
  });
});
