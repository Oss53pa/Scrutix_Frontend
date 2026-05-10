// ============================================================================
// useStatement — load des métadonnées d'un relevé
// ============================================================================

import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { loadStatementMeta, type StatementHeaderMeta } from '../api/statementApi';

export interface UseStatementResult {
  meta: StatementHeaderMeta | null;
  loading: boolean;
  error: string | null;
}

const FALLBACK_META: StatementHeaderMeta = {
  id: 'stmt-mock',
  accountId: 'acc-mock',
  clientId: 'client-mock',
  bankCode: 'NSIA',
  bankLegalName: 'NSIA Banque Côte d\'Ivoire',
  accountNumber: '86315802001',
  clientLegalName: 'Pamela ATOKOUNA',
  periodStart: '2026-02-10',
  periodEnd: '2026-05-08',
  transactionCount: 94,
  finalBalanceCentimes: 1_248_732_000,
  status: 'imported',
  importedAt: new Date().toISOString(),
};

export function useStatement(statementId: string): UseStatementResult {
  const [meta, setMeta] = useState<StatementHeaderMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (isSupabaseConfigured()) {
          const m = await loadStatementMeta(statementId);
          if (!cancelled) setMeta(m);
        } else {
          if (!cancelled) setMeta({ ...FALLBACK_META, id: statementId });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'load failed');
          setMeta({ ...FALLBACK_META, id: statementId });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [statementId]);

  return { meta, loading, error };
}
