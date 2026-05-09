// ============================================================================
// ATLASBANX — Claude Key Manager
// ============================================================================
// Thin client for the Anthropic-key-related RPCs and the validation proxy.
// The user's actual API key is stored on Supabase (atlasbanx.user_ai_keys)
// and never returned to the browser. This module only deals with metadata.
// ============================================================================

import { getSupabaseClient } from '../lib/supabase';

export interface AnthropicKeyInfo {
  isConfigured: boolean;
  fingerprint: string | null;
  validatedAt: Date | null;
  updatedAt: Date | null;
}

export const ClaudeKeyManager = {
  /**
   * Fetch metadata about the user's Anthropic key (configured? validated when?
   * fingerprint?). Never returns the key itself.
   */
  async getInfo(): Promise<AnthropicKeyInfo> {
    const supabase = getSupabaseClient();
    if (!supabase) return blank();

    const { data, error } = await supabase.rpc('anthropic_api_key_info');
    if (error || !data || !Array.isArray(data) || data.length === 0) {
      return blank();
    }
    const row = data[0] as {
      is_configured: boolean;
      fingerprint: string | null;
      validated_at: string | null;
      updated_at: string | null;
    };
    return {
      isConfigured: !!row.is_configured,
      fingerprint: row.fingerprint,
      validatedAt: row.validated_at ? new Date(row.validated_at) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    };
  },

  /**
   * Save (or replace) the user's Anthropic key on the server.
   * Returns nothing — the caller should not retain the plaintext key
   * in any state after the call resolves.
   */
  async setKey(key: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    if (!key || key.trim().length < 20) {
      throw new Error('Clé invalide (trop courte)');
    }

    const { error } = await supabase.rpc('set_anthropic_api_key', { p_key: key });
    if (error) {
      throw new Error(error.message || 'Échec de l\'enregistrement de la clé');
    }
  },

  /**
   * Delete the user's stored Anthropic key.
   */
  async clearKey(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    const { error } = await supabase.rpc('clear_anthropic_api_key');
    if (error) {
      throw new Error(error.message || 'Échec de la suppression de la clé');
    }
  },

  /**
   * Trigger a server-side validation of the stored key. The proxy makes a
   * tiny test call to Anthropic and updates `anthropic_validated_at` on
   * success. Returns { valid, error? }.
   */
  async validateStoredKey(model?: string): Promise<{ valid: boolean; error?: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { valid: false, error: 'Supabase non configuré' };

    const url = import.meta.env.VITE_SUPABASE_URL;
    if (!url) return { valid: false, error: 'Supabase non configuré' };

    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return { valid: false, error: 'Session expirée' };

    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/functions/v1/claude-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: 'validate', model }),
      });
      const data = (await res.json().catch(() => ({}))) as { valid?: boolean; error?: string };
      if (!res.ok) return { valid: false, error: data.error || res.statusText };
      return { valid: data.valid === true, error: data.valid ? undefined : data.error };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : 'Erreur réseau' };
    }
  },

  /**
   * One-shot helper: save the key, then validate it. If validation fails,
   * the key remains stored (the user might want to retry without re-typing).
   * Caller decides whether to clear it.
   */
  async setAndValidate(
    key: string,
    model?: string,
  ): Promise<{ valid: boolean; error?: string }> {
    await ClaudeKeyManager.setKey(key);
    return ClaudeKeyManager.validateStoredKey(model);
  },
};

function blank(): AnthropicKeyInfo {
  return { isConfigured: false, fingerprint: null, validatedAt: null, updatedAt: null };
}
