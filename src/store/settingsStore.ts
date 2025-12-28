import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BankConditions, DetectionThresholds, DEFAULT_THRESHOLDS } from '../types';
import type {
  AISettings,
  AIProviderConfig as NewAIProviderConfig,
  AIFeatureFlags,
  AIUsageStats,
} from '../ai/types';

// Types for custom regulatory sources
export interface CustomRegulatorySource {
  id: string;
  name: string;
  shortName: string;
  region: 'CEMAC' | 'UEMOA' | 'OTHER';
  type: 'central_bank' | 'regulator' | 'ministry' | 'professional' | 'other';
  baseUrl: string;
  searchUrl?: string;
  description: string;
  enabled: boolean;
  country?: string;
  createdAt: string;
}

// Types for AI providers
export type AIProviderType = 'claude' | 'openai' | 'mistral' | 'gemini' | 'ollama' | 'custom' | 'none';

export interface AIProviderConfig {
  enabled: boolean;
  apiKey: string;
  apiKeyIv?: string;
  baseUrl?: string; // For custom endpoints or Ollama
  model: string;
  temperature: number;
  maxTokens: number;
  // Provider-specific options
  organization?: string; // OpenAI org
  projectId?: string; // Google Cloud project
}

interface OrganizationSettings {
  // Informations du cabinet
  name: string;
  legalName: string;
  logo: string | null;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  website: string;
  // Identifiants légaux
  siret: string;
  rccm: string;
  nif: string; // Numéro d'identification fiscale
  // Email pour envoi automatique
  senderEmail: string;
  senderName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpSecure: boolean;
  // Pied de page des documents
  footerText: string;
  // Développé par
  developedBy: string;
}

interface SettingsStore {
  // Organization settings
  organization: OrganizationSettings;

  // Detection thresholds
  thresholds: DetectionThresholds;

  // Bank conditions
  bankConditions: BankConditions[];

  // Claude API configuration
  claudeApi: {
    apiKey: string;
    apiKeyIv: string;
    isEnabled: boolean;
    model: 'claude-sonnet-4-20250514' | 'claude-opus-4-1-20250414' | 'claude-3-5-sonnet-20241022' | 'claude-3-haiku-20240307';
    temperature: number;
    maxTokens: number;
    enableCategorization: boolean;
    enableFraudDetection: boolean;
    enableReportGeneration: boolean;
    enableChat: boolean;
    // Types de détection IA
    aiDetection: {
      duplicates: boolean;      // Doublons
      ghostFees: boolean;       // Frais fantômes
      overcharges: boolean;     // Surfacturation
      interestErrors: boolean;  // Erreurs d'agios
      valueDateErrors: boolean; // Erreurs dates de valeur
      suspiciousTransactions: boolean; // Opérations suspectes
      complianceViolations: boolean;   // Non-conformités
      cashflowAnomalies: boolean;      // Anomalies trésorerie
      reconciliationGaps: boolean;     // Écarts rapprochement
      multiBankIssues: boolean;        // Problèmes multi-banques
      ohadaCompliance: boolean;        // Conformité OHADA
      amlAlerts: boolean;              // Alertes LCB-FT
      feeAnomalies: boolean;           // Anomalies de frais (tous types)
    };
    usage: {
      totalTokensUsed: number;
      totalRequests: number;
      lastRequestAt: string | null;
      monthlyTokens: number;
      monthlyRequests: number;
      monthStart: string;
    };
    connectionStatus: 'unknown' | 'connected' | 'error';
    connectionError: string | null;
    lastConnectionTest: string | null;
  };

  // Detection modules configuration (algorithmic, not AI)
  detectionModules: {
    // Core detection
    duplicateFee: boolean;
    ghostFee: boolean;
    overcharge: boolean;
    interestError: boolean;
    // Extended detection
    valueDateError: boolean;
    suspiciousTransaction: boolean;
    complianceViolation: boolean;
    cashflowAnomaly: boolean;
    reconciliationGap: boolean;
    multiBankIssue: boolean;
    ohadaCompliance: boolean;
    amlAlert: boolean;
    // Fee category audits
    feeAnomaly: boolean;
  };

  // UI preferences
  preferences: {
    currency: string;
    locale: string;
    dateFormat: string;
    pageSize: number;
    showConfidenceScores: boolean;
    autoAnalyzeOnImport: boolean;
  };

  // Cloud backup configuration
  cloudBackup: {
    provider: 'google_drive' | 'none';
    isConnected: boolean;
    userEmail: string | null;
    userName: string | null;
    autoBackup: boolean;
    backupFrequency: 'daily' | 'weekly' | 'manual';
    lastBackupAt: string | null;
    lastBackupStatus: 'success' | 'failed' | null;
  };

  // Regulatory sources configuration
  regulatorySources: {
    enableReferences: boolean;
    region: 'CEMAC' | 'UEMOA' | 'all';
    sources: {
      beac: boolean;
      cobac: boolean;
      bceao: boolean;
      cb_umoa: boolean;
    };
    // Sources personnalisées
    customSources: CustomRegulatorySource[];
    lastSearchAt: string | null;
  };

  // Multi-AI Provider configuration
  aiProviders: {
    activeProvider: AIProviderType;
    providers: {
      claude: AIProviderConfig;
      openai: AIProviderConfig;
      mistral: AIProviderConfig;
      gemini: AIProviderConfig;
      ollama: AIProviderConfig;
      custom: AIProviderConfig;
    };
  };

  // Actions
  updateThresholds: (thresholds: Partial<DetectionThresholds>) => void;
  resetThresholds: () => void;

  addBankConditions: (conditions: BankConditions) => void;
  updateBankConditions: (id: string, updates: Partial<BankConditions>) => void;
  deleteBankConditions: (id: string) => void;

  updatePreferences: (prefs: Partial<SettingsStore['preferences']>) => void;
  resetPreferences: () => void;

  // Detection modules actions
  updateDetectionModules: (modules: Partial<SettingsStore['detectionModules']>) => void;
  resetDetectionModules: () => void;
  getEnabledDetectors: () => string[];

  // Claude API actions
  updateClaudeApi: (config: Partial<SettingsStore['claudeApi']>) => void;
  clearClaudeApiKey: () => void;
  updateClaudeUsage: (tokensUsed: number) => void;
  resetMonthlyUsage: () => void;
  setConnectionStatus: (status: 'unknown' | 'connected' | 'error', error?: string) => void;

  // Cloud backup actions
  updateCloudBackup: (config: Partial<SettingsStore['cloudBackup']>) => void;
  disconnectCloud: () => void;

  // Regulatory sources actions
  updateRegulatorySources: (config: Partial<SettingsStore['regulatorySources']>) => void;
  toggleRegulatorySource: (sourceId: keyof SettingsStore['regulatorySources']['sources'], enabled: boolean) => void;
  addCustomSource: (source: Omit<CustomRegulatorySource, 'id' | 'createdAt'>) => void;
  updateCustomSource: (id: string, updates: Partial<CustomRegulatorySource>) => void;
  deleteCustomSource: (id: string) => void;
  toggleCustomSource: (id: string, enabled: boolean) => void;

  // AI Provider actions
  updateAIProviders: (config: Partial<SettingsStore['aiProviders']>) => void;
  setActiveAIProvider: (provider: AIProviderType) => void;
  updateProviderConfig: (provider: AIProviderType, config: Partial<AIProviderConfig>) => void;
  getActiveAIConfig: () => AIProviderConfig | null;

  // New AI Settings (multi-provider abstraction)
  aiSettings: AISettings;
  updateAIProvider: (config: Partial<NewAIProviderConfig>) => void;
  updateAIFeatures: (features: Partial<AIFeatureFlags>) => void;
  updateAIUsage: (tokensUsed: number) => void;
  clearAIApiKey: () => void;
  resetAIMonthlyUsage: () => void;
  setAIConnectionStatus: (status: 'unknown' | 'connected' | 'error', error?: string) => void;

  // Organization actions
  updateOrganization: (config: Partial<OrganizationSettings>) => void;
  resetOrganization: () => void;

  // Selectors
  getBankConditionsByCode: (bankCode: string) => BankConditions | undefined;
  getActiveBankConditions: (bankCode: string, date: Date) => BankConditions | undefined;
}

const defaultOrganization: OrganizationSettings = {
  // Informations du cabinet
  name: '',
  legalName: '',
  logo: null,
  address: '',
  city: '',
  postalCode: '',
  country: 'CM', // Cameroun par défaut
  phone: '',
  website: '',
  // Identifiants légaux
  siret: '',
  rccm: '',
  nif: '',
  // Email pour envoi automatique
  senderEmail: '',
  senderName: '',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPassword: '',
  smtpSecure: true,
  // Pied de page
  footerText: '',
  // Développé par Atlas Studio
  developedBy: 'Atlas Studio',
};

const defaultPreferences = {
  currency: 'XAF', // FCFA
  locale: 'fr-FR',
  dateFormat: 'dd/MM/yyyy',
  pageSize: 25,
  showConfidenceScores: true,
  autoAnalyzeOnImport: false,
};

const defaultDetectionModules = {
  // Core detection (always on by default)
  duplicateFee: true,
  ghostFee: true,
  overcharge: true,
  interestError: true,
  // Extended detection
  valueDateError: true,
  suspiciousTransaction: true,
  complianceViolation: true,
  cashflowAnomaly: true,
  reconciliationGap: true,
  multiBankIssue: true,
  ohadaCompliance: true,
  amlAlert: true,
  // Fee category audits
  feeAnomaly: true,
};

const defaultCloudBackup = {
  provider: 'none' as const,
  isConnected: false,
  userEmail: null as string | null,
  userName: null as string | null,
  autoBackup: false,
  backupFrequency: 'weekly' as const,
  lastBackupAt: null as string | null,
  lastBackupStatus: null as 'success' | 'failed' | null,
};

const defaultRegulatorySources = {
  enableReferences: true,
  region: 'all' as const,
  sources: {
    beac: true,
    cobac: true,
    bceao: true,
    cb_umoa: true,
  },
  customSources: [] as CustomRegulatorySource[],
  lastSearchAt: null as string | null,
};

const defaultProviderConfig: AIProviderConfig = {
  enabled: false,
  apiKey: '',
  model: '',
  temperature: 0.3,
  maxTokens: 4000,
};

const defaultAIProviders = {
  activeProvider: 'none' as AIProviderType,
  providers: {
    claude: {
      ...defaultProviderConfig,
      model: 'claude-sonnet-4-20250514',
    },
    openai: {
      ...defaultProviderConfig,
      model: 'gpt-4-turbo',
      organization: '',
    },
    mistral: {
      ...defaultProviderConfig,
      model: 'mistral-large-latest',
    },
    gemini: {
      ...defaultProviderConfig,
      model: 'gemini-1.5-pro',
      projectId: '',
    },
    ollama: {
      ...defaultProviderConfig,
      enabled: false,
      baseUrl: 'http://localhost:11434',
      model: 'llama3.1',
    },
    custom: {
      ...defaultProviderConfig,
      baseUrl: '',
      model: '',
    },
  },
};

const defaultClaudeApi = {
  apiKey: '',
  apiKeyIv: '',
  isEnabled: false,
  model: 'claude-sonnet-4-20250514' as const,
  temperature: 0.3,
  maxTokens: 4000,
  enableCategorization: true,
  enableFraudDetection: true,
  enableReportGeneration: true,
  enableChat: true,
  aiDetection: {
    duplicates: true,
    ghostFees: true,
    overcharges: true,
    interestErrors: true,
    valueDateErrors: true,
    suspiciousTransactions: true,
    complianceViolations: true,
    cashflowAnomalies: true,
    reconciliationGaps: true,
    multiBankIssues: true,
    ohadaCompliance: true,
    amlAlerts: true,
    feeAnomalies: true,
  },
  usage: {
    totalTokensUsed: 0,
    totalRequests: 0,
    lastRequestAt: null as string | null,
    monthlyTokens: 0,
    monthlyRequests: 0,
    monthStart: new Date().toISOString().slice(0, 7), // YYYY-MM
  },
  connectionStatus: 'unknown' as const,
  connectionError: null as string | null,
  lastConnectionTest: null as string | null,
};

// New unified AI settings
const defaultAISettings: AISettings = {
  provider: {
    provider: 'claude',
    model: 'claude-sonnet-4-20250514',
    apiKey: '',
    temperature: 0.3,
    maxTokens: 4000,
    timeout: 60000,
  },
  features: {
    // Principales
    categorization: true,
    fraudDetection: true,
    reportGeneration: true,
    chat: true,
    // Base
    duplicates: true,
    ghostFees: true,
    overcharges: true,
    interestErrors: true,
    // Étendues
    valueDate: false,
    suspicious: false,
    compliance: false,
    cashflow: false,
    reconciliation: false,
    multiBank: false,
    ohada: false,
    amlLcbFt: false,
    fees: false,
  },
  detection: {
    enabledTypes: [],
    temperature: 0.3,
    maxTokens: 4000,
    batchSize: 50,
    includeRegulatoryReferences: true,
  },
  usage: {
    provider: 'claude',
    totalRequests: 0,
    totalTokensInput: 0,
    totalTokensOutput: 0,
    totalCost: 0,
  },
  isConfigured: false,
};

// Default bank conditions for common banks in CEMAC/UEMOA
const defaultBankConditions: BankConditions[] = [
  {
    id: 'default-afriland',
    bankCode: 'AFRI',
    bankName: 'Afriland First Bank',
    country: 'CM',
    currency: 'XAF',
    effectiveDate: new Date('2024-01-01'),
    fees: [
      { code: 'TDC', name: 'Tenue de compte', amount: 2500, type: 'fixed' },
      { code: 'VIR', name: 'Virement national', amount: 1500, type: 'fixed' },
      { code: 'VIRI', name: 'Virement international', amount: 15000, type: 'fixed' },
      { code: 'RET', name: 'Retrait DAB', amount: 500, type: 'fixed' },
    ],
    interestRates: [
      { type: 'overdraft', rate: 0.18, calculationMethod: 'simple', dayCountConvention: 'ACT/360' },
      { type: 'unauthorized', rate: 0.22, calculationMethod: 'simple', dayCountConvention: 'ACT/360' },
    ],
    isActive: true,
  },
  {
    id: 'default-bicec',
    bankCode: 'BICE',
    bankName: 'BICEC',
    country: 'CM',
    currency: 'XAF',
    effectiveDate: new Date('2024-01-01'),
    fees: [
      { code: 'TDC', name: 'Tenue de compte', amount: 3000, type: 'fixed' },
      { code: 'VIR', name: 'Virement national', amount: 2000, type: 'fixed' },
      { code: 'VIRI', name: 'Virement international', amount: 17500, type: 'fixed' },
      { code: 'RET', name: 'Retrait DAB', amount: 600, type: 'fixed' },
    ],
    interestRates: [
      { type: 'overdraft', rate: 0.17, calculationMethod: 'simple', dayCountConvention: 'ACT/360' },
      { type: 'unauthorized', rate: 0.21, calculationMethod: 'simple', dayCountConvention: 'ACT/360' },
    ],
    isActive: true,
  },
  {
    id: 'default-sgbc',
    bankCode: 'SGBC',
    bankName: 'Société Générale Cameroun',
    country: 'CM',
    currency: 'XAF',
    effectiveDate: new Date('2024-01-01'),
    fees: [
      { code: 'TDC', name: 'Tenue de compte', amount: 3500, type: 'fixed' },
      { code: 'VIR', name: 'Virement national', amount: 2500, type: 'fixed' },
      { code: 'VIRI', name: 'Virement international', amount: 20000, type: 'fixed' },
      { code: 'RET', name: 'Retrait DAB', amount: 500, type: 'fixed' },
    ],
    interestRates: [
      { type: 'overdraft', rate: 0.165, calculationMethod: 'simple', dayCountConvention: 'ACT/360' },
      { type: 'unauthorized', rate: 0.20, calculationMethod: 'simple', dayCountConvention: 'ACT/360' },
    ],
    isActive: true,
  },
];

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      organization: defaultOrganization,
      thresholds: DEFAULT_THRESHOLDS,
      bankConditions: defaultBankConditions,
      preferences: defaultPreferences,
      detectionModules: defaultDetectionModules,
      claudeApi: defaultClaudeApi,
      cloudBackup: defaultCloudBackup,
      regulatorySources: defaultRegulatorySources,
      aiProviders: defaultAIProviders,
      aiSettings: defaultAISettings,

      // Threshold actions
      updateThresholds: (updates) =>
        set((state) => ({
          thresholds: {
            ...state.thresholds,
            ...updates,
            duplicateDetection: {
              ...state.thresholds.duplicateDetection,
              ...updates.duplicateDetection,
            },
            ghostFeeDetection: {
              ...state.thresholds.ghostFeeDetection,
              ...updates.ghostFeeDetection,
            },
            overchargeDetection: {
              ...state.thresholds.overchargeDetection,
              ...updates.overchargeDetection,
            },
            interestCalculation: {
              ...state.thresholds.interestCalculation,
              ...updates.interestCalculation,
            },
          },
        })),

      resetThresholds: () => set({ thresholds: DEFAULT_THRESHOLDS }),

      // Bank conditions actions
      addBankConditions: (conditions) =>
        set((state) => ({
          bankConditions: [...state.bankConditions, conditions],
        })),

      updateBankConditions: (id, updates) =>
        set((state) => ({
          bankConditions: state.bankConditions.map((bc) =>
            bc.id === id ? { ...bc, ...updates } : bc
          ),
        })),

      deleteBankConditions: (id) =>
        set((state) => ({
          bankConditions: state.bankConditions.filter((bc) => bc.id !== id),
        })),

      // Preference actions
      updatePreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),

      resetPreferences: () => set({ preferences: defaultPreferences }),

      // Detection modules actions
      updateDetectionModules: (modules) =>
        set((state) => ({
          detectionModules: { ...state.detectionModules, ...modules },
        })),

      resetDetectionModules: () => set({ detectionModules: defaultDetectionModules }),

      getEnabledDetectors: () => {
        const modules = get().detectionModules;
        const detectors: string[] = [];

        if (modules.duplicateFee) detectors.push('DUPLICATE_FEE');
        if (modules.ghostFee) detectors.push('GHOST_FEE');
        if (modules.overcharge) detectors.push('OVERCHARGE');
        if (modules.interestError) detectors.push('INTEREST_ERROR');
        if (modules.valueDateError) detectors.push('VALUE_DATE_ERROR');
        if (modules.suspiciousTransaction) detectors.push('SUSPICIOUS_TRANSACTION');
        if (modules.complianceViolation) detectors.push('COMPLIANCE_VIOLATION');
        if (modules.cashflowAnomaly) detectors.push('CASHFLOW_ANOMALY');
        if (modules.reconciliationGap) detectors.push('RECONCILIATION_GAP');
        if (modules.multiBankIssue) detectors.push('MULTI_BANK_ISSUE');
        if (modules.ohadaCompliance) detectors.push('OHADA_NON_COMPLIANCE');
        if (modules.amlAlert) detectors.push('AML_ALERT');
        if (modules.feeAnomaly) detectors.push('FEE_ANOMALY');

        return detectors;
      },

      // Claude API actions
      updateClaudeApi: (config) =>
        set((state) => ({
          claudeApi: { ...state.claudeApi, ...config },
        })),

      clearClaudeApiKey: () =>
        set((state) => ({
          claudeApi: {
            ...state.claudeApi,
            apiKey: '',
            apiKeyIv: '',
            isEnabled: false,
            connectionStatus: 'unknown',
            connectionError: null,
          },
        })),

      updateClaudeUsage: (tokensUsed: number) =>
        set((state) => {
          const currentMonth = new Date().toISOString().slice(0, 7);
          const usage = state.claudeApi.usage;

          // Reset mensuel si nouveau mois
          const isNewMonth = usage.monthStart !== currentMonth;

          return {
            claudeApi: {
              ...state.claudeApi,
              usage: {
                totalTokensUsed: usage.totalTokensUsed + tokensUsed,
                totalRequests: usage.totalRequests + 1,
                lastRequestAt: new Date().toISOString(),
                monthlyTokens: isNewMonth ? tokensUsed : usage.monthlyTokens + tokensUsed,
                monthlyRequests: isNewMonth ? 1 : usage.monthlyRequests + 1,
                monthStart: currentMonth,
              },
            },
          };
        }),

      resetMonthlyUsage: () =>
        set((state) => ({
          claudeApi: {
            ...state.claudeApi,
            usage: {
              ...state.claudeApi.usage,
              monthlyTokens: 0,
              monthlyRequests: 0,
              monthStart: new Date().toISOString().slice(0, 7),
            },
          },
        })),

      setConnectionStatus: (status: 'unknown' | 'connected' | 'error', error?: string) =>
        set((state) => ({
          claudeApi: {
            ...state.claudeApi,
            connectionStatus: status,
            connectionError: error || null,
            lastConnectionTest: new Date().toISOString(),
          },
        })),

      // Cloud backup actions
      updateCloudBackup: (config) =>
        set((state) => ({
          cloudBackup: { ...state.cloudBackup, ...config },
        })),

      disconnectCloud: () =>
        set(() => ({
          cloudBackup: defaultCloudBackup,
        })),

      // Regulatory sources actions
      updateRegulatorySources: (config) =>
        set((state) => ({
          regulatorySources: { ...state.regulatorySources, ...config },
        })),

      toggleRegulatorySource: (sourceId, enabled) =>
        set((state) => ({
          regulatorySources: {
            ...state.regulatorySources,
            sources: {
              ...state.regulatorySources.sources,
              [sourceId]: enabled,
            },
          },
        })),

      // Custom regulatory sources actions
      addCustomSource: (source) =>
        set((state) => ({
          regulatorySources: {
            ...state.regulatorySources,
            customSources: [
              ...state.regulatorySources.customSources,
              {
                ...source,
                id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                createdAt: new Date().toISOString(),
              },
            ],
          },
        })),

      updateCustomSource: (id, updates) =>
        set((state) => ({
          regulatorySources: {
            ...state.regulatorySources,
            customSources: state.regulatorySources.customSources.map((s) =>
              s.id === id ? { ...s, ...updates } : s
            ),
          },
        })),

      deleteCustomSource: (id) =>
        set((state) => ({
          regulatorySources: {
            ...state.regulatorySources,
            customSources: state.regulatorySources.customSources.filter((s) => s.id !== id),
          },
        })),

      toggleCustomSource: (id, enabled) =>
        set((state) => ({
          regulatorySources: {
            ...state.regulatorySources,
            customSources: state.regulatorySources.customSources.map((s) =>
              s.id === id ? { ...s, enabled } : s
            ),
          },
        })),

      // AI Provider actions
      updateAIProviders: (config) =>
        set((state) => ({
          aiProviders: { ...state.aiProviders, ...config },
        })),

      setActiveAIProvider: (provider) =>
        set((state) => ({
          aiProviders: {
            ...state.aiProviders,
            activeProvider: provider,
          },
        })),

      updateProviderConfig: (provider, config) =>
        set((state) => ({
          aiProviders: {
            ...state.aiProviders,
            providers: {
              ...state.aiProviders.providers,
              [provider]: {
                ...state.aiProviders.providers[provider as keyof typeof state.aiProviders.providers],
                ...config,
              },
            },
          },
        })),

      getActiveAIConfig: () => {
        const state = get();
        const activeProvider = state.aiProviders.activeProvider;
        if (activeProvider === 'none') return null;
        return state.aiProviders.providers[activeProvider as keyof typeof state.aiProviders.providers] || null;
      },

      // New AI Settings actions
      updateAIProvider: (config) =>
        set((state) => {
          const currentSettings = state.aiSettings || defaultAISettings;
          return {
            aiSettings: {
              ...currentSettings,
              provider: { ...currentSettings.provider, ...config },
            },
          };
        }),

      updateAIFeatures: (features) =>
        set((state) => {
          const currentSettings = state.aiSettings || defaultAISettings;
          return {
            aiSettings: {
              ...currentSettings,
              features: { ...currentSettings.features, ...features },
            },
          };
        }),

      updateAIUsage: (tokensUsed: number) =>
        set((state) => {
          const currentSettings = state.aiSettings || defaultAISettings;
          const currentUsage = currentSettings.usage || defaultAISettings.usage;
          return {
            aiSettings: {
              ...currentSettings,
              usage: {
                ...currentUsage,
                totalRequests: (currentUsage.totalRequests || 0) + 1,
                totalTokensOutput: (currentUsage.totalTokensOutput || 0) + tokensUsed,
                lastRequestAt: new Date(),
                monthlyUsed: (currentUsage.monthlyUsed || 0) + tokensUsed,
              },
            },
          };
        }),

      clearAIApiKey: () =>
        set((state) => {
          const currentSettings = state.aiSettings || defaultAISettings;
          return {
            aiSettings: {
              ...currentSettings,
              provider: {
                ...currentSettings.provider,
                apiKey: '',
                apiKeyEncrypted: undefined,
              },
              isConfigured: false,
            },
          };
        }),

      resetAIMonthlyUsage: () =>
        set((state) => {
          const currentSettings = state.aiSettings || defaultAISettings;
          return {
            aiSettings: {
              ...currentSettings,
              usage: {
                ...currentSettings.usage,
                monthlyUsed: 0,
              },
            },
          };
        }),

      setAIConnectionStatus: (status, error) =>
        set((state) => {
          const currentSettings = state.aiSettings || defaultAISettings;
          return {
            aiSettings: {
              ...currentSettings,
              isConfigured: status === 'connected',
              lastTestedAt: new Date(),
              lastError: error ? {
                code: 'UNKNOWN' as const,
                message: error,
                provider: currentSettings.provider.provider,
                timestamp: new Date(),
                isRetryable: false,
              } : undefined,
            },
          };
        }),

      // Organization actions
      updateOrganization: (config) =>
        set((state) => ({
          organization: { ...state.organization, ...config },
        })),

      resetOrganization: () =>
        set(() => ({
          organization: defaultOrganization,
        })),

      // Selectors
      getBankConditionsByCode: (bankCode) =>
        get().bankConditions.find((bc) => bc.bankCode === bankCode && bc.isActive),

      getActiveBankConditions: (bankCode, date) =>
        get().bankConditions.find(
          (bc) =>
            bc.bankCode === bankCode &&
            bc.isActive &&
            new Date(bc.effectiveDate) <= date &&
            (!bc.expirationDate || new Date(bc.expirationDate) >= date)
        ),
    }),
    {
      name: 'scrutix-settings',
    }
  )
);
