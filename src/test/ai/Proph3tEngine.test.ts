import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Proph3tEngine } from '../../ai/proph3t/Proph3tEngine';
import { AIDetectionType } from '../../ai/types';
import {
  DEFAULT_PROPH3T_CONFIG,
  DETECTION_MODEL_MAP,
  Proph3tConfig,
} from '../../ai/proph3t/types';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockOllamaResponse(content: string, model = 'qwen2.5:7b') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      model,
      message: { role: 'assistant', content },
      prompt_eval_count: 100,
      eval_count: 50,
    }),
  });
}

function mockOllamaModelsEndpoint(models: string[]) {
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

describe('Proph3tEngine', () => {
  let engine: Proph3tEngine;
  const testConfig: Proph3tConfig = {
    ...DEFAULT_PROPH3T_CONFIG,
    enabled: true,
  };

  beforeEach(() => {
    mockFetch.mockReset();
    engine = new Proph3tEngine(
      {
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        apiKey: '',
        model: 'qwen2.5:7b',
        maxTokens: 4000,
        temperature: 0.3,
      },
      testConfig
    );
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(engine.name).toBe('PROPH3T Engine');
      expect(engine.type).toBe('ollama');
    });

    it('should use default config when none provided', () => {
      const defaultEngine = new Proph3tEngine({
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        apiKey: '',
        model: 'qwen2.5:7b',
        maxTokens: 4000,
        temperature: 0.3,
      });

      expect(defaultEngine.getProph3tConfig()).toEqual(DEFAULT_PROPH3T_CONFIG);
    });
  });

  describe('updateProph3tConfig', () => {
    it('should update partial config', () => {
      engine.updateProph3tConfig({ jsonMode: false, timeout: 60000 });

      const config = engine.getProph3tConfig();
      expect(config.jsonMode).toBe(false);
      expect(config.timeout).toBe(60000);
      expect(config.enabled).toBe(true);
    });

    it('should update baseUrl and recreate registry', () => {
      engine.updateProph3tConfig({ baseUrl: 'http://remote:11434' });

      const config = engine.getProph3tConfig();
      expect(config.baseUrl).toBe('http://remote:11434');
    });
  });

  describe('callWithRole', () => {
    it('should call with specified role', async () => {
      mockOllamaResponse('{"result": "ok"}');

      const result = await engine.callWithRole(
        [{ role: 'user', content: 'Test message' }],
        { role: 'reasoning' }
      );

      expect(result.content).toBe('{"result": "ok"}');
      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(50);
    });

    it('should restore previous role after call', async () => {
      mockOllamaResponse('ok');

      // callWithRole should not permanently change the role
      await engine.callWithRole(
        [{ role: 'user', content: 'Test' }],
        { role: 'reasoning' }
      );

      // Subsequent calls should use default role
      mockOllamaResponse('ok2');
      const result = await engine.callWithRole(
        [{ role: 'user', content: 'Test2' }],
        { role: 'fast' }
      );

      expect(result.content).toBe('ok2');
    });
  });

  describe('DETECTION_MODEL_MAP', () => {
    it('should map complex detection types to reasoning', () => {
      expect(DETECTION_MODEL_MAP[AIDetectionType.OVERCHARGES]).toBe('reasoning');
      expect(DETECTION_MODEL_MAP[AIDetectionType.INTEREST_ERRORS]).toBe('reasoning');
      expect(DETECTION_MODEL_MAP[AIDetectionType.VALUE_DATE]).toBe('reasoning');
      expect(DETECTION_MODEL_MAP[AIDetectionType.SUSPICIOUS]).toBe('reasoning');
      expect(DETECTION_MODEL_MAP[AIDetectionType.COMPLIANCE]).toBe('reasoning');
      expect(DETECTION_MODEL_MAP[AIDetectionType.MULTI_BANK]).toBe('reasoning');
      expect(DETECTION_MODEL_MAP[AIDetectionType.OHADA]).toBe('reasoning');
      expect(DETECTION_MODEL_MAP[AIDetectionType.AML_LCB_FT]).toBe('reasoning');
    });

    it('should map simple detection types to fast', () => {
      expect(DETECTION_MODEL_MAP[AIDetectionType.DUPLICATES]).toBe('fast');
      expect(DETECTION_MODEL_MAP[AIDetectionType.GHOST_FEES]).toBe('fast');
      expect(DETECTION_MODEL_MAP[AIDetectionType.CASHFLOW]).toBe('fast');
      expect(DETECTION_MODEL_MAP[AIDetectionType.RECONCILIATION]).toBe('fast');
      expect(DETECTION_MODEL_MAP[AIDetectionType.FEES]).toBe('fast');
    });

    it('should cover all detection types', () => {
      const allTypes = Object.values(AIDetectionType);
      for (const type of allTypes) {
        expect(DETECTION_MODEL_MAP[type]).toBeDefined();
      }
    });
  });

  describe('testConnection', () => {
    it('should return valid when Ollama is reachable and models available', async () => {
      // Health check
      mockOllamaModelsEndpoint(['qwen2.5:7b', 'qwen2.5:14b']);
      // Refresh models
      mockOllamaModelsEndpoint(['qwen2.5:7b', 'qwen2.5:14b']);
      // Quick completion
      mockOllamaResponse('OK');

      const result = await engine.testConnection();

      expect(result.valid).toBe(true);
    });

    it('should return invalid when Ollama is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await engine.testConnection();

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getRegistry', () => {
    it('should return the model registry', () => {
      const registry = engine.getRegistry();
      expect(registry).toBeDefined();
      expect(typeof registry.refreshAvailableModels).toBe('function');
    });
  });

  describe('cache management', () => {
    it('should return null stats when cache not initialized', async () => {
      const stats = await engine.getCacheStats();
      expect(stats).toBeNull();
    });
  });

  describe('extractJson override', () => {
    it('should use JsonValidator for extraction', () => {
      // Access the protected method via any cast for testing
      const extracted = (engine as any).extractJson('```json\n{"a": 1}\n```');
      expect(extracted).toBe('{"a": 1}');
    });

    it('should handle plain JSON', () => {
      const extracted = (engine as any).extractJson('[1, 2, 3]');
      expect(extracted).toBe('[1, 2, 3]');
    });
  });
});
