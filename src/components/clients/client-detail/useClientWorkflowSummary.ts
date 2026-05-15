// ============================================================================
// useClientWorkflowSummary — agrège les anomalies workflow d'un client
// ============================================================================
// Source de vérité pour les compteurs "Économies réalisées / potentielles"
// affichés dans la page détail client.
//
// La table atlasbanx.anomalies (workflow detected→qualified→validated→signed
// →closed) est la seule source qui reflète ce que l'utilisateur a réellement
// validé dans le détail du relevé. L'ancien analysisStore (status pending /
// confirmed) n'est mis à jour que par la page /analyses désormais retirée du
// dossier client : il ne capture pas les validations faites depuis le relevé.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { loadAnomaliesForStatements } from '../../../features/statement-detail/api/anomaliesApi';
import type { Anomaly as WorkflowAnomaly } from '../../../features/statement-detail/types/statement.types';

export interface ClientWorkflowSummary {
  /** Une anomalie au moins atteinte le statut validated/signed/closed. */
  realizedCount: number;
  /** Somme XAF des montants récupérables sur les anomalies réalisées. */
  realizedAmount: number;
  /** Anomalies qualifiées mais pas encore validées (économies en attente d'action). */
  potentialCount: number;
  potentialAmount: number;
  /** Anomalies juste détectées, en attente de qualification. */
  pendingCount: number;
  /** Liste détaillée pour les vues type "Détail des économies". */
  realizedAnomalies: WorkflowAnomaly[];
}

interface UseClientWorkflowSummaryResult {
  summary: ClientWorkflowSummary;
  loading: boolean;
  /** True si la donnée vient bien du workflow Supabase — sinon les compteurs
   *  ne doivent pas écraser les analytics legacy (mode démo / pas de Supabase). */
  hasWorkflowData: boolean;
  refresh: () => Promise<void>;
}

const EMPTY: ClientWorkflowSummary = {
  realizedCount: 0,
  realizedAmount: 0,
  potentialCount: 0,
  potentialAmount: 0,
  pendingCount: 0,
  realizedAnomalies: [],
};

function amountXAF(a: WorkflowAnomaly): number {
  // Estimation de récupérabilité prioritaire ; à défaut, valeur absolue de la tx.
  if (typeof a.potentialRecoveryCentimes === 'number' && a.potentialRecoveryCentimes > 0) {
    return a.potentialRecoveryCentimes / 100;
  }
  return Math.abs(a.transaction.amountCentimes) / 100;
}

function summarize(anomalies: WorkflowAnomaly[]): ClientWorkflowSummary {
  const realized: WorkflowAnomaly[] = [];
  let realizedAmount = 0;
  let potentialCount = 0;
  let potentialAmount = 0;
  let pendingCount = 0;

  for (const a of anomalies) {
    if (a.status === 'validated' || a.status === 'signed' || a.status === 'closed') {
      realized.push(a);
      realizedAmount += amountXAF(a);
    } else if (a.status === 'qualified') {
      potentialCount += 1;
      potentialAmount += amountXAF(a);
    } else if (a.status === 'detected') {
      pendingCount += 1;
    }
    // 'false_positive' : ignoré (ni économie, ni en attente)
  }

  return {
    realizedCount: realized.length,
    realizedAmount,
    potentialCount,
    potentialAmount,
    pendingCount,
    realizedAnomalies: realized,
  };
}

export function useClientWorkflowSummary(statementIds: string[]): UseClientWorkflowSummaryResult {
  const [anomalies, setAnomalies] = useState<WorkflowAnomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasWorkflowData, setHasWorkflowData] = useState(false);

  // Stabilise la dépendance (les IDs changent rarement, le tableau souvent)
  const idsKey = statementIds.join('|');

  const fetchAll = useMemo(
    () => async () => {
      if (!isSupabaseConfigured()) {
        setAnomalies([]);
        setHasWorkflowData(false);
        return;
      }
      if (statementIds.length === 0) {
        setAnomalies([]);
        setHasWorkflowData(true);
        return;
      }
      setLoading(true);
      try {
        const rows = await loadAnomaliesForStatements(statementIds);
        setAnomalies(rows);
        setHasWorkflowData(true);
      } catch (err) {
        console.error('[useClientWorkflowSummary] load failed:', err);
        setAnomalies([]);
        setHasWorkflowData(false);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsKey],
  );

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const summary = useMemo(() => summarize(anomalies), [anomalies]);

  return {
    summary: hasWorkflowData ? summary : EMPTY,
    loading,
    hasWorkflowData,
    refresh: fetchAll,
  };
}
