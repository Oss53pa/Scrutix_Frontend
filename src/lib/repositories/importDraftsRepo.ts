// ============================================================================
// ATLASBANX - Import drafts repository
// ============================================================================
// CRUD on atlasbanx.import_drafts. Drafts are keyed by (user, file_hash,
// mode) so re-uploading the same PDF resumes the existing review.
// ============================================================================

import { getSupabaseClient } from '../supabase';

export type ImportMode = 'statement' | 'conditions';
export type ImportDraftStatus = 'draft' | 'committed' | 'cancelled';

export interface ImportDraftRow {
  id: string;
  user_id: string;
  source_hash: string;
  mode: ImportMode;
  file_name: string;
  bank_code: string | null;
  client_id: string | null;
  payload: Record<string, unknown>;
  storage_path: string | null;
  status: ImportDraftStatus;
  committed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportDraftInsert {
  source_hash: string;
  mode: ImportMode;
  file_name: string;
  bank_code?: string | null;
  client_id?: string | null;
  payload: Record<string, unknown>;
  storage_path?: string | null;
}

const SCHEMA = 'atlasbanx';

/** Compute SHA-256 hex of a File. Used as the draft's source_hash. */
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const importDraftsRepo = {
  /** Find an existing draft for (current user × hash × mode), or null. */
  async findByHash(
    userId: string,
    sourceHash: string,
    mode: ImportMode,
  ): Promise<ImportDraftRow | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('import_drafts')
      .select('*')
      .eq('user_id', userId)
      .eq('source_hash', sourceHash)
      .eq('mode', mode)
      .maybeSingle();
    if (error) {
      console.error('[importDraftsRepo] findByHash failed:', error);
      return null;
    }
    return (data as ImportDraftRow | null) ?? null;
  },

  /** List all drafts for the current user, newest first. */
  async list(userId: string): Promise<ImportDraftRow[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('import_drafts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false });
    if (error) {
      console.error('[importDraftsRepo] list failed:', error);
      return [];
    }
    return (data as ImportDraftRow[]) ?? [];
  },

  /** Insert a new draft. */
  async insert(userId: string, draft: ImportDraftInsert): Promise<ImportDraftRow | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('import_drafts')
      .insert({
        user_id: userId,
        ...draft,
      })
      .select()
      .single();
    if (error) {
      console.error('[importDraftsRepo] insert failed:', error);
      return null;
    }
    return data as ImportDraftRow;
  },

  /** Replace the payload of an existing draft. */
  async update(
    draftId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase
      .schema(SCHEMA)
      .from('import_drafts')
      .update({ payload })
      .eq('id', draftId);
    if (error) {
      console.error('[importDraftsRepo] update failed:', error);
    }
  },

  /** Mark a draft as committed (final import done). */
  async commit(draftId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase
      .schema(SCHEMA)
      .from('import_drafts')
      .update({ status: 'committed', committed_at: new Date().toISOString() })
      .eq('id', draftId);
    if (error) {
      console.error('[importDraftsRepo] commit failed:', error);
    }
  },

  /** Mark a draft as cancelled (user discarded). */
  async cancel(draftId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase
      .schema(SCHEMA)
      .from('import_drafts')
      .update({ status: 'cancelled' })
      .eq('id', draftId);
    if (error) {
      console.error('[importDraftsRepo] cancel failed:', error);
    }
  },

  /** Delete a draft permanently. */
  async remove(draftId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase
      .schema(SCHEMA)
      .from('import_drafts')
      .delete()
      .eq('id', draftId);
    if (error) {
      console.error('[importDraftsRepo] remove failed:', error);
    }
  },
};
