// ============================================================================
// ATLASBANX — Settings Repository
// Persists per-user settings (preferences, AI provider config, organization,
// detection thresholds, etc.) in public.user_settings.settings (JSONB).
//
// Strategy:
//   - One row per user (UNIQUE user_id in user_settings)
//   - Whole settings tree stored as a single JSONB blob
//   - hydrate() returns the blob → store merges into local state
//   - save() upserts the blob → debounced from the store side
//   - Sensitive fields (API keys, encryption IVs) are STRIPPED before saving;
//     they are managed by dedicated mechanisms (atlasbanx.user_ai_keys,
//     Supabase Auth) and must never leak into a shared settings blob.
// ============================================================================

import { getSupabaseClient } from '../supabase';

export type UserSettingsBlob = Record<string, unknown>;

/** Keys to strip from any blob before persisting/loading */
const SENSITIVE_PATHS: ReadonlyArray<string> = [
  'claudeApi.apiKey',
  'claudeApi.apiKeyIv',
  'providers.claude.apiKey',
  'providers.openai.apiKey',
  'providers.mistral.apiKey',
  'providers.gemini.apiKey',
  'providers.custom.apiKey',
  // Cloud backup tokens — feature is gone, but defense in depth
  'cloudBackup.accessToken',
  'cloudBackup.refreshToken',
];

function deepClone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

function unsetByPath(obj: Record<string, unknown>, path: string): void {
  const parts = path.split('.');
  let cur: Record<string, unknown> | undefined = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur || typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) return;
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  if (cur) {
    cur[parts[parts.length - 1]] = '';
  }
}

/** Strip sensitive fields from a blob (returns a clone, doesn't mutate). */
export function sanitizeForPersist(blob: UserSettingsBlob): UserSettingsBlob {
  const clone = deepClone(blob);
  for (const path of SENSITIVE_PATHS) {
    unsetByPath(clone as Record<string, unknown>, path);
  }
  return clone;
}

export const settingsRepo = {
  /**
   * Load the current user's settings blob. Returns null if no row exists yet
   * (typical for new users — store keeps its zustand defaults).
   */
  async load(userId: string): Promise<UserSettingsBlob | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[settingsRepo] load failed:', error);
      return null;
    }
    return (data?.settings as UserSettingsBlob | undefined) ?? null;
  },

  /**
   * Upsert the current user's settings blob. Sensitive fields are stripped
   * before insert (defense in depth — store should also exclude them via
   * partialize, this is a second layer).
   */
  async save(userId: string, blob: UserSettingsBlob): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const sanitized = sanitizeForPersist(blob);
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          settings: sanitized,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (error) {
      console.error('[settingsRepo] save failed:', error);
    }
  },
};
