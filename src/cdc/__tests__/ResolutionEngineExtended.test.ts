// ============================================================================
// Tests étendus — ResolutionEngine
// ============================================================================
// CDC §6.4 : « 50 cas synthétiques + 30 réels anonymisés + 20 adversariaux »
// Ce fichier ajoute :
//   - mode strict vs prescriptif
//   - cap_max et cap_min
//   - cas adversariaux (dimensions partielles, dates limites, multi-juridictions)
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { ResolutionEngine, type CdcDataAccess } from '../resolution/ResolutionEngine';
import { createDevSigner } from '../resolution/ReceiptSigner';
import type {
  AccountContext,
  Agreement,
  AgreementCondition,
  BankReferenceCondition,
  BankReferenceVersion,
  RegulatoryRule,
  ResolutionRequest,
} from '../types';

function ctx(): AccountContext {
  return {
    account: {
      id: 'acc-1', organizationId: 'org-1', bankId: 'bank-1',
      accountNumber: '001', accountLabel: 'CC', accountType: 'courant',
      currency: 'XOF', iban: null, openedAt: null, closedAt: null,
      isActive: true, createdAt: new Date(),
    },
    organization: {
      id: 'org-1', tenantId: 'tnt-1', parentId: null,
      legalName: 'ACME', tradeName: null, orgType: 'client',
      rccm: null, taxId: null, countryIso: 'CI',
      isActive: true, createdAt: new Date(),
    },
    ancestors: [],
    bank: {
      id: 'bank-1', code: 'NSIA-CI', legalName: 'NSIA',
      countryIso: 'CI', zone: 'UEMOA', jurisdictionIds: ['j-bceao'],
      swiftBic: null, parentGroup: null, isActive: true, createdAt: new Date(),
    },
    jurisdictions: [{
      id: 'j-bceao', code: 'BCEAO', name: 'BCEAO',
      scopeCountries: ['CI'], parentId: null, createdAt: new Date(),
    }],
  };
}

function dao(over: Partial<CdcDataAccess> = {}): CdcDataAccess {
  return {
    getAccountContext: vi.fn().mockResolvedValue(ctx()),
    findAgreements: vi.fn().mockResolvedValue([]),
    findAgreementConditions: vi.fn().mockResolvedValue([]),
    findBankReferenceVersion: vi.fn().mockResolvedValue(null),
    findBankReferenceConditions: vi.fn().mockResolvedValue([]),
    findRegulatoryRules: vi.fn().mockResolvedValue([]),
    ...over,
  };
}

function l2(value: number): { version: BankReferenceVersion; condition: BankReferenceCondition } {
  const version: BankReferenceVersion = {
    id: 'v-1', bankId: 'bank-1', versionLabel: 'CG',
    effectiveFrom: new Date('2025-01-01'), effectiveTo: null,
    sourcePdfUrl: '/x.pdf', sourceHashSha256: 'x',
    validationStatus: 'published', validatedBy: null, validatedAt: null,
    publishedAt: new Date(), supersededBy: null, createdAt: new Date(),
  };
  const condition: BankReferenceCondition = {
    id: 'c-1', referenceVersionId: 'v-1', rubricCode: 'decouverts.taux_autorise',
    dimensions: null, valueNumeric: value, valueFormula: null,
    pdfBbox: null, pdfPage: null, notes: null, createdAt: new Date(),
  };
  return { version, condition };
}

function rule(cap: number, type: 'cap_max' | 'cap_min' = 'cap_max'): RegulatoryRule {
  return {
    id: 'rule-1', jurisdictionId: 'j-bceao',
    rubricCode: 'decouverts.taux_autorise', productCategory: null,
    ruleType: type, valueNumeric: cap, valueFormula: null,
    unit: 'percent', validFrom: new Date('2024-01-01'), validTo: null,
    sourceReference: 'BCEAO', sourceDocument: null,
    recordedAt: new Date(), recordedBy: null, supersededBy: null,
  };
}

const REQ_BASE: ResolutionRequest = {
  accountId: 'acc-1',
  rubricCode: 'decouverts.taux_autorise',
  referenceDate: new Date('2025-06-15'),
};

// ============================================================================
// MODE STRICT vs PRESCRIPTIF (CDC §5.2 étape 4)
// ============================================================================

describe('ResolutionEngine — mode strict vs prescriptif', () => {
  it('strict (audit) : conserve la valeur supérieure au plafond + signale la violation', async () => {
    const { version, condition } = l2(18); // 18% > usury cap 15%
    const d = dao({
      findBankReferenceVersion: vi.fn().mockResolvedValue(version),
      findBankReferenceConditions: vi.fn().mockResolvedValue([condition]),
      findRegulatoryRules: vi.fn().mockResolvedValue([rule(15)]),
    });
    const engine = new ResolutionEngine(d);

    const r = await engine.resolve({ ...REQ_BASE, mode: 'strict' });
    expect(r.value).toBe(18);                            // pas de plafonnement
    expect(r.receipt.rawValue).toBe(18);
    expect(r.receipt.capApplied).toBe(false);
    expect(r.receipt.regulatoryViolations).toHaveLength(1);
    expect(r.receipt.mode).toBe('strict');
  });

  it('prescriptif (simulation) : plafonne à la limite L1 et marque capApplied', async () => {
    const { version, condition } = l2(18);
    const d = dao({
      findBankReferenceVersion: vi.fn().mockResolvedValue(version),
      findBankReferenceConditions: vi.fn().mockResolvedValue([condition]),
      findRegulatoryRules: vi.fn().mockResolvedValue([rule(15)]),
    });
    const engine = new ResolutionEngine(d);

    const r = await engine.resolve({ ...REQ_BASE, mode: 'prescriptif' });
    expect(r.value).toBe(15);                            // plafonné
    expect(r.receipt.rawValue).toBe(18);                 // valeur brute conservée
    expect(r.receipt.capApplied).toBe(true);
    expect(r.receipt.regulatoryViolations).toHaveLength(1);
    expect(r.receipt.mode).toBe('prescriptif');
  });

  it('mode par défaut = strict', async () => {
    const { version, condition } = l2(12);
    const d = dao({
      findBankReferenceVersion: vi.fn().mockResolvedValue(version),
      findBankReferenceConditions: vi.fn().mockResolvedValue([condition]),
      findRegulatoryRules: vi.fn().mockResolvedValue([rule(15)]),
    });
    const engine = new ResolutionEngine(d);
    const r = await engine.resolve(REQ_BASE);
    expect(r.receipt.mode).toBe('strict');
  });

  it('cap_min — flag violation si valeur en dessous du plancher', async () => {
    const { version, condition } = l2(0.5);
    const d = dao({
      findBankReferenceVersion: vi.fn().mockResolvedValue(version),
      findBankReferenceConditions: vi.fn().mockResolvedValue([condition]),
      findRegulatoryRules: vi.fn().mockResolvedValue([rule(2.0, 'cap_min')]),
    });
    const engine = new ResolutionEngine(d);
    const r = await engine.resolve(REQ_BASE);
    expect(r.receipt.regulatoryViolations).toHaveLength(1);
    expect(r.receipt.regulatoryViolations[0].capValue).toBe(2.0);
  });
});

// ============================================================================
// RECEIPT SIGNING (chaque résolution → signature + hash)
// ============================================================================

describe('ResolutionEngine — receipt signing', () => {
  it('chaque receipt est signé avec hash + previousHash chaîné', async () => {
    const { version, condition } = l2(12);
    const d = dao({
      findBankReferenceVersion: vi.fn().mockResolvedValue(version),
      findBankReferenceConditions: vi.fn().mockResolvedValue([condition]),
    });
    const signer = createDevSigner('tnt-1');
    const engine = new ResolutionEngine(d, signer);

    const r1 = await engine.resolve({ ...REQ_BASE, rubricCode: 'decouverts.taux_autorise' });
    const r2 = await engine.resolve({ ...REQ_BASE, rubricCode: 'decouverts.taux_autorise', referenceDate: new Date('2025-07-01') });

    expect(r1.receipt.signature).toMatch(/^[a-f0-9]{64}$/);
    expect(r1.receipt.previousHash).toBeNull();
    expect(r2.receipt.previousHash).toBe(r1.receipt.receiptHash);

    const verify1 = await signer.verify(r1.receipt);
    const verify2 = await signer.verify(r2.receipt);
    expect(verify1.ok).toBe(true);
    expect(verify2.ok).toBe(true);
  });
});

// ============================================================================
// ADVERSARIAL — cas piégeux
// ============================================================================

describe('ResolutionEngine — cas adversariaux', () => {
  it('plusieurs L4 simultanées : la plus récente par signed_at gagne', async () => {
    const a1: Agreement = {
      id: 'agr-old', layer: 4, scopeOrgId: 'org-1', bankId: 'bank-1',
      accountId: null, agreementLabel: 'Old', signedAt: new Date('2024-01-01'),
      validFrom: new Date('2024-01-01'), validTo: null,
      recordedFrom: new Date(), recordedTo: null,
      sourcePdfUrl: null, sourceHashSha256: null,
      validationStatus: 'validated', validatedBy: null, supersededBy: null,
      createdAt: new Date(),
    };
    const a2: Agreement = { ...a1, id: 'agr-new', signedAt: new Date('2025-01-01'), agreementLabel: 'New' };
    const c1: AgreementCondition = {
      id: 'cc1', agreementId: 'agr-old', rubricCode: 'decouverts.taux_autorise',
      dimensions: null, valueNumeric: 11, valueFormula: null,
      pdfBbox: null, pdfPage: null, notes: null, createdAt: new Date(),
    };
    const c2: AgreementCondition = { ...c1, id: 'cc2', agreementId: 'agr-new', valueNumeric: 9 };

    const d = dao({
      findAgreements: vi.fn().mockImplementation((_o, _b, _a, layer) => {
        return Promise.resolve(layer === 4 ? [a1, a2] : []);
      }),
      findAgreementConditions: vi.fn().mockImplementation((agId: string) => {
        if (agId === 'agr-old') return Promise.resolve([c1]);
        if (agId === 'agr-new') return Promise.resolve([c2]);
        return Promise.resolve([]);
      }),
    });
    const engine = new ResolutionEngine(d);
    const r = await engine.resolve(REQ_BASE);
    expect(r.value).toBe(9);                            // la plus récente
  });

  it('dimensions partielles : fallback sur condition non-dimensionnelle', async () => {
    const { version } = l2(0);
    const dimensional: BankReferenceCondition = {
      id: 'c-pme', referenceVersionId: 'v-1', rubricCode: 'decouverts.taux_autorise',
      dimensions: { profil: 'pme' } as never, valueNumeric: 10,
      valueFormula: null, pdfBbox: null, pdfPage: null, notes: null,
      createdAt: new Date(),
    };
    const fallback: BankReferenceCondition = {
      ...dimensional, id: 'c-default', dimensions: null, valueNumeric: 14,
    };
    const d = dao({
      findBankReferenceVersion: vi.fn().mockResolvedValue(version),
      findBankReferenceConditions: vi.fn().mockResolvedValue([dimensional, fallback]),
    });
    const engine = new ResolutionEngine(d);
    // Request sans profil → doit prendre le fallback (14), pas la dimensionnelle
    const r = await engine.resolve(REQ_BASE);
    expect(r.value).toBe(14);
  });

  it('aucune valeur résolvable → ResolutionError explicite', async () => {
    const engine = new ResolutionEngine(dao());
    await expect(engine.resolve(REQ_BASE)).rejects.toThrow(/Aucune condition résolvable/);
  });

  it('cache invalidé par mode différent (strict ≠ prescriptif)', async () => {
    const { version, condition } = l2(18);
    const fnVersion = vi.fn().mockResolvedValue(version);
    const d = dao({
      findBankReferenceVersion: fnVersion,
      findBankReferenceConditions: vi.fn().mockResolvedValue([condition]),
      findRegulatoryRules: vi.fn().mockResolvedValue([rule(15)]),
    });
    const engine = new ResolutionEngine(d);

    const strict = await engine.resolve({ ...REQ_BASE, mode: 'strict' });
    const prescr = await engine.resolve({ ...REQ_BASE, mode: 'prescriptif' });

    expect(strict.value).toBe(18);
    expect(prescr.value).toBe(15);
    // Same date+rubric, but different mode → 2 distinct resolutions
    expect(fnVersion).toHaveBeenCalledTimes(2);
  });

  it('ancestors profonds : remontée L3 jusqu\'à la racine', async () => {
    const accCtx = ctx();
    accCtx.organization.parentId = 'org-mid';
    accCtx.ancestors = [
      { ...accCtx.organization, id: 'org-root', orgType: 'group', parentId: null, legalName: 'ROOT' },
      { ...accCtx.organization, id: 'org-mid', orgType: 'group', parentId: 'org-root', legalName: 'MID' },
    ];

    const a3: Agreement = {
      id: 'agr-grp', layer: 3, scopeOrgId: 'org-root', bankId: 'bank-1',
      accountId: null, agreementLabel: 'Group ROOT', signedAt: new Date('2025-01-01'),
      validFrom: new Date('2025-01-01'), validTo: null,
      recordedFrom: new Date(), recordedTo: null,
      sourcePdfUrl: null, sourceHashSha256: null,
      validationStatus: 'validated', validatedBy: null, supersededBy: null,
      createdAt: new Date(),
    };
    const c3: AgreementCondition = {
      id: 'c3', agreementId: 'agr-grp', rubricCode: 'decouverts.taux_autorise',
      dimensions: null, valueNumeric: 8.5, valueFormula: null,
      pdfBbox: null, pdfPage: null, notes: null, createdAt: new Date(),
    };

    const d = dao({
      getAccountContext: vi.fn().mockResolvedValue(accCtx),
      findAgreements: vi.fn().mockImplementation((orgId: string, _b: string, _a: string | null, layer: number) => {
        if (layer === 3 && orgId === 'org-root') return Promise.resolve([a3]);
        return Promise.resolve([]);
      }),
      findAgreementConditions: vi.fn().mockResolvedValue([c3]),
    });
    const engine = new ResolutionEngine(d);
    const r = await engine.resolve(REQ_BASE);
    expect(r.value).toBe(8.5);
    expect(r.receipt.layerUsed).toBe(3);
  });

  it('L5 sur compte spécifique surcharge L4 sur même compte', async () => {
    const a4: Agreement = {
      id: 'a4', layer: 4, scopeOrgId: 'org-1', bankId: 'bank-1',
      accountId: null, agreementLabel: 'L4', signedAt: new Date('2024-12-01'),
      validFrom: new Date('2025-01-01'), validTo: null,
      recordedFrom: new Date(), recordedTo: null,
      sourcePdfUrl: null, sourceHashSha256: null,
      validationStatus: 'validated', validatedBy: null, supersededBy: null,
      createdAt: new Date(),
    };
    const a5: Agreement = { ...a4, id: 'a5', layer: 5, accountId: 'acc-1', agreementLabel: 'L5 ponctuel' };
    const c4: AgreementCondition = {
      id: 'c4', agreementId: 'a4', rubricCode: 'decouverts.taux_autorise',
      dimensions: null, valueNumeric: 11.5, valueFormula: null,
      pdfBbox: null, pdfPage: null, notes: null, createdAt: new Date(),
    };
    const c5: AgreementCondition = { ...c4, id: 'c5', agreementId: 'a5', valueNumeric: 6.0 };

    const d = dao({
      findAgreements: vi.fn().mockImplementation((_o: string, _b: string, _a: string | null, layer: number) => {
        if (layer === 5) return Promise.resolve([a5]);
        if (layer === 4) return Promise.resolve([a4]);
        return Promise.resolve([]);
      }),
      findAgreementConditions: vi.fn().mockImplementation((agId: string) => {
        if (agId === 'a4') return Promise.resolve([c4]);
        if (agId === 'a5') return Promise.resolve([c5]);
        return Promise.resolve([]);
      }),
    });
    const engine = new ResolutionEngine(d);
    const r = await engine.resolve(REQ_BASE);
    expect(r.value).toBe(6.0);
    expect(r.receipt.layerUsed).toBe(5);
  });

  it('opérations en parallèle (resolveMany) : la chaîne reste cohérente', async () => {
    const { version, condition } = l2(12);
    const d = dao({
      findBankReferenceVersion: vi.fn().mockResolvedValue(version),
      findBankReferenceConditions: vi.fn().mockResolvedValue([condition]),
    });
    const engine = new ResolutionEngine(d);
    const requests: ResolutionRequest[] = [
      { ...REQ_BASE, referenceDate: new Date('2025-01-01') },
      { ...REQ_BASE, referenceDate: new Date('2025-02-01') },
      { ...REQ_BASE, referenceDate: new Date('2025-03-01') },
    ];
    const results = await engine.resolveMany(requests);
    expect(results).toHaveLength(3);
    // Chaîne intacte : r2.previous = r1.hash, r3.previous = r2.hash
    expect(results[1].receipt.previousHash).toBe(results[0].receipt.receiptHash);
    expect(results[2].receipt.previousHash).toBe(results[1].receipt.receiptHash);
  });
});
