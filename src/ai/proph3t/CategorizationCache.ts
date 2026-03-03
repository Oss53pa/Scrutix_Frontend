// ============================================================================
// SCRUTIX - Categorization Cache (IndexedDB)
// Cache IndexedDB pour les resultats de categorisation
// Pipeline 3 tiers: Cache -> Dictionnaire -> IA
// ============================================================================

import { openDB, IDBPDatabase } from 'idb';
import { TransactionType, Transaction } from '../../types';

const DB_NAME = 'scrutix-categorization-cache';
const STORE_NAME = 'categories';
const DB_VERSION = 1;
const DEFAULT_TTL_DAYS = 30;

interface CachedCategory {
  /** SHA-256 hash de la description normalisee */
  key: string;
  /** Description originale (pour debug) */
  description: string;
  /** Categorie assignee */
  category: string;
  /** Type de transaction */
  type: TransactionType;
  /** Score de confiance */
  confidence: number;
  /** Nombre d'acces (LRU) */
  hitCount: number;
  /** Date de creation */
  createdAt: number;
  /** Dernier acces */
  lastAccessedAt: number;
}

/**
 * Cache IndexedDB pour les resultats de categorisation
 * Cle = SHA-256(description normalisee), TTL 30 jours, LRU via hitCount
 */
export class CategorizationCache {
  private db: IDBPDatabase | null = null;
  private ttlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(ttlDays: number = DEFAULT_TTL_DAYS) {
    this.ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  }

  /**
   * Initialise la base IndexedDB
   */
  private async getDb(): Promise<IDBPDatabase> {
    if (this.db) return this.db;

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('lastAccessedAt', 'lastAccessedAt');
          store.createIndex('createdAt', 'createdAt');
        }
      },
    });

    return this.db;
  }

  /**
   * Recherche une categorisation en cache
   */
  async lookup(description: string): Promise<{
    category: string;
    type: TransactionType;
    confidence: number;
  } | null> {
    const key = await this.hashDescription(description);
    const db = await this.getDb();

    const entry = await db.get(STORE_NAME, key) as CachedCategory | undefined;
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.createdAt > this.ttlMs) {
      await db.delete(STORE_NAME, key);
      this.misses++;
      return null;
    }

    // Update hit count and access time
    this.hits++;
    await db.put(STORE_NAME, {
      ...entry,
      hitCount: entry.hitCount + 1,
      lastAccessedAt: Date.now(),
    });

    return {
      category: entry.category,
      type: entry.type,
      confidence: entry.confidence,
    };
  }

  /**
   * Stocke un resultat de categorisation en cache
   */
  async store(
    description: string,
    category: string,
    confidence: number,
    type: TransactionType
  ): Promise<void> {
    const key = await this.hashDescription(description);
    const db = await this.getDb();

    const entry: CachedCategory = {
      key,
      description: description.substring(0, 200),
      category,
      type,
      confidence,
      hitCount: 0,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    await db.put(STORE_NAME, entry);
  }

  /**
   * Recherche en masse
   */
  async bulkLookup(
    transactions: Transaction[]
  ): Promise<Map<string, { category: string; type: TransactionType; confidence: number } | null>> {
    const results = new Map<string, { category: string; type: TransactionType; confidence: number } | null>();

    for (const tx of transactions) {
      const cached = await this.lookup(tx.description);
      results.set(tx.id, cached);
    }

    return results;
  }

  /**
   * Stockage en masse
   */
  async bulkStore(
    items: Array<{
      description: string;
      category: string;
      confidence: number;
      type: TransactionType;
    }>
  ): Promise<void> {
    for (const item of items) {
      await this.store(item.description, item.category, item.confidence, item.type);
    }
  }

  /**
   * Nettoyage des entrees expirees ou anciennes
   * @param maxAgeDays Age max en jours (0 = tout supprimer)
   */
  async cleanup(maxAgeDays?: number): Promise<number> {
    const db = await this.getDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const cutoff = maxAgeDays !== undefined
      ? Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
      : Date.now() - this.ttlMs;

    let deleted = 0;
    let cursor = await store.openCursor();

    while (cursor) {
      const entry = cursor.value as CachedCategory;
      if (entry.createdAt < cutoff) {
        await cursor.delete();
        deleted++;
      }
      cursor = await cursor.continue();
    }

    await tx.done;
    return deleted;
  }

  /**
   * Retourne les statistiques du cache
   */
  async getStats(): Promise<{
    entries: number;
    hitRate: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    const db = await this.getDb();
    const count = await db.count(STORE_NAME);
    const total = this.hits + this.misses;

    return {
      entries: count,
      hitRate: total > 0 ? this.hits / total : 0,
      oldestEntry: null,
      newestEntry: null,
    };
  }

  /**
   * Hash SHA-256 d'une description normalisee
   */
  private async hashDescription(description: string): Promise<string> {
    const normalized = description
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
