// ============================================================================
// CDC — Zustand Store
// State management pour l'interface CDC
// ============================================================================

import { create } from 'zustand';
import type {
  CdcBank,
  CdcOrganization,
  CdcBankAccount,
  Agreement,
  CdcAuditSession,
  Ecart,
  RegulatoryJurisdiction,
} from '../types';
import { CdcService } from '../services/CdcService';

interface CdcState {
  // Data
  banks: CdcBank[];
  organizations: CdcOrganization[];
  selectedOrgId: string | null;
  accounts: CdcBankAccount[];
  agreements: Agreement[];
  auditSessions: CdcAuditSession[];
  selectedSessionId: string | null;
  ecarts: Ecart[];
  jurisdictions: RegulatoryJurisdiction[];

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  loadBanks: (zone?: string) => Promise<void>;
  loadOrganizations: (tenantId: string) => Promise<void>;
  selectOrganization: (orgId: string) => void;
  loadAccounts: (orgId: string) => Promise<void>;
  loadAgreements: (orgId: string, bankId?: string) => Promise<void>;
  loadAuditSessions: (tenantId: string) => Promise<void>;
  selectAuditSession: (sessionId: string) => Promise<void>;
  loadJurisdictions: () => Promise<void>;
  seedTaxonomy: () => Promise<number>;
  clearError: () => void;
}

let service: CdcService | null = null;

function getService(): CdcService {
  if (!service) {
    service = new CdcService();
  }
  return service;
}

export const useCdcStore = create<CdcState>((set) => ({
  banks: [],
  organizations: [],
  selectedOrgId: null,
  accounts: [],
  agreements: [],
  auditSessions: [],
  selectedSessionId: null,
  ecarts: [],
  jurisdictions: [],
  isLoading: false,
  error: null,

  loadBanks: async (zone) => {
    set({ isLoading: true, error: null });
    try {
      const banks = await getService().listBanks(zone);
      set({ banks, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  loadOrganizations: async (tenantId) => {
    set({ isLoading: true, error: null });
    try {
      const organizations = await getService().listOrganizations(tenantId);
      set({ organizations, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  selectOrganization: (orgId) => {
    set({ selectedOrgId: orgId, accounts: [], agreements: [] });
  },

  loadAccounts: async (orgId) => {
    set({ isLoading: true, error: null });
    try {
      const accounts = await getService().listBankAccounts(orgId);
      set({ accounts, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  loadAgreements: async (orgId, bankId) => {
    set({ isLoading: true, error: null });
    try {
      const agreements = await getService().listAgreements(orgId, bankId);
      set({ agreements, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  loadAuditSessions: async (tenantId) => {
    set({ isLoading: true, error: null });
    try {
      const auditSessions = await getService().getAuditSessions(tenantId);
      set({ auditSessions, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  selectAuditSession: async (sessionId) => {
    set({ isLoading: true, error: null, selectedSessionId: sessionId });
    try {
      const ecarts = await getService().getAuditEcarts(sessionId);
      set({ ecarts, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  loadJurisdictions: async () => {
    set({ isLoading: true, error: null });
    try {
      const jurisdictions = await getService().listJurisdictions();
      set({ jurisdictions, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  seedTaxonomy: async () => {
    set({ isLoading: true, error: null });
    try {
      const count = await getService().seedTaxonomy();
      set({ isLoading: false });
      return count;
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
      return 0;
    }
  },

  clearError: () => set({ error: null }),
}));
