import { describe, it, expect } from 'vitest';
import { handleC2 } from '../../ai/proph3t/intelligence/handlers/C2ConventionHandler';
import type { C2Input } from '../../ai/proph3t/intelligence/types';

const CONVENTION_TEXT = `
CONVENTION DE COMPTE BANCAIRE

Signee le 15/03/2024

Entre les soussignes :

Pour la banque SGBCI : M. Jean Kouassi, Directeur d'agence
Pour le client : Mme Marie Bamba, Gerant

Comptes concernes : CI0012345678901, CI0012345678902

Par derogation a nos CG, les conditions suivantes s'appliquent :
- Tenue de compte particulier : 3 000 FCFA (au lieu de 5 000 FCFA)
- Tarif preferentiel sur virements internationaux

Duree indeterminee.

Applicable a compter du 01/04/2024.

Convention-cadre n° GRP-2024-001
`;

describe('C2 — Extraction conventions client', () => {
  const baseInput: C2Input = {
    pdf_url: 'https://example.com/convention.pdf',
    bank_id: 'SGBCCICI',
    language: 'fr',
    expected_taxonomy: [],
  };

  it('extracts signatories', () => {
    const input = { ...baseInput, text_content: CONVENTION_TEXT } as C2Input & { text_content: string };
    const result = handleC2(input);

    expect(result.signatories.length).toBeGreaterThan(0);
    expect(result.signatories.some(s => s.side === 'bank')).toBe(true);
  });

  it('extracts signature date', () => {
    const input = { ...baseInput, text_content: CONVENTION_TEXT } as C2Input & { text_content: string };
    const result = handleC2(input);

    expect(result.signature_date).toContain('15');
  });

  it('extracts account numbers', () => {
    const input = { ...baseInput, text_content: CONVENTION_TEXT } as C2Input & { text_content: string };
    const result = handleC2(input);

    expect(result.account_numbers_concerned.length).toBeGreaterThanOrEqual(1);
  });

  it('detects derogation clauses', () => {
    const input = { ...baseInput, text_content: CONVENTION_TEXT } as C2Input & { text_content: string };
    const result = handleC2(input);

    expect(result.derogations.length).toBeGreaterThan(0);
    expect(result.derogations[0].explicit_derogation_text).toContain('derogation');
  });

  it('detects group agreement reference', () => {
    const input = { ...baseInput, text_content: CONVENTION_TEXT } as C2Input & { text_content: string };
    const result = handleC2(input);

    expect(result.parent_group_agreement_ref).toContain('GRP-2024-001');
  });

  it('inherits C1 extraction for conditions', () => {
    const input = { ...baseInput, text_content: CONVENTION_TEXT } as C2Input & { text_content: string };
    const result = handleC2(input);

    expect(result.extracted_conditions).toBeDefined();
    expect(result.document_metadata).toBeDefined();
  });

  it('works through orchestrator', async () => {
    const { dispatch } = await import('../../ai/proph3t/intelligence/orchestrator');
    const { CompetenceId } = await import('../../ai/proph3t/intelligence/types');

    const result = await dispatch(
      CompetenceId.EXTRACTION_CONVENTIONS,
      { ...baseInput, text_content: CONVENTION_TEXT },
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
    );
    expect(result.success).toBe(true);
  });
});
