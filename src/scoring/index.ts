/**
 * @module AtlasBanx
 * @file src/scoring/index.ts
 * @description Barrel export du module Risk Score (Bloc 2).
 */

export { RiskScoreEngine } from './RiskScoreEngine';
export { RiskScoreHistory } from './RiskScoreHistory';
export { RiskScoreBenchmark, SECTOR_BENCHMARKS } from './RiskScoreBenchmark';
export type { BenchmarkEntry, CompanySize } from './RiskScoreBenchmark';

export {
  RISK_LEVEL_LABELS,
  RISK_LEVEL_DESCRIPTIONS,
  RISK_LEVEL_COLORS,
  DIMENSION_LABELS,
  DIMENSION_WEIGHTS,
} from './types';

export type {
  RiskLevel,
  RiskScore,
  RiskScoreInput,
  RiskScoreMetadata,
  RiskDimensions,
  RiskScoreHistoryEntry,
  RiskScoreHistoryRow,
} from './types';
