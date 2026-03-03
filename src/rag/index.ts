// ============================================================================
// SCRUTIX - RAG Module
// Retrieval Augmented Generation pour le contexte reglementaire
// ============================================================================

export { ChunkingService } from './ChunkingService';
export { EmbeddingService } from './EmbeddingService';
export { VectorStoreService } from './VectorStoreService';
export { ReRankingService } from './ReRankingService';
export { RagPipeline } from './RagPipeline';
export { RegulatoryIndexer } from './RegulatoryIndexer';
export { DocxExtractor } from './DocxExtractor';

export type {
  RagChunk,
  RagChunkMetadata,
  RagDocument,
  RagSearchResult,
  RagConfig,
  RagSourceType,
  ChunkStrategy,
  RagStoreStats,
  RagContext,
  RagContextSource,
  RagIndexingStatus,
} from './types';

export { DEFAULT_RAG_CONFIG } from './types';
