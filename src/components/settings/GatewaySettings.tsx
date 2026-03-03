// ============================================================================
// SCRUTIX - Gateway Settings
// Configuration du Premium AI Gateway
// ============================================================================

import { useState } from 'react';
import { Router, Shield, Zap, DollarSign, ToggleLeft, ToggleRight, CheckCircle, XCircle } from 'lucide-react';
import { useGateway } from '../../hooks/useGateway';
import {
  GATEWAY_STRATEGY_LABELS,
} from '../../ai/gateway/GatewayTypes';
import type {
  GatewayStrategy,
  GatewayTaskType,
} from '../../ai/gateway/GatewayTypes';
import type { AIProviderType } from '../../ai/types';

interface GatewaySettingsProps {
  onSave?: () => void;
}

const TASK_LABELS: Record<GatewayTaskType, string> = {
  chat: 'Chat conversationnel',
  categorization: 'Categorisation',
  detection: 'Detection anomalies',
  report: 'Generation rapports',
  fraud: 'Detection fraude',
  embedding: 'Embeddings',
};

const PROVIDER_OPTIONS: Array<{ value: AIProviderType | 'auto'; label: string }> = [
  { value: 'auto', label: 'Automatique' },
  { value: 'ollama', label: 'PROPH3T (local)' },
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'openai', label: 'OpenAI GPT' },
  { value: 'mistral', label: 'Mistral AI' },
];

const STRATEGIES: GatewayStrategy[] = ['proph3t_only', 'premium_preferred', 'hybrid', 'cost_optimized'];

export function GatewaySettings({ onSave }: GatewaySettingsProps) {
  const {
    strategy,
    config,
    setStrategy,
    setBudget,
    setAlertThreshold,
    setAutoFallback,
    setTaskRouting,
    isActive,
  } = useGateway();

  const [budgetInput, setBudgetInput] = useState(String(config.monthlyBudgetXAF));
  const [thresholdInput, setThresholdInput] = useState(String(Math.round(config.alertThreshold * 100)));

  const handleBudgetSave = () => {
    const value = parseInt(budgetInput, 10);
    if (!isNaN(value) && value >= 0) {
      setBudget(value);
      onSave?.();
    }
  };

  const handleThresholdSave = () => {
    const value = parseInt(thresholdInput, 10);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      setAlertThreshold(value / 100);
      onSave?.();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary-900 mb-1">Gateway Premium</h2>
        <p className="text-sm text-primary-500">
          Configurez le routage des taches IA entre PROPH3T et les providers premium
        </p>
      </div>

      {/* Strategy Selection */}
      <div className="bg-white rounded-lg border border-primary-200 p-6">
        <h3 className="text-sm font-semibold text-primary-900 flex items-center gap-2 mb-4">
          <Router className="w-4 h-4" />
          Strategie de routage
        </h3>

        <div className="space-y-3">
          {STRATEGIES.map((s) => {
            const info = GATEWAY_STRATEGY_LABELS[s];
            const isSelected = strategy === s;
            return (
              <label
                key={s}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-primary-200 hover:border-primary-300'
                }`}
              >
                <input
                  type="radio"
                  name="gateway-strategy"
                  value={s}
                  checked={isSelected}
                  onChange={() => {
                    setStrategy(s);
                    onSave?.();
                  }}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-medium text-primary-900">{info.label}</p>
                  <p className="text-xs text-primary-500 mt-0.5">{info.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Task Routing (only for hybrid strategy) */}
      {strategy === 'hybrid' && (
        <div className="bg-white rounded-lg border border-primary-200 p-6">
          <h3 className="text-sm font-semibold text-primary-900 flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4" />
            Routage par tache
          </h3>

          <div className="space-y-3">
            {(Object.keys(TASK_LABELS) as GatewayTaskType[]).map((task) => (
              <div key={task} className="flex items-center justify-between">
                <label className="text-sm text-primary-700 font-medium">
                  {TASK_LABELS[task]}
                </label>
                <select
                  value={config.taskRouting[task] || 'auto'}
                  onChange={(e) => {
                    setTaskRouting(task, e.target.value as AIProviderType | 'auto');
                    onSave?.();
                  }}
                  className="text-sm border border-primary-200 rounded-lg px-3 py-1.5 bg-white text-primary-700"
                >
                  {PROVIDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Configuration */}
      <div className="bg-white rounded-lg border border-primary-200 p-6">
        <h3 className="text-sm font-semibold text-primary-900 flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4" />
          Budget mensuel
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-primary-600 mb-1">
              Budget mensuel (FCFA)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                min="0"
                step="5000"
                className="flex-1 border border-primary-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={handleBudgetSave}
                className="px-4 py-2 bg-primary-900 text-white rounded-lg text-sm hover:bg-primary-800 transition-colors"
              >
                Appliquer
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-primary-600 mb-1">
              Seuil d'alerte (%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                min="10"
                max="100"
                step="5"
                className="flex-1"
              />
              <span className="text-sm font-medium text-primary-700 w-12 text-right">
                {thresholdInput}%
              </span>
              <button
                onClick={handleThresholdSave}
                className="px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg text-sm hover:bg-primary-200 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Auto Fallback Toggle */}
      <div className="bg-white rounded-lg border border-primary-200 p-6">
        <h3 className="text-sm font-semibold text-primary-900 flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4" />
          Protection du budget
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-primary-900">
              Basculement automatique sur PROPH3T
            </p>
            <p className="text-xs text-primary-500 mt-0.5">
              Passer automatiquement en local quand le seuil d'alerte est atteint
            </p>
          </div>
          <button
            onClick={() => {
              setAutoFallback(!config.autoFallback);
              onSave?.();
            }}
            className="text-primary-600 hover:text-primary-800"
          >
            {config.autoFallback ? (
              <ToggleRight className="w-8 h-8 text-green-600" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-primary-400" />
            )}
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <div className="bg-white rounded-lg border border-primary-200 p-6">
        <h3 className="text-sm font-semibold text-primary-900 mb-4">Status des providers</h3>
        <div className="space-y-2">
          {[
            { id: 'ollama', name: 'PROPH3T (Ollama)', free: true },
            { id: 'claude', name: 'Claude (Anthropic)', free: false },
            { id: 'openai', name: 'OpenAI', free: false },
            { id: 'mistral', name: 'Mistral AI', free: false },
          ].map((p) => (
            <div key={p.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-primary-700">{p.name}</span>
                {p.free && (
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Gratuit</span>
                )}
              </div>
              {isActive || p.id === 'ollama' ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-primary-300" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
