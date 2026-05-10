// ============================================================================
// useStatementAnalysis — déclenche/relance l'analyse d'un relevé
// ============================================================================
// Spec §5.4 : le bandeau état (StatementStatusBanner) propose soit "Lancer
// l'analyse" (statement.status === 'pending'), soit "Relancer". Ce hook
// encapsule l'appel à l'Edge Function analyze-statement et expose un état
// minimal (running, error, lastRunAt) pour piloter l'UI.
// ============================================================================

import { useCallback, useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';

export interface UseStatementAnalysisResult {
  running: boolean;
  error: string | null;
  lastRunAt: string | null;
  /** Déclenche l'analyse du relevé. */
  run: () => Promise<{ runId: string; status: string } | null>;
}

export function useStatementAnalysis(statementId: string): UseStatementAnalysisResult {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  const run = useCallback<UseStatementAnalysisResult['run']>(
    async () => {
      const sb = getSupabaseClient();
      if (!sb) {
        setError('Supabase non configuré');
        return null;
      }
      setRunning(true);
      setError(null);
      try {
        const { data, error: fnErr } = await sb.functions.invoke('analyze-statement', {
          body: { statementId },
        });
        if (fnErr) throw fnErr;
        setLastRunAt(new Date().toISOString());
        return data as { runId: string; status: string };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'analyze failed';
        setError(msg);
        return null;
      } finally {
        setRunning(false);
      }
    },
    [statementId],
  );

  return { running, error, lastRunAt, run };
}
