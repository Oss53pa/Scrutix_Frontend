// ============================================================================
// SCRUTIX - RAG Pipeline
// Orchestrateur: Chunk -> Embed -> Store -> Search -> ReRank
// ============================================================================

import { ChunkingService } from './ChunkingService';
import { EmbeddingService } from './EmbeddingService';
import { VectorStoreService } from './VectorStoreService';
import { ReRankingService } from './ReRankingService';
import {
  DEFAULT_RAG_CONFIG,
  type RagChunk,
  type RagConfig,
  type RagContext,
  type RagContextSource,
  type RagDocument,
  type RagSearchResult,
  type RagSourceType,
  type RagStoreStats,
} from './types';

/**
 * Pipeline RAG complet: indexation, recherche, et formatage de contexte
 */
export class RagPipeline {
  private chunking: ChunkingService;
  private embedding: EmbeddingService;
  private vectorStore: VectorStoreService;
  private reranking: ReRankingService;
  private config: RagConfig;
  private initialized = false;

  constructor(
    config?: Partial<RagConfig>,
    embeddingBaseUrl?: string,
    embeddingModel?: string
  ) {
    this.config = { ...DEFAULT_RAG_CONFIG, ...config };
    this.chunking = new ChunkingService();
    this.embedding = new EmbeddingService(embeddingBaseUrl, embeddingModel);
    this.vectorStore = new VectorStoreService();
    this.reranking = new ReRankingService();
  }

  /**
   * Initialise le pipeline (charge les vecteurs en memoire)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.vectorStore.loadInMemory();
    this.initialized = true;
  }

  /**
   * Met a jour la configuration de l'embedding service
   */
  configureEmbedding(baseUrl: string, model?: string): void {
    this.embedding.configure(baseUrl, model);
  }

  /**
   * Met a jour la configuration RAG
   */
  updateConfig(config: Partial<RagConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ============================================================================
  // Indexation
  // ============================================================================

  /**
   * Indexe un document: decoupe en chunks, genere les embeddings, stocke
   */
  async indexDocument(
    documentId: string,
    title: string,
    text: string,
    source: RagSourceType,
    fileName?: string,
    onProgress?: (progress: number) => void
  ): Promise<RagDocument> {
    await this.initialize();

    // Decouper en chunks
    const chunkTexts = this.chunking.chunkText(text, {
      strategy: this.config.chunkStrategy,
      chunkSize: this.config.chunkSize,
      overlap: this.config.overlap,
    });

    if (chunkTexts.length === 0) {
      throw new Error(`Document "${title}" est vide ou ne contient pas de texte exploitable`);
    }

    // Generer les embeddings et stocker
    const chunks: RagChunk[] = [];
    for (let i = 0; i < chunkTexts.length; i++) {
      const vector = await this.embedding.embed(chunkTexts[i]);

      const chunk: RagChunk = {
        id: `${documentId}_chunk_${i}`,
        documentId,
        text: chunkTexts[i],
        vector,
        metadata: {
          title,
          source,
          chunkIndex: i,
          totalChunks: chunkTexts.length,
          indexedAt: Date.now(),
        },
      };

      chunks.push(chunk);

      if (onProgress) {
        onProgress((i + 1) / chunkTexts.length);
      }
    }

    // Stocker en batch
    await this.vectorStore.addChunks(chunks);

    // Enregistrer le document
    const doc: RagDocument = {
      id: documentId,
      title,
      source,
      chunkCount: chunks.length,
      indexedAt: Date.now(),
      textLength: text.length,
      fileName,
    };

    await this.vectorStore.registerDocument({
      id: doc.id,
      title: doc.title,
      source: doc.source,
      chunkCount: doc.chunkCount,
      indexedAt: doc.indexedAt,
      textLength: doc.textLength,
      fileName: doc.fileName,
    });

    return doc;
  }

  // ============================================================================
  // Recherche
  // ============================================================================

  /**
   * Recherche les chunks les plus pertinents pour une requete
   */
  async search(query: string, topK?: number, threshold?: number): Promise<RagSearchResult[]> {
    await this.initialize();

    // Generer l'embedding de la requete
    const queryVector = await this.embedding.embed(query);

    // Recherche cosinus
    const results = this.vectorStore.search(
      queryVector,
      (topK ?? this.config.topK) * 2, // Chercher plus pour le re-ranking
      threshold ?? this.config.threshold
    );

    // Re-ranking
    const searchResults: RagSearchResult[] = results.map(r => ({
      chunk: r.chunk,
      score: r.score,
    }));

    const reranked = this.reranking.rerank(searchResults, query);

    // Limiter au topK final
    return reranked.slice(0, topK ?? this.config.topK);
  }

  // ============================================================================
  // Contexte pour prompts
  // ============================================================================

  /**
   * Construit un contexte RAG formate pour injection dans un prompt
   */
  async buildContextForPrompt(query: string): Promise<RagContext | null> {
    const results = await this.search(query);

    if (results.length === 0) {
      return null;
    }

    // Deduplication par document (garder le meilleur chunk par document)
    const bestByDoc = new Map<string, RagSearchResult>();
    for (const result of results) {
      const docId = result.chunk.documentId;
      const existing = bestByDoc.get(docId);
      if (!existing || (result.rerankedScore ?? result.score) > (existing.rerankedScore ?? existing.score)) {
        bestByDoc.set(docId, result);
      }
    }

    const uniqueResults = Array.from(bestByDoc.values());

    // Construire le texte avec references
    const sources: RagContextSource[] = [];
    const textParts: string[] = [];

    uniqueResults.forEach((result, index) => {
      const refNum = index + 1;
      sources.push({
        refNumber: refNum,
        title: result.chunk.metadata.title,
        source: result.chunk.metadata.source,
        score: result.rerankedScore ?? result.score,
      });

      textParts.push(`[Ref.${refNum}] ${result.chunk.text}`);
    });

    return {
      text: textParts.join('\n\n'),
      sources,
    };
  }

  // ============================================================================
  // Gestion
  // ============================================================================

  /**
   * Supprime un document et tous ses chunks
   */
  async removeDocument(documentId: string): Promise<number> {
    return await this.vectorStore.deleteByDocumentId(documentId);
  }

  /**
   * Recupere la liste des documents indexes
   */
  async getDocuments(): Promise<RagDocument[]> {
    const stored = await this.vectorStore.getDocuments();
    return stored.map(d => ({
      id: d.id,
      title: d.title,
      source: d.source as RagSourceType,
      chunkCount: d.chunkCount,
      indexedAt: d.indexedAt,
      textLength: d.textLength,
      fileName: d.fileName,
    }));
  }

  /**
   * Retourne les statistiques du store
   */
  async getStats(): Promise<RagStoreStats> {
    return await this.vectorStore.getStats();
  }

  /**
   * Vide completement le store
   */
  async clear(): Promise<void> {
    await this.vectorStore.clear();
  }

  /**
   * Teste la connexion au service d'embedding
   */
  async testEmbedding(): Promise<{ valid: boolean; dims: number; error?: string }> {
    return await this.embedding.testConnection();
  }
}
