// ============================================================================
// ATLASBANX - PROPH3T Intelligence Dashboard
// Monitoring des inferences: metriques par competence, latences, confiance
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  CompetenceId,
  COMPETENCE_LABELS,
  COMPETENCE_ZONES,
} from '../../ai/proph3t/intelligence';
import { isLlmAvailable } from '../../ai/proph3t/intelligence/llmEnricher';
import { isSupabaseConfigured, getSupabaseClient } from '../../lib/supabase';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface CompetenceMetric {
  competence_id: number;
  model_used: string;
  total_calls: number;
  avg_duration_ms: number;
  avg_confidence: number;
  avg_tokens: number;
  validated_count: number;
  pending_count: number;
  validation_rate_pct: number;
}

interface DashboardState {
  metrics: CompetenceMetric[];
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
}

// Zone badge colors
const ZONE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  green: { bg: 'bg-green-100', text: 'text-green-800', label: 'Verte' },
  orange: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Orange' },
  red: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rouge' },
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function IntelligenceDashboard() {
  const [state, setState] = useState<DashboardState>({
    metrics: [],
    loading: false,
    error: null,
    lastRefresh: null,
  });

  const fetchMetrics = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setState(prev => ({ ...prev, error: 'Supabase non configure' }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .schema('atlasbanx' as 'public')
        .from('proph3t_competence_metrics')
        .select('*');

      if (error) throw error;

      setState({
        metrics: (data as CompetenceMetric[]) ?? [],
        loading: false,
        error: null,
        lastRefresh: new Date(),
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Erreur chargement metriques',
      }));
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const llmStatus = isLlmAvailable();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            PROPH3T Intelligence
          </h2>
          <p className="text-sm text-gray-500">
            Monitoring des 14 competences — 30 derniers jours
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            llmStatus ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}>
            <span className={`w-2 h-2 rounded-full ${llmStatus ? 'bg-green-500' : 'bg-gray-400'}`} />
            {llmStatus ? 'LLM Ollama actif' : 'Mode deterministe'}
          </span>
          <button
            onClick={fetchMetrics}
            disabled={state.loading}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {state.loading ? 'Chargement...' : 'Rafraichir'}
          </button>
        </div>
      </div>

      {/* Error */}
      {state.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Competence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Object.values(CompetenceId)
          .filter((v): v is CompetenceId => typeof v === 'number')
          .map(id => {
            const metric = state.metrics.find(m => m.competence_id === id);
            const zone = COMPETENCE_ZONES[id];
            const zoneStyle = ZONE_COLORS[zone];

            return (
              <CompetenceCard
                key={id}
                id={id}
                label={COMPETENCE_LABELS[id]}
                zone={zoneStyle}
                metric={metric}
              />
            );
          })}
      </div>

      {/* Metrics Table */}
      {state.metrics.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Competence</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Appels</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Latence moy.</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Confiance moy.</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Tokens moy.</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Validation</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">En attente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {state.metrics.map(m => (
                <tr key={`${m.competence_id}-${m.model_used}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className="font-medium">C{m.competence_id}</span>
                    <span className="text-gray-500 ml-1">{COMPETENCE_LABELS[m.competence_id as CompetenceId]}</span>
                    <span className="text-xs text-gray-400 ml-1">({m.model_used})</span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{m.total_calls}</td>
                  <td className="px-4 py-2 text-right font-mono">{m.avg_duration_ms}ms</td>
                  <td className="px-4 py-2 text-right">
                    <ConfidenceBadge value={m.avg_confidence} />
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{m.avg_tokens}</td>
                  <td className="px-4 py-2 text-right font-mono">{m.validation_rate_pct}%</td>
                  <td className="px-4 py-2 text-right">
                    {m.pending_count > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">
                        {m.pending_count}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!state.loading && state.metrics.length === 0 && !state.error && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">Aucune inference enregistree</p>
          <p className="text-sm mt-1">Les metriques apparaitront apres les premiers appels au gateway.</p>
        </div>
      )}

      {/* Footer */}
      {state.lastRefresh && (
        <p className="text-xs text-gray-400 text-right">
          Derniere mise a jour : {state.lastRefresh.toLocaleTimeString('fr-FR')}
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function CompetenceCard({ id, label, zone, metric }: {
  id: CompetenceId;
  label: string;
  zone: { bg: string; text: string; label: string };
  metric?: CompetenceMetric;
}) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">C{id}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${zone.bg} ${zone.text}`}>
          {zone.label}
        </span>
      </div>
      <p className="text-xs text-gray-600 mb-3 line-clamp-1">{label}</p>

      {metric ? (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-400">Appels</span>
            <p className="font-mono font-medium">{metric.total_calls}</p>
          </div>
          <div>
            <span className="text-gray-400">Latence</span>
            <p className="font-mono font-medium">{metric.avg_duration_ms}ms</p>
          </div>
          <div>
            <span className="text-gray-400">Confiance</span>
            <ConfidenceBadge value={metric.avg_confidence} />
          </div>
          <div>
            <span className="text-gray-400">Validation</span>
            <p className="font-mono font-medium">{metric.validation_rate_pct}%</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">Pas de donnees</p>
      )}
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 80 ? 'text-green-700' : value >= 50 ? 'text-amber-700' : 'text-red-700';
  return <span className={`font-mono font-medium ${color}`}>{value}%</span>;
}
