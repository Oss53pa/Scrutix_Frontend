// ============================================================================
// SCRUTIX - AI Cost Dashboard
// Tableau de bord des couts IA avec budget et utilisation par provider
// ============================================================================

import { useEffect } from 'react';
import { DollarSign, TrendingUp, AlertTriangle, Server, Activity } from 'lucide-react';
import { useGateway } from '../../hooks/useGateway';
import { GATEWAY_STRATEGY_LABELS } from '../../ai/gateway/GatewayTypes';
import type { GatewayStrategy } from '../../ai/gateway/GatewayTypes';

export function AICostDashboard() {
  const {
    strategy,
    budgetStatus,
    usageByProvider,
    config,
    refresh,
  } = useGateway();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const strategyLabel = GATEWAY_STRATEGY_LABELS[strategy as GatewayStrategy] || {
    label: strategy,
    description: '',
  };

  // Budget gauge color
  const getGaugeColor = (percent: number): string => {
    if (percent >= 1) return 'bg-red-500';
    if (percent >= 0.75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatXAF = (amount: number): string => {
    return amount.toLocaleString('fr-FR') + ' FCFA';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary-900 mb-1">Couts IA</h2>
        <p className="text-sm text-primary-500">
          Suivi de consommation et budget des providers IA
        </p>
      </div>

      {/* Strategy Banner */}
      <div className="bg-primary-50 rounded-lg p-4 flex items-center gap-3">
        <Activity className="w-5 h-5 text-primary-600" />
        <div>
          <p className="text-sm font-medium text-primary-900">
            Strategie: {strategyLabel.label}
          </p>
          <p className="text-xs text-primary-500">{strategyLabel.description}</p>
        </div>
      </div>

      {/* Budget Gauge */}
      {budgetStatus && (
        <div className="bg-white rounded-lg border border-primary-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-primary-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Budget mensuel
            </h3>
            <span className="text-xs text-primary-500">
              {budgetStatus.currentMonth}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-4 bg-primary-100 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all ${getGaugeColor(budgetStatus.usedPercent)}`}
              style={{ width: `${Math.min(100, budgetStatus.usedPercent * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-primary-600">
              Utilise: <span className="font-medium">{formatXAF(budgetStatus.usedXAF)}</span>
            </span>
            <span className="text-primary-600">
              Budget: <span className="font-medium">{formatXAF(budgetStatus.monthlyBudgetXAF)}</span>
            </span>
          </div>

          <div className="mt-2 text-sm text-primary-500">
            Restant: <span className="font-medium text-primary-700">{formatXAF(budgetStatus.remainingXAF)}</span>
            {' '}({Math.round((1 - budgetStatus.usedPercent) * 100)}%)
          </div>

          {/* Alerts */}
          {budgetStatus.budgetExceeded && (
            <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Budget depasse !</span>
              {config.autoFallback && (
                <span className="text-xs">Basculement automatique sur PROPH3T</span>
              )}
            </div>
          )}
          {budgetStatus.alertTriggered && !budgetStatus.budgetExceeded && (
            <div className="mt-3 flex items-center gap-2 text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">
                Seuil d'alerte atteint ({Math.round(config.alertThreshold * 100)}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Usage by Provider */}
      <div className="bg-white rounded-lg border border-primary-200 p-6">
        <h3 className="text-sm font-semibold text-primary-900 flex items-center gap-2 mb-4">
          <Server className="w-4 h-4" />
          Utilisation par provider
        </h3>

        {usageByProvider && Object.keys(usageByProvider).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-100">
                  <th className="text-left py-2 text-primary-600 font-medium">Provider</th>
                  <th className="text-right py-2 text-primary-600 font-medium">Requetes</th>
                  <th className="text-right py-2 text-primary-600 font-medium">Tokens (in/out)</th>
                  <th className="text-right py-2 text-primary-600 font-medium">Cout</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(usageByProvider).map(([provider, data]) => (
                  <tr key={provider} className="border-b border-primary-50">
                    <td className="py-2 font-medium text-primary-900 capitalize">{provider}</td>
                    <td className="text-right py-2 text-primary-600">{data.requests}</td>
                    <td className="text-right py-2 text-primary-600">
                      {data.inputTokens.toLocaleString('fr-FR')} / {data.outputTokens.toLocaleString('fr-FR')}
                    </td>
                    <td className="text-right py-2 font-medium text-primary-900">
                      {provider === 'ollama' ? (
                        <span className="text-green-600">0 FCFA</span>
                      ) : (
                        formatXAF(data.costXAF)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-primary-400">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucune utilisation enregistree ce mois-ci</p>
          </div>
        )}
      </div>

      {/* PROPH3T Note */}
      <div className="bg-green-50 rounded-lg p-4 text-sm text-green-800">
        <p className="font-medium mb-1">PROPH3T (Ollama) = 0 FCFA</p>
        <p className="text-green-600">
          Les requetes traitees par PROPH3T sont gratuites car executees localement.
          Seuls les providers premium (Claude, OpenAI, Mistral) generent des couts.
        </p>
      </div>
    </div>
  );
}
