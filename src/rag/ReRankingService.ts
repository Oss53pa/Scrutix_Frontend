// ============================================================================
// SCRUTIX - Re-Ranking Service
// Re-classement des resultats RAG sans appel IA supplementaire
// ============================================================================

import type { RagSearchResult } from './types';

/**
 * Service de re-ranking des resultats RAG
 * Booste les resultats par mots-cles, recence, et autorite de la source
 * Pas d'appel IA supplementaire — purement heuristique
 */
export class ReRankingService {
  /**
   * Re-classe les resultats en combinant le score cosinus avec des signaux heuristiques
   */
  rerank(results: RagSearchResult[], query: string): RagSearchResult[] {
    if (results.length === 0) return [];

    const queryTerms = this.extractTerms(query);

    const reranked = results.map(result => {
      let boost = 0;

      // 1. Boost par chevauchement de mots-cles (0 - 0.15)
      const keywordScore = this.keywordOverlapScore(result.chunk.text, queryTerms);
      boost += keywordScore * 0.15;

      // 2. Boost par autorite de la source (0 - 0.10)
      const authorityScore = this.sourceAuthorityScore(result.chunk.metadata.source);
      boost += authorityScore * 0.10;

      // 3. Boost par recence (0 - 0.05)
      const recencyScore = this.recencyScore(result.chunk.metadata.indexedAt);
      boost += recencyScore * 0.05;

      // Score final = score cosinus + boost (capped a 1.0)
      const rerankedScore = Math.min(1.0, result.score + boost);

      return {
        ...result,
        rerankedScore,
      };
    });

    // Trier par score re-ranke
    reranked.sort((a, b) => (b.rerankedScore ?? b.score) - (a.rerankedScore ?? a.score));

    return reranked;
  }

  /**
   * Extrait les termes significatifs d'une requete (mots de 3+ caracteres, sans stopwords)
   */
  private extractTerms(text: string): string[] {
    const stopwords = new Set([
      'les', 'des', 'une', 'que', 'qui', 'est', 'dans', 'pour', 'sur',
      'par', 'avec', 'son', 'ses', 'aux', 'ont', 'sont', 'pas', 'mais',
      'plus', 'tout', 'cette', 'ces', 'comme', 'elle', 'entre', 'nous',
      'vous', 'leur', 'dont', 'bien', 'etre', 'avoir', 'fait', 'faire',
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
    ]);

    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\W+/)
      .filter(term => term.length >= 3 && !stopwords.has(term));
  }

  /**
   * Score de chevauchement de mots-cles (0-1)
   */
  private keywordOverlapScore(text: string, queryTerms: string[]): number {
    if (queryTerms.length === 0) return 0;

    const textLower = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    let matches = 0;
    for (const term of queryTerms) {
      if (textLower.includes(term)) {
        matches++;
      }
    }

    return matches / queryTerms.length;
  }

  /**
   * Score d'autorite de la source (0-1)
   * regulatory > template > custom
   */
  private sourceAuthorityScore(source: string): number {
    switch (source) {
      case 'regulatory':
        return 1.0;
      case 'template':
        return 0.6;
      case 'custom':
        return 0.3;
      default:
        return 0.1;
    }
  }

  /**
   * Score de recence (0-1)
   * Documents indexes recemment ont un leger avantage
   */
  private recencyScore(indexedAt: number): number {
    const ageMs = Date.now() - indexedAt;
    const ageDays = ageMs / (24 * 60 * 60 * 1000);

    // Plein score si < 30 jours, decroit jusqu'a 365 jours, 0 apres
    if (ageDays <= 30) return 1.0;
    if (ageDays >= 365) return 0.0;
    return 1.0 - (ageDays - 30) / 335;
  }
}
