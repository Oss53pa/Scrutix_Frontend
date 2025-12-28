import { memo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardBody, DetectionBadge } from '../../ui';
import { formatCurrency, formatDate } from '../../../utils';
import { AnomalyType, ANOMALY_TYPE_LABELS, Anomaly } from '../../../types';
import { ClientAnalytics } from './types';

interface SavingsTabProps {
  analytics: ClientAnalytics;
  clientAnomalies: Anomaly[];
}

export const SavingsTab = memo(function SavingsTab({
  analytics,
  clientAnomalies,
}: SavingsTabProps) {
  const confirmedAnomalies = clientAnomalies.filter((a) => a.status === 'confirmed');

  return (
    <div className="space-y-4">
      {/* Savings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-3 bg-gradient-to-br from-green-600 to-green-700 text-white">
          <p className="text-xs text-green-100 mb-0.5">Economies totales</p>
          <p className="text-2xl font-bold">{formatCurrency(analytics.totalSavings, 'XAF')}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-primary-500 mb-0.5">Economies potentielles</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(analytics.potentialSavings, 'XAF')}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-primary-500 mb-0.5">Taux de confirmation</p>
          <p className="text-2xl font-bold text-blue-600">{analytics.confirmationRate}%</p>
        </Card>
      </div>

      {/* Savings Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Evolution des economies</CardTitle>
        </CardHeader>
        <CardBody>
          <div style={{ width: '100%', height: 192 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
              <AreaChart data={analytics.monthlyTrend}>
                <defs>
                  <linearGradient id="colorSavingsTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="month" stroke="#737373" fontSize={12} />
                <YAxis stroke="#737373" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, 'XAF')}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}
                />
                <Area
                  type="monotone"
                  dataKey="savings"
                  stroke="#22c55e"
                  fill="url(#colorSavingsTrend)"
                  name="Economies"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* Detail list */}
      <Card>
        <CardHeader>
          <CardTitle>Detail des economies</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {confirmedAnomalies.length === 0 ? (
            <div className="p-6 text-center text-primary-500 text-sm">
              Aucune economie realisee pour le moment
            </div>
          ) : (
            <div className="divide-y divide-primary-100">
              {confirmedAnomalies.map((anomaly) => (
                <div key={anomaly.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-primary-900">
                        {ANOMALY_TYPE_LABELS[anomaly.type as AnomalyType] || anomaly.type}
                      </p>
                      <DetectionBadge source={anomaly.detectionSource} size="sm" />
                    </div>
                    <p className="text-sm text-primary-500">{formatDate(anomaly.detectedAt)}</p>
                  </div>
                  <p className="text-lg font-bold text-green-600">
                    +{formatCurrency(anomaly.amount, 'XAF')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
});
