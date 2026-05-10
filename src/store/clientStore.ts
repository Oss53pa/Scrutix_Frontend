// ============================================================================
// ATLASBANX - Client Store (Supabase-backed, Iter 1)
// State mirrors Supabase tables atlasbanx.{clients,bank_accounts,bank_statements}.
// Pattern: optimistic local updates + background persistence via clientsRepo.
// Reports (ClientReport) remain local-only until Iter 2.
// ============================================================================

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  Client,
  BankAccount,
  BankStatement,
  ClientStatistics,
  ClientReport,
  Anomaly,
  Transaction,
} from '../types';
import { clientsRepo } from '../lib/repositories';
import { useAuthStore } from './authStore';
import { auditLog, AuditEventType } from '../services/auditTrail';

// Code used to identify the implicit "self" client in enterprise mode
const SELF_CLIENT_CODE = 'SELF';

interface ClientState {
  clients: Client[];
  statements: BankStatement[];
  reports: ClientReport[];
  selectedClientId: string | null;
  isHydrating: boolean;
  hydratedForUserId: string | null;
  error: string | null;

  // Hydration
  hydrateFromSupabase: () => Promise<void>;
  resetState: () => void;

  // Client CRUD
  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'accounts'>) => Client;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  getClient: (id: string) => Client | undefined;

  // Account management
  addAccount: (clientId: string, account: Omit<BankAccount, 'id' | 'clientId'>) => BankAccount;
  updateAccount: (clientId: string, accountId: string, updates: Partial<BankAccount>) => void;
  removeAccount: (clientId: string, accountId: string) => void;

  // Statement management
  addStatement: (
    clientId: string,
    statement: Omit<BankStatement, 'id' | 'clientId' | 'importedAt'>,
  ) => BankStatement;
  updateStatement: (id: string, updates: Partial<BankStatement>) => void;
  deleteStatement: (id: string) => void;
  getStatementsByClient: (clientId: string) => BankStatement[];

  // Report management (local-only until Iter 2)
  addReport: (report: Omit<ClientReport, 'id' | 'generatedAt'>) => ClientReport;
  updateReport: (id: string, updates: Partial<ClientReport>) => void;
  deleteReport: (id: string) => void;
  getReportsByClient: (clientId: string) => ClientReport[];

  // Statistics
  getClientStatistics: (
    clientId: string,
    transactions: Transaction[],
    anomalies: Anomaly[],
  ) => ClientStatistics;

  // Selection
  setSelectedClient: (id: string | null) => void;

  // Enterprise mode helper
  ensureSelfClient: (displayName?: string) => Client;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

function logError(operation: string, err: unknown) {
  console.error(`[clientStore] ${operation} failed:`, err);
}

// ----------------------------------------------------------------------------
// Store
// ----------------------------------------------------------------------------

export const useClientStore = create<ClientState>()((set, get) => ({
  clients: [],
  statements: [],
  reports: [],
  selectedClientId: null,
  isHydrating: false,
  hydratedForUserId: null,
  error: null,

  // --------------------------------------------------------------------------
  // Hydration
  // --------------------------------------------------------------------------

  hydrateFromSupabase: async () => {
    const userId = currentUserId();
    if (!userId) return;
    if (get().hydratedForUserId === userId) return;

    set({ isHydrating: true, error: null });
    try {
      const [clients, statements] = await Promise.all([
        clientsRepo.fetchAll(userId),
        clientsRepo.fetchAllStatements(userId),
      ]);
      set({
        clients,
        statements,
        isHydrating: false,
        hydratedForUserId: userId,
      });
    } catch (err) {
      logError('hydrateFromSupabase', err);
      set({
        isHydrating: false,
        error: err instanceof Error ? err.message : 'Erreur chargement clients',
      });
    }
  },

  resetState: () => {
    set({
      clients: [],
      statements: [],
      reports: [],
      selectedClientId: null,
      isHydrating: false,
      hydratedForUserId: null,
      error: null,
    });
  },

  // --------------------------------------------------------------------------
  // Clients
  // --------------------------------------------------------------------------

  addClient: (clientData) => {
    const now = new Date();
    const client: Client = {
      id: uuidv4(),
      ...clientData,
      accounts: [],
      createdAt: now,
      updatedAt: now,
    };

    // Optimistic local insert
    set((state) => ({ clients: [...state.clients, client] }));

    auditLog({
      eventType: AuditEventType.CLIENT_CREATED,
      resourceType: 'client',
      action: 'created',
      resourceId: client.id,
      clientId: client.id,
      payload: { name: client.name, code: client.code },
    });

    // Background persist
    const userId = currentUserId();
    if (userId) {
      clientsRepo.insert(userId, client).catch((err) => {
        logError('addClient', err);
        // Rollback on failure
        set((state) => ({
          clients: state.clients.filter((c) => c.id !== client.id),
          error: err instanceof Error ? err.message : 'Erreur création client',
        }));
      });
    }
    return client;
  },

  updateClient: (id, updates) => {
    const previous = get().clients.find((c) => c.id === id);
    set((state) => ({
      clients: state.clients.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c,
      ),
    }));

    auditLog({
      eventType: AuditEventType.CLIENT_UPDATED,
      resourceType: 'client',
      action: 'updated',
      resourceId: id,
      clientId: id,
      payload: { updatedFields: Object.keys(updates) },
    });

    const userId = currentUserId();
    if (userId && previous) {
      clientsRepo.update(userId, id, updates).catch((err) => {
        logError('updateClient', err);
        set((state) => ({
          clients: state.clients.map((c) => (c.id === id ? previous : c)),
          error: err instanceof Error ? err.message : 'Erreur mise à jour client',
        }));
      });
    }
  },

  deleteClient: (id) => {
    // Capture targeted snapshots for rollback (not the whole state)
    const deletedClient = get().clients.find((c) => c.id === id);
    const deletedStatements = get().statements.filter((s) => s.clientId === id);
    const deletedReports = get().reports.filter((r) => r.clientId === id);
    const prevSelectedId = get().selectedClientId;

    set((state) => ({
      clients: state.clients.filter((c) => c.id !== id),
      statements: state.statements.filter((s) => s.clientId !== id),
      reports: state.reports.filter((r) => r.clientId !== id),
      selectedClientId: state.selectedClientId === id ? null : state.selectedClientId,
    }));

    auditLog({
      eventType: AuditEventType.CLIENT_DELETED,
      resourceType: 'client',
      action: 'deleted',
      resourceId: id,
      clientId: id,
    });

    const userId = currentUserId();
    if (userId) {
      clientsRepo.remove(userId, id).catch((err) => {
        logError('deleteClient', err);
        // Targeted rollback: re-add only the removed items
        set((state) => ({
          clients: deletedClient ? [...state.clients, deletedClient] : state.clients,
          statements: [...state.statements, ...deletedStatements],
          reports: [...state.reports, ...deletedReports],
          selectedClientId: prevSelectedId === id ? id : state.selectedClientId,
          error: err instanceof Error ? err.message : 'Erreur suppression client',
        }));
      });
    }
  },

  getClient: (id) => get().clients.find((c) => c.id === id),

  // --------------------------------------------------------------------------
  // Bank accounts
  // --------------------------------------------------------------------------

  addAccount: (clientId, accountData) => {
    const account: BankAccount = {
      id: uuidv4(),
      clientId,
      ...accountData,
    };

    set((state) => ({
      clients: state.clients.map((c) =>
        c.id === clientId
          ? { ...c, accounts: [...c.accounts, account], updatedAt: new Date() }
          : c,
      ),
    }));

    const userId = currentUserId();
    if (userId) {
      clientsRepo.addAccount(userId, account).catch((err) => {
        logError('addAccount', err);
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === clientId
              ? { ...c, accounts: c.accounts.filter((a) => a.id !== account.id) }
              : c,
          ),
          error: err instanceof Error ? err.message : 'Erreur ajout compte',
        }));
      });
    }

    return account;
  },

  updateAccount: (clientId, accountId, updates) => {
    const client = get().clients.find((c) => c.id === clientId);
    const previousAccount = client?.accounts.find((a) => a.id === accountId);

    set((state) => ({
      clients: state.clients.map((c) =>
        c.id === clientId
          ? {
              ...c,
              accounts: c.accounts.map((a) =>
                a.id === accountId ? { ...a, ...updates } : a,
              ),
              updatedAt: new Date(),
            }
          : c,
      ),
    }));

    const userId = currentUserId();
    if (userId) {
      clientsRepo.updateAccount(userId, accountId, updates).catch((err) => {
        logError('updateAccount', err);
        // Rollback to previous account state
        if (previousAccount) {
          set((state) => ({
            clients: state.clients.map((c) =>
              c.id === clientId
                ? { ...c, accounts: c.accounts.map((a) => a.id === accountId ? previousAccount : a) }
                : c,
            ),
            error: err instanceof Error ? err.message : 'Erreur MAJ compte',
          }));
        } else {
          set({ error: err instanceof Error ? err.message : 'Erreur MAJ compte' });
        }
      });
    }
  },

  removeAccount: (clientId, accountId) => {
    const client = get().clients.find((c) => c.id === clientId);
    const removedAccount = client?.accounts.find((a) => a.id === accountId);

    set((state) => ({
      clients: state.clients.map((c) =>
        c.id === clientId
          ? {
              ...c,
              accounts: c.accounts.filter((a) => a.id !== accountId),
              updatedAt: new Date(),
            }
          : c,
      ),
    }));

    const userId = currentUserId();
    if (userId) {
      clientsRepo.removeAccount(userId, accountId).catch((err) => {
        logError('removeAccount', err);
        // Rollback: re-add the removed account
        if (removedAccount) {
          set((state) => ({
            clients: state.clients.map((c) =>
              c.id === clientId
                ? { ...c, accounts: [...c.accounts, removedAccount] }
                : c,
            ),
            error: err instanceof Error ? err.message : 'Erreur suppression compte',
          }));
        } else {
          set({ error: err instanceof Error ? err.message : 'Erreur suppression compte' });
        }
      });
    }
  },

  // --------------------------------------------------------------------------
  // Statements
  // --------------------------------------------------------------------------

  addStatement: (clientId, statementData) => {
    const statement: BankStatement = {
      id: uuidv4(),
      clientId,
      ...statementData,
      importedAt: new Date(),
    };

    set((state) => ({ statements: [...state.statements, statement] }));

    const userId = currentUserId();
    if (userId) {
      clientsRepo
        .addStatement(userId, statement)
        .catch((err) => {
          logError('addStatement', err);
          set((state) => ({
            statements: state.statements.filter((s) => s.id !== statement.id),
            error: err instanceof Error ? err.message : 'Erreur ajout relevé',
          }));
        });
    }
    return statement;
  },

  updateStatement: (id, updates) => {
    const previousStatement = get().statements.find((s) => s.id === id);

    set((state) => ({
      statements: state.statements.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));

    const userId = currentUserId();
    if (userId) {
      clientsRepo.updateStatement(userId, id, updates).catch((err) => {
        logError('updateStatement', err);
        // Rollback to previous statement
        if (previousStatement) {
          set((state) => ({
            statements: state.statements.map((s) => s.id === id ? previousStatement : s),
            error: err instanceof Error ? err.message : 'Erreur MAJ relevé',
          }));
        } else {
          set({ error: err instanceof Error ? err.message : 'Erreur MAJ relevé' });
        }
      });
    }
  },

  deleteStatement: (id) => {
    const deletedStatement = get().statements.find((s) => s.id === id);
    set((state) => ({
      statements: state.statements.filter((s) => s.id !== id),
    }));

    const userId = currentUserId();
    if (userId) {
      clientsRepo.removeStatement(userId, id).catch((err) => {
        logError('deleteStatement', err);
        // Targeted rollback: re-add only the removed statement
        if (deletedStatement) {
          set((state) => ({
            statements: [...state.statements, deletedStatement],
            error: err instanceof Error ? err.message : 'Erreur suppression relevé',
          }));
        }
      });
    }
  },

  getStatementsByClient: (clientId) =>
    get().statements.filter((s) => s.clientId === clientId),

  // --------------------------------------------------------------------------
  // Reports (local-only, Iter 2 will move to Supabase)
  // --------------------------------------------------------------------------

  addReport: (reportData) => {
    const report: ClientReport = {
      id: uuidv4(),
      ...reportData,
      generatedAt: new Date(),
    };
    set((state) => ({ reports: [...state.reports, report] }));
    return report;
  },

  updateReport: (id, updates) => {
    set((state) => ({
      reports: state.reports.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }));
  },

  deleteReport: (id) => {
    set((state) => ({ reports: state.reports.filter((r) => r.id !== id) }));
  },

  getReportsByClient: (clientId) =>
    get().reports.filter((r) => r.clientId === clientId),

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  getClientStatistics: (clientId, transactions, anomalies) => {
    const { statements, reports } = get();
    const clientStatements = statements.filter((s) => s.clientId === clientId);
    const clientTransactions = transactions.filter((t) => t.clientId === clientId);
    const clientAnomalies = anomalies.filter((a) =>
      a.transactions.some((t) => t.clientId === clientId),
    );
    const clientReports = reports.filter((r) => r.clientId === clientId);

    const totalSavings = clientAnomalies
      .filter((a) => a.status === 'confirmed')
      .reduce((sum, a) => sum + a.amount, 0);

    const lastStatement = [...clientStatements].sort(
      (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime(),
    )[0];

    return {
      clientId,
      totalStatements: clientStatements.length,
      totalTransactions: clientTransactions.length,
      totalAnalyses: clientStatements.filter((s) => s.status === 'analyzed').length,
      totalAnomalies: clientAnomalies.length,
      totalSavings,
      totalReports: clientReports.length,
      lastImportDate: lastStatement?.importedAt,
      lastAnalysisDate: clientStatements.find((s) => s.status === 'analyzed')?.importedAt,
    };
  },

  // --------------------------------------------------------------------------
  // Selection + self-client helper
  // --------------------------------------------------------------------------

  setSelectedClient: (id) => set({ selectedClientId: id }),

  ensureSelfClient: (displayName) => {
    const { clients, selectedClientId } = get();
    const existing = clients.find((c) => c.code === SELF_CLIENT_CODE);
    if (existing) {
      if (selectedClientId !== existing.id) {
        set({ selectedClientId: existing.id });
      }
      return existing;
    }

    const created = get().addClient({
      name: displayName?.trim() || 'Mon entreprise',
      code: SELF_CLIENT_CODE,
    });
    set({ selectedClientId: created.id });
    return created;
  },
}));
