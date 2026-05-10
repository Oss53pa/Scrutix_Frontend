// ============================================================================
// statement-detail — exports publics
// ============================================================================

export { StatementDetailPage, type StatementDetailPageProps } from './pages/StatementDetailPage';

// Tabs (utiles si on veut les wrap individuellement)
export { AnomaliesTab } from './components/AnomaliesTab/AnomaliesTab';
export { ReconciliationTab } from './components/ReconciliationTab/ReconciliationTab';
export { ReportTab } from './components/ReportTab/ReportTab';
export { SynthesisTab } from './components/SynthesisTab';
export { TransactionsTab } from './components/TransactionsTab';
export { TabsBar, type StatementTabKey } from './components/TabsBar';

// Hooks
export { useStatement, type UseStatementResult } from './hooks/useStatement';
export { useStatementAnalysis, type UseStatementAnalysisResult } from './hooks/useStatementAnalysis';
export { useStatementContext, type UseStatementContextResult } from './hooks/useStatementContext';
export { useAnomalies, type UseAnomaliesResult } from './hooks/useAnomalies';
export { useAnomalyActions, type UseAnomalyActionsResult } from './hooks/useAnomalyActions';
export { useReconciliation, type UseReconciliationResult } from './hooks/useReconciliation';
export { useReportGeneration, type UseReportGenerationResult } from './hooks/useReportGeneration';
export { useProphetChat } from './hooks/useProphetChat';

// API (utiles pour usage avancé / SSR / tests)
export * as statementApi from './api/statementApi';
export * as anomaliesApi from './api/anomaliesApi';
export * as reconciliationApi from './api/reconciliationApi';
export * as reportsApi from './api/reportsApi';

// Algos pure-TS testables
export { computeReconciliationDiscrepancies } from './reconciliation/computeReconciliation';
export { formatComplaintLetter } from './reports/formatComplaintLetter';
export {
  getAvailableActions,
  getWorkflowSteps,
  requiredFinalStatus,
  isFullyRatified,
} from './workflow/anomalyActions';

// Types
export type * from './types/statement.types';
