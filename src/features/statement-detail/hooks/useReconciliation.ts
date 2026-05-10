// ============================================================================
// useReconciliation — module SYSCOHADA compte 521, branché sur Supabase
// ============================================================================
// Bascule auto :
//   - Supabase configuré : load transactions réelles via statementApi +
//     load/save reconciliation via reconciliationApi
//   - Sinon : mock-data
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type {
  BankReconciliation,
  BankTransaction,
  LedgerEntry,
  ReconciliationDiscrepancy,
} from '../types/statement.types';
import {
  MOCK_BANK_TRANSACTIONS,
  MOCK_LEDGER_ENTRIES,
  MOCK_RECONCILIATION,
} from '../mock-data';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { computeReconciliationDiscrepancies } from '../reconciliation/computeReconciliation';
import { loadStatementMeta, loadTransactions } from '../api/statementApi';
import {
  loadLatestReconciliation,
  saveReconciliation,
  markReconciliationGenerated,
} from '../api/reconciliationApi';

export interface UseReconciliationResult {
  bankTxs: BankTransaction[];
  ledgerEntries: LedgerEntry[];
  reconciliation: BankReconciliation | null;
  loading: boolean;
  error: string | null;

  importLedger: (entries: LedgerEntry[], source: BankReconciliation['ledgerSource']) => Promise<void>;
  recompute: () => Promise<void>;
  pushDiscrepancyToAtlas: (discrepancyId: string) => Promise<void>;
  ignoreDiscrepancy: (discrepancyId: string) => void;
  generateStatement: () => Promise<{ url: string }>;
}

export function useReconciliation(statementId: string): UseReconciliationResult {
  const [bankTxs, setBankTxs] = useState<BankTransaction[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [reconciliation, setReconciliation] = useState<BankReconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (isSupabaseConfigured()) {
          const meta = await loadStatementMeta(statementId);
          const txs = await loadTransactions(meta.accountId, {
            from: meta.periodStart,
            to: meta.periodEnd,
          });
          if (cancelled) return;
          setBankTxs(txs);

          // Reconciliation persistée si elle existe
          const rec = await loadLatestReconciliation(statementId);
          if (rec) {
            setReconciliation(rec);
            // Les ledger_entries sont stockées dans la jsonb de la reconciliation
            // (chargées avec `loadLatestReconciliation`)
            // Ici, on n'a pas la propriété directement — il faudrait un getter dédié.
            // Pour simplifier, on laisse vide jusqu'à un import explicite.
          } else {
            setReconciliation(null);
          }
          setLedgerEntries([]);
        } else {
          // Fallback mock
          setBankTxs(MOCK_BANK_TRANSACTIONS);
          setLedgerEntries(MOCK_LEDGER_ENTRIES);
          setReconciliation(MOCK_RECONCILIATION);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statementId]);

  // ============================================================================
  // recompute / importLedger
  // ============================================================================

  const recompute = useCallback(async () => {
    const out = computeReconciliationDiscrepancies(bankTxs, ledgerEntries);

    if (isSupabaseConfigured() && bankTxs.length > 0) {
      try {
        const saved = await saveReconciliation({
          statementId,
          ledgerSource: reconciliation?.ledgerSource ?? 'manual_upload',
          ledgerEntries,
          matches: out.matches,
          unmatchedBank: out.unmatchedBank,
          unmatchedLedger: out.unmatchedLedger,
          discrepancies: out.discrepancies,
          totalBankCentimes: out.totalBankCentimes,
          totalLedgerCentimes: out.totalLedgerCentimes,
          matchRate: out.matchRate,
        });
        setReconciliation(saved);
        return;
      } catch (err) {
        // fail-open — on update au moins l'état local
        setError(err instanceof Error ? err.message : 'save failed');
      }
    }

    // Fallback / fail-open : update local seulement
    setReconciliation((prev) => ({
      id: prev?.id ?? 'rec-' + Date.now(),
      statementId,
      ledgerSource: prev?.ledgerSource ?? 'manual_upload',
      ledgerImportedAt: prev?.ledgerImportedAt ?? new Date().toISOString(),
      matchedPairs: out.matches,
      unmatchedBank: out.unmatchedBank,
      unmatchedLedger: out.unmatchedLedger,
      discrepancies: out.discrepancies,
      totalBankCentimes: out.totalBankCentimes,
      totalLedgerCentimes: out.totalLedgerCentimes,
      gapCentimes: out.totalBankCentimes - out.totalLedgerCentimes,
      matchRate: out.matchRate,
      reconciliationStateUrl: prev?.reconciliationStateUrl ?? null,
      generatedAt: prev?.generatedAt ?? null,
    }));
  }, [bankTxs, ledgerEntries, statementId, reconciliation?.ledgerSource]);

  const importLedger = useCallback(
    async (entries: LedgerEntry[], source: BankReconciliation['ledgerSource']) => {
      setLedgerEntries(entries);
      const out = computeReconciliationDiscrepancies(bankTxs, entries);

      if (isSupabaseConfigured()) {
        try {
          const saved = await saveReconciliation({
            statementId,
            ledgerSource: source,
            ledgerEntries: entries,
            matches: out.matches,
            unmatchedBank: out.unmatchedBank,
            unmatchedLedger: out.unmatchedLedger,
            discrepancies: out.discrepancies,
            totalBankCentimes: out.totalBankCentimes,
            totalLedgerCentimes: out.totalLedgerCentimes,
            matchRate: out.matchRate,
          });
          setReconciliation(saved);
          return;
        } catch (err) {
          setError(err instanceof Error ? err.message : 'save failed');
        }
      }

      setReconciliation({
        id: 'rec-' + Date.now(),
        statementId,
        ledgerSource: source,
        ledgerImportedAt: new Date().toISOString(),
        matchedPairs: out.matches,
        unmatchedBank: out.unmatchedBank,
        unmatchedLedger: out.unmatchedLedger,
        discrepancies: out.discrepancies,
        totalBankCentimes: out.totalBankCentimes,
        totalLedgerCentimes: out.totalLedgerCentimes,
        gapCentimes: out.totalBankCentimes - out.totalLedgerCentimes,
        matchRate: out.matchRate,
        reconciliationStateUrl: null,
        generatedAt: null,
      });
    },
    [bankTxs, statementId],
  );

  const pushDiscrepancyToAtlas = useCallback(async (_id: string) => {
    // TODO : Edge Function vers Atlas Finance API
    await new Promise((r) => setTimeout(r, 200));
  }, []);

  const ignoreDiscrepancy = useCallback(
    (id: string) => {
      setReconciliation((prev) =>
        prev
          ? {
              ...prev,
              discrepancies: prev.discrepancies.filter(
                (d: ReconciliationDiscrepancy) => d.id !== id,
              ),
            }
          : prev,
      );
    },
    [],
  );

  const generateStatement = useCallback(async () => {
    const url = `/storage/reconciliation-${statementId}.pdf`;
    if (isSupabaseConfigured() && reconciliation) {
      try {
        await markReconciliationGenerated(reconciliation.id, url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'mark generated failed');
      }
    }
    setReconciliation((prev) =>
      prev
        ? { ...prev, reconciliationStateUrl: url, generatedAt: new Date().toISOString() }
        : prev,
    );
    return { url };
  }, [statementId, reconciliation]);

  return {
    bankTxs,
    ledgerEntries,
    reconciliation,
    loading,
    error,
    importLedger,
    recompute,
    pushDiscrepancyToAtlas,
    ignoreDiscrepancy,
    generateStatement,
  };
}
