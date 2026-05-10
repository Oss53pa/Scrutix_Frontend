// ============================================================================
// reportsApi — Supabase data access pour rapports + lettres réclamation
// ============================================================================
// Schéma cible :
//   atlasbanx.generated_reports     (PDF généré, déjà en prod)
//   atlasbanx.signed_reports        (signature ADVIST + envoi, migration 023)
//   atlasbanx.bank_complaint_letters (migration 023)
// ============================================================================

import { getSupabaseClient } from '../../../lib/supabase';
import type {
  ReportTemplate,
  SignatureType,
  SignedReport,
  ReportRecipient,
  BankComplaintLetter,
} from '../types/statement.types';

// ============================================================================
// Generated reports (PDF rendu) — atlasbanx.generated_reports
// ============================================================================

export async function createGeneratedReport(args: {
  statementId: string;
  clientId: string;
  template: ReportTemplate;
  documentUrl: string;
  hash: string;
  anomalyCount: number;
  totalAmountCentimes: number;
  title?: string;
}): Promise<{ id: string }> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { data, error } = await sb
    .schema('atlasbanx' as never)
    .from('generated_reports' as never)
    .insert({
      client_id: args.clientId,
      title: args.title ?? `Rapport ${args.template}`,
      type: args.template,
      format: 'pdf',
      anomaly_count: args.anomalyCount,
      total_amount: args.totalAmountCentimes / 100,
      download_url: args.documentUrl,
      integrity_hash: args.hash,
      metadata: { statement_id: args.statementId, template: args.template },
      generated_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Insert generated_report: ${error?.message}`);
  return { id: (data as { id: string }).id };
}

// ============================================================================
// Signed reports — atlasbanx.signed_reports
// ============================================================================

export async function createSignedReportDraft(args: {
  statementId: string;
  generatedReportId?: string | null;
  template: ReportTemplate;
  documentUrl: string;
  hash: string;
}): Promise<SignedReport> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { data, error } = await sb
    .schema('atlasbanx' as never)
    .from('signed_reports' as never)
    .insert({
      statement_id: args.statementId,
      generated_report_id: args.generatedReportId ?? null,
      template: args.template,
      document_url: args.documentUrl,
      hash: args.hash,
      status: 'draft',
      recipients: [],
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Insert signed_report: ${error?.message}`);
  return mapSignedReportRow(data);
}

export async function loadLatestSignedReport(
  statementId: string,
): Promise<SignedReport | null> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { data, error } = await sb
    .schema('atlasbanx' as never)
    .from('signed_reports' as never)
    .select('*')
    .eq('statement_id', statementId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`Erreur signed_reports: ${error.message}`);
  if (!data || data.length === 0) return null;
  return mapSignedReportRow(data[0]);
}

export async function signReport(args: {
  reportId: string;
  signerId: string;
  signatureType: SignatureType;
  recipients: ReportRecipient[];
  proofBundleUrl?: string | null;
  timestampRfc3161?: string | null;
}): Promise<SignedReport> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { data, error } = await sb
    .schema('atlasbanx' as never)
    .from('signed_reports' as never)
    .update({
      signer_id: args.signerId,
      signature_type: args.signatureType,
      proof_bundle_url: args.proofBundleUrl ?? null,
      timestamp_rfc3161: args.timestampRfc3161 ?? null,
      recipients: args.recipients,
      signed_at: new Date().toISOString(),
      status: 'sent',
    })
    .eq('id', args.reportId)
    .select('*')
    .single();
  if (error || !data) throw new Error(`Sign report: ${error?.message}`);
  return mapSignedReportRow(data);
}

// ============================================================================
// Complaint letters — atlasbanx.bank_complaint_letters
// ============================================================================

export async function createComplaintLetter(args: {
  statementId: string;
  bankCode: string;
  totalAmountClaimedCentimes: number;
  anomalyIds: string[];
  documentUrl?: string;
  createdBy: string;
}): Promise<BankComplaintLetter> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { data, error } = await sb
    .schema('atlasbanx' as never)
    .from('bank_complaint_letters' as never)
    .insert({
      statement_id: args.statementId,
      bank_code: args.bankCode,
      total_amount_claimed: args.totalAmountClaimedCentimes,
      anomalies_included: args.anomalyIds,
      document_url: args.documentUrl ?? null,
      status: 'draft',
      created_by: args.createdBy,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Insert complaint: ${error?.message}`);
  return mapComplaintRow(data);
}

export async function loadLatestComplaintLetter(
  statementId: string,
): Promise<BankComplaintLetter | null> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { data, error } = await sb
    .schema('atlasbanx' as never)
    .from('bank_complaint_letters' as never)
    .select('*')
    .eq('statement_id', statementId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`Erreur complaint: ${error.message}`);
  if (!data || data.length === 0) return null;
  return mapComplaintRow(data[0]);
}

// ============================================================================
// Mappers
// ============================================================================

function mapSignedReportRow(row: unknown): SignedReport {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    statementId: r.statement_id as string,
    template: r.template as ReportTemplate,
    signerId: (r.signer_id as string) ?? null,
    signerHandle: null,
    signatureType: (r.signature_type as SignatureType | null) ?? null,
    documentUrl: r.document_url as string,
    proofBundleUrl: (r.proof_bundle_url as string) ?? null,
    hash: r.hash as string,
    timestampRfc3161: (r.timestamp_rfc3161 as string) ?? null,
    recipients: (r.recipients as ReportRecipient[]) ?? [],
    status: (r.status as SignedReport['status']) ?? 'draft',
    signedAt: (r.signed_at as string) ?? null,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

function mapComplaintRow(row: unknown): BankComplaintLetter {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    statementId: r.statement_id as string,
    bankCode: r.bank_code as string,
    bankLegalName: '',
    totalAmountClaimedCentimes: Number(r.total_amount_claimed ?? 0),
    anomaliesIncluded: (r.anomalies_included as string[]) ?? [],
    documentUrl: (r.document_url as string) ?? null,
    status: (r.status as BankComplaintLetter['status']) ?? 'draft',
    sentAt: (r.sent_at as string) ?? null,
    resolutionReceivedAt: (r.resolution_received_at as string) ?? null,
    amountRecoveredCentimes: Number(r.amount_recovered ?? 0),
    conventionRef: null,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}
