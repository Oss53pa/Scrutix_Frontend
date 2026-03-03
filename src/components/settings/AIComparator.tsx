// ============================================================================
// SCRUTIX - AI Comparator
// Interface de comparaison PROPH3T vs Premium
// ============================================================================

import { useState } from 'react';
import { Play, Loader2, BarChart3, Clock, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { useComparator } from '../../hooks/useComparator';
import { useAppStore } from '../../store';

type TaskType = 'categorization' | 'anomaly_detection';

const TASK_LABELS: Record<TaskType, string> = {
  categorization: 'Categorisation',
  anomaly_detection: 'Detection d\'anomalies',
};

const PREMIUM_PROVIDERS = [
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'openai', label: 'OpenAI GPT' },
  { value: 'mistral', label: 'Mistral AI' },
];

export function AIComparator() {
  const { isRunning, results, error, runCategorization, runAnomalyDetection, clearResults } = useComparator();
  const transactions = useAppStore((state) => state.transactions);

  const [taskType, setTaskType] = useState<TaskType>('categorization');
  const [premiumProvider, setPremiumProvider] = useState('claude');
  const [sampleSize, setSampleSize] = useState(10);

  const getSampleTransactions = () => {
    if (!transactions || transactions.length === 0) return [];
    const size = Math.min(sampleSize, transactions.length);
    const shuffled = [...transactions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, size);
  };

  const handleRun = async () => {
    const sample = getSampleTransactions();
    if (sample.length === 0) return;

    switch (taskType) {
      case 'categorization':
        await runCategorization(sample, premiumProvider);
        break;
      case 'anomaly_detection':
        await runAnomalyDetection(sample, premiumProvider);
        break;
    }
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  };

  const formatXAF = (amount: number): string => {
    if (amount === 0) return '0 FCFA';
    return amount.toLocaleString('fr-FR') + ' FCFA';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-primary-900 mb-1">Comparateur IA</h2>
        <p className="text-sm text-primary-500">
          Comparez les resultats entre PROPH3T (local) et un provider premium
        </p>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-lg border border-primary-200 p-6">
        <h3 className="text-sm font-semibold text-primary-900 mb-4">Configuration</h3>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-primary-600 mb-1">Type de tache</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as TaskType)}
              className="w-full border border-primary-200 rounded-lg px-3 py-2 text-sm"
              disabled={isRunning}
            >
              {Object.entries(TASK_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-primary-600 mb-1">Provider premium</label>
            <select
              value={premiumProvider}
              onChange={(e) => setPremiumProvider(e.target.value)}
              className="w-full border border-primary-200 rounded-lg px-3 py-2 text-sm"
              disabled={isRunning}
            >
              {PREMIUM_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-primary-600 mb-1">
              Echantillon ({transactions?.length || 0} disponibles)
            </label>
            <input
              type="number"
              value={sampleSize}
              onChange={(e) => setSampleSize(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              max={transactions?.length || 100}
              className="w-full border border-primary-200 rounded-lg px-3 py-2 text-sm"
              disabled={isRunning}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleRun}
            disabled={isRunning || !transactions || transactions.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg text-sm hover:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Comparaison en cours...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Lancer la comparaison
              </>
            )}
          </button>

          {results && (
            <button
              onClick={clearResults}
              className="text-sm text-primary-500 hover:text-primary-700"
            >
              Effacer les resultats
            </button>
          )}
        </div>

        {!transactions || transactions.length === 0 ? (
          <p className="mt-3 text-sm text-yellow-600">
            Importez des transactions pour pouvoir lancer une comparaison.
          </p>
        ) : null}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Summary Table */}
          <div className="bg-white rounded-lg border border-primary-200 p-6">
            <h3 className="text-sm font-semibold text-primary-900 flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4" />
              Resultats: {TASK_LABELS[results.taskType as TaskType] || results.taskType}
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary-100">
                    <th className="text-left py-2 text-primary-600 font-medium">Metrique</th>
                    <th className="text-center py-2 text-primary-600 font-medium">PROPH3T</th>
                    <th className="text-center py-2 text-primary-600 font-medium capitalize">{results.premium.provider}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-primary-50">
                    <td className="py-2 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-primary-400" />
                      Temps
                    </td>
                    <td className="text-center py-2 font-medium">
                      {results.proph3t.error ? '-' : formatTime(results.proph3t.timeMs)}
                    </td>
                    <td className="text-center py-2 font-medium">
                      {results.premium.error ? '-' : formatTime(results.premium.timeMs)}
                    </td>
                  </tr>
                  <tr className="border-b border-primary-50">
                    <td className="py-2 flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-primary-400" />
                      Cout
                    </td>
                    <td className="text-center py-2 font-medium text-green-600">
                      0 FCFA
                    </td>
                    <td className="text-center py-2 font-medium text-primary-900">
                      {formatXAF(results.premium.costXAF)}
                    </td>
                  </tr>
                  <tr className="border-b border-primary-50">
                    <td className="py-2">Tokens</td>
                    <td className="text-center py-2 text-primary-600">
                      {results.proph3t.tokensUsed.toLocaleString('fr-FR')}
                    </td>
                    <td className="text-center py-2 text-primary-600">
                      {results.premium.tokensUsed.toLocaleString('fr-FR')}
                    </td>
                  </tr>
                  <tr className="border-b border-primary-50">
                    <td className="py-2">Status</td>
                    <td className="text-center py-2">
                      {results.proph3t.error ? (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <XCircle className="w-3.5 h-3.5" /> Erreur
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-3.5 h-3.5" /> OK
                        </span>
                      )}
                    </td>
                    <td className="text-center py-2">
                      {results.premium.error ? (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <XCircle className="w-3.5 h-3.5" /> Erreur
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-3.5 h-3.5" /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Agreement Rate */}
          {results.taskType !== 'report' && (
            <div className="bg-white rounded-lg border border-primary-200 p-6">
              <h3 className="text-sm font-semibold text-primary-900 mb-3">Taux de concordance</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-3 bg-primary-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      results.comparison.agreementRate >= 0.8 ? 'bg-green-500' :
                      results.comparison.agreementRate >= 0.5 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${results.comparison.agreementRate * 100}%` }}
                  />
                </div>
                <span className="text-lg font-bold text-primary-900">
                  {Math.round(results.comparison.agreementRate * 100)}%
                </span>
              </div>
              <p className="text-xs text-primary-500 mt-2">
                Pourcentage de resultats identiques entre les deux providers
              </p>
            </div>
          )}

          {/* Errors */}
          {(results.proph3t.error || results.premium.error) && (
            <div className="bg-red-50 rounded-lg border border-red-200 p-4">
              <h3 className="text-sm font-semibold text-red-800 mb-2">Erreurs</h3>
              {results.proph3t.error && (
                <p className="text-sm text-red-700">PROPH3T: {results.proph3t.error}</p>
              )}
              {results.premium.error && (
                <p className="text-sm text-red-700">{results.premium.provider}: {results.premium.error}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
