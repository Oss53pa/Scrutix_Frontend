import { describe, it, expect, vi } from 'vitest';
import { WorkerPoolOptimizer } from '../WorkerPoolOptimizer';

describe('WorkerPoolOptimizer', () => {
  it('returns at least 1 worker', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 1 });
    const cfg = WorkerPoolOptimizer.optimize(100);
    expect(cfg.workerCount).toBeGreaterThanOrEqual(1);
    vi.unstubAllGlobals();
  });

  it('caps workers at MAX_WORKERS even on many-core machines', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 32 });
    const cfg = WorkerPoolOptimizer.optimize(10000);
    expect(cfg.workerCount).toBeLessThanOrEqual(WorkerPoolOptimizer.MAX_WORKERS);
    vi.unstubAllGlobals();
  });

  it('computes chunk size between 100 and 1000', () => {
    const cfg = WorkerPoolOptimizer.optimize(5000);
    expect(cfg.chunkSize).toBeGreaterThanOrEqual(100);
    expect(cfg.chunkSize).toBeLessThanOrEqual(1000);
  });

  it('allows up to soft limit without warning', () => {
    const r = WorkerPoolOptimizer.checkLimits(40000);
    expect(r.allowed).toBe(true);
    expect(r.warning).toBe(false);
  });

  it('warns between soft and hard limit', () => {
    const r = WorkerPoolOptimizer.checkLimits(75000);
    expect(r.allowed).toBe(true);
    expect(r.warning).toBe(true);
  });

  it('rejects beyond hard limit', () => {
    const r = WorkerPoolOptimizer.checkLimits(250000);
    expect(r.allowed).toBe(false);
    expect(r.message).toContain('200');
  });

  it('formats time estimates in seconds / minutes', () => {
    expect(WorkerPoolOptimizer.formatEstimate(100)).toContain('secondes');
    expect(WorkerPoolOptimizer.formatEstimate(500000)).toContain('minutes');
  });
});
