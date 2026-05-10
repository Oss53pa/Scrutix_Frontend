// ============================================================================
// reconciliationApi — load/save bank_reconciliations
// ============================================================================

import { getSupabaseClient } from '../../../lib/supabase';
import type {
  BankReconciliation,
  LedgerEntry,
  ReconciliationDiscrepancy,
  ReconciliationMatch,
  LedgerSource,
} from '../types/statement.types';

// ============================================================================
// Loaders
// ============================================================================

export async function loadLatestReconciliation(
  statementId: string,
): Promise<BankReconciliation | null> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { data, error } = await sb
    .schema('atlasbanx' as never)
    .from('bank_reconciliations' as never)
    .select('*')
    .eq('statement_id', statementId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`Erreur reconciliation: ${error.message}`);
  if (!data || data.length === 0) return null;
  return mapReconciliationRow(data[0]);
}

export async function loadLedgerEntries(reconciliationId: string): Promise<LedgerEntry[]> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { data, error } = await sb
    .schema('atlasbanx' as never)
    .from('bank_reconciliations' as never)
    .select('ledger_entries')
    .eq('id', reconciliationId)
    .single();
  if (error || !data) return [];
  const raw = ((data as { ledger_entries?: unknown }).ledger_entries) as unknown[];
  return Array.isArray(raw) ? (raw as LedgerEntry[]) : [];
}

// ============================================================================
// Mutations
// ============================================================================

export async function saveReconciliation(args: {
  statementId: string;
  ledgerSource: LedgerSource;
  ledgerEntries: LedgerEntry[];
  matches: ReconciliationMatch[];
  unmatchedBank: string[];
  unmatchedLedger: string[];
  discrepancies: ReconciliationDiscrepancy[];
  totalBankCentimes: number;
  totalLedgerCentimes: number;
  matchRate: number;
}): Promise<BankReconciliation> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  // Upsert : si une réconciliation existe déjà pour ce relevé, on insère une
  // nouvelle version (audit trail) plutôt qu'on update.
  const payload = {
    statement_id: args.statementId,
    ledger_imported_at: new Date().toISOString(),
    ledger_source: args.ledgerSource,
    matched_pairs: args.matches,
    unmatched_bank: args.unmatchedBank,
    unmatched_ledger: args.unmatchedLedger,
    discrepancies: args.discrepancies,
    ledger_entries: args.ledgerEntries,
    total_bank_centimes: args.totalBankCentimes,
    total_ledger_centimes: args.totalLedgerCentimes,
    match_rate: args.matchRate,
  };

  const { data, error } = await sb
    .schema('atlasbanx' as never)
    .from('bank_reconciliations' as never)
    .insert(payload)
    .select('*')
    .single();
  if (error || !data) throw new Error(`Insert reconciliation: ${error?.message}`);
  return mapReconciliationRow(data);
}

export async function markReconciliationGenerated(
  reconciliationId: string,
  pdfUrl: string,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { error } = await sb
    .schema('atlasbanx' as never)
    .from('bank_reconciliations' as never)
    .update({
      reconciliation_state_url: pdfUrl,
      generated_at: new Date().toISOString(),
    })
    .eq('id', reconciliationId);
  if (error) throw new Error(`Update reconciliation: ${error.message}`);
}

// ============================================================================
// Mappers
// ============================================================================

function mapReconciliationRow(row: unknown): BankReconciliation {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    statementId: r.statement_id as string,
    ledgerSource: (r.ledger_source as LedgerSource) ?? 'manual_upload',
    ledgerImportedAt: (r.ledger_imported_at as string) ?? new Date().toISOString(),
    matchedPairs: (r.matched_pairs as ReconciliationMatch[]) ?? [],
    unmatchedBank: (r.unmatched_bank as string[]) ?? [],
    unmatchedLedger: (r.unmatched_ledger as string[]) ?? [],
    discrepancies: (r.discrepancies as ReconciliationDiscrepancy[]) ?? [],
    totalBankCentimes: Number(r.total_bank_centimes ?? 0),
    totalLedgerCentimes: Number(r.total_ledger_centimes ?? 0),
    gapCentimes: Number(r.gap_centimes ?? 0),
    matchRate: Number(r.match_rate ?? 0),
    reconciliationStateUrl: (r.reconciliation_state_url as string) ?? null,
    generatedAt: (r.generated_at as string) ?? null,
  };
}
