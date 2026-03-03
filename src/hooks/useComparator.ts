// ============================================================================
// SCRUTIX - useComparator Hook
// Hook React pour le comparateur PROPH3T vs Premium
// ============================================================================

import { useState, useCallback } from 'react';
import { getAIComparator } from '../services/AIComparatorService';
import type { ComparisonResult } from '../services/AIComparatorService';
import type { Transaction } from '../types';

interface UseComparatorResult {
  /** Comparaison en cours */
  isRunning: boolean;
  /** Resultats de la derniere comparaison */
  results: ComparisonResult | null;
  /** Erreur */
  error: string | null;
  /** Lancer une comparaison de categorisation */
  runCategorization: (transactions: Transaction[], premiumProvider?: string) => Promise<void>;
  /** Lancer une comparaison de detection */
  runAnomalyDetection: (transactions: Transaction[], premiumProvider?: string) => Promise<void>;
  /** Lancer une comparaison de rapport */
  runReportGeneration: (data: { transactions: Transaction[]; anomalies: unknown[] }, premiumProvider?: string) => Promise<void>;
  /** Effacer les resultats */
  clearResults: () => void;
}

export function useComparator(): UseComparatorResult {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const comparator = getAIComparator();

  const runCategorization = useCallback(async (
    transactions: Transaction[],
    premiumProvider?: string
  ) => {
    setIsRunning(true);
    setError(null);
    try {
      const result = await comparator.compareCategorization(transactions, premiumProvider);
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de comparaison');
    } finally {
      setIsRunning(false);
    }
  }, [comparator]);

  const runAnomalyDetection = useCallback(async (
    transactions: Transaction[],
    premiumProvider?: string
  ) => {
    setIsRunning(true);
    setError(null);
    try {
      const result = await comparator.compareAnomalyDetection(transactions, premiumProvider);
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de comparaison');
    } finally {
      setIsRunning(false);
    }
  }, [comparator]);

  const runReportGeneration = useCallback(async (
    data: { transactions: Transaction[]; anomalies: unknown[] },
    premiumProvider?: string
  ) => {
    setIsRunning(true);
    setError(null);
    try {
      const result = await comparator.compareReportGeneration(data, premiumProvider);
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de comparaison');
    } finally {
      setIsRunning(false);
    }
  }, [comparator]);

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return {
    isRunning,
    results,
    error,
    runCategorization,
    runAnomalyDetection,
    runReportGeneration,
    clearResults,
  };
}

export default useComparator;
