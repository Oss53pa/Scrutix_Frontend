// ============================================================================
// SCRUTIX - Chunking Service
// Decoupage de texte en chunks pour le RAG
// ============================================================================

import type { ChunkStrategy } from './types';

export interface ChunkOptions {
  /** Strategie de chunking */
  strategy: ChunkStrategy;
  /** Taille cible en caracteres */
  chunkSize: number;
  /** Chevauchement en caracteres */
  overlap: number;
}

const DEFAULT_OPTIONS: ChunkOptions = {
  strategy: 'semantic',
  chunkSize: 512,
  overlap: 50,
};

/**
 * Service de decoupage de texte en chunks
 * Supporte le decoupage semantique (par paragraphes) et fixe (fenetre glissante)
 */
export class ChunkingService {
  /**
   * Decoupe un texte en chunks selon la strategie choisie
   */
  chunkText(text: string, options?: Partial<ChunkOptions>): string[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (!text || text.trim().length === 0) {
      return [];
    }

    if (opts.strategy === 'semantic') {
      return this.semanticChunk(text, opts.chunkSize, opts.overlap);
    }

    return this.fixedChunk(text, opts.chunkSize, opts.overlap);
  }

  /**
   * Decoupage semantique: respecte les limites de paragraphes
   * Combine les paragraphes courts, decoupe les paragraphes longs
   */
  private semanticChunk(text: string, chunkSize: number, overlap: number): string[] {
    // Separer en paragraphes (double saut de ligne ou titres)
    const paragraphs = text
      .split(/\n{2,}|\r\n{2,}/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (paragraphs.length === 0) {
      return this.fixedChunk(text, chunkSize, overlap);
    }

    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      // Si le paragraphe seul depasse la taille, le decouper en fixe
      if (paragraph.length > chunkSize) {
        // Flush le chunk en cours
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          // Garder le chevauchement
          currentChunk = currentChunk.slice(-overlap);
        }
        // Decouper le grand paragraphe en fenetre glissante
        const subChunks = this.fixedChunk(paragraph, chunkSize, overlap);
        chunks.push(...subChunks);
        currentChunk = '';
        continue;
      }

      // Si ajouter ce paragraphe depasse la taille cible
      if (currentChunk.length + paragraph.length + 1 > chunkSize) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          // Chevauchement: garder la fin du chunk precedent
          currentChunk = currentChunk.slice(-overlap) + '\n\n' + paragraph;
        } else {
          currentChunk = paragraph;
        }
      } else {
        // Ajouter au chunk courant
        currentChunk = currentChunk
          ? currentChunk + '\n\n' + paragraph
          : paragraph;
      }
    }

    // Flush le dernier chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Decoupage fixe: fenetre glissante avec chevauchement
   * Essaie de couper aux limites de phrases pour le francais
   */
  private fixedChunk(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);

      // Si on n'est pas a la fin, essayer de couper a une limite de phrase
      if (end < text.length) {
        const segment = text.slice(start, end);
        // Chercher le dernier point, point d'exclamation ou point d'interrogation
        const lastSentenceEnd = Math.max(
          segment.lastIndexOf('. '),
          segment.lastIndexOf('.\n'),
          segment.lastIndexOf('! '),
          segment.lastIndexOf('? '),
        );

        // Utiliser la limite de phrase si elle est apres la moitie du chunk
        if (lastSentenceEnd > chunkSize * 0.3) {
          end = start + lastSentenceEnd + 1;
        }
      }

      const chunk = text.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Avancer avec chevauchement
      start = end - overlap;
      if (start >= text.length) break;
      // Eviter les boucles infinies
      if (end === text.length) break;
    }

    return chunks;
  }

  /**
   * Estime le nombre de tokens pour un texte francais
   * ~4 caracteres par token pour le francais
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
