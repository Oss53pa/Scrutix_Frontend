// ============================================================================
// ATLASBANX - Transactions Repository
// Wraps Supabase queries for atlasbanx.transactions.
// ============================================================================

import { getSupabaseClient } from '../supabase';
import { dbToTransaction, transactionToDb } from './mappers';
import type { Transaction } from '../../types';

const SCHEMA = 'atlasbanx';
const INSERT_BATCH_SIZE = 500;

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

export const transactionsRepo = {
  /**
   * Fetch all transactions for the current user.
   * NOTE: for large volumes (>10k), consider paging via client_id filter.
   */
  async fetchAll(userId: string): Promise<Transaction[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(dbToTransaction);
  },

  async fetchByClient(userId: string, clientId: string): Promise<Transaction[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(dbToTransaction);
  },

  /**
   * Bulk insert transactions (used during statement import).
   * Chunks to keep requests under the Supabase payload limit.
   */
  async bulkInsert(
    userId: string,
    clientId: string,
    transactions: Transaction[],
  ): Promise<void> {
    if (transactions.length === 0) return;
    const supabase = requireClient();

    for (let i = 0; i < transactions.length; i += INSERT_BATCH_SIZE) {
      const batch = transactions.slice(i, i + INSERT_BATCH_SIZE);
      const payload = batch.map((t) => transactionToDb(t, userId, clientId));
      const { error } = await supabase.schema(SCHEMA).from('transactions').insert(payload);
      if (error) throw error;
    }
  },

  async update(
    userId: string,
    id: string,
    updates: Partial<Transaction>,
  ): Promise<void> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = {};
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.amount !== undefined) payload.amount = updates.amount;
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.reference !== undefined) payload.reference = updates.reference;
    if (updates.metadata !== undefined) payload.metadata = updates.metadata;
    if (updates.date !== undefined) payload.date = updates.date instanceof Date ? updates.date.toISOString() : new Date(updates.date).toISOString();
    if (updates.valueDate !== undefined) payload.value_date = updates.valueDate instanceof Date ? updates.valueDate.toISOString() : updates.valueDate ? new Date(updates.valueDate).toISOString() : null;
    if (updates.balance !== undefined) payload.balance = updates.balance;
    if (updates.accountNumber !== undefined) payload.account_number = updates.accountNumber;
    if (updates.bankCode !== undefined) payload.bank_code = updates.bankCode;

    const { error } = await supabase
      .schema(SCHEMA)
      .from('transactions')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  },

  async remove(userId: string, id: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .schema(SCHEMA)
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  },

  async removeAllForUser(userId: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .schema(SCHEMA)
      .from('transactions')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  },
};
