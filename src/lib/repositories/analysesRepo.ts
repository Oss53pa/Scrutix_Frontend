// ============================================================================
// ATLASBANX - Analyses & Anomalies Repository
// ============================================================================

import { getSupabaseClient } from '../supabase';
import type {
  AnalysisResult,
  Anomaly,
  AnomalyType,
  Severity,
} from '../../types';
import type {
  DbAnalysis,
  DbAnalysisInsert,
  DbAnomaly,
  DbAnomalyInsert,
} from '../database.types';

const SCHEMA = 'atlasbanx';

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

// ----------------------------------------------------------------------------
// Mappers
// ----------------------------------------------------------------------------

interface AnalysisRowWithAnomalies extends DbAnalysis {
  anomalies?: DbAnomaly[];
}

function dbToAnalysis(row: AnalysisRowWithAnomalies): AnalysisResult {
  const anomalies = (row.anomalies ?? []).map(dbToAnomaly);
  const config = (row.config ?? {}) as AnalysisResult['config'];
  const summary = (row.summary ?? {}) as AnalysisResult['summary'];
  // Statistics derived from anomalies snapshot (kept on row.metadata if persisted).
  const statistics =
    ((row.metadata?.statistics) as AnalysisResult['statistics'] | undefined) ?? {
      totalTransactions: 0,
      totalAmount: 0,
      totalAnomalies: anomalies.length,
      totalAnomalyAmount: anomalies.reduce((s, a) => s + a.amount, 0),
      anomaliesByType: {} as Record<AnomalyType, number>,
      anomaliesBySeverity: {} as Record<Severity, number>,
      anomalyRate: 0,
      potentialSavings: row.total_savings,
    };

  return {
    id: row.external_id ?? row.id,
    config,
    status: row.status as AnalysisResult['status'],
    progress: row.status === 'completed' ? 100 : 0,
    anomalies,
    statistics,
    summary,
    startedAt: row.started_at ? new Date(row.started_at) : new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    error: row.error ?? undefined,
  };
}

function dbToAnomaly(row: DbAnomaly): Anomaly {
  const reasoning = (row.reasoning ?? {}) as Record<string, unknown>;
  return {
    id: row.external_id ?? row.id,
    type: row.type as AnomalyType,
    severity: row.severity as Severity,
    confidence: row.confidence,
    amount: row.amount,
    transactions: (row.transactions ?? []) as Anomaly['transactions'],
    evidence: ((reasoning.evidence as Anomaly['evidence']) ?? []),
    recommendation: (reasoning.recommendation as string) ?? '',
    status: row.status,
    detectedAt: new Date(row.detected_at),
    reviewedAt: row.decided_at ? new Date(row.decided_at) : undefined,
    reviewedBy: (reasoning.reviewedBy as string | undefined),
    notes: row.notes ?? undefined,
    detectionSource: (reasoning.detectionSource as Anomaly['detectionSource']) ?? 'algorithm',
    aiAnalysis: (reasoning.aiAnalysis as Anomaly['aiAnalysis']),
  };
}

function analysisToDb(
  userId: string,
  result: AnalysisResult,
  isCurrent: boolean,
  internalId?: string,
): DbAnalysisInsert {
  return {
    ...(internalId ? { id: internalId } : {}),
    user_id: userId,
    external_id: result.id,
    status: result.status as DbAnalysisInsert['status'],
    config: (result.config ?? {}) as Record<string, unknown>,
    summary: (result.summary ?? {}) as Record<string, unknown>,
    total_savings: result.statistics?.potentialSavings ?? 0,
    anomaly_count: result.anomalies?.length ?? 0,
    is_current: isCurrent,
    started_at: result.startedAt ? result.startedAt.toISOString() : null,
    completed_at: result.completedAt ? result.completedAt.toISOString() : null,
    error: result.error ?? null,
    metadata: { statistics: result.statistics ?? {} },
  };
}

function anomalyToDb(
  userId: string,
  analysisInternalId: string,
  anomaly: Anomaly,
): DbAnomalyInsert {
  return {
    user_id: userId,
    analysis_id: analysisInternalId,
    external_id: anomaly.id,
    type: anomaly.type as string,
    severity: anomaly.severity as DbAnomalyInsert['severity'],
    status: anomaly.status,
    amount: anomaly.amount,
    confidence: anomaly.confidence,
    description: anomaly.recommendation ?? null,
    notes: anomaly.notes ?? null,
    detected_at: anomaly.detectedAt.toISOString(),
    decided_at: anomaly.reviewedAt ? anomaly.reviewedAt.toISOString() : null,
    transactions: (anomaly.transactions ?? []) as unknown as Record<string, unknown>[],
    reasoning: {
      evidence: anomaly.evidence ?? [],
      recommendation: anomaly.recommendation ?? '',
      reviewedBy: anomaly.reviewedBy,
      detectionSource: anomaly.detectionSource,
      aiAnalysis: anomaly.aiAnalysis,
    },
    metadata: {},
  };
}

// ----------------------------------------------------------------------------
// Repository
// ----------------------------------------------------------------------------

export const analysesRepo = {
  /**
   * Fetch all analyses for the user, eagerly loading anomalies.
   * Returns the current analysis (if any) and the history.
   */
  async fetchAll(userId: string): Promise<{
    current: AnalysisResult | null;
    history: AnalysisResult[];
  }> {
    const supabase = requireClient();

    const [analysesRes, anomaliesRes] = await Promise.all([
      supabase
        .schema(SCHEMA)
        .from('analyses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .schema(SCHEMA)
        .from('anomalies')
        .select('*')
        .eq('user_id', userId),
    ]);

    if (analysesRes.error) throw analysesRes.error;
    if (anomaliesRes.error) throw anomaliesRes.error;

    const anomaliesByAnalysis = new Map<string, DbAnomaly[]>();
    for (const a of (anomaliesRes.data ?? []) as DbAnomaly[]) {
      const list = anomaliesByAnalysis.get(a.analysis_id) ?? [];
      list.push(a);
      anomaliesByAnalysis.set(a.analysis_id, list);
    }

    const all = (analysesRes.data ?? []).map((row) =>
      dbToAnalysis({
        ...(row as DbAnalysis),
        anomalies: anomaliesByAnalysis.get(row.id) ?? [],
      }),
    );

    const currentRow = (analysesRes.data ?? []).find((r) => r.is_current);
    const current = currentRow
      ? dbToAnalysis({
          ...(currentRow as DbAnalysis),
          anomalies: anomaliesByAnalysis.get(currentRow.id) ?? [],
        })
      : null;

    const history = all.filter((a) => !current || a.id !== current.id);
    return { current, history };
  },

  /**
   * Persist a new completed/failed analysis along with its anomalies.
   * Returns the internal Supabase id of the analysis row.
   */
  async create(
    userId: string,
    result: AnalysisResult,
    opts: { isCurrent?: boolean } = {},
  ): Promise<string> {
    const supabase = requireClient();
    const isCurrent = opts.isCurrent ?? false;

    const { data: analysisRow, error: analysisErr } = await supabase
      .schema(SCHEMA)
      .from('analyses')
      .insert(analysisToDb(userId, result, isCurrent))
      .select()
      .single();
    if (analysisErr) throw analysisErr;

    if (result.anomalies && result.anomalies.length > 0) {
      const payload = result.anomalies.map((a) =>
        anomalyToDb(userId, analysisRow.id, a),
      );
      const { error: anomErr } = await supabase
        .schema(SCHEMA)
        .from('anomalies')
        .insert(payload);
      if (anomErr) throw anomErr;
    }

    return analysisRow.id;
  },

  /**
   * Mark an analysis as the "current" one (sets is_current=TRUE; trigger
   * resets all others to FALSE for the same user).
   */
  async setCurrent(userId: string, externalId: string | null): Promise<void> {
    const supabase = requireClient();
    if (externalId === null) {
      const { error } = await supabase
        .schema(SCHEMA)
        .from('analyses')
        .update({ is_current: false })
        .eq('user_id', userId)
        .eq('is_current', true);
      if (error) throw error;
      return;
    }
    const { error } = await supabase
      .schema(SCHEMA)
      .from('analyses')
      .update({ is_current: true })
      .eq('user_id', userId)
      .eq('external_id', externalId);
    if (error) throw error;
  },

  /**
   * Update the status, notes, or decided_at on a single anomaly.
   * Identifies the anomaly by its client-side `external_id`.
   */
  async updateAnomaly(
    userId: string,
    externalId: string,
    updates: Partial<{
      status: Anomaly['status'];
      notes: string;
      decidedAt: Date;
    }>,
  ): Promise<void> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.decidedAt !== undefined) payload.decided_at = updates.decidedAt.toISOString();
    if (Object.keys(payload).length === 0) return;
    const { error } = await supabase
      .schema(SCHEMA)
      .from('anomalies')
      .update(payload)
      .eq('user_id', userId)
      .eq('external_id', externalId);
    if (error) throw error;
  },

  async remove(userId: string, externalId: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .schema(SCHEMA)
      .from('analyses')
      .delete()
      .eq('user_id', userId)
      .eq('external_id', externalId);
    if (error) throw error;
  },

  async clear(userId: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .schema(SCHEMA)
      .from('analyses')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  },
};
