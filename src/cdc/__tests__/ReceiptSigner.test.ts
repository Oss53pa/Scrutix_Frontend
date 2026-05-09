// ============================================================================
// Tests — ReceiptSigner (HMAC-SHA256 + chained hashing)
// ============================================================================
// CDC §8.3 : « Receipt cryptographiquement signé à chaque résolution,
// vérifiable a posteriori. » Tamper-evident chain.
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ReceiptSigner, canonicalize, createDevSigner } from '../resolution/ReceiptSigner';
import type { ResolutionReceipt } from '../types';

function buildPartial(over: Partial<ResolutionReceipt> = {}): Omit<
  ResolutionReceipt,
  'signature' | 'signatureAlgo' | 'signatureKeyId' | 'receiptHash' | 'previousHash'
> {
  return {
    layerUsed: 4,
    sourceId: 'cond-123',
    sourceLabel: 'L4: Convention ACME 2025',
    validFrom: new Date('2025-01-01T00:00:00.000Z'),
    validTo: null,
    supersededLayers: [{ layer: 5, reason: 'aucune L5' }],
    regulatoryViolations: [],
    mode: 'strict',
    rawValue: 11.5,
    capApplied: false,
    ...over,
  };
}

describe('canonicalize', () => {
  it('produit la même sortie pour deux objets équivalents (ordre clés différent)', () => {
    const a = { b: 2, a: 1, c: { z: 9, y: 8 } };
    const b = { c: { y: 8, z: 9 }, a: 1, b: 2 };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('sérialise les Date en ISO et exclut les champs dérivés', () => {
    const r = {
      validFrom: new Date('2025-01-01T00:00:00.000Z'),
      signature: 'should-be-ignored',
      receiptHash: 'should-be-ignored',
      x: 42,
    };
    const out = canonicalize(r);
    expect(out).not.toContain('signature');
    expect(out).not.toContain('receiptHash');
    expect(out).toContain('2025-01-01T00:00:00.000Z');
  });

  it('sérialise les bigint en string', () => {
    expect(canonicalize({ x: 12345678901234567890n })).toBe(
      JSON.stringify({ x: '12345678901234567890' }).replace('"12345678901234567890"', '"12345678901234567890"'),
    );
  });
});

describe('ReceiptSigner', () => {
  let signer: ReceiptSigner;

  beforeEach(() => {
    signer = new ReceiptSigner({ key: 'test-key-32-chars-min-padding-xx', keyId: 'test' });
  });

  it('signe un receipt et le rend vérifiable', async () => {
    const receipt = await signer.sign(buildPartial());
    expect(receipt.signature).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.receiptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.signatureAlgo).toBe('hmac-sha256');
    expect(receipt.previousHash).toBeNull();

    const v = await signer.verify(receipt);
    expect(v.ok).toBe(true);
  });

  it('chaîne plusieurs receipts (previousHash → receiptHash)', async () => {
    const r1 = await signer.sign(buildPartial({ sourceId: 'a' }));
    const r2 = await signer.sign(buildPartial({ sourceId: 'b' }));
    const r3 = await signer.sign(buildPartial({ sourceId: 'c' }));

    expect(r1.previousHash).toBeNull();
    expect(r2.previousHash).toBe(r1.receiptHash);
    expect(r3.previousHash).toBe(r2.receiptHash);

    const chainCheck = await signer.verifyChain([r1, r2, r3]);
    expect(chainCheck.ok).toBe(true);
  });

  it('détecte une chaîne brisée (receipt modifié)', async () => {
    const r1 = await signer.sign(buildPartial({ sourceId: 'a' }));
    const r2 = await signer.sign(buildPartial({ sourceId: 'b' }));
    const r3 = await signer.sign(buildPartial({ sourceId: 'c' }));

    // Tamper r2's payload
    const tampered: ResolutionReceipt = { ...r2, sourceLabel: 'EVIL' };

    const chainCheck = await signer.verifyChain([r1, tampered, r3]);
    expect(chainCheck.ok).toBe(false);
    if (!chainCheck.ok) {
      expect(chainCheck.brokenAt).toBe(1);
    }
  });

  it('détecte une signature falsifiée', async () => {
    const receipt = await signer.sign(buildPartial());
    const tampered = { ...receipt, signature: 'a'.repeat(64) };
    const v = await signer.verify(tampered);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('signature invalide');
  });

  it('détecte un hash falsifié', async () => {
    const receipt = await signer.sign(buildPartial());
    const tampered = { ...receipt, receiptHash: 'b'.repeat(64) };
    const v = await signer.verify(tampered);
    expect(v.ok).toBe(false);
  });

  it('rejette un algorithme non supporté', async () => {
    const receipt = await signer.sign(buildPartial());
    const evil: ResolutionReceipt = { ...receipt, signatureAlgo: 'md5' as 'hmac-sha256' };
    const v = await signer.verify(evil);
    expect(v.ok).toBe(false);
  });

  it('reproductibilité : même input → même signature', async () => {
    const partial = buildPartial();
    const a = await signer.sign(partial);
    // reset chain so previousHash is again null
    signer.resetChain();
    const b = await signer.sign(partial);
    expect(a.signature).toBe(b.signature);
    expect(a.receiptHash).toBe(b.receiptHash);
  });

  it('factory createDevSigner crée un signer fonctionnel', async () => {
    const dev = createDevSigner('tenant-acme-uuid-1234');
    const r = await dev.sign(buildPartial());
    const v = await dev.verify(r);
    expect(v.ok).toBe(true);
    expect(r.signatureKeyId).toContain('dev-');
  });

  it('insère le previousHash fourni en seed', () => {
    signer.resetChain('seed-hash-abc');
    expect(signer.currentHead()).toBe('seed-hash-abc');
  });
});
