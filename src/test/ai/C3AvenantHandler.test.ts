import { describe, it, expect } from 'vitest';
import { handleC3 } from '../../ai/proph3t/intelligence/handlers/C3AvenantHandler';
import type { C3Input } from '../../ai/proph3t/intelligence/types';

describe('C3 — Extraction avenants ponctuels', () => {
  const baseInput: C3Input = {
    document_url: 'https://example.com/avenant.pdf',
    format: 'pdf_signe',
    bank_id: 'SGBCCICI',
    client_id: 'client-001',
    language: 'fr',
  };

  it('scores high engagement for signed contractual document', () => {
    const input = {
      ...baseInput,
      text_content: `
        Avenant n°3 a la convention de compte
        Par la presente, il est convenu et accorde :
        Taux decouvert autorise reduit a 12%
        Applicable a compter du 01/06/2024
        Signe le 15/05/2024 — Cachet de la banque
      `,
    } as C3Input & { text_content: string };

    const result = handleC3(input);
    expect(result.engagement_score).toBeGreaterThanOrEqual(80);
    expect(result.avenant_draft_created).toBe(true);
  });

  it('scores low engagement for commercial proposal', () => {
    const input = {
      ...baseInput,
      text_content: `
        Proposition commerciale
        Sans engagement de notre part
        Discussion en cours sur les conditions
        Offre soumise sous reserve de validation
      `,
    } as C3Input & { text_content: string };

    const result = handleC3(input);
    expect(result.engagement_score).toBeLessThan(50);
    expect(result.avenant_draft_created).toBe(false);
  });

  it('scores medium for ambiguous documents', () => {
    const input = {
      ...baseInput,
      text_content: `
        Accord sur taux preferentiel
        Duree determinee : 6 mois
        Sous reserve de maintien du solde moyen
      `,
    } as C3Input & { text_content: string };

    const result = handleC3(input);
    expect(result.engagement_score).toBeGreaterThanOrEqual(40);
    expect(result.engagement_score).toBeLessThan(80);
  });

  it('extracts effective period dates', () => {
    const input = {
      ...baseInput,
      text_content: 'Applicable a compter du 01/06/2024. Valable jusqu\'au 31/12/2024.',
    } as C3Input & { text_content: string };

    const result = handleC3(input);
    expect(result.effective_period).not.toBeNull();
  });

  it('truncates source text to 2000 chars', () => {
    const input = {
      ...baseInput,
      text_content: 'A'.repeat(5000),
    } as C3Input & { text_content: string };

    const result = handleC3(input);
    expect(result.source_text.length).toBeLessThanOrEqual(2000);
  });

  it('works through orchestrator', async () => {
    const { dispatch } = await import('../../ai/proph3t/intelligence/orchestrator');
    const { CompetenceId } = await import('../../ai/proph3t/intelligence/types');

    const result = await dispatch(
      CompetenceId.EXTRACTION_AVENANTS,
      { ...baseInput, text_content: 'Avenant n°1 signe le 01/01/2024' },
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
    );
    expect(result.success).toBe(true);
  });
});
