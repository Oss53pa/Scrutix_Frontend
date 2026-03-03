// ============================================================================
// SCRUTIX - RAG Types
// Types pour le systeme de Retrieval Augmented Generation
// ============================================================================

/**
 * Chunk de texte indexe dans le vector store
 */
export interface RagChunk {
  /** Identifiant unique du chunk */
  id: string;
  /** Identifiant du document source */
  documentId: string;
  /** Contenu textuel du chunk */
  text: string;
  /** Vecteur d'embedding */
  vector: number[];
  /** Metadonnees du chunk */
  metadata: RagChunkMetadata;
}

/**
 * Metadonnees associees a un chunk
 */
export interface RagChunkMetadata {
  /** Titre du document source */
  title: string;
  /** Source (regulatory, custom, etc.) */
  source: RagSourceType;
  /** Position du chunk dans le document (index) */
  chunkIndex: number;
  /** Nombre total de chunks du document */
  totalChunks: number;
  /** Date d'indexation */
  indexedAt: number;
  /** Tags optionnels */
  tags?: string[];
}

/**
 * Type de source documentaire
 */
export type RagSourceType = 'regulatory' | 'custom' | 'template';

/**
 * Document indexe dans le RAG
 */
export interface RagDocument {
  /** Identifiant unique */
  id: string;
  /** Titre du document */
  title: string;
  /** Source */
  source: RagSourceType;
  /** Nombre de chunks */
  chunkCount: number;
  /** Date d'indexation */
  indexedAt: number;
  /** Taille du texte original en caracteres */
  textLength: number;
  /** Nom du fichier d'origine (si upload) */
  fileName?: string;
}

/**
 * Resultat de recherche RAG
 */
export interface RagSearchResult {
  /** Chunk trouve */
  chunk: RagChunk;
  /** Score de similarite cosinus (0-1) */
  score: number;
  /** Score apres re-ranking */
  rerankedScore?: number;
}

/**
 * Configuration du pipeline RAG
 */
export interface RagConfig {
  /** Taille des chunks en caracteres */
  chunkSize: number;
  /** Chevauchement entre chunks en caracteres */
  overlap: number;
  /** Dimensions des vecteurs d'embedding */
  dims: number;
  /** Nombre de resultats a retourner */
  topK: number;
  /** Seuil de similarite minimum (0-1) */
  threshold: number;
  /** Strategie de chunking */
  chunkStrategy: ChunkStrategy;
}

/**
 * Strategie de decoupage en chunks
 */
export type ChunkStrategy = 'semantic' | 'fixed';

/**
 * Configuration par defaut du RAG
 */
export const DEFAULT_RAG_CONFIG: RagConfig = {
  chunkSize: 512,
  overlap: 50,
  dims: 768,
  topK: 5,
  threshold: 0.72,
  chunkStrategy: 'semantic',
};

/**
 * Statistiques du vector store
 */
export interface RagStoreStats {
  /** Nombre total de chunks */
  totalChunks: number;
  /** Nombre de documents */
  totalDocuments: number;
  /** Taille estimee en memoire (octets) */
  estimatedSizeBytes: number;
}

/**
 * Contexte RAG formate pour injection dans un prompt
 */
export interface RagContext {
  /** Texte formate avec references */
  text: string;
  /** Sources citees */
  sources: RagContextSource[];
}

/**
 * Source citee dans un contexte RAG
 */
export interface RagContextSource {
  /** Numero de reference (Ref.1, Ref.2, etc.) */
  refNumber: number;
  /** Titre du document */
  title: string;
  /** Type de source */
  source: RagSourceType;
  /** Score de pertinence */
  score: number;
}

/**
 * Status d'indexation
 */
export interface RagIndexingStatus {
  /** Indexation en cours */
  isIndexing: boolean;
  /** Progression (0-1) */
  progress: number;
  /** Document en cours */
  currentDocument?: string;
  /** Nombre de documents indexes */
  indexedCount: number;
  /** Nombre total de documents */
  totalCount: number;
  /** Derniere erreur */
  lastError?: string;
}
