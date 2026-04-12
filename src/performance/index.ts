/**
 * @module AtlasBanx
 * @file src/performance/index.ts
 * @description Barrel export du module Performance & SLA (Bloc 6).
 */

export {
  PerformanceMonitor,
  getPerformanceMonitor,
} from './PerformanceMonitor';
export { WorkerPoolOptimizer } from './WorkerPoolOptimizer';

export {
  STEP_LABELS,
  STEP_WEIGHT,
  SLA_THRESHOLDS,
  SOFT_LIMIT_TRANSACTIONS,
  HARD_LIMIT_TRANSACTIONS,
  ANALYSIS_TIMEOUT_MS,
} from './types';

export type {
  PerformanceMetrics,
  StepMetrics,
  AnalysisStep,
  SlaThreshold,
  WorkerPoolConfig,
} from './types';
