/**
 * @module AtlasBanx
 * @file src/import/ImportHistoryTracker.ts
 * @description Suivi des imports avec détection de doublons par hash SHA-256.
 * @author Atlas Studio
 * @version 1.0.0
 */

import { getSupabaseClient } from '../lib/supabase';
import type { ImportHistoryEntry } from './types';

export class ImportHistoryTracker {
  /**
   * Calcule le SHA-256 d'un fichier pour la détection de doublons.
   */
  static async hashFile(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Vérifie si un fichier a déjà été importé (par hash).
   */
  static async isDuplicate(fileHash: string): Promise<ImportHistoryEntry | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — import_history defined in migration 008
      .from('import_history')
      .select('*')
      .eq('file_hash', fileHash)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return rowToEntry(data as ImportHistoryRow);
  }

  /**
   * Enregistre un import.
   */
  static async record(entry: {
    clientId?: string;
    connectorId: string;
    fileName: string;
    fileHash: string | null;
    fileSizeBytes: number | null;
    transactionsCount: number;
    dateRangeStart?: Date;
    dateRangeEnd?: Date;
    status: 'success' | 'partial' | 'failed';
    errorMessage?: string;
  }): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return;

    const { error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — import_history defined in migration 008
      .from('import_history')
      .insert({
        user_id: userId,
        client_id: entry.clientId ?? null,
        connector_id: entry.connectorId,
        file_name: entry.fileName,
        file_hash: entry.fileHash,
        file_size_bytes: entry.fileSizeBytes,
        transactions_count: entry.transactionsCount,
        date_range_start: entry.dateRangeStart?.toISOString().split('T')[0] ?? null,
        date_range_end: entry.dateRangeEnd?.toISOString().split('T')[0] ?? null,
        status: entry.status,
        error_message: entry.errorMessage ?? null,
        imported_by: userId,
      });

    if (error) {
      console.warn('[ImportHistoryTracker] record failed:', error.message);
    }
  }

  /**
   * Liste les imports récents.
   */
  static async listRecent(limit = 50): Promise<ImportHistoryEntry[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — import_history defined in migration 008
      .from('import_history')
      .select('*')
      .order('imported_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return (data as ImportHistoryRow[]).map(rowToEntry);
  }
}

// ----------------------------------------------------------------------------

interface ImportHistoryRow {
  id: string;
  user_id: string;
  client_id: string | null;
  connector_id: string;
  file_name: string;
  file_hash: string | null;
  file_size_bytes: number | null;
  transactions_count: number;
  date_range_start: string | null;
  date_range_end: string | null;
  status: 'success' | 'partial' | 'failed';
  error_message: string | null;
  imported_at: string;
}

function rowToEntry(row: ImportHistoryRow): ImportHistoryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    clientId: row.client_id,
    connectorId: row.connector_id,
    fileName: row.file_name,
    fileHash: row.file_hash,
    fileSizeBytes: row.file_size_bytes,
    transactionsCount: row.transactions_count,
    dateRangeStart: row.date_range_start ? new Date(row.date_range_start) : null,
    dateRangeEnd: row.date_range_end ? new Date(row.date_range_end) : null,
    status: row.status,
    errorMessage: row.error_message,
    importedAt: new Date(row.imported_at),
  };
}
