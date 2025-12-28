import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Anomaly, AnalysisResult, AnalysisStatus, AnomalyType, Severity, FilterState, SortState } from '../types';

interface AnalysisStore {
  // State
  currentAnalysis: AnalysisResult | null;
  analysisHistory: AnalysisResult[];
  isAnalyzing: boolean;
  progress: number;
  currentStep: string;

  // Filters and sorting
  filters: FilterState;
  sort: SortState;

  // Actions
  startAnalysis: (config: AnalysisResult['config']) => void;
  updateProgress: (progress: number, step?: string) => void;
  completeAnalysis: (result: AnalysisResult) => void;
  failAnalysis: (error: string) => void;
  resetAnalysis: () => void;

  // Anomaly actions
  updateAnomalyStatus: (id: string, status: Anomaly['status'], notes?: string) => void;
  dismissAnomaly: (id: string) => void;
  confirmAnomaly: (id: string) => void;
  contestAnomaly: (id: string, notes: string) => void;

  // Filter actions
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  setSort: (sort: SortState) => void;

  // Selectors
  getFilteredAnomalies: () => Anomaly[];
  getAnomalyById: (id: string) => Anomaly | undefined;
  getAnomaliesByType: (type: AnomalyType) => Anomaly[];
  getAnomaliesBySeverity: (severity: Severity) => Anomaly[];
  getTotalPotentialSavings: () => number;
  getConfirmedSavings: () => number;
}

const defaultFilters: FilterState = {
  search: '',
  anomalyTypes: [],
  severities: [],
  dateRange: { start: null, end: null },
  amountRange: { min: null, max: null },
  status: [],
};

const defaultSort: SortState = {
  field: 'amount',
  direction: 'desc',
};

export const useAnalysisStore = create<AnalysisStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentAnalysis: null,
      analysisHistory: [],
      isAnalyzing: false,
      progress: 0,
      currentStep: '',
      filters: defaultFilters,
      sort: defaultSort,

      // Actions
      startAnalysis: (config) =>
        set({
          currentAnalysis: {
            id: `analysis-${Date.now()}`,
            config,
            status: AnalysisStatus.RUNNING,
            progress: 0,
            anomalies: [],
            statistics: {
              totalTransactions: 0,
              totalAmount: 0,
              totalAnomalies: 0,
              totalAnomalyAmount: 0,
              anomaliesByType: {} as Record<AnomalyType, number>,
              anomaliesBySeverity: {} as Record<Severity, number>,
              anomalyRate: 0,
              potentialSavings: 0,
            },
            summary: {
              status: 'OK',
              message: '',
              keyFindings: [],
              recommendations: [],
              estimatedRecovery: 0,
            },
            startedAt: new Date(),
          },
          isAnalyzing: true,
          progress: 0,
          currentStep: 'Initialisation...',
        }),

      updateProgress: (progress, step) =>
        set((state) => ({
          progress,
          currentStep: step || state.currentStep,
          currentAnalysis: state.currentAnalysis
            ? { ...state.currentAnalysis, progress }
            : null,
        })),

      completeAnalysis: (result) =>
        set((state) => ({
          currentAnalysis: {
            ...result,
            status: AnalysisStatus.COMPLETED,
            completedAt: new Date(),
          },
          analysisHistory: [
            { ...result, status: AnalysisStatus.COMPLETED, completedAt: new Date() },
            ...state.analysisHistory.slice(0, 9), // Keep last 10 analyses
          ],
          isAnalyzing: false,
          progress: 100,
          currentStep: 'Analyse terminée',
        })),

      failAnalysis: (error) =>
        set((state) => ({
          currentAnalysis: state.currentAnalysis
            ? {
                ...state.currentAnalysis,
                status: AnalysisStatus.FAILED,
                error,
                completedAt: new Date(),
              }
            : null,
          isAnalyzing: false,
          currentStep: 'Erreur',
        })),

      resetAnalysis: () =>
        set({
          currentAnalysis: null,
          isAnalyzing: false,
          progress: 0,
          currentStep: '',
        }),

      // Anomaly actions
      updateAnomalyStatus: (id, status, notes) =>
        set((state) => {
          if (!state.currentAnalysis) return state;

          return {
            currentAnalysis: {
              ...state.currentAnalysis,
              anomalies: state.currentAnalysis.anomalies.map((a) =>
                a.id === id
                  ? {
                      ...a,
                      status,
                      notes: notes || a.notes,
                      reviewedAt: new Date(),
                    }
                  : a
              ),
            },
          };
        }),

      dismissAnomaly: (id) => get().updateAnomalyStatus(id, 'dismissed'),
      confirmAnomaly: (id) => get().updateAnomalyStatus(id, 'confirmed'),
      contestAnomaly: (id, notes) => get().updateAnomalyStatus(id, 'contested', notes),

      // Filter actions
      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),

      resetFilters: () => set({ filters: defaultFilters }),

      setSort: (sort) => set({ sort }),

      // Selectors
      getFilteredAnomalies: () => {
        const { currentAnalysis, filters, sort } = get();
        if (!currentAnalysis) return [];

        let anomalies = [...currentAnalysis.anomalies];

        // Apply filters
        if (filters.search) {
          const search = filters.search.toLowerCase();
          anomalies = anomalies.filter(
            (a) =>
              a.recommendation.toLowerCase().includes(search) ||
              a.transactions.some((t) => t.description.toLowerCase().includes(search))
          );
        }

        if (filters.anomalyTypes.length > 0) {
          anomalies = anomalies.filter((a) => filters.anomalyTypes.includes(a.type));
        }

        if (filters.severities.length > 0) {
          anomalies = anomalies.filter((a) => filters.severities.includes(a.severity));
        }

        if (filters.status.length > 0) {
          anomalies = anomalies.filter((a) => filters.status.includes(a.status));
        }

        if (filters.amountRange.min !== null) {
          anomalies = anomalies.filter((a) => a.amount >= filters.amountRange.min!);
        }

        if (filters.amountRange.max !== null) {
          anomalies = anomalies.filter((a) => a.amount <= filters.amountRange.max!);
        }

        if (filters.dateRange.start) {
          anomalies = anomalies.filter((a) => new Date(a.detectedAt) >= filters.dateRange.start!);
        }

        if (filters.dateRange.end) {
          anomalies = anomalies.filter((a) => new Date(a.detectedAt) <= filters.dateRange.end!);
        }

        // Apply sorting
        anomalies.sort((a, b) => {
          let comparison = 0;

          switch (sort.field) {
            case 'amount':
              comparison = a.amount - b.amount;
              break;
            case 'severity':
              const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
              comparison = severityOrder[a.severity] - severityOrder[b.severity];
              break;
            case 'confidence':
              comparison = a.confidence - b.confidence;
              break;
            case 'date':
              comparison = new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime();
              break;
            case 'type':
              comparison = a.type.localeCompare(b.type);
              break;
            default:
              comparison = 0;
          }

          return sort.direction === 'asc' ? comparison : -comparison;
        });

        return anomalies;
      },

      getAnomalyById: (id) =>
        get().currentAnalysis?.anomalies.find((a) => a.id === id),

      getAnomaliesByType: (type) =>
        get().currentAnalysis?.anomalies.filter((a) => a.type === type) || [],

      getAnomaliesBySeverity: (severity) =>
        get().currentAnalysis?.anomalies.filter((a) => a.severity === severity) || [],

      getTotalPotentialSavings: () =>
        get().currentAnalysis?.statistics.potentialSavings || 0,

      getConfirmedSavings: () =>
        get()
          .currentAnalysis?.anomalies.filter((a) => a.status === 'confirmed')
          .reduce((sum, a) => sum + a.amount, 0) || 0,
    }),
    {
      name: 'scrutix-analysis',
      partialize: (state) => ({
        analysisHistory: state.analysisHistory,
        currentAnalysis: state.currentAnalysis,
      }),
    }
  )
);
