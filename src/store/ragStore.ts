// ============================================================================
// SCRUTIX - RAG Store
// Store Zustand pour la gestion du RAG
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RagPipeline } from '../rag/RagPipeline';
import { RegulatoryIndexer } from '../rag/RegulatoryIndexer';
import type {
  RagConfig,
  RagDocument,
  RagIndexingStatus,
  RagSearchResult,
  RagStoreStats,
} from '../rag/types';
import { DEFAULT_RAG_CONFIG } from '../rag/types';

interface RagState {
  /** Documents indexes */
  documents: RagDocument[];
  /** Status d'indexation */
  indexingStatus: RagIndexingStatus;
  /** Configuration RAG */
  ragConfig: RagConfig;
  /** Pipeline initialise */
  isInitialized: boolean;
  /** Stats du store */
  stats: RagStoreStats | null;
}

interface RagActions {
  /** Initialise le RAG pipeline */
  initializeRAG: (ollamaBaseUrl: string) => Promise<void>;
  /** Indexe la base reglementaire */
  indexKnowledgeBase: () => Promise<void>;
  /** Indexe un document personnalise */
  indexDocument: (file: File, metadata?: { title?: string }) => Promise<RagDocument>;
  /** Supprime un document */
  removeDocument: (documentId: string) => Promise<void>;
  /** Re-indexe tout */
  reindexAll: () => Promise<void>;
  /** Recherche RAG */
  search: (query: string) => Promise<RagSearchResult[]>;
  /** Met a jour la configuration */
  updateConfig: (config: Partial<RagConfig>) => void;
  /** Rafraichit les stats */
  refreshStats: () => Promise<void>;
  /** Rafraichit la liste des documents */
  refreshDocuments: () => Promise<void>;
}

// Instances singleton (non serializables, hors du store persiste)
let ragPipeline: RagPipeline | null = null;
let regulatoryIndexer: RegulatoryIndexer | null = null;

export function getRagPipeline(): RagPipeline | null {
  return ragPipeline;
}

export const useRagStore = create<RagState & RagActions>()(
  persist(
    (set, get) => ({
      // State
      documents: [],
      indexingStatus: {
        isIndexing: false,
        progress: 0,
        indexedCount: 0,
        totalCount: 0,
      },
      ragConfig: DEFAULT_RAG_CONFIG,
      isInitialized: false,
      stats: null,

      // Actions
      initializeRAG: async (ollamaBaseUrl: string) => {
        if (ragPipeline) {
          ragPipeline.configureEmbedding(ollamaBaseUrl);
          return;
        }

        const config = get().ragConfig;
        ragPipeline = new RagPipeline(config, ollamaBaseUrl);
        regulatoryIndexer = new RegulatoryIndexer(ragPipeline);

        await ragPipeline.initialize();

        // Rafraichir les documents et stats
        const documents = await ragPipeline.getDocuments();
        const stats = await ragPipeline.getStats();

        set({ isInitialized: true, documents, stats });
      },

      indexKnowledgeBase: async () => {
        if (!regulatoryIndexer) return;

        const docs = await regulatoryIndexer.indexKnowledgeBase((status) => {
          set({ indexingStatus: status });
        });

        const allDocs = await ragPipeline!.getDocuments();
        const stats = await ragPipeline!.getStats();
        set({ documents: allDocs, stats });
      },

      indexDocument: async (file: File, metadata?: { title?: string }) => {
        if (!regulatoryIndexer) {
          throw new Error('RAG non initialise');
        }

        const doc = await regulatoryIndexer.indexCustomDocument(file, metadata);

        const allDocs = await ragPipeline!.getDocuments();
        const stats = await ragPipeline!.getStats();
        set({ documents: allDocs, stats });

        return doc;
      },

      removeDocument: async (documentId: string) => {
        if (!ragPipeline) return;

        await ragPipeline.removeDocument(documentId);

        const documents = await ragPipeline.getDocuments();
        const stats = await ragPipeline.getStats();
        set({ documents, stats });
      },

      reindexAll: async () => {
        if (!regulatoryIndexer) return;

        await regulatoryIndexer.reindexAll((status) => {
          set({ indexingStatus: status });
        });

        const documents = await ragPipeline!.getDocuments();
        const stats = await ragPipeline!.getStats();
        set({ documents, stats });
      },

      search: async (query: string) => {
        if (!ragPipeline) return [];
        return await ragPipeline.search(query);
      },

      updateConfig: (config: Partial<RagConfig>) => {
        set((state) => {
          const newConfig = { ...state.ragConfig, ...config };
          if (ragPipeline) {
            ragPipeline.updateConfig(newConfig);
          }
          return { ragConfig: newConfig };
        });
      },

      refreshStats: async () => {
        if (!ragPipeline) return;
        const stats = await ragPipeline.getStats();
        set({ stats });
      },

      refreshDocuments: async () => {
        if (!ragPipeline) return;
        const documents = await ragPipeline.getDocuments();
        set({ documents });
      },
    }),
    {
      name: 'scrutix-rag',
      partialize: (state) => ({
        ragConfig: state.ragConfig,
        // Ne pas persister les documents (ils sont dans IndexedDB)
        // Ne pas persister isInitialized (doit etre re-initialise a chaque session)
      }),
    }
  )
);
