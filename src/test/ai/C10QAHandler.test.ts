import { describe, it, expect } from 'vitest';
import { handleC10 } from '../../ai/proph3t/intelligence/handlers/C10QAHandler';
import type { C10Input } from '../../ai/proph3t/intelligence/types';

describe('C10 — Q&A conversationnel', () => {
  it('answers questions about TEG with regulatory reference', () => {
    const input: C10Input = { question: 'Quel est le taux effectif global maximum ?', language: 'fr' };
    const result = handleC10(input);

    expect(result.requires_investigation).toBe(false);
    expect(result.sources.some(s => s.type === 'regulation')).toBe(true);
    expect(result.answer).toContain('BCEAO');
  });

  it('answers questions about dates de valeur', () => {
    const input: C10Input = { question: 'Quelles sont les regles sur les dates de valeur ?', language: 'fr' };
    const result = handleC10(input);

    expect(result.requires_investigation).toBe(false);
    expect(result.sources.some(s => s.reference.includes('BCEAO'))).toBe(true);
    expect(result.answer).toContain('J+1');
  });

  it('answers questions about CPFD', () => {
    const input: C10Input = { question: 'Comment fonctionne la CPFD ?', language: 'fr' };
    const result = handleC10(input);

    expect(result.requires_investigation).toBe(false);
    expect(result.answer).toContain('50%');
  });

  it('answers questions about ecart codes', () => {
    const input: C10Input = { question: 'Que signifie le code E03 ?', language: 'fr' };
    const result = handleC10(input);

    expect(result.requires_investigation).toBe(false);
    expect(result.sources.some(s => s.reference === 'E03')).toBe(true);
    expect(result.answer).toContain('interets');
  });

  it('finds taxonomy rubrics by keyword', () => {
    const input: C10Input = { question: 'Quels sont les frais de tenue de compte ?', language: 'fr' };
    const result = handleC10(input);

    expect(result.sources.some(s => s.type === 'taxonomy')).toBe(true);
  });

  it('answers questions about reclamation procedure', () => {
    const input: C10Input = { question: 'Comment faire une reclamation a la banque ?', language: 'fr' };
    const result = handleC10(input);

    expect(result.requires_investigation).toBe(false);
    expect(result.answer).toContain('reclamation');
  });

  it('returns investigation-required for unknown topics', () => {
    const input: C10Input = { question: 'Quel est le cours du dollar aujourd\'hui ?', language: 'fr' };
    const result = handleC10(input);

    expect(result.requires_investigation).toBe(true);
    expect(result.answer).toContain('investigation complementaire');
    expect(result.sources).toHaveLength(0);
  });

  it('works through orchestrator dispatch', async () => {
    const { dispatch } = await import('../../ai/proph3t/intelligence/orchestrator');
    const { CompetenceId } = await import('../../ai/proph3t/intelligence/types');

    const result = await dispatch(
      CompetenceId.QA_CONVERSATIONNEL,
      { question: 'Quel est le plafond CPFD ?', language: 'fr' as const },
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
    );

    expect(result.success).toBe(true);
    if (result.success) {
      const output = result.response.output as { requires_investigation: boolean };
      expect(output.requires_investigation).toBe(false);
    }
  });
});
