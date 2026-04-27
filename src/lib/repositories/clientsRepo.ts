// ============================================================================
// ATLASBANX - Clients Repository
// Wraps Supabase queries for atlasbanx.clients, atlasbanx.bank_accounts,
// and atlasbanx.bank_statements. All methods return domain types.
// ============================================================================

import { getSupabaseClient } from '../supabase';
import {
  dbToClient,
  clientToDb,
  dbToBankAccount,
  bankAccountToDb,
  dbToBankStatement,
  bankStatementToDb,
} from './mappers';
import type { Client, BankAccount, BankStatement } from '../../types';

const SCHEMA = 'atlasbanx';

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

// ----------------------------------------------------------------------------
// Clients
// ----------------------------------------------------------------------------

export const clientsRepo = {
  /**
   * Fetch all clients for the current user, eagerly loading their bank accounts.
   */
  async fetchAll(userId: string): Promise<Client[]> {
    const supabase = requireClient();

    const [clientsRes, accountsRes] = await Promise.all([
      supabase.schema(SCHEMA).from('clients').select('*').eq('user_id', userId),
      supabase.schema(SCHEMA).from('bank_accounts').select('*').eq('user_id', userId),
    ]);

    if (clientsRes.error) throw clientsRes.error;
    if (accountsRes.error) throw accountsRes.error;

    const accountsByClient = new Map<string, BankAccount[]>();
    for (const row of accountsRes.data ?? []) {
      const account = dbToBankAccount(row);
      const list = accountsByClient.get(account.clientId) ?? [];
      list.push(account);
      accountsByClient.set(account.clientId, list);
    }

    return (clientsRes.data ?? []).map((row) => {
      const client = dbToClient(row);
      client.accounts = accountsByClient.get(client.id) ?? [];
      return client;
    });
  },

  async insert(userId: string, client: Client): Promise<Client> {
    const supabase = requireClient();
    const payload = clientToDb(client, userId);
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('clients')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    const inserted = dbToClient(data);
    inserted.accounts = client.accounts ?? [];
    return inserted;
  },

  async update(userId: string, id: string, updates: Partial<Client>): Promise<void> {
    const supabase = requireClient();
    // Build payload only from fields actually present in updates
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.code !== undefined) payload.code = updates.code;
    if (updates.legalName !== undefined) payload.legal_name = updates.legalName;
    if (updates.siret !== undefined) payload.siret = updates.siret;
    if (updates.rccm !== undefined) payload.rccm = updates.rccm;
    if (updates.nif !== undefined) payload.nif = updates.nif;
    if (updates.legalForm !== undefined) payload.legal_form = updates.legalForm;
    if (updates.capital !== undefined) payload.capital = updates.capital;
    if (updates.currency !== undefined) payload.currency = updates.currency;
    if (updates.address !== undefined) payload.address = updates.address;
    if (updates.city !== undefined) payload.city = updates.city;
    if (updates.postalCode !== undefined) payload.postal_code = updates.postalCode;
    if (updates.country !== undefined) payload.country = updates.country;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.website !== undefined) payload.website = updates.website;
    if (updates.contactName !== undefined) payload.contact_name = updates.contactName;
    if (updates.contactRole !== undefined) payload.contact_role = updates.contactRole;
    if (updates.contactEmail !== undefined) payload.contact_email = updates.contactEmail;
    if (updates.contactPhone !== undefined) payload.contact_phone = updates.contactPhone;
    if (updates.sector !== undefined) payload.sector = updates.sector;
    if (updates.activity !== undefined) payload.activity = updates.activity;
    if (updates.employeeCount !== undefined) payload.employee_count = updates.employeeCount;
    if (updates.annualRevenue !== undefined) payload.annual_revenue = updates.annualRevenue;
    if (updates.fiscalYearEnd !== undefined) payload.fiscal_year_end = updates.fiscalYearEnd;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.tags !== undefined) payload.tags = updates.tags;

    if (Object.keys(payload).length === 0) return;

    const { error } = await supabase
      .schema(SCHEMA)
      .from('clients')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  },

  async remove(userId: string, id: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .schema(SCHEMA)
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  },

  // --------------------------------------------------------------------------
  // Bank accounts (scoped to a client)
  // --------------------------------------------------------------------------

  async addAccount(userId: string, account: BankAccount): Promise<BankAccount> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('bank_accounts')
      .insert(bankAccountToDb(account, userId))
      .select()
      .single();
    if (error) throw error;
    return dbToBankAccount(data);
  },

  async updateAccount(
    userId: string,
    accountId: string,
    updates: Partial<BankAccount>,
  ): Promise<void> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = {};
    if (updates.accountNumber !== undefined) payload.account_number = updates.accountNumber;
    if (updates.bankCode !== undefined) payload.bank_code = updates.bankCode;
    if (updates.bankName !== undefined) payload.bank_name = updates.bankName;
    if (updates.currency !== undefined) payload.currency = updates.currency;
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;

    const { error } = await supabase
      .schema(SCHEMA)
      .from('bank_accounts')
      .update(payload)
      .eq('id', accountId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  async removeAccount(userId: string, accountId: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .schema(SCHEMA)
      .from('bank_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  // --------------------------------------------------------------------------
  // Statements
  // --------------------------------------------------------------------------

  async fetchAllStatements(userId: string): Promise<BankStatement[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('bank_statements')
      .select('*')
      .eq('user_id', userId)
      .order('imported_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(dbToBankStatement);
  },

  async addStatement(
    userId: string,
    statement: Omit<BankStatement, 'id' | 'importedAt'> & { id?: string },
  ): Promise<BankStatement> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('bank_statements')
      .insert(bankStatementToDb(statement, userId))
      .select()
      .single();
    if (error) throw error;
    return dbToBankStatement(data);
  },

  async updateStatement(
    userId: string,
    id: string,
    updates: Partial<BankStatement>,
  ): Promise<void> {
    const supabase = requireClient();
    const payload: Record<string, unknown> = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.transactionCount !== undefined) payload.transaction_count = updates.transactionCount;
    const { error } = await supabase
      .schema(SCHEMA)
      .from('bank_statements')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  },

  async removeStatement(userId: string, id: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .schema(SCHEMA)
      .from('bank_statements')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  },
};
