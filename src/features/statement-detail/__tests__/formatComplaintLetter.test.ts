// ============================================================================
// Tests — formatComplaintLetter
// ============================================================================
// Spec onglets 2-5 §3.5 : la lettre n'inclut que les anomalies tarifaires
// qualifiées+ ; le total réclamé est la somme des potentialRecoveryCentimes ;
// la date est localisée fr-FR.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { formatComplaintLetter } from '../reports/formatComplaintLetter';
import type { Anomaly } from '../types/statement.types';

function makeAnomaly(over: Partial<Anomaly>): Anomaly {
  return {
    id: 'a',
    statementId: 's',
    type: 'commission_excessive',
    severity: 'high',
    status: 'qualified',
    title: 'Commission de mouvement excédentaire',
    description: 'd',
    transaction: {
      id: 'tx', date: '2026-03-31', label: 'COM MVT', amountCentimes: -8_760_000,
    },
    detection: { algorithm: 'algo', confidence: 0.95, rule: 'r' },
    potentialRecoveryCentimes: 2_760_000,
    createdAt: '2026-03-31T00:00:00Z',
    ...over,
  };
}

const BASE_INPUT = {
  cabinet: { name: 'Atlas Studio', addressLines: ['Abidjan, Cocody', 'BP 1234'] },
  bank: { legalName: 'NSIA Banque CI', addressLines: ['8-10 Av. Joseph Anoma', 'Abidjan 01'] },
  client: { legalName: 'Pamela ATOKOUNA', accountNumber: '86315802001' },
  period: { start: '2026-02-10', end: '2026-05-08' },
  convention: { id: 'c1', signedDate: '2025-03-12' },
  emittedOn: new Date('2026-05-09'),
  signatory: { displayName: 'Cheick SANANKOUA', title: 'Directeur Général' },
};

describe('formatComplaintLetter', () => {
  it('inclut uniquement les anomalies tarifaires qualifiées+', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ id: 'a1', type: 'commission_excessive', status: 'qualified', potentialRecoveryCentimes: 2_760_000 }),
      makeAnomaly({ id: 'a2', type: 'pays_gafi_risque', status: 'validated', potentialRecoveryCentimes: 0 }),  // pas tarifaire
      makeAnomaly({ id: 'a3', type: 'agio_errone', status: 'detected', potentialRecoveryCentimes: 500_000 }),  // pas qualifiée
      makeAnomaly({ id: 'a4', type: 'frais_double', status: 'qualified', potentialRecoveryCentimes: 100_000 }),
    ];
    const out = formatComplaintLetter({ ...BASE_INPUT, anomalies });
    expect(out.items.map((i) => i.anomalyId)).toEqual(['a1', 'a4']);
  });

  it('totalClaimedCentimes = somme des excess', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ id: 'a1', type: 'commission_excessive', status: 'qualified', potentialRecoveryCentimes: 2_760_000 }),
      makeAnomaly({ id: 'a4', type: 'frais_double', status: 'qualified', potentialRecoveryCentimes: 100_000 }),
    ];
    const out = formatComplaintLetter({ ...BASE_INPUT, anomalies });
    expect(out.totalClaimedCentimes).toBe(2_860_000);
  });

  it('formatte la date en français long', () => {
    const out = formatComplaintLetter({ ...BASE_INPUT, anomalies: [] });
    expect(out.text).toContain('9 mai 2026');
    expect(out.text).toContain('12 mars 2025');
  });

  it('cite la convention dans l\'objet et le corps', () => {
    const out = formatComplaintLetter({ ...BASE_INPUT, anomalies: [] });
    expect(out.text).toContain('convention signée le 12 mars 2025');
  });

  it('les montants sont formatés avec espaces des milliers', () => {
    const anomalies: Anomaly[] = [
      makeAnomaly({ id: 'a', type: 'commission_excessive', status: 'qualified', potentialRecoveryCentimes: 2_760_000 }),
    ];
    const out = formatComplaintLetter({ ...BASE_INPUT, anomalies });
    expect(out.text).toContain('27 600 FCFA');
  });

  it('inclut nom + titre signataire', () => {
    const out = formatComplaintLetter({ ...BASE_INPUT, anomalies: [] });
    expect(out.text).toContain('Cheick SANANKOUA');
    expect(out.text).toContain('Directeur Général');
  });

  it('inclut numéro de compte dans l\'objet', () => {
    const out = formatComplaintLetter({ ...BASE_INPUT, anomalies: [] });
    expect(out.text).toContain('86315802001');
  });

  it('lettre vide si aucune anomalie éligible', () => {
    const out = formatComplaintLetter({ ...BASE_INPUT, anomalies: [] });
    expect(out.items).toEqual([]);
    expect(out.totalClaimedCentimes).toBe(0);
    expect(out.text.length).toBeGreaterThan(0);  // template reste affiché
  });
});
