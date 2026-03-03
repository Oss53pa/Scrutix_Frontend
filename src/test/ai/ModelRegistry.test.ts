import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Proph3tModelRegistry } from '../../ai/proph3t/ModelRegistry';
import {
  Proph3tConfig,
  DEFAULT_PROPH3T_CONFIG,
  DEFAULT_PROPH3T_MODELS,
} from '../../ai/proph3t/types';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockOllamaModels(models: string[]) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      models: models.map((name) => ({
        name,
        size: 1000000,
        digest: 'abc123',
        modified_at: new Date().toISOString(),
      })),
    }),
  });
}

describe('Proph3tModelRegistry', () => {
  let registry: Proph3tModelRegistry;
  const config: Proph3tConfig = { ...DEFAULT_PROPH3T_CONFIG };

  beforeEach(() => {
    registry = new Proph3tModelRegistry('http://localhost:11434');
    mockFetch.mockReset();
  });

  describe('refreshAvailableModels', () => {
    it('should fetch and store model list from Ollama', async () => {
      mockOllamaModels(['qwen2.5:7b', 'qwen2.5:14b', 'llava:13b']);

      const models = await registry.refreshAvailableModels();

      expect(models).toEqual(['qwen2.5:7b', 'qwen2.5:14b', 'llava:13b']);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/tags');
    });

    it('should return empty array on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const models = await registry.refreshAvailableModels();

      expect(models).toEqual([]);
    });

    it('should return empty array on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const models = await registry.refreshAvailableModels();

      expect(models).toEqual([]);
    });
  });

  describe('isModelAvailable', () => {
    it('should return true for exact model match', async () => {
      mockOllamaModels(['qwen2.5:7b']);
      await registry.refreshAvailableModels();

      expect(registry.isModelAvailable('qwen2.5:7b')).toBe(true);
    });

    it('should return true for base name match (different tag)', async () => {
      mockOllamaModels(['qwen2.5:14b']);
      await registry.refreshAvailableModels();

      // "qwen2.5:7b" should match against "qwen2.5:14b" via base name
      expect(registry.isModelAvailable('qwen2.5:7b')).toBe(true);
    });

    it('should return false for unavailable model', async () => {
      mockOllamaModels(['llama3:8b']);
      await registry.refreshAvailableModels();

      expect(registry.isModelAvailable('qwen2.5:7b')).toBe(false);
    });

    it('should return false when no models loaded', () => {
      expect(registry.isModelAvailable('qwen2.5:7b')).toBe(false);
    });
  });

  describe('resolveModel', () => {
    it('should return configured model when available', async () => {
      mockOllamaModels(['qwen2.5:7b', 'qwen2.5:14b']);
      await registry.refreshAvailableModels();

      const result = registry.resolveModel('fast', config);

      expect(result).not.toBeNull();
      expect(result!.model).toBe('qwen2.5:7b');
      expect(result!.actualRole).toBe('fast');
    });

    it('should return fallback when primary unavailable', async () => {
      // Only fast model available, not reasoning
      mockOllamaModels(['qwen2.5:7b']);
      await registry.refreshAvailableModels();

      // Vision falls back to reasoning, reasoning falls back to fast
      const result = registry.resolveModel('vision', config);

      expect(result).not.toBeNull();
      // vision → reasoning → fast (since qwen2.5 base name matches)
      expect(result).toBeDefined();
    });

    it('should return null when no models available', async () => {
      mockOllamaModels([]);
      await registry.refreshAvailableModels();

      const result = registry.resolveModel('fast', config);

      expect(result).toBeNull();
    });
  });

  describe('resolveFallback', () => {
    it('should follow fallback chain', async () => {
      // Only a model with different base name — won't match qwen2.5:14b (reasoning)
      // but also won't match qwen2.5:7b (fast). Use llava:13b (vision model).
      // vision fallbackRole → reasoning → fast, none available → null
      mockOllamaModels(['nomic-embed-text']);
      await registry.refreshAvailableModels();

      // vision → reasoning (qwen2.5:14b, unavailable) → fast (qwen2.5:7b, unavailable)
      // → last resort scan → finds nomic-embed-text → returns embedding role
      const result = registry.resolveFallback('vision', config);

      expect(result).not.toBeNull();
      expect(result!.model).toBe('nomic-embed-text');
      expect(result!.actualRole).toBe('embedding');
    });

    it('should avoid infinite loops', async () => {
      mockOllamaModels([]);
      await registry.refreshAvailableModels();

      const result = registry.resolveFallback('fast', config);

      expect(result).toBeNull();
    });
  });

  describe('checkAllRoles', () => {
    it('should report all roles available', async () => {
      mockOllamaModels(['qwen2.5:7b', 'qwen2.5:14b', 'llava:13b', 'nomic-embed-text']);
      await registry.refreshAvailableModels();

      const roles = registry.checkAllRoles(config);

      expect(roles.reasoning.available).toBe(true);
      expect(roles.reasoning.fallback).toBe(false);
      expect(roles.fast.available).toBe(true);
      expect(roles.fast.fallback).toBe(false);
      expect(roles.vision.available).toBe(true);
      expect(roles.embedding.available).toBe(true);
    });

    it('should report unavailable roles with fallback info', async () => {
      // Only nomic-embed-text available — different base name from all other roles
      mockOllamaModels(['nomic-embed-text']);
      await registry.refreshAvailableModels();

      const roles = registry.checkAllRoles(config);

      // embedding is directly available
      expect(roles.embedding.available).toBe(true);
      expect(roles.embedding.fallback).toBe(false);

      // vision falls back through chain and eventually finds nomic-embed-text
      expect(roles.vision.available).toBe(true);
      expect(roles.vision.fallback).toBe(true);

      // fast (qwen2.5:7b) has no fallbackRole, but last resort finds nomic-embed-text
      expect(roles.fast.available).toBe(true);
      expect(roles.fast.fallback).toBe(true);
    });
  });

  describe('checkHealth', () => {
    it('should return healthy when Ollama is reachable', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const health = await registry.checkHealth();

      expect(health.healthy).toBe(true);
    });

    it('should return unhealthy on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const health = await registry.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    });

    it('should return unhealthy on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const health = await registry.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('HTTP 500');
    });
  });

  describe('getDefaultModels', () => {
    it('should return default model config', () => {
      const defaults = Proph3tModelRegistry.getDefaultModels();

      expect(defaults.reasoning.name).toBe(DEFAULT_PROPH3T_MODELS.reasoning.name);
      expect(defaults.fast.name).toBe(DEFAULT_PROPH3T_MODELS.fast.name);
      expect(defaults.vision.name).toBe(DEFAULT_PROPH3T_MODELS.vision.name);
      expect(defaults.embedding.name).toBe(DEFAULT_PROPH3T_MODELS.embedding.name);
    });
  });

  describe('getTimeSinceLastRefresh', () => {
    it('should return Infinity before first refresh', () => {
      expect(registry.getTimeSinceLastRefresh()).toBe(Infinity);
    });

    it('should return time since refresh', async () => {
      mockOllamaModels(['qwen2.5:7b']);
      await registry.refreshAvailableModels();

      const elapsed = registry.getTimeSinceLastRefresh();

      expect(elapsed).toBeGreaterThanOrEqual(0);
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
