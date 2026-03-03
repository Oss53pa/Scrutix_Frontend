// ============================================================================
// SCRUTIX - Gateway Types
// Types pour le Premium AI Gateway
// ============================================================================

import type { AIProviderType } from '../types';

/**
 * Strategie de routage du gateway
 */
export type GatewayStrategy =
  | 'proph3t_only'       // Toujours utiliser PROPH3T (local)
  | 'premium_preferred'  // Premium si budget le permet, sinon PROPH3T
  | 'hybrid'             // Routage par type de tache
  | 'cost_optimized';    // Le moins cher possible

/**
 * Types de taches IA
 */
export type GatewayTaskType =
  | 'chat'
  | 'categorization'
  | 'detection'
  | 'report'
  | 'fraud'
  | 'embedding';

/**
 * Configuration du gateway
 */
export interface GatewayConfig {
  /** Strategie de routage */
  strategy: GatewayStrategy;
  /** Routage par tache (pour strategie 'hybrid') */
  taskRouting: Record<GatewayTaskType, AIProviderType | 'auto'>;
  /** Budget mensuel en XAF */
  monthlyBudgetXAF: number;
  /** Seuil d'alerte (0-1, ex: 0.75 = alerte a 75%) */
  alertThreshold: number;
  /** Basculer automatiquement sur PROPH3T a l'atteinte du seuil */
  autoFallback: boolean;
}

/**
 * Configuration par defaut du gateway
 */
export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  strategy: 'proph3t_only',
  taskRouting: {
    chat: 'auto',
    categorization: 'auto',
    detection: 'auto',
    report: 'auto',
    fraud: 'auto',
    embedding: 'ollama',
  },
  monthlyBudgetXAF: 50000,
  alertThreshold: 0.75,
  autoFallback: true,
};

/**
 * Enregistrement d'utilisation
 */
export interface GatewayUsageRecord {
  /** Identifiant unique */
  id: string;
  /** Fournisseur utilise */
  provider: AIProviderType;
  /** Modele utilise */
  model: string;
  /** Type de tache */
  taskType: GatewayTaskType;
  /** Tokens d'entree */
  inputTokens: number;
  /** Tokens de sortie */
  outputTokens: number;
  /** Cout en USD */
  costUSD: number;
  /** Cout en XAF */
  costXAF: number;
  /** Date */
  timestamp: number;
  /** Mois (YYYY-MM) */
  month: string;
}

/**
 * Status du budget
 */
export interface GatewayBudgetStatus {
  /** Budget mensuel en XAF */
  monthlyBudgetXAF: number;
  /** Depenses du mois en XAF */
  usedXAF: number;
  /** Restant en XAF */
  remainingXAF: number;
  /** Pourcentage utilise (0-1) */
  usedPercent: number;
  /** Seuil d'alerte atteint */
  alertTriggered: boolean;
  /** Budget depasse */
  budgetExceeded: boolean;
  /** Mois en cours (YYYY-MM) */
  currentMonth: string;
}

/**
 * Labels des strategies
 */
export const GATEWAY_STRATEGY_LABELS: Record<GatewayStrategy, { label: string; description: string }> = {
  proph3t_only: {
    label: 'PROPH3T uniquement',
    description: 'Toutes les taches sont traitees localement par PROPH3T (gratuit)',
  },
  premium_preferred: {
    label: 'Premium prefere',
    description: 'Utilise les providers premium tant que le budget le permet, puis PROPH3T',
  },
  hybrid: {
    label: 'Hybride',
    description: 'Routage personnalise par type de tache (ex: rapports via Claude, chat via PROPH3T)',
  },
  cost_optimized: {
    label: 'Cout optimise',
    description: 'Choisit automatiquement le provider le moins cher pour chaque tache',
  },
};
