/**
 * @module AtlasBanx
 * @file src/ml/index.ts
 * @description Barrel export de la couche ML/statistique (Bloc 1).
 */

export { StatisticalDetectionEngine } from './StatisticalDetectionEngine';
export { IsolationForestDetector } from './detectors/IsolationForestDetector';
export { ZScoreAnalyzer } from './detectors/ZScoreAnalyzer';
export type { ZScoreFinding } from './detectors/ZScoreAnalyzer';
export { BenfordLawChecker } from './detectors/BenfordLawChecker';
export { FrequencyPatternDetector } from './detectors/FrequencyPatternDetector';

export type {
  TransactionFeatureVector,
  AnomalyScore,
  BenfordResult,
  PatternResult,
  StatisticalAnomaly,
  StatisticalReport,
  StatisticalDetectorName,
  ClientHistory,
  ModelMetrics,
} from './types';
