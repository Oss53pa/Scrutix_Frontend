// ============================================================================
// CDC — Client TS pour l'Edge Function cdc-resolution-cache
// ============================================================================
// Utilise l'Edge Function comme cache L2 partagé entre workers.
// Encapsule également la signature serveur des receipts en production
// (la clé HMAC reste côté Vault Supabase).
// ============================================================================

import type { ResolutionRequest, ResolutionResult } from '../types';

export interface RemoteCacheConfig {
  /** Base URL de la fonction, ex. https://<proj>.supabase.co/functions/v1/cdc-resolution-cache */
  endpoint: string;
  /** Token Supabase de l'utilisateur courant. */
  authToken: string;
  /** Désactive le cache (DEV / debug). */
  disabled?: boolean;
}

export class RemoteCacheClient {
  constructor(private config: RemoteCacheConfig) {}

  private async request<T>(path: string, body: unknown): Promise<T> {
    const r = await fetch(`${this.config.endpoint}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.authToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      throw new Error(`[RemoteCacheClient] ${path} failed: ${r.status} ${await r.text()}`);
    }
    return (await r.json()) as T;
  }

  async get(req: ResolutionRequest): Promise<ResolutionResult | null> {
    if (this.config.disabled) return null;
    try {
      const r = await this.request<{ hit: boolean; value?: unknown }>('get', {
        accountId: req.accountId,
        rubricCode: req.rubricCode,
        referenceDate: req.referenceDate.toISOString().slice(0, 10),
        mode: req.mode ?? 'strict',
        dimensions: req.dimensions,
      });
      if (!r.hit || !r.value) return null;
      return rehydrateResult(r.value);
    } catch (err) {
      // Fail-open : un cache cassé ne doit jamais bloquer un audit
      console.warn('[RemoteCacheClient.get] fail-open', err);
      return null;
    }
  }

  async set(req: ResolutionRequest, result: ResolutionResult): Promise<void> {
    if (this.config.disabled) return;
    try {
      await this.request('set', {
        accountId: req.accountId,
        rubricCode: req.rubricCode,
        referenceDate: req.referenceDate.toISOString().slice(0, 10),
        mode: req.mode ?? 'strict',
        dimensions: req.dimensions,
        value: dehydrateResult(result),
      });
    } catch (err) {
      console.warn('[RemoteCacheClient.set] fail-open', err);
    }
  }

  /**
   * Invalide les clés correspondantes. À appeler après modification d'une
   * convention ou d'une version de référentiel.
   */
  async invalidate(scope: { scope: 'tenant' } | { scope: 'account'; accountId: string } | { scope: 'rubric'; rubricCode: string }): Promise<{ invalidated: number }> {
    return this.request('invalidate', scope);
  }

  /**
   * Demande au serveur de signer un payload canonique.
   * Utilisé en production où la clé HMAC est côté Vault.
   */
  async signCanonical(canonical: string): Promise<{ signature: string; hash: string; keyId: string }> {
    return this.request('sign', { canonical });
  }

  async health(): Promise<{ status: string; redisConfigured: boolean; signingConfigured: boolean; keyId: string }> {
    const r = await fetch(`${this.config.endpoint}/health`);
    return r.json();
  }
}

// ============================================================================
// Hydration helpers — Date / bigint sont perdus en JSON
// ============================================================================

function dehydrateResult(r: ResolutionResult): unknown {
  return JSON.parse(JSON.stringify(r, (_k, v) => {
    if (typeof v === 'bigint') return { __bigint: v.toString() };
    if (v instanceof Date) return { __date: v.toISOString() };
    return v;
  }));
}

function rehydrateResult(raw: unknown): ResolutionResult {
  return JSON.parse(JSON.stringify(raw), (_k, v) => {
    if (v && typeof v === 'object') {
      if ('__bigint' in v) return BigInt((v as { __bigint: string }).__bigint);
      if ('__date' in v) return new Date((v as { __date: string }).__date);
    }
    return v;
  }) as ResolutionResult;
}
