/**
 * Service de recherche sur les sites des regulateurs bancaires CEMAC/UEMOA
 * Permet a l'IA de citer des references officielles dans ses analyses
 */

export interface RegulatorySource {
  id: string;
  name: string;
  shortName: string;
  region: 'CEMAC' | 'UEMOA';
  type: 'central_bank' | 'regulator';
  baseUrl: string;
  searchUrl?: string;
  description: string;
  enabled: boolean;
}

export interface SearchResult {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  snippet: string;
  url: string;
  date?: string;
  type: 'regulation' | 'circular' | 'decision' | 'report' | 'press' | 'other';
  relevanceScore: number;
}

export interface RegulatoryReference {
  sourceId: string;
  sourceName: string;
  documentTitle: string;
  documentUrl: string;
  excerpt: string;
  citedAt: Date;
}

// Sources reglementaires officielles CEMAC/UEMOA
export const REGULATORY_SOURCES: RegulatorySource[] = [
  // CEMAC
  {
    id: 'beac',
    name: 'Banque des Etats de l\'Afrique Centrale',
    shortName: 'BEAC',
    region: 'CEMAC',
    type: 'central_bank',
    baseUrl: 'https://www.beac.int',
    searchUrl: 'https://www.beac.int/recherche/',
    description: 'Banque centrale de la CEMAC (Cameroun, Centrafrique, Congo, Gabon, Guinee Equatoriale, Tchad)',
    enabled: true,
  },
  {
    id: 'cobac',
    name: 'Commission Bancaire de l\'Afrique Centrale',
    shortName: 'COBAC',
    region: 'CEMAC',
    type: 'regulator',
    baseUrl: 'https://www.sgcobac.org',
    description: 'Autorite de supervision et de controle des etablissements de credit de la CEMAC',
    enabled: true,
  },
  // UEMOA
  {
    id: 'bceao',
    name: 'Banque Centrale des Etats de l\'Afrique de l\'Ouest',
    shortName: 'BCEAO',
    region: 'UEMOA',
    type: 'central_bank',
    baseUrl: 'https://www.bceao.int',
    searchUrl: 'https://www.bceao.int/fr/recherche',
    description: 'Banque centrale de l\'UEMOA (Benin, Burkina Faso, Cote d\'Ivoire, Guinee-Bissau, Mali, Niger, Senegal, Togo)',
    enabled: true,
  },
  {
    id: 'cb_umoa',
    name: 'Commission Bancaire de l\'UMOA',
    shortName: 'CB-UMOA',
    region: 'UEMOA',
    type: 'regulator',
    baseUrl: 'https://www.cb.uemoa.int',
    description: 'Autorite de supervision des etablissements de credit de l\'UEMOA',
    enabled: true,
  },
];

// Base de connaissances des reglementations cles
export const REGULATORY_KNOWLEDGE_BASE = [
  // CEMAC - BEAC
  {
    sourceId: 'beac',
    title: 'Reglement COBAC R-2018/01 relatif aux conditions bancaires',
    url: 'https://www.beac.int/reglementation/',
    type: 'regulation' as const,
    keywords: ['frais bancaires', 'conditions', 'tarification', 'commission'],
    summary: 'Reglemente les conditions de banque applicables aux operations de credit et les frais bancaires dans la zone CEMAC.',
  },
  {
    sourceId: 'beac',
    title: 'Instruction BEAC sur les taux d\'interet',
    url: 'https://www.beac.int/politique-monetaire/',
    type: 'circular' as const,
    keywords: ['taux', 'interet', 'agios', 'debiteur'],
    summary: 'Fixe les taux directeurs et les conditions applicables aux operations de refinancement.',
  },
  {
    sourceId: 'cobac',
    title: 'Reglement COBAC R-2016/04 relatif au traitement des reclamations',
    url: 'https://www.sgcobac.org/reglementation/',
    type: 'regulation' as const,
    keywords: ['reclamation', 'client', 'litige', 'mediation'],
    summary: 'Encadre le traitement des reclamations des clients par les etablissements de credit.',
  },
  // UEMOA - BCEAO
  {
    sourceId: 'bceao',
    title: 'Instruction N°008-05-2015 relative aux conditions de banque',
    url: 'https://www.bceao.int/fr/reglementation',
    type: 'circular' as const,
    keywords: ['frais', 'commission', 'tarif', 'conditions'],
    summary: 'Definit les regles applicables aux conditions de banque dans l\'UEMOA.',
  },
  {
    sourceId: 'bceao',
    title: 'Avis aux banques relatif aux taux d\'interet',
    url: 'https://www.bceao.int/fr/politique-monetaire',
    type: 'circular' as const,
    keywords: ['taux', 'usure', 'interet', 'plafond'],
    summary: 'Fixe les taux de reference et les plafonds des taux d\'interet applicables.',
  },
  {
    sourceId: 'cb_umoa',
    title: 'Circulaire sur la transparence des conditions bancaires',
    url: 'https://www.cb.uemoa.int/circulaires/',
    type: 'circular' as const,
    keywords: ['transparence', 'information', 'client', 'affichage'],
    summary: 'Impose aux etablissements de credit l\'affichage et la communication des conditions tarifaires.',
  },
];

class RegulatorySearchServiceClass {
  private sources: RegulatorySource[] = REGULATORY_SOURCES;

  /**
   * Recherche dans les sources reglementaires
   */
  async search(query: string, options?: {
    region?: 'CEMAC' | 'UEMOA' | 'all';
    sourceIds?: string[];
    limit?: number;
  }): Promise<SearchResult[]> {
    const { region = 'all', sourceIds, limit = 10 } = options || {};

    // Filtrer les sources actives
    let activeSources = this.sources.filter(s => s.enabled);

    if (region !== 'all') {
      activeSources = activeSources.filter(s => s.region === region);
    }

    if (sourceIds && sourceIds.length > 0) {
      activeSources = activeSources.filter(s => sourceIds.includes(s.id));
    }

    // Recherche dans la base de connaissances locale
    const results = this.searchKnowledgeBase(query, activeSources);

    // Trier par pertinence
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return results.slice(0, limit);
  }

  /**
   * Recherche dans la base de connaissances locale
   */
  private searchKnowledgeBase(query: string, sources: RegulatorySource[]): SearchResult[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const sourceIds = sources.map(s => s.id);

    const results: SearchResult[] = [];

    for (const doc of REGULATORY_KNOWLEDGE_BASE) {
      if (!sourceIds.includes(doc.sourceId)) continue;

      // Calculer le score de pertinence
      let score = 0;

      // Correspondance dans le titre
      if (doc.title.toLowerCase().includes(queryLower)) {
        score += 50;
      }

      // Correspondance dans les mots-cles
      for (const keyword of doc.keywords) {
        if (queryLower.includes(keyword) || keyword.includes(queryLower)) {
          score += 20;
        }
        for (const word of queryWords) {
          if (keyword.includes(word)) {
            score += 5;
          }
        }
      }

      // Correspondance dans le resume
      for (const word of queryWords) {
        if (doc.summary.toLowerCase().includes(word)) {
          score += 3;
        }
      }

      if (score > 0) {
        const source = sources.find(s => s.id === doc.sourceId)!;
        results.push({
          id: `${doc.sourceId}-${doc.title.slice(0, 20).replace(/\s/g, '-')}`,
          sourceId: doc.sourceId,
          sourceName: source.shortName,
          title: doc.title,
          snippet: doc.summary,
          url: doc.url,
          type: doc.type,
          relevanceScore: Math.min(100, score),
        });
      }
    }

    return results;
  }

  /**
   * Obtient les references pertinentes pour une analyse
   */
  async getReferencesForAnalysis(context: {
    anomalyTypes?: string[];
    keywords?: string[];
    region?: 'CEMAC' | 'UEMOA';
  }): Promise<RegulatoryReference[]> {
    const { anomalyTypes = [], keywords = [], region } = context;

    // Construire la requete de recherche
    const searchTerms: string[] = [];

    // Mapper les types d'anomalies aux termes de recherche
    const anomalyKeywords: Record<string, string[]> = {
      'DUPLICATE_FEE': ['frais', 'doublon', 'commission'],
      'GHOST_FEE': ['frais', 'commission', 'transparence'],
      'OVERCHARGE': ['surfacturation', 'tarif', 'conditions', 'plafond'],
      'INTEREST_ERROR': ['interet', 'agios', 'taux', 'calcul'],
      'UNAUTHORIZED': ['autorisation', 'prelevement', 'consentement'],
    };

    for (const type of anomalyTypes) {
      const terms = anomalyKeywords[type];
      if (terms) {
        searchTerms.push(...terms);
      }
    }

    searchTerms.push(...keywords);

    // Rechercher
    const uniqueTerms = [...new Set(searchTerms)];
    const query = uniqueTerms.join(' ');

    const results = await this.search(query, { region, limit: 5 });

    // Convertir en references
    return results.map(r => ({
      sourceId: r.sourceId,
      sourceName: r.sourceName,
      documentTitle: r.title,
      documentUrl: r.url,
      excerpt: r.snippet,
      citedAt: new Date(),
    }));
  }

  /**
   * Genere un texte de citation pour l'IA
   */
  formatReferencesForAI(references: RegulatoryReference[]): string {
    if (references.length === 0) {
      return '';
    }

    let text = '\n\n---\nREFERENCES REGLEMENTAIRES:\n';

    for (const ref of references) {
      text += `\n- [${ref.sourceName}] ${ref.documentTitle}\n`;
      text += `  Source: ${ref.documentUrl}\n`;
      text += `  Resume: ${ref.excerpt}\n`;
    }

    return text;
  }

  /**
   * Liste toutes les sources disponibles
   */
  getSources(): RegulatorySource[] {
    return this.sources;
  }

  /**
   * Active/desactive une source
   */
  toggleSource(sourceId: string, enabled: boolean): void {
    const source = this.sources.find(s => s.id === sourceId);
    if (source) {
      source.enabled = enabled;
    }
  }

  /**
   * Obtient les sources par region
   */
  getSourcesByRegion(region: 'CEMAC' | 'UEMOA'): RegulatorySource[] {
    return this.sources.filter(s => s.region === region);
  }

  /**
   * Verifie si des sources sont actives
   */
  hasActiveSources(): boolean {
    return this.sources.some(s => s.enabled);
  }
}

// Export singleton
export const RegulatorySearchService = new RegulatorySearchServiceClass();
