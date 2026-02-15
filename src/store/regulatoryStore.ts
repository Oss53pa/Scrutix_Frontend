import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  RegulatoryFetchService,
  RegulatoryRate,
  RegulatoryDocument,
} from '../services/RegulatoryFetchService';

interface RegulatoryState {
  // Données
  rates: RegulatoryRate[];
  documents: RegulatoryDocument[];

  // État
  lastUpdated: Date | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchData: (forceRefresh?: boolean) => Promise<void>;
  getRatesByZone: (zone: 'CEMAC' | 'UEMOA') => RegulatoryRate[];
  getUsuryRate: (zone: 'CEMAC' | 'UEMOA') => number;
  getRelevantDocuments: (anomalyType: string) => RegulatoryDocument[];
  checkUsuryViolation: (rate: number, zone: 'CEMAC' | 'UEMOA') => {
    isViolation: boolean;
    usuryRate: number;
    excess: number;
    reference?: RegulatoryDocument;
  };
}

export const useRegulatoryStore = create<RegulatoryState>()(
  persist(
    (set, get) => ({
      rates: [],
      documents: [],
      lastUpdated: null,
      isLoading: false,
      error: null,

      fetchData: async (forceRefresh = false) => {
        set({ isLoading: true, error: null });

        try {
          const result = await RegulatoryFetchService.fetchAll(forceRefresh);

          set({
            rates: result.rates,
            documents: result.documents,
            lastUpdated: result.lastUpdated,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Erreur de récupération',
            isLoading: false,
          });
        }
      },

      getRatesByZone: (zone: 'CEMAC' | 'UEMOA') => {
        const { rates } = get();
        const sources = zone === 'CEMAC' ? ['BEAC', 'COBAC'] : ['BCEAO', 'CB_UMOA'];
        return rates.filter(r => sources.includes(r.source));
      },

      getUsuryRate: (zone: 'CEMAC' | 'UEMOA') => {
        const { rates } = get();

        if (zone === 'UEMOA') {
          const baseRate = rates.find(
            r => r.source === 'BCEAO' && r.type === 'taux_directeur'
          );
          return baseRate ? Math.min(baseRate.value * 2, 15) : 15;
        } else {
          const tiao = rates.find(
            r => r.source === 'BEAC' && r.id === 'beac-tiao'
          );
          return tiao ? Math.min(tiao.value * 2, 15) : 15;
        }
      },

      getRelevantDocuments: (anomalyType: string) => {
        const { documents } = get();

        const keywordMap: Record<string, string[]> = {
          'DUPLICATE_FEE': ['frais', 'tarifs', 'transparence'],
          'GHOST_FEE': ['frais', 'transparence', 'affichage'],
          'OVERCHARGE': ['tarifs', 'plafond', 'conditions', 'usure'],
          'INTEREST_ERROR': ['taux', 'intérêt', 'usure', 'calcul'],
          'UNAUTHORIZED': ['réclamation', 'client', 'médiation'],
        };

        const keywords = keywordMap[anomalyType] || [];

        return documents.filter(doc =>
          doc.keywords.some(k => keywords.includes(k))
        );
      },

      checkUsuryViolation: (rate: number, zone: 'CEMAC' | 'UEMOA') => {
        const { documents } = get();
        const usuryRate = get().getUsuryRate(zone);
        const isViolation = rate > usuryRate;

        const reference = documents.find(d =>
          d.keywords.includes('usure')
        );

        return {
          isViolation,
          usuryRate,
          excess: isViolation ? rate - usuryRate : 0,
          reference,
        };
      },
    }),
    {
      name: 'scrutix-regulatory-store',
      partialize: (state) => ({
        rates: state.rates,
        documents: state.documents,
        lastUpdated: state.lastUpdated,
      }),
    }
  )
);
