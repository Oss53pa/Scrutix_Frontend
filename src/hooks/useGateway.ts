// ============================================================================
// SCRUTIX - useGateway Hook
// Hook React pour le Premium AI Gateway
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSettingsStore } from '../store';
import { PremiumGateway } from '../ai/gateway/PremiumGateway';
import { AIProviderFactory } from '../ai';
import type {
  GatewayStrategy,
  GatewayBudgetStatus,
  GatewayConfig,
} from '../ai/gateway/GatewayTypes';
import type { AIProviderType } from '../ai/types';

interface UseGatewayResult {
  /** Strategie actuelle */
  strategy: GatewayStrategy;
  /** Status du budget (null si pas encore charge) */
  budgetStatus: GatewayBudgetStatus | null;
  /** Utilisation par provider */
  usageByProvider: Record<string, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costXAF: number;
  }> | null;
  /** Changer la strategie */
  setStrategy: (strategy: GatewayStrategy) => void;
  /** Changer le budget mensuel */
  setBudget: (budgetXAF: number) => void;
  /** Changer le seuil d'alerte */
  setAlertThreshold: (threshold: number) => void;
  /** Toggle auto-fallback */
  setAutoFallback: (enabled: boolean) => void;
  /** Changer le routage par tache */
  setTaskRouting: (task: string, provider: AIProviderType | 'auto') => void;
  /** Rafraichir les donnees */
  refresh: () => Promise<void>;
  /** Configuration actuelle */
  config: GatewayConfig;
  /** Gateway est actif (pas proph3t_only) */
  isActive: boolean;
}

export function useGateway(): UseGatewayResult {
  const { gateway, updateGateway } = useSettingsStore();
  const [budgetStatus, setBudgetStatus] = useState<GatewayBudgetStatus | null>(null);
  const [usageByProvider, setUsageByProvider] = useState<Record<string, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costXAF: number;
  }> | null>(null);

  const isActive = useMemo(() => {
    return gateway.strategy !== 'proph3t_only';
  }, [gateway.strategy]);

  const refresh = useCallback(async () => {
    const gw = AIProviderFactory.getGateway();
    if (gw) {
      const status = await gw.getBudgetStatus();
      setBudgetStatus(status);
      const usage = await gw.getUsageByProvider();
      setUsageByProvider(usage);
    }
  }, []);

  // Configure gateway in factory and refresh on mount
  useEffect(() => {
    AIProviderFactory.configureGateway(gateway);
    refresh();
  }, [gateway, refresh]);

  const setStrategy = useCallback((strategy: GatewayStrategy) => {
    updateGateway({ strategy });
  }, [updateGateway]);

  const setBudget = useCallback((budgetXAF: number) => {
    updateGateway({ monthlyBudgetXAF: budgetXAF });
  }, [updateGateway]);

  const setAlertThreshold = useCallback((threshold: number) => {
    updateGateway({ alertThreshold: Math.max(0, Math.min(1, threshold)) });
  }, [updateGateway]);

  const setAutoFallback = useCallback((enabled: boolean) => {
    updateGateway({ autoFallback: enabled });
  }, [updateGateway]);

  const setTaskRouting = useCallback((task: string, provider: AIProviderType | 'auto') => {
    updateGateway({
      taskRouting: {
        ...gateway.taskRouting,
        [task]: provider,
      },
    });
  }, [gateway.taskRouting, updateGateway]);

  return {
    strategy: gateway.strategy,
    budgetStatus,
    usageByProvider,
    setStrategy,
    setBudget,
    setAlertThreshold,
    setAutoFallback,
    setTaskRouting,
    refresh,
    config: gateway,
    isActive,
  };
}

export default useGateway;
