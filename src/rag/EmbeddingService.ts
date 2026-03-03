// ============================================================================
// SCRUTIX - Embedding Service
// Generation d'embeddings via Ollama /api/embeddings
// ============================================================================

/**
 * Service de generation d'embeddings via Ollama
 * Utilise le modele nomic-embed-text par defaut (768 dimensions)
 */
export class EmbeddingService {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'nomic-embed-text') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  /**
   * Met a jour la configuration
   */
  configure(baseUrl: string, model?: string): void {
    this.baseUrl = baseUrl;
    if (model) {
      this.model = model;
    }
  }

  /**
   * Genere un embedding pour un texte
   */
  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(
        `Embedding error (${response.status}): ${errorData?.error || response.statusText}`
      );
    }

    const data = await response.json() as { embedding?: number[] };

    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error('Reponse embedding invalide: pas de vecteur retourne');
    }

    return data.embedding;
  }

  /**
   * Genere des embeddings pour un batch de textes
   * Traite sequentiellement pour eviter de surcharger Ollama
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (const text of texts) {
      const embedding = await this.embed(text);
      results.push(embedding);
    }

    return results;
  }

  /**
   * Teste la connexion au service d'embedding
   */
  async testConnection(): Promise<{ valid: boolean; dims: number; error?: string }> {
    try {
      const embedding = await this.embed('test');
      return { valid: true, dims: embedding.length };
    } catch (error) {
      return {
        valid: false,
        dims: 0,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}
