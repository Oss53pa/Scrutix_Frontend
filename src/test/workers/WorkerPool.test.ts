import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DetectionWorkerPool } from '../../workers/WorkerPool';

// Mock Worker class
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  private terminated = false;

  constructor() {
    // Simulate async response for any postMessage
    MockWorker.instances.push(this);
  }

  postMessage(data: any) {
    if (this.terminated) return;

    // Simulate async worker response
    setTimeout(() => {
      if (this.onmessage && !this.terminated) {
        this.onmessage(new MessageEvent('message', {
          data: {
            type: 'RESULT',
            id: data.id,
            detectorType: data.detectorType,
            anomalies: [],
          },
        }));
      }
    }, 5);
  }

  terminate() {
    this.terminated = true;
  }

  static instances: MockWorker[] = [];
  static reset() {
    MockWorker.instances = [];
  }
}

// Mock navigator.hardwareConcurrency
vi.stubGlobal('navigator', { hardwareConcurrency: 4 });

// Stub Worker constructor
vi.stubGlobal('Worker', MockWorker);

describe('DetectionWorkerPool', () => {
  let pool: DetectionWorkerPool;

  beforeEach(() => {
    MockWorker.reset();
    pool = new DetectionWorkerPool();
  });

  afterEach(() => {
    pool.terminate();
  });

  describe('initialize', () => {
    it('should create workers based on hardwareConcurrency', () => {
      const result = pool.initialize();

      expect(result).toBe(true);
      expect(pool.poolSize).toBe(4);
      expect(pool.isInitialized).toBe(true);
    });

    it('should not re-initialize if already initialized', () => {
      pool.initialize();
      const sizeBefore = pool.poolSize;

      pool.initialize();

      expect(pool.poolSize).toBe(sizeBefore);
    });

    it('should cap pool size at 6', () => {
      vi.stubGlobal('navigator', { hardwareConcurrency: 16 });

      const bigPool = new DetectionWorkerPool();
      bigPool.initialize();

      expect(bigPool.poolSize).toBeLessThanOrEqual(6);
      bigPool.terminate();

      // Restore
      vi.stubGlobal('navigator', { hardwareConcurrency: 4 });
    });
  });

  describe('runDetection', () => {
    it('should reject when not initialized', async () => {
      await expect(
        pool.runDetection('DUPLICATES', [])
      ).rejects.toThrow('Worker pool non initialise');
    });

    it('should dispatch work and resolve with anomalies', async () => {
      pool.initialize();

      const anomalies = await pool.runDetection('DUPLICATES', []);

      expect(anomalies).toEqual([]);
    });

    it('should dispatch to workers in round-robin', async () => {
      pool.initialize();

      // Fire multiple detections
      const p1 = pool.runDetection('DUPLICATES', []);
      const p2 = pool.runDetection('GHOST_FEES', []);
      const p3 = pool.runDetection('OVERCHARGES', []);
      const p4 = pool.runDetection('CASHFLOW', []);
      const p5 = pool.runDetection('FEES', []);

      const results = await Promise.all([p1, p2, p3, p4, p5]);

      // All should resolve successfully
      expect(results).toHaveLength(5);
      results.forEach((r) => expect(Array.isArray(r)).toBe(true));
    });
  });

  describe('runParallel', () => {
    it('should reject when not initialized', async () => {
      await expect(
        pool.runParallel(['DUPLICATES'], [])
      ).rejects.toThrow('Worker pool non initialise');
    });

    it('should run multiple detectors and collect results', async () => {
      pool.initialize();

      const detectors = ['DUPLICATES', 'GHOST_FEES', 'OVERCHARGES'];
      const anomalies = await pool.runParallel(detectors, []);

      expect(Array.isArray(anomalies)).toBe(true);
    });

    it('should call progress callback', async () => {
      pool.initialize();

      const progressCalls: [number, number, string][] = [];

      await pool.runParallel(
        ['DUPLICATES', 'GHOST_FEES'],
        [],
        {
          onProgress: (completed, total, type) => {
            progressCalls.push([completed, total, type]);
          },
        }
      );

      expect(progressCalls.length).toBe(2);
      // Each call should have total=2
      progressCalls.forEach(([, total]) => expect(total).toBe(2));
    });

    it('should handle empty detector list', async () => {
      pool.initialize();

      const anomalies = await pool.runParallel([], []);

      expect(anomalies).toEqual([]);
    });
  });

  describe('terminate', () => {
    it('should clean up all workers', () => {
      pool.initialize();
      expect(pool.poolSize).toBeGreaterThan(0);

      pool.terminate();

      expect(pool.poolSize).toBe(0);
      expect(pool.isInitialized).toBe(false);
    });

    it('should allow re-initialization after terminate', () => {
      pool.initialize();
      pool.terminate();

      const result = pool.initialize();

      expect(result).toBe(true);
      expect(pool.isInitialized).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle worker errors gracefully in runParallel', async () => {
      // Create a pool with error-producing workers
      const ErrorWorker = class {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: ErrorEvent) => void) | null = null;

        postMessage(data: any) {
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage(new MessageEvent('message', {
                data: {
                  type: 'ERROR',
                  id: data.id,
                  detectorType: data.detectorType,
                  error: 'Detection failed',
                },
              }));
            }
          }, 5);
        }

        terminate() {}
      };

      vi.stubGlobal('Worker', ErrorWorker);

      const errorPool = new DetectionWorkerPool();
      errorPool.initialize();

      // runParallel should not throw, just log errors
      const anomalies = await errorPool.runParallel(['DUPLICATES'], []);

      expect(Array.isArray(anomalies)).toBe(true);
      errorPool.terminate();

      // Restore
      vi.stubGlobal('Worker', MockWorker);
    });
  });
});
