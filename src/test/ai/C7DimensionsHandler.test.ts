import { describe, it, expect } from 'vitest';
import { handleC7 } from '../../ai/proph3t/intelligence/handlers/C7DimensionsHandler';
import type { C7Input } from '../../ai/proph3t/intelligence/types';

describe('C7 — Detection dimensions tarifaires', () => {
  it('detects montant range', () => {
    const input: C7Input = { text: 'Commission de 0,5% pour les montants entre 1 000 000 et 5 000 000 FCFA' };
    const result = handleC7(input);

    const montant = result.dimensions.find(d => d.type === 'montant');
    expect(montant).toBeDefined();
    expect(montant!.values.montant_centimes?.min).toBeDefined();
    expect(montant!.values.montant_centimes?.max).toBeDefined();
  });

  it('detects montant threshold (superieur a)', () => {
    const input: C7Input = { text: 'Applicable pour les operations superieur a 500 000 FCFA' };
    const result = handleC7(input);

    const montant = result.dimensions.find(d => d.type === 'montant');
    expect(montant).toBeDefined();
    expect(montant!.values.montant_centimes?.min).toBeDefined();
  });

  it('detects profil particulier', () => {
    const input: C7Input = { text: 'Taux applicable aux particuliers : 14%' };
    const result = handleC7(input);

    const profil = result.dimensions.find(d => d.type === 'profil');
    expect(profil).toBeDefined();
    expect(profil!.values.profil).toBe('particulier');
  });

  it('detects profil PME', () => {
    const input: C7Input = { text: 'Conditions speciales PME et TPE' };
    const result = handleC7(input);

    const profil = result.dimensions.find(d => d.type === 'profil');
    expect(profil).toBeDefined();
    expect(profil!.values.profil).toBe('pme');
  });

  it('detects duree range', () => {
    const input: C7Input = { text: 'Credit de 12 a 60 mois' };
    const result = handleC7(input);

    const duree = result.dimensions.find(d => d.type === 'duree');
    expect(duree).toBeDefined();
    expect(duree!.values.duree_jours?.min).toBeGreaterThan(300);
    expect(duree!.values.duree_jours?.max).toBeGreaterThan(1000);
  });

  it('detects court/moyen/long terme', () => {
    expect(handleC7({ text: 'Credit court terme' }).dimensions.some(d => d.type === 'duree')).toBe(true);
    expect(handleC7({ text: 'Credit moyen terme' }).dimensions.some(d => d.type === 'duree')).toBe(true);
    expect(handleC7({ text: 'Credit long terme' }).dimensions.some(d => d.type === 'duree')).toBe(true);
  });

  it('detects garantie', () => {
    const input: C7Input = { text: 'Avec hypotheque de premier rang' };
    const result = handleC7(input);

    const garantie = result.dimensions.find(d => d.type === 'garantie');
    expect(garantie).toBeDefined();
    expect(garantie!.values.garantie).toContain('hypotheque');
  });

  it('detects devise', () => {
    const input: C7Input = { text: 'Virement en EUR vers la France' };
    const result = handleC7(input);

    const devise = result.dimensions.find(d => d.type === 'devise');
    expect(devise).toBeDefined();
    expect(devise!.values.devise).toBe('EUR');
  });

  it('detects canal (e-banking)', () => {
    const input: C7Input = { text: 'Via internet banking : gratuit' };
    const result = handleC7(input);

    const canal = result.dimensions.find(d => d.type === 'canal');
    expect(canal).toBeDefined();
    expect(canal!.values.canal).toBe('ebanking');
  });

  it('detects tiered pricing', () => {
    const input: C7Input = { text: 'Bareme degressif : 0,5% pour les premiers 1 000 000 FCFA' };
    const result = handleC7(input);

    expect(result.has_tiers).toBe(true);
  });

  it('detects conditional rules (gratuit si)', () => {
    const input: C7Input = { text: 'Tenue de compte gratuit si solde moyen superieur a 500 000 FCFA' };
    const result = handleC7(input);

    expect(result.conditional_rules.length).toBeGreaterThan(0);
    expect(result.conditional_rules[0].condition).toContain('solde');
  });

  it('works through orchestrator', async () => {
    const { dispatch } = await import('../../ai/proph3t/intelligence/orchestrator');
    const { CompetenceId } = await import('../../ai/proph3t/intelligence/types');

    const result = await dispatch(
      CompetenceId.DIMENSIONS_TARIFAIRES,
      { text: 'Taux pour les PME : 12% sur montants superieurs a 10 000 000 FCFA' },
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000002',
    );
    expect(result.success).toBe(true);
  });
});
