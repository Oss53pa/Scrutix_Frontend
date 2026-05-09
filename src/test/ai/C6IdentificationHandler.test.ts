import { describe, it, expect } from 'vitest';
import { handleC6 } from '../../ai/proph3t/intelligence/handlers/C6IdentificationHandler';
import type { C6Input } from '../../ai/proph3t/intelligence/types';

describe('C6 — Identification banque & type de document', () => {
  // -------------------------------------------------------------------------
  // Bank detection
  // -------------------------------------------------------------------------

  it('detects SGBCI from header text', () => {
    const input: C6Input = {
      text_content: `
        SGBCI - Société Générale de Banques en Côte d'Ivoire
        RCCM: CI-ABJ-2003-B-00001
        Relevé de compte au 31/03/2024
        Compte: 0123456789
        Solde précédent: 1 500 000 XOF
      `,
    };
    const result = handleC6(input);
    expect(result.detected_bank.code).toBe('SGBCCICI');
    expect(result.detected_bank.confidence).toBeGreaterThanOrEqual(90);
  });

  it('detects Ecobank Cameroun', () => {
    const input: C6Input = {
      text_content: 'Ecobank Cameroun S.A. - Conditions Générales applicables',
    };
    const result = handleC6(input);
    expect(result.detected_bank.code).toBe('ECABORDC');
    expect(result.detected_bank.confidence).toBeGreaterThanOrEqual(90);
  });

  it('detects bank via SWIFT code', () => {
    const input: C6Input = {
      text_content: 'Code SWIFT: BGFIGABX — BGFIBank Libreville',
    };
    const result = handleC6(input);
    expect(result.detected_bank.code).toBe('BGFIGABX');
    expect(result.detected_bank.confidence).toBeGreaterThanOrEqual(90);
  });

  it('falls back to generic Ecobank if no country context', () => {
    const input: C6Input = {
      text_content: 'Ecobank - Grille tarifaire',
    };
    const result = handleC6(input);
    expect(result.detected_bank.name).toContain('Ecobank');
    expect(result.detected_bank.confidence).toBeLessThan(90);
  });

  it('returns UNKNOWN for non-banking text', () => {
    const input: C6Input = {
      text_content: 'Facture d\'électricité ENEO - Mois de mars 2024',
    };
    const result = handleC6(input);
    expect(result.detected_bank.code).toBe('UNKNOWN');
    expect(result.detected_bank.confidence).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Document type detection
  // -------------------------------------------------------------------------

  it('identifies conditions generales', () => {
    const input: C6Input = {
      text_content: `
        CONDITIONS GENERALES DE BANQUE
        Tarification des services bancaires
        Applicables à compter du 01/01/2024
        Barème des frais de tenue de compte
      `,
    };
    const result = handleC6(input);
    expect(result.detected_document_type.type).toBe('conditions_generales');
    expect(result.detected_document_type.confidence).toBeGreaterThanOrEqual(70);
  });

  it('identifies convention client', () => {
    const input: C6Input = {
      text_content: `
        CONVENTION DE COMPTE
        Entre les soussignés :
        Par dérogation à nos CG, les conditions suivantes s'appliquent...
        Conditions particulières accordées
      `,
    };
    const result = handleC6(input);
    expect(result.detected_document_type.type).toBe('convention');
    expect(result.detected_document_type.confidence).toBeGreaterThanOrEqual(70);
  });

  it('identifies releve de compte', () => {
    const input: C6Input = {
      text_content: `
        RELEVE DE COMPTE
        Période du 01/03/2024 au 31/03/2024
        Solde précédent: 2 345 678 XOF
        Total des débits: 1 200 000
        Total des crédits: 800 000
        Nouveau solde: 1 945 678
      `,
    };
    const result = handleC6(input);
    expect(result.detected_document_type.type).toBe('releve');
    expect(result.detected_document_type.confidence).toBeGreaterThanOrEqual(70);
  });

  it('identifies echelle d\'interets', () => {
    const input: C6Input = {
      text_content: `
        ÉCHELLE D'INTÉRÊTS
        Ticket d'agios - Trimestre T1 2024
        Commission du Plus Fort Découvert (CPFD)
        Intérêts débiteurs calculés sur la période
      `,
    };
    const result = handleC6(input);
    expect(result.detected_document_type.type).toBe('echelle_interets');
    expect(result.detected_document_type.confidence).toBeGreaterThanOrEqual(70);
  });

  it('identifies non-bancaire document', () => {
    const input: C6Input = {
      text_content: `
        BULLETIN DE SALAIRE
        Mois de mars 2024
        Salaire brut: 450 000 FCFA
        Contrat de travail CDI
      `,
    };
    const result = handleC6(input);
    expect(result.detected_document_type.type).toBe('non_bancaire');
  });

  // -------------------------------------------------------------------------
  // Combined detection
  // -------------------------------------------------------------------------

  it('detects both bank and document type together', () => {
    const input: C6Input = {
      text_content: `
        BICEC - Banque Internationale du Cameroun pour l'Épargne et le Crédit
        CONDITIONS GÉNÉRALES DE BANQUE
        Grille tarifaire en vigueur à compter du 1er janvier 2024
        SWIFT: BICCMCMX
        RCCM: RC/DLA/2000/B/00123
      `,
    };
    const result = handleC6(input);
    expect(result.detected_bank.code).toBe('BICCMCMX');
    expect(result.detected_bank.confidence).toBeGreaterThanOrEqual(90);
    expect(result.detected_document_type.type).toBe('conditions_generales');
    expect(result.detected_document_type.confidence).toBeGreaterThanOrEqual(70);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Orchestrator integration
  // -------------------------------------------------------------------------

  it('works through orchestrator dispatch', async () => {
    const { dispatch } = await import('../../ai/proph3t/intelligence/orchestrator');
    const { CompetenceId } = await import('../../ai/proph3t/intelligence/types');

    const result = await dispatch(
      CompetenceId.IDENTIFICATION,
      {
        text_content: 'NSIA Banque - Relevé de compte',
      },
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response.trace.competence_version).toBe('1.0.0');
      expect(result.response.trace.duration_ms).toBeGreaterThanOrEqual(0);
      const output = result.response.output as { detected_bank: { code: string } };
      expect(output.detected_bank.code).toBe('NSIACICI');
    }
  });
});
