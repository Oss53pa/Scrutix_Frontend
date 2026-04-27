// ============================================================================
// ATLASBANX - Rate Limiter IA
// Contrôle du débit des appels API par fournisseur (fenêtre glissante 1h)
// ============================================================================

export interface RateLimitConfig {
  maxRequestsPerHour: number;
  maxTokensPerHour: number;
  enabled: boolean;
}

export interface RateLimitStatus {
  provider: string;
  requestsUsed: number;
  requestsLimit: number;
  tokensUsed: number;
  tokensLimit: number;
  resetsAt: Date;
  isLimited: boolean;
  remainingRequests: number;
  remainingTokens: number;
}

interface StoredEntry {
  timestamp: number;
  tokens: number;
}

interface StoredData {
  [provider: string]: StoredEntry[];
}

interface StoredConfigs {
  [provider: string]: RateLimitConfig;
}

// ----------------------------------------------------------------------------
// Constantes
// ----------------------------------------------------------------------------

const STORAGE_KEY = 'atlasbanx-rate-limits';
const CONFIG_KEY = 'atlasbanx-rate-limits-config';
const WINDOW_MS = 60 * 60 * 1000; // 1 heure

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequestsPerHour: 100,
  maxTokensPerHour: 500_000,
  enabled: true,
};

// ----------------------------------------------------------------------------
// Classe RateLimiter
// ----------------------------------------------------------------------------

class RateLimiter {
  private configs: StoredConfigs;

  constructor() {
    this.configs = this.loadConfigs();
  }

  // ==========================================================================
  // API publique
  // ==========================================================================

  /**
   * Vérifie si une requête est autorisée pour un provider donné
   */
  checkLimit(provider: string): { allowed: boolean; retryAfterMs?: number } {
    const config = this.getConfig(provider);
    if (!config.enabled) {
      return { allowed: true };
    }

    const entries = this.getValidEntries(provider);
    const requestCount = entries.length;
    const tokenCount = entries.reduce((sum, e) => sum + e.tokens, 0);

    if (requestCount >= config.maxRequestsPerHour) {
      const oldest = entries[0];
      const retryAfterMs = oldest.timestamp + WINDOW_MS - Date.now();
      return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1000) };
    }

    if (tokenCount >= config.maxTokensPerHour) {
      const oldest = entries[0];
      const retryAfterMs = oldest.timestamp + WINDOW_MS - Date.now();
      return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1000) };
    }

    return { allowed: true };
  }

  /**
   * Enregistre une requête effectuée
   */
  recordRequest(provider: string, tokens: number): void {
    const data = this.loadData();
    if (!data[provider]) {
      data[provider] = [];
    }
    data[provider].push({ timestamp: Date.now(), tokens });
    this.saveData(data);
  }

  /**
   * Retourne le statut du rate limit pour un provider
   */
  getStatus(provider: string): RateLimitStatus {
    const config = this.getConfig(provider);
    const entries = this.getValidEntries(provider);
    const requestsUsed = entries.length;
    const tokensUsed = entries.reduce((sum, e) => sum + e.tokens, 0);

    const oldestTimestamp = entries.length > 0 ? entries[0].timestamp : Date.now();
    const resetsAt = new Date(oldestTimestamp + WINDOW_MS);

    const isLimited =
      config.enabled &&
      (requestsUsed >= config.maxRequestsPerHour || tokensUsed >= config.maxTokensPerHour);

    return {
      provider,
      requestsUsed,
      requestsLimit: config.maxRequestsPerHour,
      tokensUsed,
      tokensLimit: config.maxTokensPerHour,
      resetsAt,
      isLimited,
      remainingRequests: Math.max(0, config.maxRequestsPerHour - requestsUsed),
      remainingTokens: Math.max(0, config.maxTokensPerHour - tokensUsed),
    };
  }

  /**
   * Retourne les statuts de tous les providers ayant des données
   */
  getAllStatuses(): RateLimitStatus[] {
    const data = this.loadData();
    const providers = new Set([
      ...Object.keys(data),
      ...Object.keys(this.configs),
    ]);

    return Array.from(providers).map((p) => this.getStatus(p));
  }

  /**
   * Réinitialise les compteurs pour un provider
   */
  resetLimits(provider: string): void {
    const data = this.loadData();
    delete data[provider];
    this.saveData(data);
  }

  /**
   * Met à jour la configuration d'un provider
   */
  updateConfig(provider: string, config: Partial<RateLimitConfig>): void {
    this.configs[provider] = { ...this.getConfig(provider), ...config };
    this.saveConfigs();
  }

  /**
   * Retourne la configuration d'un provider
   */
  getConfig(provider: string): RateLimitConfig {
    return this.configs[provider] ?? { ...DEFAULT_CONFIG };
  }

  // ==========================================================================
  // Stockage
  // ==========================================================================

  private getValidEntries(provider: string): StoredEntry[] {
    const data = this.loadData();
    const entries = data[provider] ?? [];
    const cutoff = Date.now() - WINDOW_MS;

    // Nettoyage des entrées expirées
    const valid = entries.filter((e) => e.timestamp > cutoff);

    // Persister le nettoyage si des entrées ont été supprimées
    if (valid.length !== entries.length) {
      data[provider] = valid;
      this.saveData(data);
    }

    return valid;
  }

  private loadData(): StoredData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveData(data: StoredData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Silently fail if storage is full
    }
  }

  private loadConfigs(): StoredConfigs {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveConfigs(): void {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(this.configs));
    } catch {
      // Silently fail
    }
  }
}

// Singleton
export const rateLimiter = new RateLimiter();
