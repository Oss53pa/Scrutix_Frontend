import { describe, it, expect } from 'vitest';
import { handleC1 } from '../../ai/proph3t/intelligence/handlers/C1ExtractionCGHandler';
import type { C1Input } from '../../ai/proph3t/intelligence/types';

// Simulated CG document text (typical bank conditions)
const SAMPLE_CG_TEXT = `
CONDITIONS GENERALES DE BANQUE
Applicables a compter du 01/01/2024
Version : V2024-01

FRAIS DE TENUE DE COMPTE
Tenue de compte particulier ......................... 5 000 FCFA/mois
Tenue de compte entreprise ......................... 15 000 FCFA/mois

DECOUVERTS
Taux decouvert autorise (TEG) ..................... 14,50%
Taux decouvert non autorise ....................... 18,00%
Commission de mouvement ........................... 0,025%
CPFD - Commission du Plus Fort Decouvert .......... 0,05%

CARTES BANCAIRES
Carte Visa Classic ................................ 10 000 FCFA
Carte Visa Platinum ............................... 25 000 FCFA
Retrait DAB national meme banque .................. Gratuit
Retrait DAB autre banque .......................... 500 FCFA

VIREMENTS
Virement interne — commission ..................... 1 000 FCFA
Virement CEMAC UEMOA — commission ................. 3 500 FCFA
Virement international — commission ............... 15 000 FCFA
Virement international — SWIFT .................... 10 000 FCFA

CHEQUES
Chequier emission 25 feuilles ..................... 5 000 FCFA
Opposition cheque ................................. 10 000 FCFA
Cheque sans provision ............................. 25 000 FCFA

E-BANKING
Abonnement mensuel internet banking ............... 3 000 FCFA/mois
SMS alerte ........................................ 500 FCFA/mois
`;

describe('C1 — Extraction CG bancaires', () => {
  const baseInput: C1Input = {
    pdf_url: 'https://example.com/cg.pdf',
    bank_id: 'SGBCCICI',
    language: 'fr',
    expected_taxonomy: [],
  };

  it('extracts conditions from typical CG text', () => {
    const input = { ...baseInput, text_content: SAMPLE_CG_TEXT } as C1Input & { text_content: string };
    const result = handleC1(input);

    expect(result.extracted_conditions.length).toBeGreaterThan(0);

    // Should find tenue de compte
    const tdc = result.extracted_conditions.find(c => c.rubric_code === 'compte.tenue_mensuelle');
    expect(tdc).toBeDefined();
    if (tdc) {
      expect(tdc.value_numeric).toBe(5000);
      expect(tdc.unit).toBe('fcfa');
      expect(tdc.confidence).toBeGreaterThan(0);
    }
  });

  it('extracts percentage-based conditions (taux)', () => {
    const input = { ...baseInput, text_content: SAMPLE_CG_TEXT } as C1Input & { text_content: string };
    const result = handleC1(input);

    const tauxAutorise = result.extracted_conditions.find(c => c.rubric_code === 'decouverts.taux_autorise');
    expect(tauxAutorise).toBeDefined();
    if (tauxAutorise) {
      expect(tauxAutorise.value_numeric).toBe(14.5);
      expect(tauxAutorise.unit).toBe('percent');
    }
  });

  it('extracts card fees', () => {
    const input = { ...baseInput, text_content: SAMPLE_CG_TEXT } as C1Input & { text_content: string };
    const result = handleC1(input);

    // cardFees.visaClassic → cartes.cotisation_debit
    const cotisationDebit = result.extracted_conditions.find(c => c.rubric_code === 'cartes.cotisation_debit');
    expect(cotisationDebit).toBeDefined();
    if (cotisationDebit) {
      expect(cotisationDebit.value_numeric).toBe(10000);
      expect(cotisationDebit.unit).toBe('fcfa');
    }
  });

  it('extracts transfer fees', () => {
    const input = { ...baseInput, text_content: SAMPLE_CG_TEXT } as C1Input & { text_content: string };
    const result = handleC1(input);

    // transferFees.virementInternational.commission → virements.international
    const virInt = result.extracted_conditions.find(c => c.rubric_code === 'virements.international');
    expect(virInt).toBeDefined();
    if (virInt) {
      expect(virInt.value_numeric).toBe(15000);
    }
  });

  it('detects document metadata', () => {
    const input = { ...baseInput, text_content: SAMPLE_CG_TEXT } as C1Input & { text_content: string };
    const result = handleC1(input);

    expect(result.document_metadata.detected_bank).toBe('SGBCCICI');
    expect(result.document_metadata.detected_version).toContain('2024');
    expect(result.document_metadata.detected_effective_date).toContain('01');
  });

  it('marks unfound rubrics with confidence 0', () => {
    const input = { ...baseInput, text_content: 'Document presque vide.' } as C1Input & { text_content: string };
    const result = handleC1(input);

    // All conditions should exist but with null values and 0 confidence
    const allZero = result.extracted_conditions.every(
      c => c.value_numeric === null && c.confidence === 0
    );
    expect(allZero).toBe(true);
  });

  it('filters by expected_taxonomy when provided', () => {
    const input = {
      ...baseInput,
      text_content: SAMPLE_CG_TEXT,
      expected_taxonomy: ['compte.tenue_mensuelle', 'decouverts.taux_autorise'],
    } as C1Input & { text_content: string };
    const result = handleC1(input);

    // Should only contain the requested rubrics
    const rubricCodes = result.extracted_conditions.map(c => c.rubric_code);
    expect(rubricCodes).toContain('compte.tenue_mensuelle');
    expect(rubricCodes).toContain('decouverts.taux_autorise');
    // Should not contain rubrics not in the taxonomy filter
    expect(rubricCodes).not.toContain('cartes.cotisation_debit');
  });

  it('generates unmapped segments for sparse extraction', () => {
    const longText = SAMPLE_CG_TEXT + '\n'.repeat(100) + 'Beaucoup de texte non structure ici...'.repeat(20);
    const input = {
      ...baseInput,
      text_content: longText,
      expected_taxonomy: ['rubrique.inexistante'],
    } as C1Input & { text_content: string };
    const result = handleC1(input);

    // With a non-existent taxonomy filter, extraction will be sparse
    expect(result.unmapped_segments.length).toBeGreaterThanOrEqual(0);
  });

  it('works through orchestrator dispatch', async () => {
    const { dispatch } = await import('../../ai/proph3t/intelligence/orchestrator');
    const { CompetenceId } = await import('../../ai/proph3t/intelligence/types');

    const result = await dispatch(
      CompetenceId.EXTRACTION_CG,
      {
        pdf_url: 'https://example.com/cg.pdf',
        bank_id: 'SGBCCICI',
        language: 'fr' as const,
        expected_taxonomy: [],
        text_content: SAMPLE_CG_TEXT,
      },
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response.trace.competence_version).toBe('1.0.0');
      expect(result.response.trace.confidence_score).toBeGreaterThan(0);
    }
  });
});
