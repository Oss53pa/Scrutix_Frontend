import { useState } from 'react';
import {
  Brain,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  Thermometer,
  Save,
  Server,
  Cloud,
  Cpu,
  Settings2,
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
import { useSettingsStore, AIProviderType, AIProviderConfig } from '../../store';
import { AIProviderFactory } from '../../ai';

interface AIProviderSettingsProps {
  onSave?: () => void;
}

// Provider configurations
const PROVIDERS = {
  claude: {
    name: 'Claude (Anthropic)',
    icon: Brain,
    color: 'purple',
    models: [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Recommande)' },
      { value: 'claude-opus-4-1-20250414', label: 'Claude Opus 4 (Plus puissant)' },
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Rapide)' },
    ],
    placeholder: 'sk-ant-api03-...',
    description: 'IA de reference pour l\'analyse bancaire',
  },
  openai: {
    name: 'OpenAI (GPT)',
    icon: Cloud,
    color: 'green',
    models: [
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (Recommande)' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Economique)' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Rapide)' },
    ],
    placeholder: 'sk-...',
    description: 'Solution OpenAI populaire',
    hasOrganization: true,
  },
  mistral: {
    name: 'Mistral AI',
    icon: Server,
    color: 'orange',
    models: [
      { value: 'mistral-large-latest', label: 'Mistral Large (Recommande)' },
      { value: 'mistral-medium-latest', label: 'Mistral Medium' },
      { value: 'mistral-small-latest', label: 'Mistral Small (Economique)' },
      { value: 'codestral-latest', label: 'Codestral (Code)' },
    ],
    placeholder: '...',
    description: 'IA francaise performante',
  },
  gemini: {
    name: 'Google Gemini',
    icon: Cloud,
    color: 'blue',
    models: [
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Recommande)' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Rapide)' },
      { value: 'gemini-1.0-pro', label: 'Gemini 1.0 Pro' },
    ],
    placeholder: 'AIza...',
    description: 'IA Google avec contexte etendu',
    hasProjectId: true,
  },
  ollama: {
    name: 'Ollama (Local)',
    icon: Cpu,
    color: 'gray',
    models: [
      { value: 'llama3.1', label: 'Llama 3.1 (Recommande)' },
      { value: 'llama3.1:70b', label: 'Llama 3.1 70B (Puissant)' },
      { value: 'mistral', label: 'Mistral' },
      { value: 'codellama', label: 'Code Llama' },
      { value: 'qwen2.5', label: 'Qwen 2.5' },
    ],
    placeholder: '',
    description: 'IA locale, gratuit, donnees privees',
    hasBaseUrl: true,
    noApiKey: true,
  },
  custom: {
    name: 'Personnalise',
    icon: Settings2,
    color: 'primary',
    models: [],
    placeholder: '...',
    description: 'Endpoint OpenAI-compatible',
    hasBaseUrl: true,
    customModel: true,
  },
};

export function AIProviderSettings({ onSave }: AIProviderSettingsProps) {
  const {
    aiProviders,
    setActiveAIProvider,
    updateProviderConfig,
    getActiveAIConfig,
  } = useSettingsStore();

  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [validating, setValidating] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<Record<string, 'idle' | 'valid' | 'invalid'>>({});

  const activeProvider = aiProviders.activeProvider;

  const handleValidateApiKey = async (provider: AIProviderType) => {
    if (provider === 'none') return;

    const config = aiProviders.providers[provider as keyof typeof aiProviders.providers];
    if (!config?.apiKey && provider !== 'ollama') return;

    setValidating(provider);
    setValidationStatus((prev) => ({ ...prev, [provider]: 'idle' }));

    try {
      // Map store provider type to AI module provider type
      const providerTypeMap: Record<string, 'claude' | 'openai' | 'mistral' | 'ollama'> = {
        claude: 'claude',
        openai: 'openai',
        mistral: 'mistral',
        ollama: 'ollama',
        gemini: 'openai', // Use OpenAI-compatible for Gemini
        custom: 'openai', // Use OpenAI-compatible for custom
      };

      const mappedProvider = providerTypeMap[provider];
      if (!mappedProvider) {
        setValidationStatus((prev) => ({ ...prev, [provider]: 'invalid' }));
        return;
      }

      // Test connection using the factory
      const result = await AIProviderFactory.testConnection({
        provider: mappedProvider,
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature || 0.3,
        maxTokens: config.maxTokens || 4000,
        baseUrl: config.baseUrl,
      });

      setValidationStatus((prev) => ({ ...prev, [provider]: result.valid ? 'valid' : 'invalid' }));

      if (result.valid) {
        updateProviderConfig(provider, { enabled: true });
      }
    } catch (error) {
      console.error('Validation error:', error);
      setValidationStatus((prev) => ({ ...prev, [provider]: 'invalid' }));
    } finally {
      setValidating(null);
    }
  };

  const maskApiKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 8) return '********';
    return key.substring(0, 4) + '************' + key.substring(key.length - 4);
  };

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      purple: 'from-purple-50 to-purple-100 border-purple-200',
      green: 'from-green-50 to-green-100 border-green-200',
      orange: 'from-orange-50 to-orange-100 border-orange-200',
      blue: 'from-blue-50 to-blue-100 border-blue-200',
      gray: 'from-primary-50 to-primary-100 border-primary-200',
      primary: 'from-primary-50 to-primary-100 border-primary-200',
    };
    return colors[provider] || colors.primary;
  };

  const renderProviderCard = (providerKey: AIProviderType) => {
    if (providerKey === 'none') return null;

    const provider = PROVIDERS[providerKey as keyof typeof PROVIDERS];
    if (!provider) return null;

    const config = aiProviders.providers[providerKey as keyof typeof aiProviders.providers];
    const Icon = provider.icon;
    const isActive = activeProvider === providerKey;
    const isValidated = validationStatus[providerKey] === 'valid';

    return (
      <div
        key={providerKey}
        className={`p-4 border-2 rounded-lg transition-all cursor-pointer ${
          isActive
            ? `bg-gradient-to-br ${getProviderColor(provider.color)} border-${provider.color}-500`
            : 'border-primary-200 hover:border-primary-300 bg-white'
        }`}
        onClick={() => setActiveAIProvider(providerKey)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${isActive ? `text-${provider.color}-600` : 'text-primary-500'}`} />
            <span className="font-medium text-primary-900">{provider.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {isValidated && <CheckCircle className="w-4 h-4 text-green-500" />}
            <input
              type="radio"
              checked={isActive}
              onChange={() => setActiveAIProvider(providerKey)}
              className="w-4 h-4"
            />
          </div>
        </div>
        <p className="text-xs text-primary-500 mb-3">{provider.description}</p>

        {isActive && (
          <div className="space-y-3 pt-3 border-t border-primary-200">
            {/* API Key (if needed) */}
            {!provider.noApiKey && (
              <div>
                <label className="block text-xs font-medium text-primary-700 mb-1">
                  Cle API
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showApiKey[providerKey] ? 'text' : 'password'}
                      value={showApiKey[providerKey] ? config.apiKey : maskApiKey(config.apiKey)}
                      onChange={(e) => updateProviderConfig(providerKey, { apiKey: e.target.value })}
                      placeholder={provider.placeholder}
                      className="pr-8 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((prev) => ({ ...prev, [providerKey]: !prev[providerKey] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-primary-400 hover:text-primary-600"
                    >
                      {showApiKey[providerKey] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleValidateApiKey(providerKey)}
                    disabled={validating === providerKey || !config.apiKey}
                  >
                    {validating === providerKey ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : validationStatus[providerKey] === 'valid' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : validationStatus[providerKey] === 'invalid' ? (
                      <XCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      'Test'
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Base URL (for Ollama and custom) */}
            {provider.hasBaseUrl && (
              <Input
                label="URL du serveur"
                value={config.baseUrl || ''}
                onChange={(e) => updateProviderConfig(providerKey, { baseUrl: e.target.value })}
                placeholder={providerKey === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
              />
            )}

            {/* Organization (for OpenAI) */}
            {provider.hasOrganization && (
              <Input
                label="Organisation (optionnel)"
                value={(config as AIProviderConfig & { organization?: string }).organization || ''}
                onChange={(e) => updateProviderConfig(providerKey, { organization: e.target.value })}
                placeholder="org-..."
              />
            )}

            {/* Project ID (for Google) */}
            {provider.hasProjectId && (
              <Input
                label="Project ID (optionnel)"
                value={(config as AIProviderConfig & { projectId?: string }).projectId || ''}
                onChange={(e) => updateProviderConfig(providerKey, { projectId: e.target.value })}
                placeholder="my-project-123"
              />
            )}

            {/* Model selection */}
            {provider.customModel ? (
              <Input
                label="Modele"
                value={config.model}
                onChange={(e) => updateProviderConfig(providerKey, { model: e.target.value })}
                placeholder="gpt-4-turbo, claude-3-opus, etc."
              />
            ) : (
              <Select
                label="Modele"
                value={config.model}
                onChange={(e) => updateProviderConfig(providerKey, { model: e.target.value })}
                options={provider.models}
              />
            )}

            {/* Temperature */}
            <div>
              <label className="block text-xs font-medium text-primary-700 mb-1">
                Temperature: {config.temperature?.toFixed(1) || '0.3'}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.temperature || 0.3}
                onChange={(e) => updateProviderConfig(providerKey, { temperature: parseFloat(e.target.value) })}
                className="w-full h-2 bg-primary-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-primary-400 mt-1">
                <span>Precis</span>
                <span>Creatif</span>
              </div>
            </div>

            {/* Max tokens */}
            <Input
              type="number"
              label="Tokens maximum"
              value={config.maxTokens || 4000}
              onChange={(e) => updateProviderConfig(providerKey, { maxTokens: parseInt(e.target.value) || 4000 })}
              min={100}
              max={128000}
              helperText="Limite la longueur des reponses"
            />

            {/* Enable toggle */}
            <label className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => updateProviderConfig(providerKey, { enabled: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">Activer ce provider</span>
            </label>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-500" />
          <CardTitle>Providers d'Intelligence Artificielle</CardTitle>
        </div>
        <CardDescription>
          Configurez et selectionnez le provider IA a utiliser pour l'analyse bancaire
        </CardDescription>
      </CardHeader>

      <CardBody className="space-y-6">
        {/* No AI option */}
        <div
          className={`p-4 border-2 rounded-lg transition-all cursor-pointer ${
            activeProvider === 'none'
              ? 'bg-primary-50 border-primary-500'
              : 'border-primary-200 hover:border-primary-300'
          }`}
          onClick={() => setActiveAIProvider('none')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-primary-400" />
              <span className="font-medium text-primary-900">Sans IA</span>
            </div>
            <input
              type="radio"
              checked={activeProvider === 'none'}
              onChange={() => setActiveAIProvider('none')}
              className="w-4 h-4"
            />
          </div>
          <p className="text-xs text-primary-500 mt-2">
            Utiliser uniquement les algorithmes de detection sans assistance IA
          </p>
        </div>

        {/* Provider cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderProviderCard('claude')}
          {renderProviderCard('openai')}
          {renderProviderCard('mistral')}
          {renderProviderCard('gemini')}
          {renderProviderCard('ollama')}
          {renderProviderCard('custom')}
        </div>

        {/* Active provider summary */}
        {activeProvider !== 'none' && (
          <div className="p-4 bg-primary-50 rounded-lg">
            <h4 className="text-sm font-medium text-primary-700 mb-2">Provider actif</h4>
            <div className="flex items-center gap-3">
              {(() => {
                const provider = PROVIDERS[activeProvider as keyof typeof PROVIDERS];
                const Icon = provider?.icon || Brain;
                return (
                  <>
                    <Icon className="w-5 h-5 text-primary-600" />
                    <span className="font-medium">{provider?.name}</span>
                    <span className="text-sm text-primary-500">
                      - {aiProviders.providers[activeProvider as keyof typeof aiProviders.providers]?.model}
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </CardBody>

      <CardFooter>
        <div className="flex items-center justify-between w-full">
          <p className="text-xs text-primary-400">
            Les appels API sont factures par le provider selon leur tarification.
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
