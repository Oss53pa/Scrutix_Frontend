// ============================================================================
// SCRUTIX - PROPH3T Model Registry
// Decouverte et gestion des modeles Ollama installes
// ============================================================================

import { Proph3tModelRole, Proph3tModelSlot, Proph3tConfig, DEFAULT_PROPH3T_MODELS } from './types';

interface OllamaModelInfo {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
  details?: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

/**
 * Registre des modeles PROPH3T
 * Decouvre les modeles Ollama installes et resout les assignations par role
 */
export class Proph3tModelRegistry {
  private availableModels: string[] = [];
  private lastRefresh: number = 0;
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  /**
   * Rafraichit la liste des modeles disponibles depuis Ollama
   */
  async refreshAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        this.availableModels = [];
        return [];
      }

      const data = (await response.json()) as { models?: OllamaModelInfo[] };
      this.availableModels = data.models?.map((m) => m.name) || [];
      this.lastRefresh = Date.now();

      return this.availableModels;
    } catch {
      this.availableModels = [];
      return [];
    }
  }

  /**
   * Verifie si un modele est disponible localement
   */
  isModelAvailable(modelName: string): boolean {
    const baseName = modelName.split(':')[0];
    return this.availableModels.some(
      (m) => m === modelName || m.startsWith(`${baseName}:`)
    );
  }

  /**
   * Resout le modele a utiliser pour un role donne
   * Retourne le modele configure s'il est disponible, sinon le fallback
   */
  resolveModel(
    role: Proph3tModelRole,
    config: Proph3tConfig
  ): { model: string; actualRole: Proph3tModelRole } | null {
    const slot = config.models[role];

    // Le modele configure est disponible
    if (this.isModelAvailable(slot.name)) {
      return { model: slot.name, actualRole: role };
    }

    // Essayer le fallback
    return this.resolveFallback(role, config);
  }

  /**
   * Resout un modele de repli pour un role donne
   */
  resolveFallback(
    role: Proph3tModelRole,
    config: Proph3tConfig,
    visited: Set<Proph3tModelRole> = new Set()
  ): { model: string; actualRole: Proph3tModelRole } | null {
    // Eviter les boucles infinies
    if (visited.has(role)) return null;
    visited.add(role);

    const slot = config.models[role];

    // Si le modele est disponible, l'utiliser
    if (this.isModelAvailable(slot.name)) {
      return { model: slot.name, actualRole: role };
    }

    // Essayer le fallbackRole
    if (slot.fallbackRole) {
      return this.resolveFallback(slot.fallbackRole, config, visited);
    }

    // Dernier recours: chercher n'importe quel modele disponible
    for (const [r, s] of Object.entries(config.models) as Array<[Proph3tModelRole, Proph3tModelSlot]>) {
      if (!visited.has(r) && this.isModelAvailable(s.name)) {
        return { model: s.name, actualRole: r };
      }
    }

    return null;
  }

  /**
   * Retourne la liste des modeles disponibles
   */
  getAvailableModels(): string[] {
    return [...this.availableModels];
  }

  /**
   * Verifie la disponibilite de tous les roles configures
   */
  checkAllRoles(config: Proph3tConfig): Record<Proph3tModelRole, { available: boolean; model: string; fallback: boolean }> {
    const result = {} as Record<Proph3tModelRole, { available: boolean; model: string; fallback: boolean }>;

    for (const role of ['reasoning', 'fast', 'vision', 'embedding'] as Proph3tModelRole[]) {
      const slot = config.models[role];
      const directlyAvailable = this.isModelAvailable(slot.name);

      if (directlyAvailable) {
        result[role] = { available: true, model: slot.name, fallback: false };
      } else {
        const resolved = this.resolveFallback(role, config);
        if (resolved) {
          result[role] = { available: true, model: resolved.model, fallback: true };
        } else {
          result[role] = { available: false, model: slot.name, fallback: false };
        }
      }
    }

    return result;
  }

  /**
   * Verifie la sante de la connexion Ollama
   */
  async checkHealth(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
      if (response.ok) {
        return { healthy: true };
      }
      return { healthy: false, error: `HTTP ${response.status}` };
    } catch {
      return { healthy: false, error: `Ollama inaccessible a ${this.baseUrl}` };
    }
  }

  /**
   * Temps depuis le dernier rafraichissement (ms)
   */
  getTimeSinceLastRefresh(): number {
    if (this.lastRefresh === 0) return Infinity;
    return Date.now() - this.lastRefresh;
  }

  /**
   * Retourne les modeles par defaut recommandes
   */
  static getDefaultModels(): Record<Proph3tModelRole, Proph3tModelSlot> {
    return { ...DEFAULT_PROPH3T_MODELS };
  }
}
