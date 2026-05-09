// ============================================================================
// CDC Architecture v1.0 — Barrel exports
// ============================================================================

// Types
export * from './types';

// Taxonomy
export { RUBRICS_TAXONOMY, RUBRIC_CATEGORIES } from './taxonomy/rubrics';
export type { RubricSeed } from './taxonomy/rubrics';

// Resolution
export { ResolutionEngine, ResolutionError } from './resolution/ResolutionEngine';
export type { CdcDataAccess } from './resolution/ResolutionEngine';
export { SupabaseCdcDao } from './resolution/SupabaseCdcDao';

// Calculations
export { AgiosCalculator } from './calculations/AgiosCalculator';
export type { AgiosConfig } from './calculations/AgiosCalculator';
export { CommissionCalculator } from './calculations/CommissionCalculator';
export type { OperationDebitrice, OperationType } from './calculations/CommissionCalculator';
export { CpfdCalculator } from './calculations/CpfdCalculator';
export { ValueDateAuditor } from './calculations/ValueDateAuditor';
export type { ValueDateOperation, ValueDateOperationType } from './calculations/ValueDateAuditor';

// Audit
export { CdcAuditOrchestrator } from './audit/CdcAuditOrchestrator';
export type { AuditInput, AuditOutput } from './audit/CdcAuditOrchestrator';

// Service
export { CdcService } from './services/CdcService';
