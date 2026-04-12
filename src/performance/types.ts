/**
 * @module AtlasBanx
 * @file src/performance/types.ts
 * @description Types pour le module Performance & SLA (Bloc 6).
 * @author Atlas Studio
 * @version 1.0.0
 */

export interface PerformanceMetrics {
  /** Identifiant unique de l'analyse mesurée */
  analysisId: string;
  /** Nombre de transactions traitées */
  transactionCount: number;
  /** Temps total ms */
  totalMs: number;
  /** Décomposition par étape */
  steps: StepMetrics[];
  /** Throughput : transactions / seconde */
  throughput: number;
  /** Pic mémoire Web Worker estimé (MB) — navigator.deviceMemory si dispo */
  peakMemoryMb: number | null;
  /** Succès : pas d'erreur fatale */
  success: boolean;
  /** Date du run */
  timestamp: Date;
}

export interface StepMetrics {
  name: AnalysisStep;
  label: string;
  durationMs: number;
  /** % du temps total */
  percentage: number;
}

export type AnalysisStep =
  | 'import'
  | 'ocr'
  | 'deterministic'
  | 'ml'
  | 'ai_llm'
  | 'risk_score';

export const STEP_LABELS: Record<AnalysisStep, string> = {
  import: 'Import et validation',
  ocr: 'OCR et extraction',
  deterministic: 'Détection déterministe',
  ml: 'Analyse ML / statistique',
  ai_llm: 'Analyse IA / LLM',
  risk_score: 'Calcul Risk Score + rapport',
};

export const STEP_WEIGHT: Record<AnalysisStep, [number, number]> = {
  import:        [0, 10],
  ocr:           [10, 30],
  deterministic: [30, 55],
  ml:            [55, 70],
  ai_llm:        [70, 90],
  risk_score:    [90, 100],
};

export interface SlaThreshold {
  maxTransactions: number;
  maxDurationSeconds: number;
  label: string;
}

export const SLA_THRESHOLDS: readonly SlaThreshold[] = [
  { maxTransactions: 1000,  maxDurationSeconds: 30,  label: '< 1 000 tx → < 30 s' },
  { maxTransactions: 10000, maxDurationSeconds: 180, label: '1 000 – 10 000 tx → < 3 min' },
  { maxTransactions: 50000, maxDurationSeconds: 900, label: '10 000 – 50 000 tx → < 15 min' },
  { maxTransactions: 200000, maxDurationSeconds: 2700, label: '> 50 000 tx → < 45 min' },
];

export const SOFT_LIMIT_TRANSACTIONS = 50000;
export const HARD_LIMIT_TRANSACTIONS = 200000;
export const ANALYSIS_TIMEOUT_MS = 15 * 60 * 1000; // 15 min

export interface WorkerPoolConfig {
  /** Nombre de workers alloués */
  workerCount: number;
  /** Taille de chunk par worker */
  chunkSize: number;
  /** Nombre de cores CPU détectés */
  cpuCores: number;
}
