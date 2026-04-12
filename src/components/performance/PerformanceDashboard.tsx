/**
 * @module AtlasBanx
 * @file src/components/performance/PerformanceDashboard.tsx
 * @description Dashboard de performance pour Settings — affiche les
 *              métriques des 30 dernières analyses, les SLA, et les
 *              recommandations d'optimisation.
 */

import { useState, useEffect } from 'react';
import { Activity, Clock, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { Card, CardHeader, CardTitle, CardBody, Alert, Badge } from '../ui';
import {
  getPerformanceMonitor,
  type PerformanceMetrics,
  SLA_THRESHOLDS,
  STEP_LABELS,
} from '../../performance';

export function PerformanceDashboard() {
  const [history, setHistory] = useState<readonly PerformanceMetrics[]>([]);

  useEffect(() => {
    setHistory(getPerformanceMonitor().getHistory());
  }, []);

  const avgThroughput =
    history.length > 0
      ? Math.round(history.reduce((s, m) => s + m.throughput, 0) / history.length)
      : 0;

  const avgDuration =
    history.length > 0
      ? Math.round(history.reduce((s, m) => s + m.totalMs, 0) / history.length)
      : 0;

  const successRate =
    history.length > 0
      ? Math.round((history.filter((m) => m.success).length / history.length) * 100)
      : 100;

  const chartData = history
    .slice()
    .reverse()
    .map((m, i) => ({
      name: `#${i + 1}`,
      duration: Math.round(m.totalMs / 1000),
      transactions: m.transactionCount,
    }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-700" />
              </div>
              <div>
                <div className="text-2xl font-bold text-primary-900">
                  {avgThroughput.toLocaleString('fr-FR')} tx/s
                </div>
                <div className="text-xs text-primary-500">Débit moyen</div>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary-700" />
              </div>
              <div>
                <div className="text-2xl font-bold text-primary-900">
                  {avgDuration > 60000
                    ? `${(avgDuration / 60000).toFixed(1)} min`
                    : `${(avgDuration / 1000).toFixed(1)} s`}
                </div>
                <div className="text-xs text-primary-500">Durée moyenne</div>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary-700" />
              </div>
              <div>
                <div className="text-2xl font-bold text-primary-900">{successRate}%</div>
                <div className="text-xs text-primary-500">Taux de réussite</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Graphique durées */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Durée par analyse (secondes)</CardTitle>
          </CardHeader>
          <CardBody>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      name === 'duration' ? `${v} s` : `${v.toLocaleString('fr-FR')} tx`,
                      name === 'duration' ? 'Durée' : 'Transactions',
                    ]}
                  />
                  <ReferenceLine y={180} stroke="#d97706" strokeDasharray="3 3" label="SLA 10k" />
                  <Bar dataKey="duration" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      )}

      {/* SLA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Engagements de traitement (SLA)
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="space-y-2">
            {SLA_THRESHOLDS.map((sla, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 border border-primary-200 rounded-lg"
              >
                <span className="text-sm text-primary-700">{sla.label}</span>
                <Badge variant="success">Garanti</Badge>
              </div>
            ))}
            <Alert variant="info" title="Disponibilité">
              99.5% (Supabase SLA). RTO: 4h en cas d'incident majeur. RPO: 24h (backup quotidien).
              Exclusions: pannes réseau côté client, quotas LLM providers dépassés.
            </Alert>
          </div>
        </CardBody>
      </Card>

      {/* Étapes les plus longues */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Répartition par étape (dernière analyse)</CardTitle>
          </CardHeader>
          <CardBody>
            {history[0].steps.length === 0 ? (
              <div className="text-sm text-primary-500 text-center py-4">
                Pas de données de décomposition disponibles.
              </div>
            ) : (
              <div className="space-y-2">
                {history[0].steps.map((step) => (
                  <div key={step.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-primary-700">{STEP_LABELS[step.name]}</span>
                      <span className="text-primary-500 font-mono">
                        {(step.durationMs / 1000).toFixed(1)}s ({step.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-700 transition-all"
                        style={{ width: `${step.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {history.length === 0 && (
        <div className="flex items-center gap-2 p-4 text-sm text-primary-500 bg-primary-50 rounded-lg border border-primary-200">
          <AlertTriangle className="w-4 h-4" />
          Aucune analyse enregistrée — les métriques apparaîtront après la première analyse complète.
        </div>
      )}
    </div>
  );
}
