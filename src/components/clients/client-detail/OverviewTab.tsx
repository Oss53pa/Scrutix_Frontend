import { memo } from 'react';
import {
  PiggyBank,
  AlertTriangle,
  BarChart3,
  ShieldAlert,
  Zap,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardBody } from '../../ui';
import { formatCurrency } from '../../../utils';
import { ClientAnalytics, TabProps } from './types';

interface OverviewTabProps {
  analytics: ClientAnalytics;
  clientTransactions: TabProps['clientTransactions'];
  clientAnomalies: TabProps['clientAnomalies'];
}

export const OverviewTab = memo(function OverviewTab({
  analytics,
  clientTransactions,
  clientAnomalies,
}: OverviewTabProps) {
  return (
    <div className="space-y-4">
      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3 bg-gradient-to-br from-green-600 to-green-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-100">Economies realisees</p>
              <p className="text-xl font-bold mt-0.5">{formatCurrency(analytics.totalSavings, 'XAF')}</p>
              <p className="text-xs text-green-200 mt-1">+{formatCurrency(analytics.potentialSavings, 'XAF')} potentiel</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <PiggyBank className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-primary-500">Anomalies detectees</p>
              <p className="text-xl font-bold text-primary-900 mt-0.5">{clientAnomalies.length}</p>
              <p className="text-xs text-primary-400 mt-1">{analytics.confirmedCount} confirmees, {analytics.pendingCount} en attente</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-primary-500">Volume traite</p>
              <p className="text-xl font-bold text-primary-900 mt-0.5">{formatCurrency(analytics.totalVolume, 'XAF')}</p>
              <p className="text-xs text-primary-400 mt-1">{clientTransactions.length} transactions</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-primary-500">Score de risque</p>
              <p className={`text-xl font-bold mt-0.5 ${analytics.riskColor === 'red' ? 'text-red-600' : analytics.riskColor === 'yellow' ? 'text-yellow-600' : 'text-green-600'}`}>{analytics.riskScore}%</p>
              <p className="text-xs text-primary-400 mt-1">Niveau {analytics.riskLevel.toLowerCase()}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${analytics.riskColor === 'red' ? 'bg-red-100' : analytics.riskColor === 'yellow' ? 'bg-yellow-100' : 'bg-green-100'}`}>
              <ShieldAlert className={`w-5 h-5 ${analytics.riskColor === 'red' ? 'text-red-600' : analytics.riskColor === 'yellow' ? 'text-yellow-600' : 'text-green-600'}`} />
            </div>
          </div>
        </Card>
      </div>

      {/* Severity Distribution */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <Zap className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-red-600">{analytics.bySeverity.critical}</p>
              <p className="text-xs text-primary-500">Critiques</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-orange-600">{analytics.bySeverity.high}</p>
              <p className="text-xs text-primary-500">Hautes</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Activity className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-yellow-600">{analytics.bySeverity.medium}</p>
              <p className="text-xs text-primary-500">Moyennes</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-green-600">{analytics.bySeverity.low}</p>
              <p className="text-xs text-primary-500">Basses</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Evolution mensuelle</CardTitle>
          </CardHeader>
          <CardBody>
            <div style={{ width: '100%', height: 192 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
                <AreaChart data={analytics.monthlyTrend}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#171717" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#171717" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorSavingsClient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="month" stroke="#737373" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#737373" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#22c55e" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}
                    formatter={(value: number, name: string) => [
                      name === 'savings' || name === 'volume' ? formatCurrency(value, 'XAF') : value,
                      name === 'volume' ? 'Volume' : name === 'savings' ? 'Economies' : name === 'transactions' ? 'Transactions' : 'Anomalies'
                    ]}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="volume"
                    stroke="#171717"
                    fill="url(#colorVolume)"
                    name="Volume"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="anomalies"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ fill: '#f59e0b' }}
                    name="Anomalies"
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="savings"
                    stroke="#22c55e"
                    fill="url(#colorSavingsClient)"
                    name="Economies"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {/* Top Anomaly Types */}
        <Card>
          <CardHeader>
            <CardTitle>Types d'anomalies</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {analytics.topTypes.length > 0 ? (
                analytics.topTypes.map((item, idx) => (
                  <div key={item.type} className="flex items-center gap-4">
                    <div className="w-8 text-center">
                      <span className="text-sm font-bold text-primary-400">#{idx + 1}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-primary-900">{item.label}</span>
                        <span className="text-sm text-primary-600">{item.count} ({formatCurrency(item.amount, 'XAF')})</span>
                      </div>
                      <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-900 rounded-full"
                          style={{
                            width: `${(item.count / Math.max(...analytics.topTypes.map((t) => t.count))) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-primary-500">
                  Aucune anomalie detectee
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Transaction Summary & Bank Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Transaction Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Resume des transactions</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary-600">Credits</span>
                <span className="font-medium text-green-600">+{formatCurrency(analytics.creditVolume, 'XAF')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary-600">Debits</span>
                <span className="font-medium text-red-600">-{formatCurrency(analytics.debitVolume, 'XAF')}</span>
              </div>
              <div className="border-t border-primary-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-primary-600">Moyenne/transaction</span>
                  <span className="font-medium">{formatCurrency(analytics.avgTransaction, 'XAF')}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary-600">Taux de confirmation</span>
                <span className="font-medium text-blue-600">{analytics.confirmationRate}%</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Bank Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Repartition bancaire</CardTitle>
          </CardHeader>
          <CardBody>
            {analytics.bankDistribution.length > 0 ? (
              <div style={{ width: '100%', height: 160 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
                  <PieChart>
                    <Pie
                      data={analytics.bankDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="count"
                    >
                      {analytics.bankDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} transactions`, 'Volume']} />
                    <Legend
                      layout="horizontal"
                      align="center"
                      verticalAlign="bottom"
                      formatter={(value) => <span className="text-xs">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-primary-500">
                Aucune transaction
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
});
