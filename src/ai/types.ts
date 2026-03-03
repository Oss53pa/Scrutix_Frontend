// ============================================================================
// SCRUTIX - AI Types
// Types et interfaces pour l'abstraction multi-fournisseur IA
// ============================================================================

import { Transaction, Anomaly, AnomalyType, BankConditions, TransactionType } from '../types';

// ----------------------------------------------------------------------------
// AI Provider Types
// ----------------------------------------------------------------------------

/**
 * Fournisseurs d'IA supportés
 */
export type AIProviderType = 'claude' | 'openai' | 'mistral' | 'ollama' | 'custom' | 'gemini' | 'deepseek';

/**
 * Labels des fournisseurs
 */
export const AI_PROVIDER_LABELS: Record<AIProviderType, string> = {
  claude: 'Anthropic Claude',
  openai: 'OpenAI GPT',
  mistral: 'Mistral AI',
  ollama: 'Ollama (Local)',
  custom: 'Personnalisé',
  gemini: 'Google Gemini',
  deepseek: 'DeepSeek',
};

/**
 * Modèle IA disponible
 */
export interface AIModel {
  id: string;
  name: string;
  provider: AIProviderType;
  contextWindow: number;
  maxOutputTokens: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  costPer1kInput?: number;  // USD
  costPer1kOutput?: number; // USD
  isDefault?: boolean;
}

/**
 * Modèles par fournisseur
 */
export const AI_MODELS: Record<AIProviderType, AIModel[]> = {
  claude: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'claude', contextWindow: 200000, maxOutputTokens: 8192, supportsVision: true, isDefault: true },
    { id: 'claude-opus-4-1-20250414', name: 'Claude Opus 4', provider: 'claude', contextWindow: 200000, maxOutputTokens: 8192, supportsVision: true },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'claude', contextWindow: 200000, maxOutputTokens: 8192, supportsVision: true },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'claude', contextWindow: 200000, maxOutputTokens: 4096, supportsVision: true },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000, maxOutputTokens: 16384, supportsVision: true, isDefault: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128000, maxOutputTokens: 16384, supportsVision: true },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', contextWindow: 128000, maxOutputTokens: 4096, supportsVision: true },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', contextWindow: 16385, maxOutputTokens: 4096 },
  ],
  mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral', contextWindow: 128000, maxOutputTokens: 8192, isDefault: true },
    { id: 'mistral-medium-latest', name: 'Mistral Medium', provider: 'mistral', contextWindow: 32000, maxOutputTokens: 8192 },
    { id: 'mistral-small-latest', name: 'Mistral Small', provider: 'mistral', contextWindow: 32000, maxOutputTokens: 8192 },
    { id: 'codestral-latest', name: 'Codestral', provider: 'mistral', contextWindow: 32000, maxOutputTokens: 8192 },
  ],
  ollama: [
    { id: 'llama3.1:70b', name: 'Llama 3.1 70B', provider: 'ollama', contextWindow: 128000, maxOutputTokens: 8192, isDefault: true },
    { id: 'llama3.1:8b', name: 'Llama 3.1 8B', provider: 'ollama', contextWindow: 128000, maxOutputTokens: 8192 },
    { id: 'mistral:7b', name: 'Mistral 7B', provider: 'ollama', contextWindow: 32000, maxOutputTokens: 4096 },
    { id: 'codellama:34b', name: 'Code Llama 34B', provider: 'ollama', contextWindow: 16000, maxOutputTokens: 4096 },
  ],
  custom: [],
  gemini: [], // Phase 3 stub
  deepseek: [], // Phase 3 stub
};

/**
 * Configuration d'un fournisseur IA
 */
export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey?: string;
  apiKeyEncrypted?: string;
  model: string;
  baseUrl?: string;  // Pour Ollama ou API personnalisée
  temperature: number;
  maxTokens: number;
  timeout?: number;  // ms
  retryAttempts?: number;
}

/**
 * Configuration par défaut
 */
export const DEFAULT_AI_CONFIG: Omit<AIProviderConfig, 'apiKey'> = {
  provider: 'claude',
  model: 'claude-sonnet-4-20250514',
  temperature: 0.3,
  maxTokens: 4000,
  timeout: 60000,
  retryAttempts: 3,
};

// ----------------------------------------------------------------------------
// Chat Types
// ----------------------------------------------------------------------------

/**
 * Message de chat
 */
export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokensUsed?: number;
  model?: string;
}

/**
 * Options de chat
 */
export interface AIChatOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  context?: AIChatContext;
}

/**
 * Contexte de chat pour l'audit bancaire
 */
export interface AIChatContext {
  transactions?: Transaction[];
  anomalies?: Anomaly[];
  clientName?: string;
  bankConditions?: BankConditions;
  period?: { start: Date; end: Date };
  ragContext?: {
    text: string;
    sources: Array<{ title: string; source: string }>;
  };
}

/**
 * Réponse de chat
 */
export interface AIChatResponse {
  content: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  model: string;
  finishReason: 'stop' | 'length' | 'error';
}

// ----------------------------------------------------------------------------
// Detection Types
// ----------------------------------------------------------------------------

/**
 * Types de détection IA
 */
export enum AIDetectionType {
  // Détection de base
  DUPLICATES = 'duplicates',
  GHOST_FEES = 'ghost_fees',
  OVERCHARGES = 'overcharges',
  INTEREST_ERRORS = 'interest_errors',

  // Détection étendue
  VALUE_DATE = 'value_date',
  SUSPICIOUS = 'suspicious',
  COMPLIANCE = 'compliance',
  CASHFLOW = 'cashflow',
  RECONCILIATION = 'reconciliation',
  MULTI_BANK = 'multi_bank',
  OHADA = 'ohada',
  AML_LCB_FT = 'aml_lcb_ft',
  FEES = 'fees',
}

/**
 * Labels des types de détection
 */
export const AI_DETECTION_LABELS: Record<AIDetectionType, { label: string; icon: string; description: string }> = {
  // Base
  [AIDetectionType.DUPLICATES]: { label: 'Doublons', icon: '🔄', description: 'Détection de transactions en double' },
  [AIDetectionType.GHOST_FEES]: { label: 'Frais fantômes', icon: '👻', description: 'Frais sans justification apparente' },
  [AIDetectionType.OVERCHARGES]: { label: 'Surfacturation', icon: '📈', description: 'Frais excessifs par rapport aux conditions' },
  [AIDetectionType.INTEREST_ERRORS]: { label: 'Erreurs d\'agios', icon: '💰', description: 'Calculs d\'intérêts incorrects' },
  // Étendue
  [AIDetectionType.VALUE_DATE]: { label: 'Dates valeur', icon: '📅', description: 'Anomalies sur les dates de valeur' },
  [AIDetectionType.SUSPICIOUS]: { label: 'Suspect', icon: '🔍', description: 'Transactions suspectes ou inhabituelles' },
  [AIDetectionType.COMPLIANCE]: { label: 'Conformité', icon: '⚠️', description: 'Violations des conditions contractuelles' },
  [AIDetectionType.CASHFLOW]: { label: 'Trésorerie', icon: '💵', description: 'Anomalies de flux de trésorerie' },
  [AIDetectionType.RECONCILIATION]: { label: 'Rapprochement', icon: '🔗', description: 'Écarts de rapprochement bancaire' },
  [AIDetectionType.MULTI_BANK]: { label: 'Multi-banques', icon: '🏦', description: 'Incohérences entre plusieurs banques' },
  [AIDetectionType.OHADA]: { label: 'OHADA', icon: '📋', description: 'Conformité aux normes OHADA' },
  [AIDetectionType.AML_LCB_FT]: { label: 'LCB-FT', icon: '🚨', description: 'Alertes anti-blanchiment' },
  [AIDetectionType.FEES]: { label: 'Frais', icon: '🧾', description: 'Analyse complète des frais bancaires' },
};

/**
 * Mapping entre AIDetectionType et AnomalyType
 */
export const DETECTION_TO_ANOMALY_MAP: Record<AIDetectionType, AnomalyType> = {
  [AIDetectionType.DUPLICATES]: AnomalyType.DUPLICATE_FEE,
  [AIDetectionType.GHOST_FEES]: AnomalyType.GHOST_FEE,
  [AIDetectionType.OVERCHARGES]: AnomalyType.OVERCHARGE,
  [AIDetectionType.INTEREST_ERRORS]: AnomalyType.INTEREST_ERROR,
  [AIDetectionType.VALUE_DATE]: AnomalyType.VALUE_DATE_ERROR,
  [AIDetectionType.SUSPICIOUS]: AnomalyType.SUSPICIOUS_TRANSACTION,
  [AIDetectionType.COMPLIANCE]: AnomalyType.COMPLIANCE_VIOLATION,
  [AIDetectionType.CASHFLOW]: AnomalyType.CASHFLOW_ANOMALY,
  [AIDetectionType.RECONCILIATION]: AnomalyType.RECONCILIATION_GAP,
  [AIDetectionType.MULTI_BANK]: AnomalyType.MULTI_BANK_ISSUE,
  [AIDetectionType.OHADA]: AnomalyType.OHADA_NON_COMPLIANCE,
  [AIDetectionType.AML_LCB_FT]: AnomalyType.AML_ALERT,
  [AIDetectionType.FEES]: AnomalyType.FEE_ANOMALY,
};

/**
 * Configuration de détection
 */
export interface AIDetectionConfig {
  enabledTypes: AIDetectionType[];
  temperature: number;
  maxTokens: number;
  batchSize: number;
  includeRegulatoryReferences: boolean;
  region?: 'CEMAC' | 'UEMOA';
}

/**
 * Configuration par défaut de détection
 */
export const DEFAULT_DETECTION_CONFIG: AIDetectionConfig = {
  enabledTypes: [
    AIDetectionType.DUPLICATES,
    AIDetectionType.GHOST_FEES,
    AIDetectionType.OVERCHARGES,
    AIDetectionType.INTEREST_ERRORS,
  ],
  temperature: 0.3,
  maxTokens: 4000,
  batchSize: 50,
  includeRegulatoryReferences: true,
};

/**
 * Résultat d'une détection IA
 */
export interface AIDetectionResult {
  type: AIDetectionType;
  anomalies: Anomaly[];
  summary: string;
  tokensUsed: number;
  processingTime: number;
  confidence: number;
}

// ----------------------------------------------------------------------------
// Categorization Types
// ----------------------------------------------------------------------------

/**
 * Résultat de catégorisation
 */
export interface AICategoryResult {
  transactionId: string;
  category: string;
  confidence: number;
  type: TransactionType;
  subCategory?: string;
}

// ----------------------------------------------------------------------------
// Fraud Detection Types
// ----------------------------------------------------------------------------

/**
 * Analyse de fraude
 */
export interface AIFraudAnalysis {
  transactionId: string;
  isSuspicious: boolean;
  riskScore: number;  // 0-1
  reasons: string[];
  recommendation: string;
  patterns?: string[];
}

// ----------------------------------------------------------------------------
// Report Generation Types
// ----------------------------------------------------------------------------

/**
 * Contenu de rapport généré par IA
 */
export interface AIReportContent {
  title: string;
  executiveSummary: string;
  keyFindings: string[];
  detailedAnalysis: string;
  recommendations: string[];
  conclusion: string;
  regulatoryReferences?: string[];
}

/**
 * Données pour génération de rapport
 */
export interface AIReportData {
  clientName: string;
  period: { start: Date; end: Date };
  anomalies: Anomaly[];
  statistics: {
    totalTransactions: number;
    totalAmount: number;
    potentialSavings: number;
  };
  bankConditions?: BankConditions;
}

// ----------------------------------------------------------------------------
// Usage & Statistics
// ----------------------------------------------------------------------------

/**
 * Statistiques d'utilisation IA
 */
export interface AIUsageStats {
  provider: AIProviderType;
  totalRequests: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCost: number;  // USD
  lastRequestAt?: Date;
  monthlyLimit?: number;
  monthlyUsed?: number;
}

/**
 * Métriques de performance
 */
export interface AIPerformanceMetrics {
  averageLatency: number;  // ms
  successRate: number;     // 0-1
  errorCount: number;
  lastErrors: AIError[];
}

// ----------------------------------------------------------------------------
// Error Types
// ----------------------------------------------------------------------------

/**
 * Codes d'erreur IA
 */
export type AIErrorCode =
  | 'NETWORK'
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'INVALID_REQUEST'
  | 'SERVER'
  | 'CONTENT_FILTER'
  | 'CONTEXT_LENGTH'
  | 'UNKNOWN';

/**
 * Erreur IA
 */
export interface AIError {
  code: AIErrorCode;
  message: string;
  provider: AIProviderType;
  timestamp: Date;
  statusCode?: number;
  retryAfter?: number;
  isRetryable: boolean;
}

/**
 * Messages d'erreur en français
 */
export const AI_ERROR_MESSAGES: Record<AIErrorCode, string> = {
  NETWORK: 'Erreur de connexion. Vérifiez votre accès internet.',
  AUTH: 'Clé API invalide ou expirée. Veuillez vérifier vos paramètres.',
  RATE_LIMIT: 'Limite d\'appels API atteinte. Veuillez patienter.',
  TIMEOUT: 'Délai d\'attente dépassé. L\'opération a pris trop de temps.',
  INVALID_REQUEST: 'Requête invalide. Contactez le support si le problème persiste.',
  SERVER: 'Erreur serveur. Réessayez dans quelques instants.',
  CONTENT_FILTER: 'Le contenu a été filtré par les règles de sécurité.',
  CONTEXT_LENGTH: 'Le contexte dépasse la limite du modèle.',
  UNKNOWN: 'Une erreur inattendue s\'est produite.',
};

// ----------------------------------------------------------------------------
// Provider Interface
// ----------------------------------------------------------------------------

/**
 * Interface abstraite pour les fournisseurs IA
 */
export interface IAIProvider {
  // Identification
  readonly name: string;
  readonly type: AIProviderType;
  readonly models: AIModel[];

  // Configuration
  configure(config: AIProviderConfig): void;
  getConfig(): AIProviderConfig;
  testConnection(): Promise<{ valid: boolean; error?: string }>;

  // Chat
  chat(messages: AIChatMessage[], options?: AIChatOptions): Promise<AIChatResponse>;

  // Complétion simple
  complete(prompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<string>;

  // Fonctionnalités d'audit bancaire
  categorizeTransactions(transactions: Transaction[], existingCategories?: string[]): Promise<AICategoryResult[]>;
  detectAnomalies(transactions: Transaction[], type: AIDetectionType, context?: { bankConditions?: BankConditions }): Promise<Anomaly[]>;
  analyzeFraud(transactions: Transaction[], existingAnomalies?: Anomaly[]): Promise<AIFraudAnalysis[]>;
  generateReport(data: AIReportData): Promise<AIReportContent>;

  // Usage
  getUsage(): AIUsageStats;
  getLastTokensUsed(): { input: number; output: number } | null;
}

// ----------------------------------------------------------------------------
// Feature Flags
// ----------------------------------------------------------------------------

/**
 * Fonctionnalités IA activables
 */
export interface AIFeatureFlags {
  // Principales
  categorization: boolean;
  fraudDetection: boolean;
  reportGeneration: boolean;
  chat: boolean;

  // Détection de base
  duplicates: boolean;
  ghostFees: boolean;
  overcharges: boolean;
  interestErrors: boolean;

  // Détection étendue
  valueDate: boolean;
  suspicious: boolean;
  compliance: boolean;
  cashflow: boolean;
  reconciliation: boolean;
  multiBank: boolean;
  ohada: boolean;
  amlLcbFt: boolean;
  fees: boolean;
}

/**
 * Flags par défaut
 */
export const DEFAULT_AI_FEATURES: AIFeatureFlags = {
  // Principales - activées
  categorization: true,
  fraudDetection: true,
  reportGeneration: true,
  chat: true,
  // Base - activées
  duplicates: true,
  ghostFees: true,
  overcharges: true,
  interestErrors: true,
  // Étendues - désactivées par défaut
  valueDate: false,
  suspicious: false,
  compliance: false,
  cashflow: false,
  reconciliation: false,
  multiBank: false,
  ohada: false,
  amlLcbFt: false,
  fees: false,
};

// ----------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------

/**
 * Configuration complète IA pour le store
 */
export interface AISettings {
  // Provider
  provider: AIProviderConfig;

  // Features
  features: AIFeatureFlags;

  // Detection
  detection: AIDetectionConfig;

  // Usage
  usage: AIUsageStats;

  // State
  isConfigured: boolean;
  lastTestedAt?: Date;
  lastError?: AIError;
}

/**
 * Configuration par défaut complète
 */
export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: {
    ...DEFAULT_AI_CONFIG,
    apiKey: '',
  },
  features: DEFAULT_AI_FEATURES,
  detection: DEFAULT_DETECTION_CONFIG,
  usage: {
    provider: 'claude',
    totalRequests: 0,
    totalTokensInput: 0,
    totalTokensOutput: 0,
    totalCost: 0,
  },
  isConfigured: false,
};
