// ============================================================================
// SCRUTIX - Regulatory Indexer
// Indexation de la base reglementaire et documents personnalises dans le RAG
// ============================================================================

import { RagPipeline } from './RagPipeline';
import { DocxExtractor } from './DocxExtractor';
import { REGULATORY_KNOWLEDGE_BASE, REGULATORY_SOURCES } from '../services/RegulatorySearchService';
import type { RagDocument, RagIndexingStatus, RagSourceType } from './types';

/**
 * Service d'indexation des documents reglementaires et personnalises
 */
export class RegulatoryIndexer {
  private pipeline: RagPipeline;
  private docxExtractor: DocxExtractor;
  private status: RagIndexingStatus = {
    isIndexing: false,
    progress: 0,
    indexedCount: 0,
    totalCount: 0,
  };

  constructor(pipeline: RagPipeline) {
    this.pipeline = pipeline;
    this.docxExtractor = new DocxExtractor();
  }

  /**
   * Indexe toute la base de connaissances reglementaire embarquee
   */
  async indexKnowledgeBase(
    onProgress?: (status: RagIndexingStatus) => void
  ): Promise<RagDocument[]> {
    const docs: RagDocument[] = [];
    const total = REGULATORY_KNOWLEDGE_BASE.length;

    this.status = {
      isIndexing: true,
      progress: 0,
      indexedCount: 0,
      totalCount: total,
    };
    onProgress?.(this.status);

    for (let i = 0; i < total; i++) {
      const entry = REGULATORY_KNOWLEDGE_BASE[i];
      const source = REGULATORY_SOURCES.find(s => s.id === entry.sourceId);

      try {
        // Construire le texte complet a indexer
        const fullText = this.buildRegulatoryText(entry, source?.shortName);
        const docId = `reg_${entry.sourceId}_${i}`;

        this.status.currentDocument = entry.title;
        onProgress?.(this.status);

        const doc = await this.pipeline.indexDocument(
          docId,
          entry.title,
          fullText,
          'regulatory'
        );

        docs.push(doc);
        this.status.indexedCount = i + 1;
        this.status.progress = (i + 1) / total;
        onProgress?.(this.status);
      } catch (error) {
        this.status.lastError = `Erreur indexation "${entry.title}": ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
        onProgress?.(this.status);
      }
    }

    this.status.isIndexing = false;
    this.status.currentDocument = undefined;
    onProgress?.(this.status);

    return docs;
  }

  /**
   * Indexe un document personnalise (PDF, DOCX, TXT)
   */
  async indexCustomDocument(
    file: File,
    metadata?: { title?: string; tags?: string[] },
    onProgress?: (progress: number) => void
  ): Promise<RagDocument> {
    const text = await this.extractText(file);

    if (!text || text.trim().length === 0) {
      throw new Error(`Impossible d'extraire du texte du fichier "${file.name}"`);
    }

    const docId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const title = metadata?.title || file.name.replace(/\.[^.]+$/, '');

    return await this.pipeline.indexDocument(
      docId,
      title,
      text,
      'custom',
      file.name,
      onProgress
    );
  }

  /**
   * Re-indexe toute la base (supprime puis re-indexe)
   */
  async reindexAll(
    onProgress?: (status: RagIndexingStatus) => void
  ): Promise<RagDocument[]> {
    // Supprimer les documents reglementaires existants
    const existingDocs = await this.pipeline.getDocuments();
    for (const doc of existingDocs) {
      if (doc.source === 'regulatory') {
        await this.pipeline.removeDocument(doc.id);
      }
    }

    // Re-indexer
    return await this.indexKnowledgeBase(onProgress);
  }

  /**
   * Retourne le status d'indexation en cours
   */
  getIndexingStatus(): RagIndexingStatus {
    return { ...this.status };
  }

  /**
   * Extrait le texte d'un fichier selon son type
   */
  private async extractText(file: File): Promise<string> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'txt':
        return await file.text();

      case 'docx':
        return await this.docxExtractor.extract(file);

      case 'pdf':
        return await this.extractPdfText(file);

      default:
        throw new Error(`Format non supporte: .${extension}. Formats acceptes: PDF, DOCX, TXT`);
    }
  }

  /**
   * Extrait le texte d'un PDF via pdfjs-dist
   */
  private async extractPdfText(file: File): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: { str?: string }) => item.str || '')
        .join(' ');
      textParts.push(pageText);
    }

    return textParts.join('\n\n');
  }

  /**
   * Construit le texte complet d'un document reglementaire pour l'indexation
   */
  private buildRegulatoryText(
    entry: typeof REGULATORY_KNOWLEDGE_BASE[0],
    sourceName?: string
  ): string {
    const parts: string[] = [];

    parts.push(`Titre: ${entry.title}`);
    if (sourceName) {
      parts.push(`Source: ${sourceName}`);
    }
    parts.push(`Type: ${entry.type}`);
    parts.push(`Resume: ${entry.summary}`);
    parts.push(`Mots-cles: ${entry.keywords.join(', ')}`);

    return parts.join('\n');
  }
}
