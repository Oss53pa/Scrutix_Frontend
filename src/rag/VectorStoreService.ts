// ============================================================================
// SCRUTIX - Vector Store Service
// Stockage IndexedDB de vecteurs avec recherche cosinus en memoire
// ============================================================================

import { openDB, IDBPDatabase } from 'idb';
import type { RagChunk, RagChunkMetadata, RagStoreStats } from './types';

const DB_NAME = 'scrutix-rag-vectors';
const CHUNKS_STORE = 'chunks';
const DOCS_STORE = 'documents';
const DB_VERSION = 1;

interface StoredChunk {
  id: string;
  documentId: string;
  text: string;
  vector: number[];
  metadata: RagChunkMetadata;
}

interface StoredDocument {
  id: string;
  title: string;
  source: string;
  chunkCount: number;
  indexedAt: number;
  textLength: number;
  fileName?: string;
}

/**
 * Vector store IndexedDB avec recherche cosinus en memoire
 * Charge tous les vecteurs en RAM pour des recherches rapides
 * Adapte pour ~1000 chunks (corpus reglementaire)
 */
export class VectorStoreService {
  private db: IDBPDatabase | null = null;
  private memoryIndex: Map<string, { vector: number[]; chunk: RagChunk }> = new Map();
  private isLoaded = false;

  /**
   * Initialise la base IndexedDB
   */
  private async getDb(): Promise<IDBPDatabase> {
    if (this.db) return this.db;

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
          const store = db.createObjectStore(CHUNKS_STORE, { keyPath: 'id' });
          store.createIndex('documentId', 'documentId');
        }
        if (!db.objectStoreNames.contains(DOCS_STORE)) {
          db.createObjectStore(DOCS_STORE, { keyPath: 'id' });
        }
      },
    });

    return this.db;
  }

  /**
   * Charge tous les vecteurs en memoire pour la recherche
   */
  async loadInMemory(): Promise<void> {
    if (this.isLoaded) return;

    const db = await this.getDb();
    const allChunks = await db.getAll(CHUNKS_STORE) as StoredChunk[];

    this.memoryIndex.clear();
    for (const stored of allChunks) {
      const chunk: RagChunk = {
        id: stored.id,
        documentId: stored.documentId,
        text: stored.text,
        vector: stored.vector,
        metadata: stored.metadata,
      };
      this.memoryIndex.set(stored.id, { vector: stored.vector, chunk });
    }

    this.isLoaded = true;
  }

  /**
   * Ajoute un chunk au store
   */
  async addChunk(chunk: RagChunk): Promise<void> {
    const db = await this.getDb();

    const stored: StoredChunk = {
      id: chunk.id,
      documentId: chunk.documentId,
      text: chunk.text,
      vector: chunk.vector,
      metadata: chunk.metadata,
    };

    await db.put(CHUNKS_STORE, stored);

    // Mettre a jour l'index en memoire
    this.memoryIndex.set(chunk.id, { vector: chunk.vector, chunk });
  }

  /**
   * Ajoute plusieurs chunks en batch
   */
  async addChunks(chunks: RagChunk[]): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(CHUNKS_STORE, 'readwrite');

    for (const chunk of chunks) {
      const stored: StoredChunk = {
        id: chunk.id,
        documentId: chunk.documentId,
        text: chunk.text,
        vector: chunk.vector,
        metadata: chunk.metadata,
      };
      await tx.store.put(stored);
      this.memoryIndex.set(chunk.id, { vector: chunk.vector, chunk });
    }

    await tx.done;
  }

  /**
   * Recherche les chunks les plus similaires a un vecteur requete
   */
  search(
    queryVector: number[],
    topK: number = 5,
    threshold: number = 0.72
  ): Array<{ chunk: RagChunk; score: number }> {
    const results: Array<{ chunk: RagChunk; score: number }> = [];

    for (const { vector, chunk } of this.memoryIndex.values()) {
      const score = this.cosineSimilarity(queryVector, vector);
      if (score >= threshold) {
        results.push({ chunk, score });
      }
    }

    // Trier par score decroissant et limiter
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Supprime tous les chunks d'un document
   */
  async deleteByDocumentId(documentId: string): Promise<number> {
    const db = await this.getDb();
    const tx = db.transaction([CHUNKS_STORE, DOCS_STORE], 'readwrite');
    const chunksStore = tx.objectStore(CHUNKS_STORE);
    const index = chunksStore.index('documentId');

    let deleted = 0;
    let cursor = await index.openCursor(documentId);

    while (cursor) {
      const chunkId = (cursor.value as StoredChunk).id;
      await cursor.delete();
      this.memoryIndex.delete(chunkId);
      deleted++;
      cursor = await cursor.continue();
    }

    // Supprimer le document aussi
    await tx.objectStore(DOCS_STORE).delete(documentId);
    await tx.done;

    return deleted;
  }

  /**
   * Enregistre les metadonnees d'un document
   */
  async registerDocument(doc: StoredDocument): Promise<void> {
    const db = await this.getDb();
    await db.put(DOCS_STORE, doc);
  }

  /**
   * Recupere tous les documents indexes
   */
  async getDocuments(): Promise<StoredDocument[]> {
    const db = await this.getDb();
    return await db.getAll(DOCS_STORE) as StoredDocument[];
  }

  /**
   * Retourne les statistiques du store
   */
  async getStats(): Promise<RagStoreStats> {
    const db = await this.getDb();
    const chunkCount = await db.count(CHUNKS_STORE);
    const docCount = await db.count(DOCS_STORE);

    // Estimation taille: chaque vecteur 768 floats * 8 bytes + texte
    let textSize = 0;
    for (const { chunk } of this.memoryIndex.values()) {
      textSize += chunk.text.length * 2; // UTF-16
    }
    const vectorSize = chunkCount * 768 * 8;

    return {
      totalChunks: chunkCount,
      totalDocuments: docCount,
      estimatedSizeBytes: vectorSize + textSize,
    };
  }

  /**
   * Vide completement le store
   */
  async clear(): Promise<void> {
    const db = await this.getDb();
    await db.clear(CHUNKS_STORE);
    await db.clear(DOCS_STORE);
    this.memoryIndex.clear();
  }

  /**
   * Similarite cosinus entre deux vecteurs
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }
}
