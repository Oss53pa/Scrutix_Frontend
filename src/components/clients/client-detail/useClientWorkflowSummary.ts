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
//
// Le hook expose aussi `legacyAnomalies` — les anomalies converties au format
// legacy (Anomaly de src/types) — pour que TOUTE l'analytics du client (et pas
// juste les compteurs d'économies) soit recalculée à partir du workflow réel :
// répartition par sévérité, top types, tendance mensuelle, et synthèse
// par banque.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { loadAnomaliesForStatements } from '../../../features/statement-detail/api/anomaliesApi';
import type { Anomaly as WorkflowAnomaly } from '../../../features/statement-detail/types/statement.types';
import {
  Anomaly as LegacyAnomaly,
  AnomalyType,
  Severity,
  Transaction,
  TransactionType,
  BankStatement,
} from '../../../types';

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
  /** Anomalies workflow converties au format legacy `Anomaly`, pour alimenter
   *  les analytics existantes (sévérités, types, tendance, synthèse banques). */
  legacyAnomalies: LegacyAnomaly[];
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

// ─── Mapping vocabulaires workflow → legacy ──────────────────────────────────

const TYPE_MAP: Record<string, AnomalyType> = {
  commission_excessive: AnomalyType.OVERCHARGE,
  agio_errone: AnomalyType.INTEREST_ERROR,
  frais_double: AnomalyType.DUPLICATE_FEE,
  convention_violee: AnomalyType.COMPLIANCE_VIOLATION,
  date_valeur_abusive: AnomalyType.VALUE_DATE_ERROR,
  frais_non_justifie: AnomalyType.GHOST_FEE,
  lcb_ft: AnomalyType.AML_ALERT,
  pays_gafi_risque: AnomalyType.AML_ALERT,
  beneficiaire_inedit: AnomalyType.SUSPICIOUS_TRANSACTION,
  montant_anormal: AnomalyType.SUSPICIOUS_TRANSACTION,
  doublon_transaction: AnomalyType.DUPLICATE_FEE,
  autre: AnomalyType.FEE_ANOMALY,
};

const SEVERITY_MAP: Record<string, Severity> = {
  low: Severity.LOW,
  medium: Severity.MEDIUM,
  high: Severity.HIGH,
  critical: Severity.CRITICAL,
};

function workflowStatusToLegacy(s: WorkflowAnomaly['status']): LegacyAnomaly['status'] {
  if (s === 'validated' || s === 'signed' || s === 'closed') return 'confirmed';
  if (s === 'false_positive') return 'dismissed';
  return 'pending';
}

/** Exporté pour les tests — montant XAF d'une anomalie (récupérabilité prioritaire). */
export function amountXAF(a: WorkflowAnomaly): number {
  // Estimation de récupérabilité prioritaire ; à défaut, valeur absolue de la tx.
  if (typeof a.potentialRecoveryCentimes === 'number' && a.potentialRecoveryCentimes > 0) {
    return a.potentialRecoveryCentimes / 100;
  }
  return Math.abs(a.transaction.amountCentimes) / 100;
}

/** Exporté pour les tests — agrège les anomalies workflow en un summary. */
export function summarizeWorkflowAnomalies(anomalies: WorkflowAnomaly[]): ClientWorkflowSummary {
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

/** Convertit une anomalie workflow vers le format legacy `Anomaly` pour que
 *  toute l'analytics existante (sévérités, types, tendance, banques) en bénéficie.
 *  Exporté pour les tests. */
export function toLegacyAnomaly(
  a: WorkflowAnomaly,
  clientId: string,
  bankCodeByStatement: Map<string, { bankCode: string; bankName?: string }>,
): LegacyAnomaly {
  const bankInfo = bankCodeByStatement.get(a.statementId);
  const amount = amountXAF(a);
  const txAmountSigned = a.transaction.amountCentimes / 100;

  // Synthèse d'une Transaction "stub" — suffisante pour les filtres analytics
  // (clientId, bankCode, date, amount). Les filtres downstream ne lisent pas
  // les autres champs (catégorie, balance détaillée, etc.).
  const txDate = new Date(a.transaction.date);
  const createdDate = new Date(a.createdAt);
  const stubTransaction: Transaction = {
    id: `wf-tx-${a.id}`,
    clientId,
    accountNumber: '',
    bankCode: bankInfo?.bankCode ?? '',
    bankName: bankInfo?.bankName,
    date: txDate,
    valueDate: txDate,
    amount: txAmountSigned,
    balance: 0,
    description: a.transaction.label,
    type: txAmountSigned >= 0 ? TransactionType.CREDIT : TransactionType.DEBIT,
    createdAt: createdDate,
    updatedAt: createdDate,
  };

  return {
    id: a.id,
    type: TYPE_MAP[a.type] ?? AnomalyType.FEE_ANOMALY,
    severity: SEVERITY_MAP[a.severity] ?? Severity.MEDIUM,
    confidence: a.detection.confidence,
    amount,
    transactions: [stubTransaction],
    evidence: [],
    recommendation: a.description || a.title,
    status: workflowStatusToLegacy(a.status),
    detectedAt: new Date(a.createdAt),
    reviewedAt: a.validatedBy
      ? new Date(a.validatedBy.at)
      : a.qualifiedBy
        ? new Date(a.qualifiedBy.at)
        : undefined,
    detectionSource: 'algorithm',
  };
}

export function useClientWorkflowSummary(
  statementIds: string[],
  clientId: string,
  statements: BankStatement[],
): UseClientWorkflowSummaryResult {
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
        // Pas de relevé → rien à interroger côté workflow. On laisse l'analytics
        // legacy reprendre la main (utile pour les comptes qui ont encore des
        // données héritées de l'ancien chemin /analyses sans avoir importé via
        // le nouveau flux).
        setAnomalies([]);
        setHasWorkflowData(false);
        return;
      }
      setLoading(true);
      try {
        const rows = await loadAnomaliesForStatements(statementIds);
        setAnomalies(rows);
        setHasWorkflowData(true);

        // ── DEV WARNINGS ─────────────────────────────────────────────────────
        // H3: si on a demandé N statements et 0 anomalies, soit c'est légitime
        // (rien détecté) soit les IDs ne matchent pas la base. On ne peut pas
        // distinguer les deux ici, mais on log un info pour faciliter le debug.
        if (rows.length === 0 && statementIds.length > 0 && import.meta.env.DEV) {
          console.info(
            `[useClientWorkflowSummary] 0 anomalies for ${statementIds.length} statements ` +
              '— vérifie que les statement IDs correspondent à atlasbanx.anomalies.statement_id',
          );
        }
        // H2: anomalies validated/signed/closed sans potentialRecoveryCentimes
        // → fallback compte la transaction entière (potentielle surestimation).
        if (import.meta.env.DEV) {
          const missingRecovery = rows.filter(
            (r) =>
              (r.status === 'validated' || r.status === 'signed' || r.status === 'closed') &&
              (r.potentialRecoveryCentimes === undefined || r.potentialRecoveryCentimes === null),
          );
          if (missingRecovery.length > 0) {
            console.warn(
              `[useClientWorkflowSummary] ${missingRecovery.length} anomalie(s) validée(s) ` +
                'sans potentialRecoveryCentimes — montants estimés depuis abs(transaction), ' +
                'risque de surestimation. IDs:',
              missingRecovery.map((r) => r.id),
            );
          }
        }
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

  const summary = useMemo(() => summarizeWorkflowAnomalies(anomalies), [anomalies]);

  // Lookup table statementId → bankCode pour la conversion legacy
  const bankByStatement = useMemo(() => {
    const m = new Map<string, { bankCode: string; bankName?: string }>();
    for (const s of statements) m.set(s.id, { bankCode: s.bankCode, bankName: s.bankName });
    return m;
  }, [statements]);

  const legacyAnomalies = useMemo(
    () => anomalies.map((a) => toLegacyAnomaly(a, clientId, bankByStatement)),
    [anomalies, clientId, bankByStatement],
  );

  return {
    summary: hasWorkflowData ? summary : EMPTY,
    loading,
    hasWorkflowData,
    legacyAnomalies: hasWorkflowData ? legacyAnomalies : [],
    refresh: fetchAll,
  };
}
