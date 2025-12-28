import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Transaction, Client, BankAccount } from '../types';

interface TransactionStore {
  // State
  transactions: Transaction[];
  clients: Client[];
  accounts: BankAccount[];
  isLoading: boolean;
  error: string | null;

  // Transaction actions
  addTransactions: (transactions: Transaction[]) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  clearTransactions: () => void;

  // Client actions
  addClient: (client: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // Account actions
  addAccount: (account: BankAccount) => void;
  updateAccount: (id: string, updates: Partial<BankAccount>) => void;
  deleteAccount: (id: string) => void;

  // Loading state
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Selectors (computed values as functions)
  getTransactionsByClient: (clientId: string) => Transaction[];
  getTransactionsByAccount: (accountNumber: string) => Transaction[];
  getTransactionsByDateRange: (start: Date, end: Date) => Transaction[];
  getTransactionById: (id: string) => Transaction | undefined;
  getClientById: (id: string) => Client | undefined;
  getTotalAmount: () => number;
  getTransactionCount: () => number;
}

export const useTransactionStore = create<TransactionStore>()(
  persist(
    (set, get) => ({
      // Initial state
      transactions: [],
      clients: [],
      accounts: [],
      isLoading: false,
      error: null,

      // Transaction actions
      addTransactions: (newTransactions) =>
        set((state) => {
          // Deduplicate by ID
          const existingIds = new Set(state.transactions.map((t) => t.id));
          const uniqueNew = newTransactions.filter((t) => !existingIds.has(t.id));
          return {
            transactions: [...state.transactions, ...uniqueNew],
            error: null,
          };
        }),

      updateTransaction: (id, updates) =>
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
          ),
        })),

      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
        })),

      clearTransactions: () =>
        set({
          transactions: [],
          error: null,
        }),

      // Client actions
      addClient: (client) =>
        set((state) => ({
          clients: [...state.clients, client],
        })),

      updateClient: (id, updates) =>
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
          ),
        })),

      deleteClient: (id) =>
        set((state) => ({
          clients: state.clients.filter((c) => c.id !== id),
          // Also remove associated transactions and accounts
          transactions: state.transactions.filter((t) => t.clientId !== id),
          accounts: state.accounts.filter((a) => a.clientId !== id),
        })),

      // Account actions
      addAccount: (account) =>
        set((state) => ({
          accounts: [...state.accounts, account],
        })),

      updateAccount: (id, updates) =>
        set((state) => ({
          accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),

      deleteAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
        })),

      // Loading state
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      // Selectors
      getTransactionsByClient: (clientId) =>
        get().transactions.filter((t) => t.clientId === clientId),

      getTransactionsByAccount: (accountNumber) =>
        get().transactions.filter((t) => t.accountNumber === accountNumber),

      getTransactionsByDateRange: (start, end) =>
        get().transactions.filter((t) => {
          const date = new Date(t.date);
          return date >= start && date <= end;
        }),

      getTransactionById: (id) => get().transactions.find((t) => t.id === id),

      getClientById: (id) => get().clients.find((c) => c.id === id),

      getTotalAmount: () =>
        get().transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),

      getTransactionCount: () => get().transactions.length,
    }),
    {
      name: 'scrutix-transactions',
      partialize: (state) => ({
        transactions: state.transactions,
        clients: state.clients,
        accounts: state.accounts,
      }),
    }
  )
);
