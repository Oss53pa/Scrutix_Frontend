import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Bank, BankConditions, FeeSchedule, InterestRate, ArchivedDocument, ConditionGrid } from '../types';

// Types pour les zones monétaires
export type MonetaryZone = 'CEMAC' | 'UEMOA';

export interface BankWithZone extends Omit<Bank, 'id' | 'createdAt' | 'updatedAt'> {
  zone: MonetaryZone;
}

// Banques CEMAC (Communauté Économique et Monétaire de l'Afrique Centrale)
// Pays: Cameroun, Centrafrique, Congo, Gabon, Guinée Équatoriale, Tchad
// Monnaie: XAF (Franc CFA BEAC)
const CEMAC_BANKS: BankWithZone[] = [
  // Cameroun
  { code: 'ABORECMX', name: 'Afriland First Bank', country: 'CM', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'BICCMCMX', name: 'BICEC - Banque Internationale du Cameroun', country: 'CM', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'SGCMCMX', name: 'Société Générale Cameroun', country: 'CM', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'SCBLCMCX', name: 'SCB Cameroun - Standard Chartered', country: 'CM', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'ECABORDC', name: 'Ecobank Cameroun', country: 'CM', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'UBACMCMX', name: 'UBA Cameroun', country: 'CM', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'CBCXCMCX', name: 'Commercial Bank Cameroun (CBC)', country: 'CM', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'BGFICMCX', name: 'BGFIBank Cameroun', country: 'CM', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'ATLNCMCX', name: 'Banque Atlantique Cameroun', country: 'CM', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'CITYCMCX', name: 'Citibank Cameroun', country: 'CM', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'NSIACMCX', name: 'NSIA Banque Cameroun', country: 'CM', zone: 'CEMAC', conditions: null, isActive: true },
  // Gabon
  { code: 'BGFIGABX', name: 'BGFIBank Gabon', country: 'GA', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'BICIGABX', name: 'BICIG - Banque Internationale du Commerce', country: 'GA', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'UBGAGABX', name: 'UGB - Union Gabonaise de Banque', country: 'GA', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'ECABGABX', name: 'Ecobank Gabon', country: 'GA', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'ORAGABX', name: 'Orabank Gabon', country: 'GA', zone: 'CEMAC', conditions: null, isActive: true },
  // Congo
  { code: 'LCBPCGCX', name: 'La Congolaise de Banque (LCB)', country: 'CG', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'BGFICGCX', name: 'BGFIBank Congo', country: 'CG', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'ECABCGCX', name: 'Ecobank Congo', country: 'CG', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'UBACGCXX', name: 'UBA Congo', country: 'CG', zone: 'CEMAC', conditions: null, isActive: true },
  // Tchad
  { code: 'ECABTDCX', name: 'Ecobank Tchad', country: 'TD', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'SGCBTDCX', name: 'Société Générale Tchad', country: 'TD', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'UBATDNDJ', name: 'UBA Tchad', country: 'TD', zone: 'CEMAC', conditions: null, isActive: true },
  // Centrafrique
  { code: 'ECABCFCX', name: 'Ecobank Centrafrique', country: 'CF', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'CBCACFCX', name: 'CBCA - Commercial Bank Centrafrique', country: 'CF', zone: 'CEMAC', conditions: null, isActive: true },
  // Guinée Équatoriale
  { code: 'BGFIGQCX', name: 'BGFIBank Guinée Équatoriale', country: 'GQ', zone: 'CEMAC', conditions: null, isActive: true },
  { code: 'CCEIGNMG', name: 'CCEI Bank GE', country: 'GQ', zone: 'CEMAC', conditions: null, isActive: true },
];

// Banques UEMOA (Union Économique et Monétaire Ouest Africaine)
// Pays: Bénin, Burkina Faso, Côte d'Ivoire, Guinée-Bissau, Mali, Niger, Sénégal, Togo
// Monnaie: XOF (Franc CFA BCEAO)
const UEMOA_BANKS: BankWithZone[] = [
  // Côte d'Ivoire
  { code: 'SGBCCICI', name: 'SGBCI - Société Générale Côte d\'Ivoire', country: 'CI', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'BICICICX', name: 'BICICI - Banque Internationale pour le Commerce', country: 'CI', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'ECABCICI', name: 'Ecobank Côte d\'Ivoire', country: 'CI', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'BOACICIX', name: 'BOA Côte d\'Ivoire - Bank of Africa', country: 'CI', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'NSIACICI', name: 'NSIA Banque Côte d\'Ivoire', country: 'CI', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'COBACICI', name: 'Coris Bank International CI', country: 'CI', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'ATLNCICI', name: 'Banque Atlantique Côte d\'Ivoire', country: 'CI', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'ORACICIX', name: 'Orabank Côte d\'Ivoire', country: 'CI', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'UBACICIX', name: 'UBA Côte d\'Ivoire', country: 'CI', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'BGFICICI', name: 'BGFIBank Côte d\'Ivoire', country: 'CI', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'BRDTCICX', name: 'Bridge Bank Côte d\'Ivoire', country: 'CI', zone: 'UEMOA', conditions: null, isActive: true },
  // Sénégal
  { code: 'CBAOSNDA', name: 'CBAO Groupe Attijariwafa Bank', country: 'SN', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'SGBSSNDA', name: 'Société Générale Sénégal', country: 'SN', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'ECABSNDA', name: 'Ecobank Sénégal', country: 'SN', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'BOASNSND', name: 'BOA Sénégal - Bank of Africa', country: 'SN', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'BICISNDX', name: 'BICIS - BNP Paribas Sénégal', country: 'SN', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'ORASNDA', name: 'Orabank Sénégal', country: 'SN', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'UBASNSND', name: 'UBA Sénégal', country: 'SN', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'CORSSNDA', name: 'Coris Bank Sénégal', country: 'SN', zone: 'UEMOA', conditions: null, isActive: true },
  // Burkina Faso
  { code: 'COBABFBF', name: 'Coris Bank International Burkina', country: 'BF', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'ECABBFBF', name: 'Ecobank Burkina Faso', country: 'BF', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'BOABFBFX', name: 'BOA Burkina Faso', country: 'BF', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'SGBBBFBF', name: 'Société Générale Burkina Faso', country: 'BF', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'UBABFBFX', name: 'UBA Burkina Faso', country: 'BF', zone: 'UEMOA', conditions: null, isActive: true },
  // Mali
  { code: 'BDMMMLBX', name: 'BDM-SA - Banque de Développement du Mali', country: 'ML', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'ECABMLBA', name: 'Ecobank Mali', country: 'ML', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'BOAMLBAX', name: 'BOA Mali', country: 'ML', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'BIMSMLIX', name: 'BIM-SA - Banque Internationale du Mali', country: 'ML', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'CORSMLBA', name: 'Coris Bank Mali', country: 'ML', zone: 'UEMOA', conditions: null, isActive: true },
  // Bénin
  { code: 'ECABBJBJ', name: 'Ecobank Bénin', country: 'BJ', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'BOABJBJX', name: 'BOA Bénin', country: 'BJ', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'SGBEBJBJ', name: 'Société Générale Bénin', country: 'BJ', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'ORABBJBJ', name: 'Orabank Bénin', country: 'BJ', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'UBABJBJX', name: 'UBA Bénin', country: 'BJ', zone: 'UEMOA', conditions: null, isActive: true },
  // Togo
  { code: 'ECABTGTG', name: 'Ecobank Togo (Siège)', country: 'TG', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'BOATGTGX', name: 'BOA Togo', country: 'TG', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'ORATGTGX', name: 'Orabank Togo', country: 'TG', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'SGBTTGTG', name: 'Société Générale Togo', country: 'TG', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'UBATGTGX', name: 'UBA Togo', country: 'TG', zone: 'UEMOA', conditions: null, isActive: true },
  // Niger
  { code: 'ECABNENE', name: 'Ecobank Niger', country: 'NE', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'BOANENEX', name: 'BOA Niger', country: 'NE', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'SONIBNEX', name: 'Sonibank Niger', country: 'NE', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'ORANINE', name: 'Orabank Niger', country: 'NE', zone: 'UEMOA', conditions: null, isActive: true },
  // Guinée-Bissau
  { code: 'ECABGWGW', name: 'Ecobank Guinée-Bissau', country: 'GW', zone: 'UEMOA', conditions: null, isActive: true },
  { code: 'BOAGWGWX', name: 'BOA Guinée-Bissau', country: 'GW', zone: 'UEMOA', conditions: null, isActive: true },
];

// Combine all banks - CEMAC first (XAF), then UEMOA (XOF)
const DEFAULT_BANKS: BankWithZone[] = [...CEMAC_BANKS, ...UEMOA_BANKS];

interface BankState {
  banks: Bank[];
  selectedBankId: string | null;

  // Bank CRUD
  addBank: (bank: Omit<Bank, 'id' | 'createdAt' | 'updatedAt'>) => Bank;
  updateBank: (id: string, updates: Partial<Bank>) => void;
  deleteBank: (id: string) => void;
  getBank: (id: string) => Bank | undefined;
  getBankByCode: (code: string) => Bank | undefined;

  // Conditions management
  setConditions: (bankId: string, conditions: Omit<BankConditions, 'id'>) => void;
  updateConditions: (bankId: string, updates: Partial<BankConditions>) => void;
  addFee: (bankId: string, fee: FeeSchedule) => void;
  updateFee: (bankId: string, feeCode: string, updates: Partial<FeeSchedule>) => void;
  removeFee: (bankId: string, feeCode: string) => void;
  addInterestRate: (bankId: string, rate: InterestRate) => void;
  updateInterestRate: (bankId: string, rateType: InterestRate['type'], updates: Partial<InterestRate>) => void;
  removeInterestRate: (bankId: string, rateType: InterestRate['type']) => void;

  // Condition Grid management (versioning)
  addConditionGrid: (bankId: string, grid: Omit<ConditionGrid, 'id' | 'createdAt' | 'updatedAt'>) => ConditionGrid;
  updateConditionGrid: (bankId: string, gridId: string, updates: Partial<ConditionGrid>) => void;
  archiveConditionGrid: (bankId: string, gridId: string) => void;
  deleteConditionGrid: (bankId: string, gridId: string) => void;
  setActiveGrid: (bankId: string, gridId: string) => void;
  getGridForDate: (bankId: string, date: Date) => ConditionGrid | null;
  getActiveGrid: (bankId: string) => ConditionGrid | null;
  getAllGrids: (bankId: string) => ConditionGrid[];

  // Document management
  addDocument: (bankId: string, document: ArchivedDocument) => void;
  removeDocument: (bankId: string, documentId: string) => void;
  setDocumentActive: (bankId: string, documentId: string, isActive: boolean) => void;

  // Selection
  setSelectedBank: (id: string | null) => void;

  // Initialize defaults
  initializeDefaults: () => void;
}

export const useBankStore = create<BankState>()(
  persist(
    (set, get) => ({
      banks: [],
      selectedBankId: null,

      addBank: (bankData) => {
        const now = new Date();
        const bank: Bank = {
          id: uuidv4(),
          ...bankData,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          banks: [...state.banks, bank],
        }));
        return bank;
      },

      updateBank: (id, updates) => {
        set((state) => ({
          banks: state.banks.map((b) =>
            b.id === id ? { ...b, ...updates, updatedAt: new Date() } : b
          ),
        }));
      },

      deleteBank: (id) => {
        set((state) => ({
          banks: state.banks.filter((b) => b.id !== id),
          selectedBankId: state.selectedBankId === id ? null : state.selectedBankId,
        }));
      },

      getBank: (id) => {
        return get().banks.find((b) => b.id === id);
      },

      getBankByCode: (code) => {
        return get().banks.find((b) => b.code === code);
      },

      setConditions: (bankId, conditionsData) => {
        const conditions: BankConditions = {
          id: uuidv4(),
          ...conditionsData,
        };
        set((state) => ({
          banks: state.banks.map((b) =>
            b.id === bankId ? { ...b, conditions, updatedAt: new Date() } : b
          ),
        }));
      },

      updateConditions: (bankId, updates) => {
        set((state) => ({
          banks: state.banks.map((b) =>
            b.id === bankId && b.conditions
              ? { ...b, conditions: { ...b.conditions, ...updates }, updatedAt: new Date() }
              : b
          ),
        }));
      },

      addFee: (bankId, fee) => {
        set((state) => ({
          banks: state.banks.map((b) =>
            b.id === bankId && b.conditions
              ? {
                  ...b,
                  conditions: {
                    ...b.conditions,
                    fees: [...b.conditions.fees, fee],
                  },
                  updatedAt: new Date(),
                }
              : b
          ),
        }));
      },

      updateFee: (bankId, feeCode, updates) => {
        set((state) => ({
          banks: state.banks.map((b) =>
            b.id === bankId && b.conditions
              ? {
                  ...b,
                  conditions: {
                    ...b.conditions,
                    fees: b.conditions.fees.map((f) =>
                      f.code === feeCode ? { ...f, ...updates } : f
                    ),
                  },
                  updatedAt: new Date(),
                }
              : b
          ),
        }));
      },

      removeFee: (bankId, feeCode) => {
        set((state) => ({
          banks: state.banks.map((b) =>
            b.id === bankId && b.conditions
              ? {
                  ...b,
                  conditions: {
                    ...b.conditions,
                    fees: b.conditions.fees.filter((f) => f.code !== feeCode),
                  },
                  updatedAt: new Date(),
                }
              : b
          ),
        }));
      },

      addInterestRate: (bankId, rate) => {
        set((state) => ({
          banks: state.banks.map((b) =>
            b.id === bankId && b.conditions
              ? {
                  ...b,
                  conditions: {
                    ...b.conditions,
                    interestRates: [...b.conditions.interestRates, rate],
                  },
                  updatedAt: new Date(),
                }
              : b
          ),
        }));
      },

      updateInterestRate: (bankId, rateType, updates) => {
        set((state) => ({
          banks: state.banks.map((b) =>
            b.id === bankId && b.conditions
              ? {
                  ...b,
                  conditions: {
                    ...b.conditions,
                    interestRates: b.conditions.interestRates.map((r) =>
                      r.type === rateType ? { ...r, ...updates } : r
                    ),
                  },
                  updatedAt: new Date(),
                }
              : b
          ),
        }));
      },

      removeInterestRate: (bankId, rateType) => {
        set((state) => ({
          banks: state.banks.map((b) =>
            b.id === bankId && b.conditions
              ? {
                  ...b,
                  conditions: {
                    ...b.conditions,
                    interestRates: b.conditions.interestRates.filter((r) => r.type !== rateType),
                  },
                  updatedAt: new Date(),
                }
              : b
          ),
        }));
      },

      addDocument: (bankId, document) => {
        set((state) => ({
          banks: state.banks.map((b) => {
            if (b.id !== bankId) return b;

            // If bank has no conditions yet, create default ones
            const existingConditions = b.conditions || {
              id: uuidv4(),
              bankCode: b.code,
              bankName: b.name,
              country: b.country,
              currency: 'XAF',
              effectiveDate: new Date(),
              fees: [],
              interestRates: [],
              isActive: true,
              documents: [],
            };

            return {
              ...b,
              conditions: {
                ...existingConditions,
                documents: [...(existingConditions.documents || []), document],
              },
              updatedAt: new Date(),
            };
          }),
        }));
      },

      removeDocument: (bankId, documentId) => {
        set((state) => ({
          banks: state.banks.map((b) =>
            b.id === bankId && b.conditions
              ? {
                  ...b,
                  conditions: {
                    ...b.conditions,
                    documents: (b.conditions.documents || []).filter((d) => d.id !== documentId),
                  },
                  updatedAt: new Date(),
                }
              : b
          ),
        }));
      },

      setDocumentActive: (bankId, documentId, isActive) => {
        set((state) => ({
          banks: state.banks.map((b) =>
            b.id === bankId && b.conditions
              ? {
                  ...b,
                  conditions: {
                    ...b.conditions,
                    documents: (b.conditions.documents || []).map((d) =>
                      d.id === documentId ? { ...d, isActive } : d
                    ),
                  },
                  updatedAt: new Date(),
                }
              : b
          ),
        }));
      },

      // ============================================
      // Condition Grid Management (Versioning)
      // ============================================

      addConditionGrid: (bankId, gridData) => {
        const now = new Date();
        const grid: ConditionGrid = {
          id: uuidv4(),
          ...gridData,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          banks: state.banks.map((b) => {
            if (b.id !== bankId) return b;

            const existingGrids = b.conditionGrids || [];

            // Si c'est la première grille active, la définir comme active
            const isFirstActiveGrid = grid.status === 'active' &&
              !existingGrids.some(g => g.status === 'active');

            return {
              ...b,
              conditionGrids: [...existingGrids, grid],
              activeGridId: isFirstActiveGrid ? grid.id : b.activeGridId,
              // Synchroniser avec conditions pour rétrocompatibilité
              conditions: grid.status === 'active' && isFirstActiveGrid ? grid.conditions : b.conditions,
              updatedAt: now,
            };
          }),
        }));

        return grid;
      },

      updateConditionGrid: (bankId, gridId, updates) => {
        const now = new Date();
        set((state) => ({
          banks: state.banks.map((b) => {
            if (b.id !== bankId || !b.conditionGrids) return b;

            const updatedGrids = b.conditionGrids.map((g) =>
              g.id === gridId ? { ...g, ...updates, updatedAt: now } : g
            );

            // Si on met à jour la grille active, synchroniser avec conditions
            const updatedGrid = updatedGrids.find(g => g.id === gridId);
            const shouldSyncConditions = b.activeGridId === gridId && updatedGrid;

            return {
              ...b,
              conditionGrids: updatedGrids,
              conditions: shouldSyncConditions ? updatedGrid.conditions : b.conditions,
              updatedAt: now,
            };
          }),
        }));
      },

      archiveConditionGrid: (bankId, gridId) => {
        const now = new Date();
        set((state) => ({
          banks: state.banks.map((b) => {
            if (b.id !== bankId || !b.conditionGrids) return b;

            const updatedGrids = b.conditionGrids.map((g) =>
              g.id === gridId
                ? { ...g, status: 'archived' as const, updatedAt: now }
                : g
            );

            // Si on archive la grille active, trouver la prochaine grille active
            let newActiveGridId = b.activeGridId;
            let newConditions = b.conditions;

            if (b.activeGridId === gridId) {
              const nextActiveGrid = updatedGrids.find(g =>
                g.status === 'active' && g.id !== gridId
              );
              newActiveGridId = nextActiveGrid?.id;
              newConditions = nextActiveGrid?.conditions || null;
            }

            return {
              ...b,
              conditionGrids: updatedGrids,
              activeGridId: newActiveGridId,
              conditions: newConditions,
              updatedAt: now,
            };
          }),
        }));
      },

      deleteConditionGrid: (bankId, gridId) => {
        const now = new Date();
        set((state) => ({
          banks: state.banks.map((b) => {
            if (b.id !== bankId || !b.conditionGrids) return b;

            const filteredGrids = b.conditionGrids.filter((g) => g.id !== gridId);

            // Si on supprime la grille active, trouver une nouvelle grille active
            let newActiveGridId = b.activeGridId;
            let newConditions = b.conditions;

            if (b.activeGridId === gridId) {
              const nextActiveGrid = filteredGrids.find(g => g.status === 'active');
              newActiveGridId = nextActiveGrid?.id;
              newConditions = nextActiveGrid?.conditions || null;
            }

            return {
              ...b,
              conditionGrids: filteredGrids,
              activeGridId: newActiveGridId,
              conditions: newConditions,
              updatedAt: now,
            };
          }),
        }));
      },

      setActiveGrid: (bankId, gridId) => {
        const now = new Date();
        set((state) => ({
          banks: state.banks.map((b) => {
            if (b.id !== bankId || !b.conditionGrids) return b;

            const targetGrid = b.conditionGrids.find(g => g.id === gridId);
            if (!targetGrid) return b;

            // Mettre à jour le statut des grilles
            const updatedGrids = b.conditionGrids.map((g) => ({
              ...g,
              status: g.id === gridId
                ? 'active' as const
                : (g.status === 'active' ? 'archived' as const : g.status),
              updatedAt: g.id === gridId || g.status === 'active' ? now : g.updatedAt,
            }));

            return {
              ...b,
              conditionGrids: updatedGrids,
              activeGridId: gridId,
              conditions: targetGrid.conditions,
              updatedAt: now,
            };
          }),
        }));
      },

      getGridForDate: (bankId, date) => {
        const bank = get().banks.find(b => b.id === bankId);
        if (!bank || !bank.conditionGrids) return null;

        // Trouver la grille applicable pour la date donnée
        // Priorité: grille dont la date d'effet <= date et pas de date d'expiration ou expiration > date
        const applicableGrids = bank.conditionGrids.filter(g => {
          const effectiveDate = new Date(g.effectiveDate);
          const expirationDate = g.expirationDate ? new Date(g.expirationDate) : null;
          const targetDate = new Date(date);

          const isEffective = effectiveDate <= targetDate;
          const notExpired = !expirationDate || expirationDate > targetDate;

          return isEffective && notExpired && g.status !== 'draft';
        });

        if (applicableGrids.length === 0) return null;

        // Retourner la grille avec la date d'effet la plus récente
        return applicableGrids.reduce((latest, current) => {
          const latestDate = new Date(latest.effectiveDate);
          const currentDate = new Date(current.effectiveDate);
          return currentDate > latestDate ? current : latest;
        });
      },

      getActiveGrid: (bankId) => {
        const bank = get().banks.find(b => b.id === bankId);
        if (!bank || !bank.conditionGrids || !bank.activeGridId) return null;
        return bank.conditionGrids.find(g => g.id === bank.activeGridId) || null;
      },

      getAllGrids: (bankId) => {
        const bank = get().banks.find(b => b.id === bankId);
        if (!bank || !bank.conditionGrids) return [];
        // Trier par date d'effet décroissante (plus récent en premier)
        return [...bank.conditionGrids].sort((a, b) =>
          new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
        );
      },

      setSelectedBank: (id) => {
        set({ selectedBankId: id });
      },

      initializeDefaults: () => {
        const { banks } = get();
        if (banks.length === 0) {
          const now = new Date();
          const defaultBanks = DEFAULT_BANKS.map((b) => ({
            ...b,
            id: uuidv4(),
            createdAt: now,
            updatedAt: now,
          }));
          set({ banks: defaultBanks });
        }
      },
    }),
    {
      name: 'scrutix-banks',
      partialize: (state) => ({
        banks: state.banks,
      }),
    }
  )
);
