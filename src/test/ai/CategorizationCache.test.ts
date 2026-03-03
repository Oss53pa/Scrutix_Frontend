import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { CategorizationCache } from '../../ai/proph3t/CategorizationCache';
import { TransactionType, Transaction } from '../../types';

// fake-indexeddb/auto polyfills indexedDB + crypto.subtle for the test env

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  const now = new Date();
  return {
    id: `txn-${Math.random().toString(36).substr(2, 9)}`,
    clientId: 'client-1',
    accountNumber: '123456789',
    bankCode: 'TEST',
    date: now,
    valueDate: now,
    amount: -1000,
    balance: 50000,
    description: 'TEST TRANSACTION',
    type: TransactionType.OTHER,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('CategorizationCache', () => {
  let cache: CategorizationCache;

  beforeEach(() => {
    // Create fresh cache instance (new hit/miss counters, reuses same IndexedDB)
    cache = new CategorizationCache(30);
  });

  describe('store and lookup', () => {
    it('should store and retrieve a categorization result', async () => {
      await cache.store(
        'FRAIS DE TENUE DE COMPTE',
        'Frais bancaires',
        0.98,
        TransactionType.FEE
      );

      const result = await cache.lookup('FRAIS DE TENUE DE COMPTE');

      expect(result).not.toBeNull();
      expect(result!.category).toBe('Frais bancaires');
      expect(result!.confidence).toBe(0.98);
      expect(result!.type).toBe(TransactionType.FEE);
    });

    it('should return null for unknown description', async () => {
      const result = await cache.lookup('NEVER SEEN BEFORE');

      expect(result).toBeNull();
    });

    it('should normalize descriptions for matching', async () => {
      await cache.store(
        'frais de tenue de compte',
        'Frais bancaires',
        0.98,
        TransactionType.FEE
      );

      // Same description but different case should match (both normalized to uppercase)
      const result = await cache.lookup('FRAIS DE TENUE DE COMPTE');

      expect(result).not.toBeNull();
      expect(result!.category).toBe('Frais bancaires');
    });

    it('should overwrite existing entry for same description', async () => {
      await cache.store('TEST DESC', 'Category A', 0.80, TransactionType.DEBIT);
      await cache.store('TEST DESC', 'Category B', 0.95, TransactionType.CREDIT);

      const result = await cache.lookup('TEST DESC');

      expect(result).not.toBeNull();
      expect(result!.category).toBe('Category B');
      expect(result!.confidence).toBe(0.95);
    });
  });

  describe('bulkLookup', () => {
    it('should return results for multiple transactions', async () => {
      await cache.store('DESC ONE', 'Cat A', 0.90, TransactionType.FEE);
      await cache.store('DESC TWO', 'Cat B', 0.85, TransactionType.TRANSFER);

      const transactions = [
        createTransaction({ id: 'tx1', description: 'DESC ONE' }),
        createTransaction({ id: 'tx2', description: 'DESC TWO' }),
        createTransaction({ id: 'tx3', description: 'DESC THREE' }),
      ];

      const results = await cache.bulkLookup(transactions);

      expect(results.get('tx1')).not.toBeNull();
      expect(results.get('tx1')!.category).toBe('Cat A');
      expect(results.get('tx2')).not.toBeNull();
      expect(results.get('tx2')!.category).toBe('Cat B');
      expect(results.get('tx3')).toBeNull();
    });
  });

  describe('bulkStore', () => {
    it('should store multiple entries at once', async () => {
      await cache.bulkStore([
        { description: 'BULK A', category: 'Cat A', confidence: 0.90, type: TransactionType.FEE },
        { description: 'BULK B', category: 'Cat B', confidence: 0.85, type: TransactionType.DEBIT },
      ]);

      const resultA = await cache.lookup('BULK A');
      const resultB = await cache.lookup('BULK B');

      expect(resultA).not.toBeNull();
      expect(resultA!.category).toBe('Cat A');
      expect(resultB).not.toBeNull();
      expect(resultB!.category).toBe('Cat B');
    });
  });

  describe('getStats', () => {
    it('should track hits and misses', async () => {
      // Get baseline entry count (entries may exist from prior tests)
      const baseline = await cache.getStats();

      await cache.store('STATS_HIT_TEST', 'Category', 0.90, TransactionType.FEE);

      // One hit
      await cache.lookup('STATS_HIT_TEST');
      // Two misses
      await cache.lookup('STATS_MISS_1_XYZABC');
      await cache.lookup('STATS_MISS_2_XYZABC');

      const stats = await cache.getStats();

      expect(stats.entries).toBeGreaterThanOrEqual(baseline.entries + 1);
      expect(stats.hitRate).toBeCloseTo(1 / 3, 2);
    });

    it('should return 0 hit rate with no lookups', async () => {
      // Fresh cache instance has 0 hits and 0 misses
      const stats = await cache.getStats();

      expect(stats.entries).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should delete expired entries', async () => {
      // Create a cache with 0-day TTL (everything is expired immediately)
      const shortCache = new CategorizationCache(0);

      await shortCache.store('OLD ENTRY', 'Cat', 0.90, TransactionType.FEE);

      // Wait a tiny bit so the entry is "old"
      await new Promise((r) => setTimeout(r, 10));

      const deleted = await shortCache.cleanup(0);

      expect(deleted).toBeGreaterThanOrEqual(1);
    });
  });

  describe('TTL expiration', () => {
    it('should return null for expired entries on lookup', async () => {
      // Cache with 0-day TTL
      const expiredCache = new CategorizationCache(0);

      await expiredCache.store('EXPIRED', 'Cat', 0.90, TransactionType.FEE);

      // Wait a tiny bit for TTL to expire
      await new Promise((r) => setTimeout(r, 10));

      const result = await expiredCache.lookup('EXPIRED');

      expect(result).toBeNull();
    });
  });
});
