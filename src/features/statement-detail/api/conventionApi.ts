// ============================================================================
// conventionApi — chargement des conventions de compte (atlasbanx.account_conventions)
// ============================================================================

import { getSupabaseClient } from '../../../lib/supabase';
import type { AccountConvention } from '../types/statement.types';

export async function loadLatestConventionForAccount(
  accountId: string,
): Promise<AccountConvention | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .schema('atlasbanx' as never)
    .from('account_conventions' as never)
    .select('*')
    .eq('account_id', accountId)
    .order('signed_date', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;

  const r = data[0] as Record<string, unknown>;
  return {
    id: r.id as string,
    accountId: r.account_id as string,
    signedDate: r.signed_date as string,
    expiresDate: (r.expires_date as string) ?? null,
    documentUrl: (r.document_url as string) ?? null,
    rules: (r.rules as Record<string, unknown>) ?? {},
    uploadedBy: (r.uploaded_by as string) ?? null,
    createdAt: r.created_at as string,
  };
}
