import { useState, useEffect, useCallback } from 'react';
import { Cpu, RefreshCw, CheckCircle, XCircle, Zap, Brain, Eye, Hash, Database, Trash2 } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { Proph3tModelRegistry } from '../../ai/proph3t/ModelRegistry';
import type { Proph3tModelRole, Proph3tModelSlot } from '../../ai/proph3t/types';
import { DETECTION_MODEL_MAP } from '../../ai/proph3t/types';
import { AIDetectionType, AI_DETECTION_LABELS } from '../../ai/types';

interface Proph3tSettingsPanelProps {
  onSave?: () => void;
}

const ROLE_CONFIG: Record<Proph3tModelRole, { label: string; description: string; icon: React.ReactNode }> = {
  reasoning: { label: 'Reasoning', description: 'Analyses complexes, rapports, conformite', icon: <Brain className="w-4 h-4" /> },
  fast: { label: 'Fast', description: 'Categorisation, detections simples', icon: <Zap className="w-4 h-4" /> },
  vision: { label: 'Vision', description: 'Analyse de documents scannes', icon: <Eye className="w-4 h-4" /> },
  embedding: { label: 'Embedding', description: 'Recherche semantique', icon: <Hash className="w-4 h-4" /> },
};

export function Proph3tSettingsPanel({ onSave }: Proph3tSettingsPanelProps) {
  const { proph3tConfig, updateProph3tConfig } = useSettingsStore();
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [health, setHealth] = useState<'unknown' | 'healthy' | 'error'>('unknown');
  const [roleStatus, setRoleStatus] = useState<Record<Proph3tModelRole, { available: boolean; model: string; fallback: boolean }> | null>(null);
  const [cacheStats, setCacheStats] = useState<{ entries: number; hitRate: number } | null>(null);

  const registry = new Proph3tModelRegistry(proph3tConfig.baseUrl);

  const scanModels = useCallback(async () => {
    setScanning(true);
    try {
      const healthResult = await registry.checkHealth();
      setHealth(healthResult.healthy ? 'healthy' : 'error');

      if (healthResult.healthy) {
        const models = await registry.refreshAvailableModels();
        setAvailableModels(models);
        const status = registry.checkAllRoles(proph3tConfig);
        setRoleStatus(status);
      }
    } catch {
      setHealth('error');
    } finally {
      setScanning(false);
    }
  }, [proph3tConfig.baseUrl]);

  useEffect(() => {
    if (proph3tConfig.enabled) {
      scanModels();
    }
  }, [proph3tConfig.enabled]);

  const handleToggleEnabled = () => {
    updateProph3tConfig({ enabled: !proph3tConfig.enabled });
    onSave?.();
  };

  const handleModelChange = (role: Proph3tModelRole, modelName: string) => {
    const current = proph3tConfig.models[role];
    const updated: Proph3tModelSlot = { ...current, name: modelName };
    updateProph3tConfig({
      models: { ...proph3tConfig.models, [role]: updated },
    });
    onSave?.();
  };

  const handleJsonModeToggle = () => {
    updateProph3tConfig({ jsonMode: !proph3tConfig.jsonMode });
    onSave?.();
  };

  const handleBaseUrlChange = (url: string) => {
    updateProph3tConfig({ baseUrl: url });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <Cpu className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">PROPH3T Engine</h3>
            <p className="text-sm text-gray-500">Moteur IA multi-modele local (Ollama)</p>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={proph3tConfig.enabled}
            onChange={handleToggleEnabled}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
        </label>
      </div>

      {!proph3tConfig.enabled && (
        <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4">
          Activez PROPH3T pour utiliser plusieurs modeles Ollama avec routage intelligent.
          L'ancien mode Ollama (modele unique) reste actif quand PROPH3T est desactive.
        </div>
      )}

      {proph3tConfig.enabled && (
        <>
          {/* Connection */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Connexion Ollama</span>
              <div className="flex items-center gap-2">
                {health === 'healthy' && <CheckCircle className="w-4 h-4 text-green-500" />}
                {health === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                <button
                  onClick={scanModels}
                  disabled={scanning}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white border rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
                  Scanner
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">URL Ollama</label>
              <input
                type="text"
                value={proph3tConfig.baseUrl}
                onChange={(e) => handleBaseUrlChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-primary-500"
                placeholder="http://localhost:11434"
              />
            </div>

            {availableModels.length > 0 && (
              <p className="text-xs text-gray-500">
                {availableModels.length} modele{availableModels.length > 1 ? 's' : ''} detecte{availableModels.length > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Model Slots */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Assignation des modeles</h4>

            {(Object.entries(ROLE_CONFIG) as Array<[Proph3tModelRole, typeof ROLE_CONFIG[Proph3tModelRole]]>).map(([role, config]) => {
              const currentModel = proph3tConfig.models[role]?.name || '';
              const status = roleStatus?.[role];

              return (
                <div key={role} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                  <div className="p-1.5 bg-gray-100 rounded-md text-gray-600">
                    {config.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{config.label}</span>
                      {status && (
                        status.available ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded-full">
                            <CheckCircle className="w-2.5 h-2.5" />
                            {status.fallback ? 'Repli' : 'OK'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded-full">
                            <XCircle className="w-2.5 h-2.5" />
                            Absent
                          </span>
                        )
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{config.description}</p>
                  </div>

                  <select
                    value={currentModel}
                    onChange={(e) => handleModelChange(role as Proph3tModelRole, e.target.value)}
                    className="w-48 px-2 py-1.5 text-sm border rounded-md focus:ring-1 focus:ring-primary-500 bg-white"
                  >
                    <option value={currentModel}>{currentModel}</option>
                    {availableModels
                      .filter((m) => m !== currentModel)
                      .map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                  </select>
                </div>
              );
            })}
          </div>

          {/* JSON Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <span className="text-sm font-medium text-gray-700">Mode JSON</span>
              <p className="text-xs text-gray-500">Force le format JSON dans les reponses (recommande)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={proph3tConfig.jsonMode}
                onChange={handleJsonModeToggle}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-primary-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
            </label>
          </div>

          {/* Routing Table */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Table de routage</h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Detection</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Role</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Modele</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(DETECTION_MODEL_MAP).map(([type, role]) => {
                    const label = AI_DETECTION_LABELS[type as AIDetectionType]?.label || type;
                    const model = proph3tConfig.models[role]?.name || '—';
                    return (
                      <tr key={type} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 text-gray-700">{label}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            role === 'reasoning' ? 'bg-purple-100 text-purple-700' :
                            role === 'fast' ? 'bg-blue-100 text-blue-700' :
                            role === 'vision' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {role}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-gray-500 font-mono">{model}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cache Stats */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-gray-500" />
              <div>
                <span className="text-sm font-medium text-gray-700">Cache de categorisation</span>
                {cacheStats && (
                  <p className="text-xs text-gray-500">
                    {cacheStats.entries} entrees | Hit rate: {(cacheStats.hitRate * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={async () => {
                // Cache stats would be loaded from Proph3tEngine
                setCacheStats({ entries: 0, hitRate: 0 });
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-3 h-3" />
              Vider
            </button>
          </div>
        </>
      )}
    </div>
  );
}
