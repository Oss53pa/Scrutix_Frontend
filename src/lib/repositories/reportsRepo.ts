// ============================================================================
// ATLASBANX - Reports Repository
// Persists report drafts and generated report history.
// ============================================================================

import { getSupabaseClient } from '../supabase';
import type { Anomaly } from '../../types';
import type {
  DbReportDraft,
  DbReportDraftInsert,
  DbGeneratedReport,
  DbGeneratedReportInsert,
} from '../database.types';

const SCHEMA = 'atlasbanx';

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

// ----------------------------------------------------------------------------
// Domain types (mirror the existing reportStore shapes)
// ----------------------------------------------------------------------------

export interface ReportDraft {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  type: 'audit' | 'summary' | 'detailed' | 'recovery';
  period: { start: Date; end: Date };
  selectedAnomalies: Anomaly[];
  confirmedAnomalies: Anomaly[];
  dismissedAnomalies: Anomaly[];
  contestedAnomalies: Anomaly[];
  notes: string;
  includeAIAnalysis: boolean;
  includeRecommendations: boolean;
  includeTransactionDetails: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedReport {
  id: string;
  draftId: string;
  title: string;
  clientName: string;
  type: ReportDraft['type'];
  format: 'pdf' | 'excel';
  anomalyCount: number;
  totalAmount: number;
  generatedAt: Date;
  downloadUrl?: string;
}

// ----------------------------------------------------------------------------
// Mappers
// ----------------------------------------------------------------------------

function dbToDraft(row: DbReportDraft): ReportDraft {
  return {
    id: row.id,
    title: row.title,
    clientId: row.client_id ?? '',
    clientName: row.client_name,
    type: row.type,
    period: {
      start: row.period_start ? new Date(row.period_start) : new Date(),
      end: row.period_end ? new Date(row.period_end) : new Date(),
    },
    selectedAnomalies: (row.selected_anomalies ?? []) as unknown as Anomaly[],
    confirmedAnomalies: (row.confirmed_anomalies ?? []) as unknown as Anomaly[],
    dismissedAnomalies: (row.dismissed_anomalies ?? []) as unknown as Anomaly[],
    contestedAnomalies: (row.contested_anomalies ?? []) as unknown as Anomaly[],
    notes: row.notes,
    includeAIAnalysis: row.include_ai_analysis,
    includeRecommendations: row.include_recommendations,
    includeTransactionDetails: row.include_transaction_details,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function draftToDb(userId: string, draft: ReportDraft): DbReportDraftInsert {
  return {
    user_id: userId,
    client_id: draft.clientId || null,
    client_name: draft.clientName,
    title: draft.title,
    type: draft.type,
    period_start: draft.period.start ? draft.period.start.toISOString() : null,
    period_end: draft.period.end ? draft.period.end.toISOString() : null,
    selected_anomalies: (draft.selectedAnomalies ?? []) as unknown as Record<string, unknown>[],
    confirmed_anomalies: (draft.confirmedAnomalies ?? []) as unknown as Record<string, unknown>[],
    dismissed_anomalies: (draft.dismissedAnomalies ?? []) as unknown as Record<string, unknown>[],
    contested_anomalies: (draft.contestedAnomalies ?? []) as unknown as Record<string, unknown>[],
    notes: draft.notes ?? '',
    include_ai_analysis: draft.includeAIAnalysis,
    include_recommendations: draft.includeRecommendations,
    include_transaction_details: draft.includeTransactionDetails,
    metadata: {},
  };
}

function dbToGenerated(row: DbGeneratedReport): GeneratedReport {
  return {
    id: row.external_id ?? row.id,
    draftId: row.draft_id ?? '',
    title: row.title,
    clientName: row.client_name,
    type: row.type,
    format: row.format,
    anomalyCount: row.anomaly_count,
    totalAmount: row.total_amount,
    generatedAt: new Date(row.generated_at),
    downloadUrl: row.download_url ?? undefined,
  };
}

function generatedToDb(
  userId: string,
  report: GeneratedReport,
): DbGeneratedReportInsert {
  return {
    user_id: userId,
    external_id: report.id,
    draft_id: null, // draft id is client-side; we don't link by FK
    title: report.title,
    client_name: report.clientName,
    type: report.type,
    format: report.format,
    anomaly_count: report.anomalyCount,
    total_amount: report.totalAmount,
    download_url: report.downloadUrl ?? null,
    storage_path: null,
    integrity_hash: null,
    metadata: {},
    generated_at: report.generatedAt.toISOString(),
  };
}

// ----------------------------------------------------------------------------
// Repository
// ----------------------------------------------------------------------------

export const reportsRepo = {
  // ---- Drafts (typically 0 or 1 active per user) -----------------------

  async fetchDraft(userId: string): Promise<ReportDraft | null> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('report_drafts')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? dbToDraft(data) : null;
  },

  /**
   * Replace the user's current draft. Deletes any existing draft and
   * inserts the new one. Use null to clear.
   */
  async upsertDraft(userId: string, draft: ReportDraft | null): Promise<void> {
    const supabase = requireClient();
    // Always wipe before insert — simplifies "single active draft" semantics.
    const del = await supabase
      .schema(SCHEMA)
      .from('report_drafts')
      .delete()
      .eq('user_id', userId);
    if (del.error) throw del.error;

    if (!draft) return;

    const { error } = await supabase
      .schema(SCHEMA)
      .from('report_drafts')
      .insert(draftToDb(userId, draft));
    if (error) throw error;
  },

  // ---- Generated reports history ---------------------------------------

  async fetchGenerated(userId: string): Promise<GeneratedReport[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('generated_reports')
      .select('*')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(dbToGenerated);
  },

  async addGenerated(userId: string, report: GeneratedReport): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .schema(SCHEMA)
      .from('generated_reports')
      .insert(generatedToDb(userId, report));
    if (error) throw error;
  },

  async removeGenerated(userId: string, externalId: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .schema(SCHEMA)
      .from('generated_reports')
      .delete()
      .eq('user_id', userId)
      .eq('external_id', externalId);
    if (error) throw error;
  },

  async clear(userId: string): Promise<void> {
    const supabase = requireClient();
    await supabase.schema(SCHEMA).from('report_drafts').delete().eq('user_id', userId);
    await supabase.schema(SCHEMA).from('generated_reports').delete().eq('user_id', userId);
  },
};
