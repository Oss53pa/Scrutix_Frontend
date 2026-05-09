// AtlasBanx Services

// Audit Trail (immutable event log + integrity certificates)
export {
  AuditTrailService,
  getAuditTrailService,
  auditLog,
  auditLogCritical,
  generateIntegrityCertificate,
  formatCertificateForPdf,
  AuditEventType,
} from './auditTrail';
export type {
  AuditEventInput,
  AuditEntry,
  AuditResourceType,
  AuditAction,
  IntegrityReport,
  IntegrityCertificate,
} from './auditTrail';

export { ImportService } from './ImportService';
export { OcrService } from './OcrService';
export type { OcrResult, OcrProgress } from './OcrService';
export { AnalysisService, getAnalysisService } from './AnalysisService';
export { ClaudeService, getClaudeService, hasClaudeService, clearClaudeService } from './ClaudeService';
export { ReportService } from './ReportService';
export { PremiumReportService } from './PremiumReportService';
export type { PremiumReportData } from './PremiumReportService';
export { BankConditionsResolver, gridToBankConditions } from './BankConditionsResolver';
export type { ResolutionInput, ResolutionResult } from './BankConditionsResolver';
export {
  computeDistribution,
  detectOutliers,
  computeCoverage,
  computeAggressiveness,
  computeCostBasket,
  simulateMigration,
  forecastTrend,
  forecastBank,
  getActiveGrid,
  getNumericValue,
  getZone,
  PROFILE_BASKETS,
  quantile,
  pearson,
} from './conditionsAnalytics';
export type {
  RubricRef,
  Distribution,
  Outlier,
  CoverageStats,
  AggressivenessScore,
  ClientProfile,
  BasketResult,
  MigrationResult,
  TrendForecast,
} from './conditionsAnalytics';
export {
  REGULATORY_LIMITS,
  checkBankCompliance,
  checkCohortCompliance,
} from './regulatoryCompliance';
export type {
  Regulator,
  RegulatoryLimit,
  Violation,
  ComplianceReport,
} from './regulatoryCompliance';
export {
  generateExecutiveSummary,
  analyzeBenchmarkSection,
  answerNaturalLanguageQ,
  produceFullReportNarrative,
  summarizeCompliance,
} from './proph3tBenchmark';
export type {
  ExecutiveSummary,
  SectionInsight,
  NlqAnswer,
  ReportNarrative,
  SectionId as BenchmarkSectionId,
} from './proph3tBenchmark';
export { BenchmarkReportService } from './BenchmarkReportService';
export type { BenchmarkReportArgs } from './BenchmarkReportService';
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
