// ============================================================================
// ATLASBANX - Transaction Store (Supabase-backed, Iter 1)
// Stores transactions loaded from atlasbanx.transactions.
// Pattern: optimistic local updates + background persistence via transactionsRepo.
// Note: the previous `clients` and `accounts` arrays were unused duplicates of
// clientStore and have been removed in Iter 1.
// ============================================================================

import { create } from 'zustand';
import { Transaction } from '../types';
import { transactionsRepo } from '../lib/repositories';
import { useAuthStore } from './authStore';

interface TransactionStore {
  // State
  transactions: Transaction[];
  isLoading: boolean;
  isHydrating: boolean;
  hydratedForUserId: string | null;
  error: string | null;

  // Hydration
  hydrateFromSupabase: () => Promise<void>;
  resetState: () => void;

  // Transaction actions
  addTransactions: (transactions: Transaction[]) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  clearTransactions: () => void;

  // Loading state
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Selectors (computed values as functions)
  getTransactionsByClient: (clientId: string) => Transaction[];
  getTransactionsByAccount: (accountNumber: string) => Transaction[];
  getTransactionsByDateRange: (start: Date, end: Date) => Transaction[];
  getTransactionById: (id: string) => Transaction | undefined;
  getTotalAmount: () => number;
  getTransactionCount: () => number;
}

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

function logError(operation: string, err: unknown) {
  console.error(`[transactionStore] ${operation} failed:`, err);
}

export const useTransactionStore = create<TransactionStore>()((set, get) => ({
  // Initial state
  transactions: [],
  isLoading: false,
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
      const transactions = await transactionsRepo.fetchAll(userId);
      set({ transactions, isHydrating: false, hydratedForUserId: userId });
    } catch (err) {
      logError('hydrateFromSupabase', err);
      set({
        isHydrating: false,
        error: err instanceof Error ? err.message : 'Erreur chargement transactions',
      });
    }
  },

  resetState: () => {
    set({
      transactions: [],
      isLoading: false,
      isHydrating: false,
      hydratedForUserId: null,
      error: null,
    });
  },

  // --------------------------------------------------------------------------
  // Transaction actions (optimistic)
  // --------------------------------------------------------------------------

  addTransactions: (newTransactions) => {
    if (newTransactions.length === 0) return;

    // Deduplicate by ID
    const existingIds = new Set(get().transactions.map((t) => t.id));
    const uniqueNew = newTransactions.filter((t) => !existingIds.has(t.id));
    if (uniqueNew.length === 0) return;

    // Group by clientId for bulk upsert
    const byClient = new Map<string, Transaction[]>();
    for (const t of uniqueNew) {
      const list = byClient.get(t.clientId) ?? [];
      list.push(t);
      byClient.set(t.clientId, list);
    }

    set((state) => ({
      transactions: [...state.transactions, ...uniqueNew],
      error: null,
    }));

    const userId = currentUserId();
    if (userId) {
      // Fire all bulk inserts in parallel; only rollback failed batches
      const entries = Array.from(byClient.entries());
      Promise.allSettled(
        entries.map(([clientId, txs]) =>
          transactionsRepo.bulkInsert(userId, clientId, txs),
        ),
      ).then((results) => {
        const failedIds = new Set<string>();
        results.forEach((result, idx) => {
          if (result.status === 'rejected') {
            logError('addTransactions', result.reason);
            for (const t of entries[idx][1]) {
              failedIds.add(t.id);
            }
          }
        });

        if (failedIds.size > 0) {
          set((state) => ({
            transactions: state.transactions.filter((t) => !failedIds.has(t.id)),
            error: 'Erreur import partiel de transactions',
          }));
        }
      });
    }
  },

  updateTransaction: (id, updates) => {
    const previous = get().transactions.find((t) => t.id === id);
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t,
      ),
    }));

    const userId = currentUserId();
    if (userId && previous) {
      transactionsRepo.update(userId, id, updates).catch((err) => {
        logError('updateTransaction', err);
        set((state) => ({
          transactions: state.transactions.map((t) => (t.id === id ? previous : t)),
          error: err instanceof Error ? err.message : 'Erreur MAJ transaction',
        }));
      });
    }
  },

  deleteTransaction: (id) => {
    const deleted = get().transactions.find((t) => t.id === id);
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
    }));

    const userId = currentUserId();
    if (userId) {
      transactionsRepo.remove(userId, id).catch((err) => {
        logError('deleteTransaction', err);
        // Targeted rollback: re-add only the removed transaction
        if (deleted) {
          set((state) => ({
            transactions: [...state.transactions, deleted],
            error: err instanceof Error ? err.message : 'Erreur suppression transaction',
          }));
        }
      });
    }
  },

  clearTransactions: () => {
    const previousTransactions = [...get().transactions];
    set({ transactions: [], error: null });

    const userId = currentUserId();
    if (userId) {
      transactionsRepo.removeAllForUser(userId).catch((err) => {
        logError('clearTransactions', err);
        // Targeted rollback: merge back previous transactions with any new ones
        set((state) => ({
          transactions: [...state.transactions, ...previousTransactions],
          error: err instanceof Error ? err.message : 'Erreur effacement transactions',
        }));
      });
    }
  },

  // --------------------------------------------------------------------------
  // Loading state
  // --------------------------------------------------------------------------

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // --------------------------------------------------------------------------
  // Selectors
  // --------------------------------------------------------------------------

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

  getTotalAmount: () =>
    get().transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),

  getTransactionCount: () => get().transactions.length,
}));
