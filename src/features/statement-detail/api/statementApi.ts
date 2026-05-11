// ============================================================================
// statementApi — Supabase data access pour la page relevé
// ============================================================================
// Encapsule TOUS les accès Supabase liés à un relevé : métadonnées (header
// page) + transactions (onglet transactions / ReconciliationTab côté banque).
//
// Schéma cible :
//   atlasbanx.bank_statements (1 ligne)
//   atlasbanx.bank_accounts   (FK)
//   atlasbanx.clients         (FK)
//   atlasbanx.transactions    (94 lignes pour le relevé NSIA)
//
// Toutes les fonctions sont async et déterministes ; elles renvoient des
// types adaptés (centimes en bigint-ish, ISO dates, etc.).
// ============================================================================

import { getSupabaseClient } from '../../../lib/supabase';
import type { BankTransaction } from '../types/statement.types';

// ============================================================================
// Types adaptés à la page
// ============================================================================

export interface StatementHeaderMeta {
  id: string;
  accountId: string;
  clientId: string;
  bankCode: string;
  bankLegalName: string;
  accountNumber: string;
  clientLegalName: string;
  periodStart: string;          // ISO date
  periodEnd: string;            // ISO date
  transactionCount: number;
  /** Dernier solde connu (centimes). */
  finalBalanceCentimes: number;
  status: string;
  importedAt: string;
}

// ============================================================================
// Loaders
// ============================================================================

export async function loadStatementMeta(statementId: string): Promise<StatementHeaderMeta> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { data: stmt, error: e1 } = await sb
    .schema('atlasbanx' as never)
    .from('bank_statements' as never)
    .select('*')
    .eq('id', statementId)
    .single();
  if (e1 || !stmt) throw new Error(`Relevé introuvable: ${e1?.message ?? statementId}`);

  const s = stmt as Record<string, unknown>;
  const accountId = s.account_id as string;
  const clientId = s.client_id as string;

  // Account
  let accountNumber = '';
  if (accountId) {
    const { data: acc } = await sb
      .schema('atlasbanx' as never)
      .from('bank_accounts' as never)
      .select('account_number')
      .eq('id', accountId)
      .single();
    accountNumber = ((acc as { account_number?: string } | null)?.account_number) ?? '';
  }

  // Client
  let clientLegalName = '';
  if (clientId) {
    const { data: cli } = await sb
      .schema('atlasbanx' as never)
      .from('clients' as never)
      .select('name, legal_name')
      .eq('id', clientId)
      .single();
    const c = (cli ?? {}) as { name?: string; legal_name?: string };
    clientLegalName = c.legal_name || c.name || '';
  }

  // Final balance — dernière transaction par date (running balance)
  const { data: lastTx } = await sb
    .schema('atlasbanx' as never)
    .from('transactions' as never)
    .select('balance')
    .eq('account_id', accountId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);
  const lastBal = ((lastTx?.[0] as { balance?: number } | undefined)?.balance) ?? 0;

  return {
    id: statementId,
    accountId,
    clientId,
    bankCode: (s.bank_code as string) ?? '',
    bankLegalName: (s.bank_name as string) ?? '',
    accountNumber,
    clientLegalName,
    periodStart: (s.period_start as string) ?? '',
    periodEnd: (s.period_end as string) ?? '',
    transactionCount: (s.transaction_count as number) ?? 0,
    finalBalanceCentimes: amountToCentimes(lastBal),
    status: (s.status as string) ?? 'imported',
    importedAt: (s.imported_at as string) ?? new Date().toISOString(),
  };
}

export async function loadTransactions(
  accountId: string,
  opts: { from?: string; to?: string; limit?: number } = {},
): Promise<BankTransaction[]> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  // 1. Première tentative : filtrage strict par account_id (FK uuid)
  let q = sb
    .schema('atlasbanx' as never)
    .from('transactions' as never)
    .select('*')
    .eq('account_id', accountId)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (opts.from) q = q.gte('date', opts.from);
  if (opts.to)   q = q.lte('date', opts.to);
  if (opts.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw new Error(`Erreur transactions: ${error.message}`);

  if (data && data.length > 0) return data.map(mapTransactionRow);

  // 2. Fallback : si aucune transaction n'a account_id renseigné (data legacy
  // ou import qui n'a pas réassocié la FK), on tente par account_number +
  // bank_code lus depuis le bank_account parent.
  //
  // Ce fallback résout le bug "Aucune transaction ne correspond" sur les
  // statements importés avant le fix d'association account_id.
  const { data: acc } = await sb
    .schema('atlasbanx' as never)
    .from('bank_accounts' as never)
    .select('account_number, bank_code')
    .eq('id', accountId)
    .single();
  const accountNumber = (acc as { account_number?: string } | null)?.account_number;
  const bankCode = (acc as { bank_code?: string } | null)?.bank_code;
  if (!accountNumber || !bankCode) return [];

  // Match par account_number (TRIM pour absorber les espaces parasites
  // observés en prod, type ' 01281-86315802001-03')
  let fallback = sb
    .schema('atlasbanx' as never)
    .from('transactions' as never)
    .select('*')
    .eq('bank_code', bankCode)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });
  if (opts.from) fallback = fallback.gte('date', opts.from);
  if (opts.to)   fallback = fallback.lte('date', opts.to);
  if (opts.limit) fallback = fallback.limit(opts.limit);

  const { data: byBank, error: fbErr } = await fallback;
  if (fbErr) return [];

  const trimmed = accountNumber.trim();
  const matched = (byBank ?? []).filter((row) => {
    const r = row as { account_number?: string };
    return typeof r.account_number === 'string' && r.account_number.trim() === trimmed;
  });
  return matched.map(mapTransactionRow);
}

// ============================================================================
// Mappers
// ============================================================================

/** Convertit un montant numeric (XAF unités) en centimes. */
function amountToCentimes(n: unknown): number {
  if (typeof n !== 'number') return 0;
  return Math.round(n * 100);
}

function mapTransactionRow(row: unknown): BankTransaction {
  const r = row as Record<string, unknown>;
  const amount = (r.amount as number) ?? 0;
  // Convention prod : amount signé (négatif = débit, positif = crédit)
  const debitCentimes  = amount < 0 ? Math.round(Math.abs(amount) * 100) : 0;
  const creditCentimes = amount > 0 ? Math.round(amount * 100) : 0;
  return {
    id: r.id as string,
    date: r.date as string,
    valueDate: (r.value_date as string | null) ?? undefined,
    label: (r.description as string) ?? '',
    reference: (r.reference as string | null) ?? null,
    debitCentimes,
    creditCentimes,
    runningBalanceCentimes: amountToCentimes(r.balance),
  };
}
