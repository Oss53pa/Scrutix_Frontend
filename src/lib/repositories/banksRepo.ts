// ============================================================================
// ATLASBANX - Banks Repository
// Wraps Supabase queries for atlasbanx.user_banks. Stores per-user bank
// list with conditions, condition grids and archived documents as JSONB.
// ============================================================================

import { getSupabaseClient } from '../supabase';
import type { Bank } from '../../types';
import type { DbUserBank, DbUserBankInsert } from '../database.types';

const SCHEMA = 'atlasbanx';

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

// ----------------------------------------------------------------------------
// Mappers
// ----------------------------------------------------------------------------

/**
 * Recursively revive ISO date strings into Date objects.
 * Banks contain conditions/grids/documents with `effectiveDate`,
 * `expirationDate`, `uploadDate`, `createdAt`, `updatedAt`.
 */
function reviveDates<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(reviveDates) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (
        typeof v === 'string' &&
        (k.endsWith('At') || k.endsWith('Date') || k === 'startDate' || k === 'endDate') &&
        /^\d{4}-\d{2}-\d{2}T/.test(v)
      ) {
        out[k] = new Date(v);
      } else {
        out[k] = reviveDates(v);
      }
    }
    return out as T;
  }
  return value;
}

function dbToBank(row: DbUserBank): Bank {
  return reviveDates({
    id: row.bank_id,
    code: row.code,
    name: row.name,
    country: row.country,
    isActive: row.is_active,
    conditions: row.conditions ?? null,
    conditionGrids: row.condition_grids ?? [],
    activeGridId: (row.metadata?.activeGridId as string | undefined) ?? undefined,
    // logo, zone, archivedDocuments live in metadata blob
    ...((row.metadata?.logo) ? { logo: row.metadata.logo as string } : {}),
    ...((row.metadata?.zone) ? { zone: row.metadata.zone as Bank['zone'] } : {}),
    archivedDocuments: row.documents ?? [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  } as unknown as Bank);
}

function bankToDb(userId: string, bank: Bank): DbUserBankInsert {
  // Helper: stringify Date values inside nested objects.
  const serialize = (v: unknown): unknown => {
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(serialize);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        out[k] = serialize(val);
      }
      return out;
    }
    return v;
  };

  const metadata: Record<string, unknown> = {};
  if (bank.activeGridId) metadata.activeGridId = bank.activeGridId;
  if (bank.logo) metadata.logo = bank.logo;
  if (bank.zone) metadata.zone = bank.zone;

  return {
    user_id: userId,
    bank_id: bank.id,
    code: bank.code,
    name: bank.name,
    country: bank.country,
    is_active: bank.isActive,
    conditions: serialize(bank.conditions ?? null) as Record<string, unknown> | null,
    condition_grids: (serialize(bank.conditionGrids ?? []) as Record<string, unknown>[]) ?? [],
    documents: (serialize(
      // ArchivedDocument[] currently lives at bank.archivedDocuments — fall
      // back to metadata.archivedDocuments / legacy shape if absent.
      ((bank as unknown as { archivedDocuments?: unknown }).archivedDocuments) ?? [],
    ) as Record<string, unknown>[]) ?? [],
    metadata,
  };
}

// ----------------------------------------------------------------------------
// Repository
// ----------------------------------------------------------------------------

export const banksRepo = {
  async fetchAll(userId: string): Promise<Bank[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('user_banks')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).map(dbToBank);
  },

  /**
   * Replace the whole user-bank set in a single transactional upsert.
   * Used when a complex change (add fee, archive grid, etc.) touches
   * multiple nested fields — much simpler than per-field SQL.
   */
  async upsert(userId: string, bank: Bank): Promise<void> {
    const supabase = requireClient();
    const payload = bankToDb(userId, bank);
    const { error } = await supabase
      .schema(SCHEMA)
      .from('user_banks')
      .upsert(payload, { onConflict: 'user_id,bank_id' });
    if (error) throw error;
  },

  async upsertMany(userId: string, banks: Bank[]): Promise<void> {
    if (banks.length === 0) return;
    const supabase = requireClient();
    const payload = banks.map((b) => bankToDb(userId, b));
    const { error } = await supabase
      .schema(SCHEMA)
      .from('user_banks')
      .upsert(payload, { onConflict: 'user_id,bank_id' });
    if (error) throw error;
  },

  async remove(userId: string, bankId: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .schema(SCHEMA)
      .from('user_banks')
      .delete()
      .eq('user_id', userId)
      .eq('bank_id', bankId);
    if (error) throw error;
  },

  async clear(userId: string): Promise<void> {
    const supabase = requireClient();
    const { error } = await supabase
      .schema(SCHEMA)
      .from('user_banks')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  },
};
