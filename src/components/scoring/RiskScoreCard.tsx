/**
 * @module AtlasBanx
 * @file src/components/scoring/RiskScoreCard.tsx
 * @description Carte détaillée du score de risque pour la fiche client.
 *              Inclut une jauge circulaire CSS pure (pas de lib externe),
 *              la décomposition par dimension en barres de progression,
 *              et l'évolution vs période précédente.
 */

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '../ui';
import {
  DIMENSION_LABELS,
  DIMENSION_WEIGHTS,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_DESCRIPTIONS,
  RISK_LEVEL_COLORS,
  type RiskScore,
  type RiskDimensions,
  type RiskLevel,
} from '../../scoring';

interface RiskScoreCardProps {
  current: RiskScore;
  previous?: RiskScore | null;
  onSeeAnomalies?: () => void;
}

export function RiskScoreCard({ current, previous, onSeeAnomalies }: RiskScoreCardProps) {
  const colors = RISK_LEVEL_COLORS[current.level];
  const delta = previous ? current.score - previous.score : null;
  const TrendIcon = delta == null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Score de risque global</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Jauge circulaire */}
          <div className="flex flex-col items-center justify-center">
            <CircularGauge score={current.score} level={current.level} />
            <div className={`mt-3 text-center px-3 py-1 rounded-full ${colors.bg} ${colors.text}`}>
              <div className="font-semibold text-sm">{RISK_LEVEL_LABELS[current.level]}</div>
              <div className="text-xs opacity-80">{RISK_LEVEL_DESCRIPTIONS[current.level]}</div>
            </div>
            {delta != null && (
              <div className="mt-2 flex items-center gap-1 text-sm text-primary-600">
                <TrendIcon
                  className={`w-4 h-4 ${
                    delta > 0 ? 'text-red-600' : delta < 0 ? 'text-green-600' : 'text-primary-400'
                  }`}
                />
                <span>
                  {delta > 0 ? '+' : ''}
                  {delta} pts vs période précédente
                </span>
              </div>
            )}
          </div>

          {/* Décomposition par dimension */}
          <div className="md:col-span-2 space-y-3">
            <DimensionBars dimensions={current.dimensions} />

            {onSeeAnomalies && (
              <button
                type="button"
                onClick={onSeeAnomalies}
                className="text-sm text-primary-700 hover:text-primary-900 hover:underline mt-2"
              >
                Voir les anomalies en détail →
              </button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// CIRCULAR GAUGE — pure SVG, no external lib
// ----------------------------------------------------------------------------

function CircularGauge({ score, level }: { score: number; level: RiskLevel }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const strokeColor = useMemo(() => {
    switch (level) {
      case 'low':      return '#16a34a'; // green-600
      case 'moderate': return '#d97706'; // amber-600
      case 'high':     return '#ea580c'; // orange-600
      case 'critical': return '#dc2626'; // red-600
    }
  }, [level]);

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms ease, stroke 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold text-primary-900">{score}</div>
        <div className="text-xs text-primary-500">/ 100</div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// DIMENSION BARS
// ----------------------------------------------------------------------------

function DimensionBars({ dimensions }: { dimensions: RiskDimensions }) {
  return (
    <div className="space-y-2.5">
      {(Object.keys(dimensions) as Array<keyof RiskDimensions>).map((key) => {
        const value = dimensions[key];
        const max = DIMENSION_WEIGHTS[key];
        const pct = max > 0 ? Math.round((value / max) * 100) : 0;
        const barColor =
          pct < 33 ? 'bg-green-500'
          : pct < 66 ? 'bg-amber-500'
          : 'bg-red-500';
        return (
          <div key={key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-primary-700 font-medium">{DIMENSION_LABELS[key]}</span>
              <span className="font-mono text-primary-500">
                {value.toFixed(1)} / {max} pts
              </span>
            </div>
            <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor} transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
