import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Anomaly } from '../types';

interface ReportDraft {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  type: 'audit' | 'summary' | 'detailed' | 'recovery';
  period: {
    start: Date;
    end: Date;
  };
  selectedAnomalies: Anomaly[];
  confirmedAnomalies: Anomaly[];
  dismissedAnomalies: Anomaly[];
  contestedAnomalies: Anomaly[];
  notes: string;
  includeAIAnalysis: boolean;
  includeRecommendations: boolean;
  includeTransactionDetails: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface GeneratedReport {
  id: string;
  draftId: string;
  title: string;
  clientName: string;
  type: ReportDraft['type'];
  format: 'pdf' | 'excel';
  anomalyCount: number;
  totalAmount: number;
  generatedAt: Date;
  downloadUrl?: string;
  blobData?: Blob;
}

interface ReportStore {
  // Current draft
  currentDraft: ReportDraft | null;

  // Generated reports history
  generatedReports: GeneratedReport[];

  // Actions
  createDraft: (clientId: string, clientName: string) => void;
  updateDraft: (updates: Partial<ReportDraft>) => void;
  clearDraft: () => void;

  // Anomaly management
  addAnomalyToDraft: (anomaly: Anomaly) => void;
  removeAnomalyFromDraft: (anomalyId: string) => void;
  confirmAnomaly: (anomaly: Anomaly) => void;
  dismissAnomaly: (anomaly: Anomaly) => void;
  contestAnomaly: (anomaly: Anomaly) => void;

  // Bulk actions
  addAllAnomaliesToDraft: (anomalies: Anomaly[]) => void;
  confirmAllAnomalies: () => void;

  // Report generation
  addGeneratedReport: (report: GeneratedReport) => void;
  deleteGeneratedReport: (reportId: string) => void;

  // Selectors
  getSelectedAnomaliesCount: () => number;
  getTotalSelectedAmount: () => number;
  isAnomalyInDraft: (anomalyId: string) => boolean;
  getAnomalyStatus: (anomalyId: string) => 'selected' | 'confirmed' | 'dismissed' | 'contested' | null;
}

export const useReportStore = create<ReportStore>()(
  persist(
    (set, get) => ({
      currentDraft: null,
      generatedReports: [],

      createDraft: (clientId, clientName) => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        set({
          currentDraft: {
            id: `draft-${Date.now()}`,
            title: `Rapport d'audit - ${clientName}`,
            clientId,
            clientName,
            type: 'audit',
            period: {
              start: startOfMonth,
              end: now,
            },
            selectedAnomalies: [],
            confirmedAnomalies: [],
            dismissedAnomalies: [],
            contestedAnomalies: [],
            notes: '',
            includeAIAnalysis: true,
            includeRecommendations: true,
            includeTransactionDetails: true,
            createdAt: now,
            updatedAt: now,
          },
        });
      },

      updateDraft: (updates) =>
        set((state) => ({
          currentDraft: state.currentDraft
            ? { ...state.currentDraft, ...updates, updatedAt: new Date() }
            : null,
        })),

      clearDraft: () => set({ currentDraft: null }),

      addAnomalyToDraft: (anomaly) =>
        set((state) => {
          if (!state.currentDraft) {
            // Auto-create draft if none exists
            const now = new Date();
            return {
              currentDraft: {
                id: `draft-${Date.now()}`,
                title: 'Nouveau rapport d\'audit',
                clientId: anomaly.transactions[0]?.clientId || 'default',
                clientName: 'Client',
                type: 'audit',
                period: { start: now, end: now },
                selectedAnomalies: [anomaly],
                confirmedAnomalies: [],
                dismissedAnomalies: [],
                contestedAnomalies: [],
                notes: '',
                includeAIAnalysis: true,
                includeRecommendations: true,
                includeTransactionDetails: true,
                createdAt: now,
                updatedAt: now,
              },
            };
          }

          // Check if already in draft
          const exists = state.currentDraft.selectedAnomalies.some(a => a.id === anomaly.id);
          if (exists) return state;

          return {
            currentDraft: {
              ...state.currentDraft,
              selectedAnomalies: [...state.currentDraft.selectedAnomalies, anomaly],
              updatedAt: new Date(),
            },
          };
        }),

      removeAnomalyFromDraft: (anomalyId) =>
        set((state) => {
          if (!state.currentDraft) return state;
          return {
            currentDraft: {
              ...state.currentDraft,
              selectedAnomalies: state.currentDraft.selectedAnomalies.filter(a => a.id !== anomalyId),
              confirmedAnomalies: state.currentDraft.confirmedAnomalies.filter(a => a.id !== anomalyId),
              dismissedAnomalies: state.currentDraft.dismissedAnomalies.filter(a => a.id !== anomalyId),
              contestedAnomalies: state.currentDraft.contestedAnomalies.filter(a => a.id !== anomalyId),
              updatedAt: new Date(),
            },
          };
        }),

      confirmAnomaly: (anomaly) =>
        set((state) => {
          if (!state.currentDraft) return state;

          // Remove from other lists and add to confirmed
          const updatedDraft = {
            ...state.currentDraft,
            selectedAnomalies: state.currentDraft.selectedAnomalies.filter(a => a.id !== anomaly.id),
            dismissedAnomalies: state.currentDraft.dismissedAnomalies.filter(a => a.id !== anomaly.id),
            contestedAnomalies: state.currentDraft.contestedAnomalies.filter(a => a.id !== anomaly.id),
            confirmedAnomalies: [
              ...state.currentDraft.confirmedAnomalies.filter(a => a.id !== anomaly.id),
              { ...anomaly, status: 'confirmed' as const },
            ],
            updatedAt: new Date(),
          };

          return { currentDraft: updatedDraft };
        }),

      dismissAnomaly: (anomaly) =>
        set((state) => {
          if (!state.currentDraft) return state;

          const updatedDraft = {
            ...state.currentDraft,
            selectedAnomalies: state.currentDraft.selectedAnomalies.filter(a => a.id !== anomaly.id),
            confirmedAnomalies: state.currentDraft.confirmedAnomalies.filter(a => a.id !== anomaly.id),
            contestedAnomalies: state.currentDraft.contestedAnomalies.filter(a => a.id !== anomaly.id),
            dismissedAnomalies: [
              ...state.currentDraft.dismissedAnomalies.filter(a => a.id !== anomaly.id),
              { ...anomaly, status: 'dismissed' as const },
            ],
            updatedAt: new Date(),
          };

          return { currentDraft: updatedDraft };
        }),

      contestAnomaly: (anomaly) =>
        set((state) => {
          if (!state.currentDraft) return state;

          const updatedDraft = {
            ...state.currentDraft,
            selectedAnomalies: state.currentDraft.selectedAnomalies.filter(a => a.id !== anomaly.id),
            confirmedAnomalies: state.currentDraft.confirmedAnomalies.filter(a => a.id !== anomaly.id),
            dismissedAnomalies: state.currentDraft.dismissedAnomalies.filter(a => a.id !== anomaly.id),
            contestedAnomalies: [
              ...state.currentDraft.contestedAnomalies.filter(a => a.id !== anomaly.id),
              { ...anomaly, status: 'contested' as const },
            ],
            updatedAt: new Date(),
          };

          return { currentDraft: updatedDraft };
        }),

      addAllAnomaliesToDraft: (anomalies) =>
        set((state) => {
          if (!state.currentDraft) {
            const now = new Date();
            return {
              currentDraft: {
                id: `draft-${Date.now()}`,
                title: 'Nouveau rapport d\'audit',
                clientId: 'default',
                clientName: 'Client',
                type: 'audit',
                period: { start: now, end: now },
                selectedAnomalies: anomalies,
                confirmedAnomalies: [],
                dismissedAnomalies: [],
                contestedAnomalies: [],
                notes: '',
                includeAIAnalysis: true,
                includeRecommendations: true,
                includeTransactionDetails: true,
                createdAt: now,
                updatedAt: now,
              },
            };
          }

          // Merge, avoiding duplicates
          const existingIds = new Set(state.currentDraft.selectedAnomalies.map(a => a.id));
          const newAnomalies = anomalies.filter(a => !existingIds.has(a.id));

          return {
            currentDraft: {
              ...state.currentDraft,
              selectedAnomalies: [...state.currentDraft.selectedAnomalies, ...newAnomalies],
              updatedAt: new Date(),
            },
          };
        }),

      confirmAllAnomalies: () =>
        set((state) => {
          if (!state.currentDraft) return state;

          return {
            currentDraft: {
              ...state.currentDraft,
              confirmedAnomalies: [
                ...state.currentDraft.confirmedAnomalies,
                ...state.currentDraft.selectedAnomalies.map(a => ({ ...a, status: 'confirmed' as const })),
              ],
              selectedAnomalies: [],
              updatedAt: new Date(),
            },
          };
        }),

      addGeneratedReport: (report) =>
        set((state) => ({
          generatedReports: [report, ...state.generatedReports],
        })),

      deleteGeneratedReport: (reportId) =>
        set((state) => ({
          generatedReports: state.generatedReports.filter(r => r.id !== reportId),
        })),

      getSelectedAnomaliesCount: () => {
        const draft = get().currentDraft;
        if (!draft) return 0;
        return draft.selectedAnomalies.length + draft.confirmedAnomalies.length + draft.contestedAnomalies.length;
      },

      getTotalSelectedAmount: () => {
        const draft = get().currentDraft;
        if (!draft) return 0;
        const allSelected = [
          ...draft.selectedAnomalies,
          ...draft.confirmedAnomalies,
          ...draft.contestedAnomalies,
        ];
        return allSelected.reduce((sum, a) => sum + a.amount, 0);
      },

      isAnomalyInDraft: (anomalyId) => {
        const draft = get().currentDraft;
        if (!draft) return false;
        return (
          draft.selectedAnomalies.some(a => a.id === anomalyId) ||
          draft.confirmedAnomalies.some(a => a.id === anomalyId) ||
          draft.dismissedAnomalies.some(a => a.id === anomalyId) ||
          draft.contestedAnomalies.some(a => a.id === anomalyId)
        );
      },

      getAnomalyStatus: (anomalyId) => {
        const draft = get().currentDraft;
        if (!draft) return null;
        if (draft.confirmedAnomalies.some(a => a.id === anomalyId)) return 'confirmed';
        if (draft.dismissedAnomalies.some(a => a.id === anomalyId)) return 'dismissed';
        if (draft.contestedAnomalies.some(a => a.id === anomalyId)) return 'contested';
        if (draft.selectedAnomalies.some(a => a.id === anomalyId)) return 'selected';
        return null;
      },
    }),
    {
      name: 'scrutix-reports',
    }
  )
);
