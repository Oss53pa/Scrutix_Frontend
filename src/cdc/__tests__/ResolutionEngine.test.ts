// ============================================================================
// Tests — ResolutionEngine (5-layer cascade)
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { ResolutionEngine, type CdcDataAccess } from '../resolution/ResolutionEngine';
import type {
  AccountContext,
  Agreement,
  AgreementCondition,
  BankReferenceCondition,
  BankReferenceVersion,
  RegulatoryRule,
  ResolutionRequest,
} from '../types';

// ==========================================================================
// Mock DAO
// ==========================================================================

function createMockContext(): AccountContext {
  return {
    account: {
      id: 'acc-1',
      organizationId: 'org-1',
      bankId: 'bank-1',
      accountNumber: '001234567890',
      accountLabel: 'Compte courant',
      accountType: 'courant',
      currency: 'XOF',
      iban: null,
      openedAt: null,
      closedAt: null,
      isActive: true,
      createdAt: new Date(),
    },
    organization: {
      id: 'org-1',
      tenantId: 'tenant-1',
      parentId: 'group-1',
      legalName: 'ACME SARL',
      tradeName: 'ACME',
      orgType: 'client',
      rccm: null,
      taxId: null,
      countryIso: 'CI',
      isActive: true,
      createdAt: new Date(),
    },
    ancestors: [
      {
        id: 'group-1',
        tenantId: 'tenant-1',
        parentId: null,
        legalName: 'ACME Holding',
        tradeName: null,
        orgType: 'group',
        rccm: null,
        taxId: null,
        countryIso: 'CI',
        isActive: true,
        createdAt: new Date(),
      },
    ],
    bank: {
      id: 'bank-1',
      code: 'SGCI',
      legalName: 'Société Générale CI',
      countryIso: 'CI',
      zone: 'UEMOA',
      jurisdictionIds: ['juris-bceao'],
      swiftBic: null,
      parentGroup: null,
      isActive: true,
      createdAt: new Date(),
    },
    jurisdictions: [
      {
        id: 'juris-bceao',
        code: 'BCEAO',
        name: 'BCEAO',
        scopeCountries: ['CI', 'SN'],
        parentId: null,
        createdAt: new Date(),
      },
    ],
  };
}

function createMockDao(overrides: Partial<CdcDataAccess> = {}): CdcDataAccess {
  return {
    getAccountContext: vi.fn().mockResolvedValue(createMockContext()),
    findAgreements: vi.fn().mockResolvedValue([]),
    findAgreementConditions: vi.fn().mockResolvedValue([]),
    findBankReferenceVersion: vi.fn().mockResolvedValue(null),
    findBankReferenceConditions: vi.fn().mockResolvedValue([]),
    findRegulatoryRules: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const BASE_REQUEST: ResolutionRequest = {
  accountId: 'acc-1',
  rubricCode: 'decouverts.taux_autorise',
  referenceDate: new Date('2025-01-15'),
};

// ==========================================================================
// Tests
// ==========================================================================

describe('ResolutionEngine', () => {
  describe('cascade descendante', () => {
    it('résout depuis L4 quand une convention client existe', async () => {
      const agreement: Agreement = {
        id: 'agr-l4',
        layer: 4,
        scopeOrgId: 'org-1',
        bankId: 'bank-1',
        accountId: null,
        agreementLabel: 'Convention ACME 2025',
        signedAt: new Date('2024-12-01'),
        validFrom: new Date('2025-01-01'),
        validTo: null,
        recordedFrom: new Date(),
        recordedTo: null,
        sourcePdfUrl: null,
        sourceHashSha256: null,
        validationStatus: 'validated',
        validatedBy: null,
        supersededBy: null,
        createdAt: new Date(),
      };

      const condition: AgreementCondition = {
        id: 'cond-1',
        agreementId: 'agr-l4',
        rubricCode: 'decouverts.taux_autorise',
        dimensions: null,
        valueNumeric: 11.5,
        valueFormula: null,
        pdfBbox: null,
        pdfPage: null,
        notes: null,
        createdAt: new Date(),
      };

      const dao = createMockDao({
        findAgreements: vi.fn().mockImplementation((_orgId, _bankId, _accId, layer) => {
          if (layer === 4) return Promise.resolve([agreement]);
          return Promise.resolve([]);
        }),
        findAgreementConditions: vi.fn().mockResolvedValue([condition]),
      });

      const engine = new ResolutionEngine(dao);
      const result = await engine.resolve(BASE_REQUEST);

      expect(result.value).toBe(11.5);
      expect(result.receipt.layerUsed).toBe(4);
      expect(result.receipt.sourceLabel).toContain('L4');
      expect(result.receipt.supersededLayers).toHaveLength(1); // L5 was skipped
    });

    it('fallback sur L2 quand aucune convention L3-L5', async () => {
      const version: BankReferenceVersion = {
        id: 'ref-v1',
        bankId: 'bank-1',
        versionLabel: 'CG SGCI 2025',
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: null,
        sourcePdfUrl: '/docs/sgci-2025.pdf',
        sourceHashSha256: 'abc123',
        validationStatus: 'published',
        validatedBy: null,
        validatedAt: null,
        publishedAt: new Date(),
        supersededBy: null,
        createdAt: new Date(),
      };

      const condition: BankReferenceCondition = {
        id: 'ref-cond-1',
        referenceVersionId: 'ref-v1',
        rubricCode: 'decouverts.taux_autorise',
        dimensions: null,
        valueNumeric: 14.0,
        valueFormula: null,
        pdfBbox: null,
        pdfPage: null,
        notes: null,
        createdAt: new Date(),
      };

      const dao = createMockDao({
        findBankReferenceVersion: vi.fn().mockResolvedValue(version),
        findBankReferenceConditions: vi.fn().mockResolvedValue([condition]),
      });

      const engine = new ResolutionEngine(dao);
      const result = await engine.resolve(BASE_REQUEST);

      expect(result.value).toBe(14.0);
      expect(result.receipt.layerUsed).toBe(2);
      expect(result.receipt.supersededLayers).toHaveLength(3); // L5, L4, L3 skipped
    });

    it('lève une erreur quand aucune couche ne résout', async () => {
      const dao = createMockDao();
      const engine = new ResolutionEngine(dao);

      await expect(engine.resolve(BASE_REQUEST)).rejects.toThrow('Aucune condition résolvable');
    });
  });

  describe('vérification L1', () => {
    it('détecte une violation réglementaire si taux > plafond L1', async () => {
      const version: BankReferenceVersion = {
        id: 'ref-v1',
        bankId: 'bank-1',
        versionLabel: 'CG',
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: null,
        sourcePdfUrl: '/docs/x.pdf',
        sourceHashSha256: 'x',
        validationStatus: 'published',
        validatedBy: null,
        validatedAt: null,
        publishedAt: new Date(),
        supersededBy: null,
        createdAt: new Date(),
      };

      const condition: BankReferenceCondition = {
        id: 'c1',
        referenceVersionId: 'ref-v1',
        rubricCode: 'decouverts.taux_autorise',
        dimensions: null,
        valueNumeric: 18.0, // Above usury cap
        valueFormula: null,
        pdfBbox: null,
        pdfPage: null,
        notes: null,
        createdAt: new Date(),
      };

      const rule: RegulatoryRule = {
        id: 'rule-usure',
        jurisdictionId: 'juris-bceao',
        rubricCode: 'decouverts.taux_autorise',
        productCategory: null,
        ruleType: 'cap_max',
        valueNumeric: 15.0,
        valueFormula: null,
        unit: 'percent',
        validFrom: new Date('2024-01-01'),
        validTo: null,
        sourceReference: 'BCEAO usure',
        sourceDocument: null,
        recordedAt: new Date(),
        recordedBy: null,
        supersededBy: null,
      };

      const dao = createMockDao({
        findBankReferenceVersion: vi.fn().mockResolvedValue(version),
        findBankReferenceConditions: vi.fn().mockResolvedValue([condition]),
        findRegulatoryRules: vi.fn().mockResolvedValue([rule]),
      });

      const engine = new ResolutionEngine(dao);
      const result = await engine.resolve(BASE_REQUEST);

      expect(result.value).toBe(18.0); // Value NOT capped — audit mode
      expect(result.receipt.regulatoryViolations).toHaveLength(1);
      expect(result.receipt.regulatoryViolations[0].code).toBe('E02');
      expect(result.receipt.regulatoryViolations[0].capValue).toBe(15.0);
    });
  });

  describe('filtrage dimensionnel', () => {
    it('sélectionne la condition dimensionnelle qui matche', async () => {
      const version: BankReferenceVersion = {
        id: 'ref-v1',
        bankId: 'bank-1',
        versionLabel: 'CG',
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: null,
        sourcePdfUrl: '/docs/x.pdf',
        sourceHashSha256: 'x',
        validationStatus: 'published',
        validatedBy: null,
        validatedAt: null,
        publishedAt: new Date(),
        supersededBy: null,
        createdAt: new Date(),
      };

      const conditions: BankReferenceCondition[] = [
        {
          id: 'c-pme',
          referenceVersionId: 'ref-v1',
          rubricCode: 'decouverts.taux_autorise',
          dimensions: { profil: 'pme' } as any,
          valueNumeric: 10.5,
          valueFormula: null,
          pdfBbox: null,
          pdfPage: null,
          notes: null,
          createdAt: new Date(),
        },
        {
          id: 'c-default',
          referenceVersionId: 'ref-v1',
          rubricCode: 'decouverts.taux_autorise',
          dimensions: null,
          valueNumeric: 14.0,
          valueFormula: null,
          pdfBbox: null,
          pdfPage: null,
          notes: null,
          createdAt: new Date(),
        },
      ];

      const dao = createMockDao({
        findBankReferenceVersion: vi.fn().mockResolvedValue(version),
        findBankReferenceConditions: vi.fn().mockResolvedValue(conditions),
      });

      const engine = new ResolutionEngine(dao);

      // Request with PME profile → should get 10.5
      const resultPme = await engine.resolve({
        ...BASE_REQUEST,
        dimensions: { profil: 'pme' },
      });
      expect(resultPme.value).toBe(10.5);

      // Clear cache for next test
      engine.clearCache();

      // Request without profile → should get 14.0 (catch-all)
      const resultDefault = await engine.resolve(BASE_REQUEST);
      expect(resultDefault.value).toBe(14.0);
    });
  });

  describe('cache', () => {
    it('utilise le cache pour les requêtes identiques', async () => {
      const version: BankReferenceVersion = {
        id: 'ref-v1',
        bankId: 'bank-1',
        versionLabel: 'CG',
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: null,
        sourcePdfUrl: '/docs/x.pdf',
        sourceHashSha256: 'x',
        validationStatus: 'published',
        validatedBy: null,
        validatedAt: null,
        publishedAt: new Date(),
        supersededBy: null,
        createdAt: new Date(),
      };

      const condition: BankReferenceCondition = {
        id: 'c1',
        referenceVersionId: 'ref-v1',
        rubricCode: 'decouverts.taux_autorise',
        dimensions: null,
        valueNumeric: 12.0,
        valueFormula: null,
        pdfBbox: null,
        pdfPage: null,
        notes: null,
        createdAt: new Date(),
      };

      const dao = createMockDao({
        findBankReferenceVersion: vi.fn().mockResolvedValue(version),
        findBankReferenceConditions: vi.fn().mockResolvedValue([condition]),
      });

      const engine = new ResolutionEngine(dao);

      await engine.resolve(BASE_REQUEST);
      await engine.resolve(BASE_REQUEST);

      // getAccountContext should only be called once (cached)
      expect(dao.getAccountContext).toHaveBeenCalledTimes(1);
    });
  });
});
