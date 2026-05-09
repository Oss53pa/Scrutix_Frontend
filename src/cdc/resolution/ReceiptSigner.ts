// ============================================================================
// CDC — Receipt Signer (HMAC-SHA256 + chained hashing)
// ============================================================================
// CDC §8.3 Auditabilité :
//   « Receipt cryptographiquement signé à chaque résolution, vérifiable
//     a posteriori. »
//
// Implémentation :
//   - Canonicalisation du receipt (ordre stable des clés, dates ISO, sans
//     champs dérivés signature/receiptHash) → bytes
//   - HMAC-SHA256(canonical, key) → signature
//   - SHA-256(canonical) → receiptHash
//   - Chaînage : previousHash référence le receiptHash du receipt précédent
//     → toute altération a posteriori casse la chaîne (tamper-evident)
//
// La clé est gérée côté backend (Edge Function) en production. En front,
// on utilise une clé dérivée du tenant (pour DEV/preview) — le receipt
// reste vérifiable mais la confiance vient du serveur lors de l'export.
// ============================================================================

import type { ResolutionReceipt } from '../types';

// ============================================================================
// Web Crypto helpers
// ============================================================================

function getCrypto(): Crypto {
  // Browser
  if (typeof globalThis !== 'undefined' && (globalThis as { crypto?: Crypto }).crypto?.subtle) {
    return (globalThis as { crypto: Crypto }).crypto;
  }
  throw new Error('[ReceiptSigner] Web Crypto API non disponible');
}

function bytesToHex(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let h = '';
  for (let i = 0; i < b.length; i++) {
    h += b[i].toString(16).padStart(2, '0');
  }
  return h;
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await getCrypto().subtle.digest('SHA-256', enc);
  return bytesToHex(buf);
}

async function hmacSha256Hex(input: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await getCrypto().subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await getCrypto().subtle.sign('HMAC', cryptoKey, enc.encode(input));
  return bytesToHex(sig);
}

// ============================================================================
// Canonicalisation
// ============================================================================

/**
 * Sérialise une partie de receipt de manière déterministe :
 *   - clés triées par ordre alphabétique
 *   - Date → ISO string
 *   - bigint → string décimal
 *   - exclut signature, receiptHash, previousHash (méta de la chaîne)
 *
 * Le résultat est strictement reproductible : la même entrée → la même
 * sortie, sur n'importe quelle plateforme.
 */
export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => !EXCLUDED_FROM_CANONICAL.includes(k))
      .sort();
    return (
      '{' +
      keys
        .map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

const EXCLUDED_FROM_CANONICAL = [
  'signature',
  'signatureAlgo',
  'signatureKeyId',
  'receiptHash',
  // previousHash IS included in the canonical form so it gets signed
];

// ============================================================================
// ReceiptSigner
// ============================================================================

export interface SignerConfig {
  /** Clé HMAC (32+ caractères recommandés). En prod : fournie par Edge Function. */
  key: string;
  /** Identifiant de la clé (rotation). */
  keyId: string;
}

export class ReceiptSigner {
  private config: SignerConfig;
  /** Hash du receipt précédent — chaîne tamper-evident. */
  private previousHash: string | null = null;

  constructor(config: SignerConfig) {
    this.config = config;
  }

  /** Réinitialise la chaîne (nouveau job d'audit). */
  resetChain(seedHash: string | null = null): void {
    this.previousHash = seedHash;
  }

  /** Renvoie le hash courant — à persister côté audit_session pour reprise. */
  currentHead(): string | null {
    return this.previousHash;
  }

  /**
   * Signe un receipt et chaîne au précédent.
   *
   * Renvoie un receipt complet avec signature + receiptHash + previousHash.
   * Met à jour la tête de chaîne pour le prochain receipt.
   */
  async sign(
    partial: Omit<ResolutionReceipt, 'signature' | 'signatureAlgo' | 'signatureKeyId' | 'receiptHash' | 'previousHash'>,
  ): Promise<ResolutionReceipt> {
    const draft = {
      ...partial,
      previousHash: this.previousHash,
    };
    const canonical = canonicalize(draft);
    const receiptHash = await sha256Hex(canonical);
    const signature = await hmacSha256Hex(canonical, this.config.key);

    const signed: ResolutionReceipt = {
      ...partial,
      previousHash: this.previousHash,
      receiptHash,
      signature,
      signatureAlgo: 'hmac-sha256',
      signatureKeyId: this.config.keyId,
    };

    this.previousHash = receiptHash;
    return signed;
  }

  /**
   * Vérifie qu'un receipt est intact :
   *   1. Recalcule sa signature et la compare
   *   2. Recalcule son hash et le compare
   *
   * Renvoie {ok: true} si tout est cohérent, sinon {ok: false, reason}.
   */
  async verify(
    receipt: ResolutionReceipt,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (receipt.signatureAlgo !== 'hmac-sha256') {
      return { ok: false, reason: `algo non supporté: ${receipt.signatureAlgo}` };
    }
    const draft = stripDerivedFields(receipt);
    const canonical = canonicalize(draft);
    const expectedSig = await hmacSha256Hex(canonical, this.config.key);
    if (expectedSig !== receipt.signature) {
      return { ok: false, reason: 'signature invalide' };
    }
    const expectedHash = await sha256Hex(canonical);
    if (expectedHash !== receipt.receiptHash) {
      return { ok: false, reason: 'hash invalide' };
    }
    return { ok: true };
  }

  /**
   * Vérifie une chaîne entière de receipts ordonnés.
   * Renvoie l'index du premier receipt cassé, ou -1 si chaîne intacte.
   */
  async verifyChain(receipts: ResolutionReceipt[]): Promise<{ ok: true } | { ok: false; brokenAt: number; reason: string }> {
    let prevHash: string | null = null;
    for (let i = 0; i < receipts.length; i++) {
      const r = receipts[i];
      if (r.previousHash !== prevHash) {
        return { ok: false, brokenAt: i, reason: 'chaîne brisée: previousHash incohérent' };
      }
      const v = await this.verify(r);
      if (!v.ok) {
        return { ok: false, brokenAt: i, reason: v.reason };
      }
      prevHash = r.receiptHash;
    }
    return { ok: true };
  }
}

function stripDerivedFields(
  r: ResolutionReceipt,
): Omit<ResolutionReceipt, 'signature' | 'signatureAlgo' | 'signatureKeyId' | 'receiptHash'> {
  const {
    signature: _s,
    signatureAlgo: _sa,
    signatureKeyId: _sk,
    receiptHash: _rh,
    ...rest
  } = r;
  void _s; void _sa; void _sk; void _rh;
  return rest;
}

// ============================================================================
// Factory : signer par défaut (DEV) — clé dérivée du tenant
// ============================================================================

/**
 * Construit un signer DEV à partir d'un tenantId.
 * En production, la clé doit venir d'une Edge Function (Supabase Vault).
 */
export function createDevSigner(tenantId: string): ReceiptSigner {
  const key = `atlasbanx-cdc-dev-${tenantId}-v1`;
  return new ReceiptSigner({ key, keyId: `dev-${tenantId.slice(0, 8)}` });
}
