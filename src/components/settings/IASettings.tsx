import { useState, useMemo, useEffect } from 'react';
import {
  Brain,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  MessageSquare,
  BarChart3,
  Thermometer,
  RefreshCw,
  Save,
  Zap,
  Cpu,
  Sparkles,
  Calculator,
  ShieldCheck,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Button,
  Input,
  Select,
  InfoTooltip,
} from '../ui';
import { useSettingsStore } from '../../store';
import {
  getAIModelRouter,
  MODEL_CONFIGS,
  MODULE_CONFIGS,
  MODULES_BY_CATEGORY,
  type ModelTier,
  type AnalysisModule,
} from '../../services';
import { ClaudeKeyManager, type AnthropicKeyInfo } from '../../services/ClaudeKeyManager';

interface IASettingsProps {
  onSave?: () => void;
}

export function IASettings({ onSave }: IASettingsProps) {
  const { claudeApi, updateClaudeApi, resetMonthlyUsage } = useSettingsStore();

  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [keyInfo, setKeyInfo] = useState<AnthropicKeyInfo | null>(null);

  // On mount: ask the server whether a key is configured for the current user
  useEffect(() => {
    let cancelled = false;
    void ClaudeKeyManager.getInfo().then((info) => {
      if (cancelled) return;
      setKeyInfo(info);
      // Sync the client-side `isEnabled` flag with server state
      if (info.isConfigured && !claudeApi.isEnabled) {
        updateClaudeApi({ isEnabled: true });
      }
      if (!info.isConfigured && claudeApi.isEnabled) {
        updateClaudeApi({ isEnabled: false });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI Model Router
  const router = useMemo(() => getAIModelRouter(), []);
  const fullAnalysisCost = useMemo(() => router.estimateFullAnalysisCost(), [router]);

  const tierConfig: Record<ModelTier, { icon: typeof Zap; color: string; bgColor: string }> = {
    haiku: { icon: Zap, color: 'text-primary-600', bgColor: 'bg-primary-100' },
    sonnet: { icon: Cpu, color: 'text-primary-600', bgColor: 'bg-primary-100' },
    opus: { icon: Sparkles, color: 'text-primary-600', bgColor: 'bg-primary-100' },
  };

  const categoryLabels: Record<string, string> = {
    detection: 'Detection',
    verification: 'Verification',
    analyse: 'Analyse',
    rapports: 'Rapports',
    autre: 'Autre',
  };

  /**
   * Save the typed key on the server (RPC), then trigger server-side validation.
   * The plaintext key is wiped from local state immediately after the save call.
   */
  const handleValidateApiKey = async () => {
    if (!apiKeyInput.trim()) return;

    setValidating(true);
    setValidationStatus('idle');
    setValidationError(null);

    try {
      const result = await ClaudeKeyManager.setAndValidate(apiKeyInput, claudeApi.model);
      // Wipe plaintext from local state regardless of outcome
      setApiKeyInput('');

      if (result.valid) {
        setValidationStatus('valid');
        updateClaudeApi({ isEnabled: true });
        // Refresh metadata
        const info = await ClaudeKeyManager.getInfo();
        setKeyInfo(info);
      } else {
        setValidationStatus('invalid');
        setValidationError(result.error ?? 'Validation échouée');
      }
    } catch (err) {
      setValidationStatus('invalid');
      setValidationError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setValidating(false);
    }
  };

  const handleClearApiKey = async () => {
    setApiKeyInput('');
    setValidationStatus('idle');
    setValidationError(null);
    try {
      await ClaudeKeyManager.clearKey();
      updateClaudeApi({ isEnabled: false });
      setKeyInfo({ isConfigured: false, fingerprint: null, validatedAt: null, updatedAt: null });
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Erreur de suppression');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary-500" />
          <CardTitle>Intelligence Artificielle Claude</CardTitle>
        </div>
        <CardDescription>
          Configurez l'integration avec Claude AI pour la categorisation automatique et la detection de fraude
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-6">
        {/* API Key */}
        <div>
          <h4 className="text-sm font-medium text-ink-700 mb-2 flex items-center gap-2">
            <Key className="w-4 h-4" />
            Clé API Anthropic
            <InfoTooltip content="Votre clé est stockée chiffrée côté serveur Supabase et n'est jamais exposée au navigateur. Obtenez-la sur console.anthropic.com." />
          </h4>

          {/* Status banner — shows server-side configuration state */}
          {keyInfo?.isConfigured ? (
            <div className="rounded-lg border border-emerald-200/70 bg-emerald-50 px-3.5 py-2.5 mb-3 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-900 tracking-tight">
                  Clé configurée côté serveur
                </p>
                <p className="text-xs text-emerald-700">
                  Empreinte <span className="font-mono">{keyInfo.fingerprint}…</span>
                  {keyInfo.validatedAt && (
                    <> · validée le {keyInfo.validatedAt.toLocaleDateString('fr-FR')}</>
                  )}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleClearApiKey}>
                Effacer
              </Button>
            </div>
          ) : (
            <p className="text-xs text-ink-500 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-accent-600" />
              Aucune clé configurée. Saisissez-la ci-dessous — elle ne quittera jamais le serveur.
            </p>
          )}

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  setValidationStatus('idle');
                  setValidationError(null);
                }}
                placeholder={keyInfo?.isConfigured ? '••• Remplacer la clé existante' : 'sk-ant-api03-...'}
                className="pr-10"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                aria-label={showApiKey ? 'Masquer' : 'Afficher'}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button
              variant="secondary"
              onClick={handleValidateApiKey}
              disabled={validating || !apiKeyInput.trim()}
            >
              {validating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : validationStatus === 'valid' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              ) : validationStatus === 'invalid' ? (
                <XCircle className="w-4 h-4 text-red-500" />
              ) : (
                'Valider'
              )}
            </Button>
          </div>
          {validationStatus === 'valid' && (
            <p className="text-sm text-emerald-700 mt-2">Clé validée et enregistrée</p>
          )}
          {validationStatus === 'invalid' && (
            <p className="text-sm text-red-600 mt-2">
              {validationError ?? 'Clé API invalide. Vérifiez votre clé et réessayez.'}
            </p>
          )}
        </div>

        {/* Model Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Modele Claude"
            value={claudeApi.model}
            onChange={(e) => updateClaudeApi({ model: e.target.value as typeof claudeApi.model })}
            options={[
              { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Recommande)' },
              { value: 'claude-opus-4-1-20250414', label: 'Claude Opus 4 (Plus puissant)' },
              { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
              { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Rapide)' },
            ]}
            disabled={!claudeApi.isEnabled}
          />
          <div className="flex items-end">
            <label className="flex items-center gap-3 p-3 border border-primary-200 rounded-md w-full">
              <input
                type="checkbox"
                checked={claudeApi.isEnabled}
                onChange={(e) => updateClaudeApi({ isEnabled: e.target.checked })}
                disabled={!keyInfo?.isConfigured}
                className="w-4 h-4"
              />
              <span className="text-sm">Activer l'IA Claude</span>
            </label>
          </div>
        </div>

        {/* Feature Toggles */}
        <div>
          <h4 className="text-sm font-medium text-primary-700 mb-4">Fonctionnalites IA</h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <label className="flex items-center gap-3 p-3 border border-primary-200 rounded-md cursor-pointer hover:bg-primary-50">
              <input
                type="checkbox"
                checked={claudeApi.enableCategorization}
                onChange={(e) => updateClaudeApi({ enableCategorization: e.target.checked })}
                disabled={!claudeApi.isEnabled}
                className="w-4 h-4"
              />
              <span className="text-sm">Categorisation auto</span>
            </label>
            <label className="flex items-center gap-3 p-3 border border-primary-200 rounded-md cursor-pointer hover:bg-primary-50">
              <input
                type="checkbox"
                checked={claudeApi.enableFraudDetection}
                onChange={(e) => updateClaudeApi({ enableFraudDetection: e.target.checked })}
                disabled={!claudeApi.isEnabled}
                className="w-4 h-4"
              />
              <span className="text-sm">Detection fraude</span>
            </label>
            <label className="flex items-center gap-3 p-3 border border-primary-200 rounded-md cursor-pointer hover:bg-primary-50">
              <input
                type="checkbox"
                checked={claudeApi.enableReportGeneration}
                onChange={(e) => updateClaudeApi({ enableReportGeneration: e.target.checked })}
                disabled={!claudeApi.isEnabled}
                className="w-4 h-4"
              />
              <span className="text-sm">Generation rapports</span>
            </label>
            <label className="flex items-center gap-3 p-3 border border-primary-200 rounded-md cursor-pointer hover:bg-primary-50">
              <input
                type="checkbox"
                checked={claudeApi.enableChat}
                onChange={(e) => updateClaudeApi({ enableChat: e.target.checked })}
                disabled={!claudeApi.isEnabled}
                className="w-4 h-4"
              />
              <MessageSquare className="w-4 h-4 text-primary-500" />
              <span className="text-sm">Chat IA</span>
            </label>
          </div>
        </div>

        {/* AI Detection Types */}
        <div>
          <h4 className="text-sm font-medium text-primary-700 mb-4">Detection IA de base</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'duplicates', emoji: '🔄', label: 'Doublons' },
              { key: 'ghostFees', emoji: '👻', label: 'Frais fantomes' },
              { key: 'overcharges', emoji: '📈', label: 'Surfacturation' },
              { key: 'interestErrors', emoji: '💰', label: "Erreurs d'agios" },
            ].map(({ key, emoji, label }) => (
              <label key={key} className="flex items-center gap-2 p-2 border border-primary-200 rounded-md cursor-pointer hover:bg-primary-50">
                <input
                  type="checkbox"
                  checked={claudeApi.aiDetection?.[key as keyof typeof claudeApi.aiDetection] ?? true}
                  onChange={(e) =>
                    updateClaudeApi({
                      aiDetection: { ...claudeApi.aiDetection, [key]: e.target.checked },
                    })
                  }
                  disabled={!claudeApi.isEnabled}
                  className="w-4 h-4"
                />
                <span>{emoji}</span>
                <span className="text-xs">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Extended AI Detection Types */}
        <div>
          <h4 className="text-sm font-medium text-primary-700 mb-4">Detection IA etendue</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { key: 'valueDateErrors', emoji: '📅', label: 'Dates valeur' },
              { key: 'suspiciousTransactions', emoji: '🔍', label: 'Suspect' },
              { key: 'complianceViolations', emoji: '⚠️', label: 'Conformite' },
              { key: 'cashflowAnomalies', emoji: '💵', label: 'Tresorerie' },
              { key: 'reconciliationGaps', emoji: '🔗', label: 'Rapprochement' },
              { key: 'multiBankIssues', emoji: '🏦', label: 'Multi-banques' },
              { key: 'ohadaCompliance', emoji: '📋', label: 'OHADA' },
              { key: 'amlAlerts', emoji: '🚨', label: 'LCB-FT' },
              { key: 'feeAnomalies', emoji: '🧾', label: 'Frais' },
            ].map(({ key, emoji, label }) => (
              <label key={key} className="flex items-center gap-2 p-2 border border-primary-200 rounded-md cursor-pointer hover:bg-primary-50">
                <input
                  type="checkbox"
                  checked={claudeApi.aiDetection?.[key as keyof typeof claudeApi.aiDetection] ?? true}
                  onChange={(e) =>
                    updateClaudeApi({
                      aiDetection: { ...claudeApi.aiDetection, [key]: e.target.checked },
                    })
                  }
                  disabled={!claudeApi.isEnabled}
                  className="w-4 h-4"
                />
                <span>{emoji}</span>
                <span className="text-xs">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Advanced Parameters */}
        <div>
          <h4 className="text-sm font-medium text-primary-700 mb-4 flex items-center gap-2">
            <Thermometer className="w-4 h-4" />
            Parametres avances
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-2">
                Temperature: {claudeApi.temperature?.toFixed(1) || '0.3'}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={claudeApi.temperature || 0.3}
                onChange={(e) => updateClaudeApi({ temperature: parseFloat(e.target.value) })}
                disabled={!claudeApi.isEnabled}
                className="w-full h-2 bg-primary-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-primary-400 mt-1">
                <span>Precis</span>
                <span>Creatif</span>
              </div>
            </div>
            <div>
              <Input
                type="number"
                label="Tokens maximum"
                value={claudeApi.maxTokens || 4000}
                onChange={(e) => updateClaudeApi({ maxTokens: parseInt(e.target.value) || 4000 })}
                disabled={!claudeApi.isEnabled}
                min={100}
                max={8000}
                helperText="Limite la longueur des reponses (100-8000)"
              />
            </div>
          </div>
        </div>

        {/* Usage Statistics */}
        {claudeApi.isEnabled && (
          <div>
            <h4 className="text-sm font-medium text-primary-700 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Statistiques d'utilisation
            </h4>
            <div className="bg-primary-50 rounded-lg p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { value: claudeApi.usage?.monthlyTokens || 0, label: 'Tokens ce mois' },
                  { value: claudeApi.usage?.monthlyRequests || 0, label: 'Requetes ce mois' },
                  { value: claudeApi.usage?.totalTokensUsed || 0, label: 'Tokens total' },
                  { value: claudeApi.usage?.totalRequests || 0, label: 'Requetes total' },
                ].map(({ value, label }) => (
                  <div key={label} className="text-center">
                    <p className="text-2xl font-bold text-primary-900">
                      {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
                    </p>
                    <p className="text-xs text-primary-500">{label}</p>
                  </div>
                ))}
              </div>
              {claudeApi.usage?.lastRequestAt && (
                <p className="text-xs text-primary-400 text-center mt-3">
                  Derniere utilisation: {new Date(claudeApi.usage.lastRequestAt).toLocaleString('fr-FR')}
                </p>
              )}
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" size="sm" onClick={resetMonthlyUsage}>
                  <RefreshCw className="w-3 h-3" />
                  Reinitialiser stats mensuelles
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* AI Model Routing */}
        <div>
          <h4 className="text-sm font-medium text-primary-700 mb-4 flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Routage Intelligent des Modeles
            <InfoTooltip content="Chaque module utilise le modele le plus adapte a sa complexite pour optimiser le rapport cout/precision" />
          </h4>

          {/* Tier Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {(['haiku', 'sonnet', 'opus'] as ModelTier[]).map((tier) => {
              const config = MODEL_CONFIGS[tier];
              const TierIcon = tierConfig[tier].icon;
              const modulesCount = Object.values(MODULE_CONFIGS).filter(m => m.tier === tier).length;
              const tierCost = fullAnalysisCost.breakdown[tier];

              return (
                <div
                  key={tier}
                  className={`p-3 rounded-lg border-2 border-primary-200 bg-primary-50`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-lg ${tierConfig[tier].bgColor} flex items-center justify-center`}>
                      <TierIcon className={`w-4 h-4 ${tierConfig[tier].color}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-primary-900">{config.displayName}</p>
                      <p className="text-xs text-primary-500">{modulesCount} modules</p>
                    </div>
                  </div>
                  <div className="text-xs text-primary-600 space-y-1">
                    <p>Entree: ${config.inputCostPer1M}/1M tokens</p>
                    <p>Sortie: ${config.outputCostPer1M}/1M tokens</p>
                    {tierCost.count > 0 && (
                      <p className="font-medium pt-1 border-t border-primary-200">
                        ~{router.formatCost(tierCost.costUSD)} / analyse
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cost Summary */}
          <div className="bg-gradient-to-r from-primary-900 to-primary-800 rounded-lg p-4 text-white mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-300">Cout estime par analyse complete</p>
                <p className="text-2xl font-bold">{router.formatCost(fullAnalysisCost.totalCostUSD)}</p>
                <p className="text-xs text-primary-400">≈ ${fullAnalysisCost.totalCostUSD.toFixed(4)} USD</p>
              </div>
              <div className="text-right text-xs text-primary-300">
                <p>{fullAnalysisCost.modules.length} modules</p>
                <p>Haiku: {fullAnalysisCost.breakdown.haiku.count}</p>
                <p>Sonnet: {fullAnalysisCost.breakdown.sonnet.count}</p>
                <p>Opus: {fullAnalysisCost.breakdown.opus.count}</p>
              </div>
            </div>
          </div>

          {/* Modules by Category */}
          <div className="space-y-3">
            {Object.entries(MODULES_BY_CATEGORY).map(([category, modules]) => (
              <div key={category} className="border border-primary-200 rounded-lg overflow-hidden">
                <div className="bg-primary-50 px-3 py-2 border-b border-primary-200">
                  <p className="text-sm font-medium text-primary-700">{categoryLabels[category]}</p>
                </div>
                <div className="p-2">
                  <div className="flex flex-wrap gap-2">
                    {modules.map((module: AnalysisModule) => {
                      const config = MODULE_CONFIGS[module];
                      const TierIcon = tierConfig[config.tier].icon;
                      const estimate = router.estimateCost(module);

                      return (
                        <div
                          key={module}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-primary-100 text-primary-800`}
                          title={`${config.description}\nCout: ${router.formatCost(estimate.costUSD)}`}
                        >
                          <TierIcon className="w-3 h-3" />
                          <span>{config.description.split(' ')[0]}</span>
                          <span className="opacity-60">({router.formatCost(estimate.costUSD)})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-primary-400 mt-3 text-center">
            Les couts sont des estimations basees sur une utilisation moyenne. Le cout reel depend du volume de donnees.
          </p>
        </div>
      </CardBody>
      <CardFooter>
        <div className="flex items-center justify-between w-full">
          <p className="text-xs text-primary-400">
            Les appels API sont factures par Anthropic selon leur tarification.
          </p>
          <Button variant="primary" onClick={onSave}>
            <Save className="w-4 h-4" />
            Enregistrer
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
