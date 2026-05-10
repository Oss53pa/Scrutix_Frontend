// ============================================================================
// useStatementAnalysis — lance/relance l'analyse client-side (19 détecteurs)
// ============================================================================
// L'analyse tourne intégralement côté client via AnalysisService + WorkerPool.
// L'Edge Function analyze-statement reste disponible comme point d'entrée pour
// un futur mode serveur, mais n'est plus appelée par défaut.
// ============================================================================

import { useCallback, useState } from 'react';
import { getAnalysisService } from '../../../services/AnalysisService';
import { AnomalyType, type AnalysisConfig, type Transaction, type BankConditions } from '../../../types';
import type { BankTransaction } from '../types/statement.types';

export interface UseStatementAnalysisResult {
  running: boolean;
  progress: number;
  progressStep: string;
  error: string | null;
  lastRunAt: string | null;
  /** Lance l'analyse sur les transactions fournies. */
  run: (bankTxs: BankTransaction[], bankConditions?: BankConditions) => Promise<void>;
}

/** Convertit BankTransaction (page relevé) → Transaction (AnalysisService). */
function toAnalysisTransaction(tx: BankTransaction, meta: { clientId: string; accountNumber: string; bankCode: string }): Transaction {
  const amount = tx.creditCentimes > 0
    ? tx.creditCentimes / 100
    : -(tx.debitCentimes / 100);
  const d = new Date(tx.date);
  return {
    id: tx.id,
    clientId: meta.clientId,
    accountNumber: meta.accountNumber,
    bankCode: meta.bankCode,
    date: d,
    valueDate: tx.valueDate ? new Date(tx.valueDate) : d,
    amount,
    balance: tx.runningBalanceCentimes / 100,
    description: tx.label,
    reference: tx.reference ?? undefined,
    type: amount < 0 ? 'debit' as never : 'credit' as never,
    createdAt: d,
    updatedAt: d,
  };
}

const DEFAULT_DETECTORS: AnomalyType[] = [
  AnomalyType.DUPLICATE_FEE,
  AnomalyType.GHOST_FEE,
  AnomalyType.OVERCHARGE,
  AnomalyType.INTEREST_ERROR,
  AnomalyType.VALUE_DATE_ERROR,
  AnomalyType.SUSPICIOUS_TRANSACTION,
  AnomalyType.COMPLIANCE_VIOLATION,
  AnomalyType.CASHFLOW_ANOMALY,
  AnomalyType.RECONCILIATION_GAP,
  AnomalyType.OHADA_NON_COMPLIANCE,
  AnomalyType.AML_ALERT,
  AnomalyType.FEE_ANOMALY,
];

const DEFAULT_BANK_CONDITIONS: BankConditions = {
  bankName: '',
  accountType: 'current' as never,
  fees: {},
  interestRates: {},
  limits: {},
};

export function useStatementAnalysis(
  statementId: string,
  meta?: { clientId: string; accountNumber: string; bankCode: string },
): UseStatementAnalysisResult {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStep, setProgressStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  const run = useCallback(
    async (bankTxs: BankTransaction[], bankConditions?: BankConditions) => {
      if (bankTxs.length === 0) {
        setError('Aucune transaction à analyser');
        return;
      }

      setRunning(true);
      setError(null);
      setProgress(0);
      setProgressStep('Initialisation...');

      try {
        const txMeta = meta ?? { clientId: '', accountNumber: '', bankCode: '' };
        const transactions = bankTxs.map((tx) => toAnalysisTransaction(tx, txMeta));

        const config: AnalysisConfig = {
          enabledDetectors: DEFAULT_DETECTORS,
          dateRange: {},
          clientId: txMeta.clientId || undefined,
          bankCodes: txMeta.bankCode ? [txMeta.bankCode] : undefined,
        };

        const service = getAnalysisService();
        const result = await service.analyzeTransactions(
          transactions,
          bankConditions ?? { ...DEFAULT_BANK_CONDITIONS, bankName: txMeta.bankCode },
          config,
          {
            useWorkers: true,
            onProgress: (pct, step) => {
              setProgress(pct);
              setProgressStep(step);
            },
          },
        );

        setLastRunAt(new Date().toISOString());

        if (result.error) {
          setError(result.error);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur analyse';
        setError(msg);
      } finally {
        setRunning(false);
        setProgress(100);
        setProgressStep('Terminé');
      }
    },
    [statementId, meta],
  );

  return { running, progress, progressStep, error, lastRunAt, run };
}
