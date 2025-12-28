import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

interface ClientState {
  clients: Client[];
  statements: BankStatement[];
  reports: ClientReport[];
  selectedClientId: string | null;

  // Client CRUD
  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'accounts'>) => Client;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  getClient: (id: string) => Client | undefined;

  // Account management
  addAccount: (clientId: string, account: Omit<BankAccount, 'id' | 'clientId'>) => void;
  updateAccount: (clientId: string, accountId: string, updates: Partial<BankAccount>) => void;
  removeAccount: (clientId: string, accountId: string) => void;

  // Statement management
  addStatement: (statement: Omit<BankStatement, 'id' | 'importedAt'>) => BankStatement;
  updateStatement: (id: string, updates: Partial<BankStatement>) => void;
  deleteStatement: (id: string) => void;
  getStatementsByClient: (clientId: string) => BankStatement[];

  // Report management
  addReport: (report: Omit<ClientReport, 'id' | 'generatedAt'>) => ClientReport;
  updateReport: (id: string, updates: Partial<ClientReport>) => void;
  deleteReport: (id: string) => void;
  getReportsByClient: (clientId: string) => ClientReport[];

  // Statistics
  getClientStatistics: (clientId: string, transactions: Transaction[], anomalies: Anomaly[]) => ClientStatistics;

  // Selection
  setSelectedClient: (id: string | null) => void;
}

export const useClientStore = create<ClientState>()(
  persist(
    (set, get) => ({
      clients: [],
      statements: [],
      reports: [],
      selectedClientId: null,

      addClient: (clientData) => {
        const now = new Date();
        const client: Client = {
          id: uuidv4(),
          ...clientData,
          accounts: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          clients: [...state.clients, client],
        }));
        return client;
      },

      updateClient: (id, updates) => {
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
          ),
        }));
      },

      deleteClient: (id) => {
        set((state) => ({
          clients: state.clients.filter((c) => c.id !== id),
          statements: state.statements.filter((s) => s.clientId !== id),
          reports: state.reports.filter((r) => r.clientId !== id),
          selectedClientId: state.selectedClientId === id ? null : state.selectedClientId,
        }));
      },

      getClient: (id) => {
        return get().clients.find((c) => c.id === id);
      },

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
              : c
          ),
        }));
      },

      updateAccount: (clientId, accountId, updates) => {
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === clientId
              ? {
                  ...c,
                  accounts: c.accounts.map((a) =>
                    a.id === accountId ? { ...a, ...updates } : a
                  ),
                  updatedAt: new Date(),
                }
              : c
          ),
        }));
      },

      removeAccount: (clientId, accountId) => {
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === clientId
              ? {
                  ...c,
                  accounts: c.accounts.filter((a) => a.id !== accountId),
                  updatedAt: new Date(),
                }
              : c
          ),
        }));
      },

      addStatement: (statementData) => {
        const statement: BankStatement = {
          id: uuidv4(),
          ...statementData,
          importedAt: new Date(),
        };
        set((state) => ({
          statements: [...state.statements, statement],
        }));
        return statement;
      },

      updateStatement: (id, updates) => {
        set((state) => ({
          statements: state.statements.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },

      deleteStatement: (id) => {
        set((state) => ({
          statements: state.statements.filter((s) => s.id !== id),
        }));
      },

      getStatementsByClient: (clientId) => {
        return get().statements.filter((s) => s.clientId === clientId);
      },

      addReport: (reportData) => {
        const report: ClientReport = {
          id: uuidv4(),
          ...reportData,
          generatedAt: new Date(),
        };
        set((state) => ({
          reports: [...state.reports, report],
        }));
        return report;
      },

      updateReport: (id, updates) => {
        set((state) => ({
          reports: state.reports.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }));
      },

      deleteReport: (id) => {
        set((state) => ({
          reports: state.reports.filter((r) => r.id !== id),
        }));
      },

      getReportsByClient: (clientId) => {
        return get().reports.filter((r) => r.clientId === clientId);
      },

      getClientStatistics: (clientId, transactions, anomalies) => {
        const { statements, reports } = get();
        const clientStatements = statements.filter((s) => s.clientId === clientId);
        const clientTransactions = transactions.filter((t) => t.clientId === clientId);
        const clientAnomalies = anomalies.filter((a) =>
          a.transactions.some((t) => t.clientId === clientId)
        );
        const clientReports = reports.filter((r) => r.clientId === clientId);

        const totalSavings = clientAnomalies
          .filter((a) => a.status === 'confirmed')
          .reduce((sum, a) => sum + a.amount, 0);

        const lastStatement = clientStatements
          .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime())[0];

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

      setSelectedClient: (id) => {
        set({ selectedClientId: id });
      },
    }),
    {
      name: 'scrutix-clients',
      partialize: (state) => ({
        clients: state.clients,
        statements: state.statements,
        reports: state.reports,
      }),
    }
  )
);
