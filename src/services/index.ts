// Scrutix Services

export { ImportService } from './ImportService';
export { OcrService } from './OcrService';
export type { OcrResult, OcrProgress } from './OcrService';
export { AnalysisService, getAnalysisService } from './AnalysisService';
export { ClaudeService, getClaudeService, hasClaudeService, clearClaudeService } from './ClaudeService';
export { ReportService } from './ReportService';
export { PrintService } from './PrintService';
export type { PrintOptions } from './PrintService';
export { BackupService, APP_VERSION } from './BackupService';
export type { BackupData, SettingsBackupData, FullBackupData, AnyBackupData } from './BackupService';

// AI Model Router
export {
  AIModelRouter,
  getAIModelRouter,
  resetAIModelRouter,
  getModelId,
  getTier,
  MODEL_CONFIGS,
  MODULE_CONFIGS,
  MODEL_ROUTING,
  MODULES_BY_CATEGORY,
} from './AIModelRouter';
export type {
  ModelTier,
  AnalysisModule,
  ModelConfig,
  ModuleConfig,
  CostEstimate,
  BatchCostEstimate,
} from './AIModelRouter';
