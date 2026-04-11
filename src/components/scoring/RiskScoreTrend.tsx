/**
 * @module AtlasBanx
 * @file src/components/scoring/RiskScoreTrend.tsx
 * @description Sparkline 12 mois de l'évolution du score de risque.
 *              Utilise recharts (déjà dans les deps).
 */

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { RiskScoreHistoryEntry } from '../../scoring';

interface RiskScoreTrendProps {
  history: RiskScoreHistoryEntry[];
  height?: number;
}

export function RiskScoreTrend({ history, height = 120 }: RiskScoreTrendProps) {
  if (history.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-primary-400"
        style={{ height }}
      >
        Aucun historique disponible — lancez une analyse pour démarrer le suivi.
      </div>
    );
  }

  const data = history.map((entry) => ({
    date: format(entry.computedAt, 'dd/MM', { locale: fr }),
    fullDate: format(entry.computedAt, 'dd MMMM yyyy', { locale: fr }),
    score: entry.score,
    level: entry.level,
  }));

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              padding: '6px 10px',
            }}
            formatter={(value: number) => [`${value}/100`, 'Score']}
            labelFormatter={(_: string, payload) => {
              const item = payload?.[0]?.payload as { fullDate?: string } | undefined;
              return item?.fullDate ?? '';
            }}
          />
          <ReferenceLine y={25} stroke="#16a34a" strokeDasharray="3 3" />
          <ReferenceLine y={50} stroke="#d97706" strokeDasharray="3 3" />
          <ReferenceLine y={75} stroke="#dc2626" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#1e3a8a"
            strokeWidth={2}
            dot={{ r: 3, fill: '#1e3a8a' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
