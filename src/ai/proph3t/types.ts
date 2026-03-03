// ============================================================================
// SCRUTIX - PROPH3T Engine Types
// Systeme de types pour le moteur IA multi-modele PROPH3T
// ============================================================================

import { AIDetectionType } from '../types';

// ----------------------------------------------------------------------------
// Model Roles
// ----------------------------------------------------------------------------

/**
 * Roles des modeles dans le moteur PROPH3T
 * Chaque role correspond a un type de tache specifique
 */
export type Proph3tModelRole = 'reasoning' | 'fast' | 'vision' | 'embedding';

/**
 * Configuration d'un slot de modele
 */
export interface Proph3tModelSlot {
  /** Nom du modele Ollama (ex: 'qwen2.5:14b') */
  name: string;
  /** Taille de la fenetre de contexte */
  contextWindow: number;
  /** Support du format JSON natif */
  supportsJson: boolean;
  /** Support de la vision (images) */
  supportsVision: boolean;
  /** Modele de repli si indisponible */
  fallbackRole?: Proph3tModelRole;
}

/**
 * Configuration complete du moteur PROPH3T
 */
export interface Proph3tConfig {
  /** URL de base d'Ollama */
  baseUrl: string;
  /** Map des modeles par role */
  models: Record<Proph3tModelRole, Proph3tModelSlot>;
  /** Timeout global en ms */
  timeout: number;
  /** Activer le mode JSON force */
  jsonMode: boolean;
  /** Actif ou non */
  enabled: boolean;
}

// ----------------------------------------------------------------------------
// Default Models
// ----------------------------------------------------------------------------

/**
 * Assignation par defaut des modeles par role
 */
export const DEFAULT_PROPH3T_MODELS: Record<Proph3tModelRole, Proph3tModelSlot> = {
  reasoning: {
    name: 'qwen2.5:14b',
    contextWindow: 32768,
    supportsJson: true,
    supportsVision: false,
    fallbackRole: 'fast',
  },
  fast: {
    name: 'qwen2.5:7b',
    contextWindow: 32768,
    supportsJson: true,
    supportsVision: false,
    fallbackRole: undefined,
  },
  vision: {
    name: 'llava:13b',
    contextWindow: 4096,
    supportsJson: false,
    supportsVision: true,
    fallbackRole: 'reasoning',
  },
  embedding: {
    name: 'nomic-embed-text',
    contextWindow: 8192,
    supportsJson: false,
    supportsVision: false,
    fallbackRole: undefined,
  },
};

// ----------------------------------------------------------------------------
// Detection Model Mapping
// ----------------------------------------------------------------------------

/**
 * Mapping de chaque type de detection IA vers un role de modele
 * Les taches complexes utilisent 'reasoning', les taches simples 'fast'
 */
export const DETECTION_MODEL_MAP: Record<AIDetectionType, Proph3tModelRole> = {
  [AIDetectionType.DUPLICATES]: 'fast',
  [AIDetectionType.GHOST_FEES]: 'fast',
  [AIDetectionType.OVERCHARGES]: 'reasoning',
  [AIDetectionType.INTEREST_ERRORS]: 'reasoning',
  [AIDetectionType.VALUE_DATE]: 'reasoning',
  [AIDetectionType.SUSPICIOUS]: 'reasoning',
  [AIDetectionType.COMPLIANCE]: 'reasoning',
  [AIDetectionType.CASHFLOW]: 'fast',
  [AIDetectionType.RECONCILIATION]: 'fast',
  [AIDetectionType.MULTI_BANK]: 'reasoning',
  [AIDetectionType.OHADA]: 'reasoning',
  [AIDetectionType.AML_LCB_FT]: 'reasoning',
  [AIDetectionType.FEES]: 'fast',
};

// ----------------------------------------------------------------------------
// Call Options & Response Types
// ----------------------------------------------------------------------------

/**
 * Options pour un appel PROPH3T
 */
export interface Proph3tCallOptions {
  /** Role a utiliser pour cet appel */
  role?: Proph3tModelRole;
  /** Forcer le format JSON dans la reponse */
  jsonMode?: boolean;
  /** Temperature (0-1) */
  temperature?: number;
  /** Nombre max de tokens en sortie */
  maxTokens?: number;
  /** Timeout specifique en ms */
  timeout?: number;
}

/**
 * Reponse JSON typee du moteur PROPH3T
 */
export interface Proph3tJsonResponse<T> {
  /** Donnees parsees */
  data: T;
  /** Modele utilise */
  model: string;
  /** Role utilise */
  role: Proph3tModelRole;
  /** Tokens consommes */
  tokens: {
    input: number;
    output: number;
  };
  /** Temps de traitement en ms */
  processingTime: number;
}

/**
 * Configuration par defaut du moteur PROPH3T
 */
export const DEFAULT_PROPH3T_CONFIG: Proph3tConfig = {
  baseUrl: 'http://localhost:11434',
  models: DEFAULT_PROPH3T_MODELS,
  timeout: 120000,
  jsonMode: true,
  enabled: false,
};
