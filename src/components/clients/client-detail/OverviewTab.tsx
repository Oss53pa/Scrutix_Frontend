import { memo } from 'react';
import {
  PiggyBank,
  AlertTriangle,
  BarChart3,
  ShieldAlert,
  Zap,
  Activity,
  CheckCircle2,
  Landmark,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
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
        <Card className="p-3 bg-gradient-to-br from-primary-600 to-primary-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-primary-100">Economies realisees</p>
              <p className="text-xl font-bold mt-0.5">{formatCurrency(analytics.totalSavings, 'XAF')}</p>
              <p className="text-xs text-primary-200 mt-1">+{formatCurrency(analytics.potentialSavings, 'XAF')} potentiel</p>
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
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-primary-600" />
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
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-600" />
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-primary-500">Score de risque</p>
              <p className="text-xl font-bold mt-0.5 text-primary-600">{analytics.riskScore}%</p>
              <p className="text-xs text-primary-400 mt-1">Niveau {analytics.riskLevel.toLowerCase()}</p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary-100">
              <ShieldAlert className="w-5 h-5 text-primary-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Severity Distribution */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-primary-600">{analytics.bySeverity.critical}</p>
              <p className="text-xs text-primary-500">Critiques</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-primary-600">{analytics.bySeverity.high}</p>
              <p className="text-xs text-primary-500">Hautes</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-primary-600">{analytics.bySeverity.medium}</p>
              <p className="text-xs text-primary-500">Moyennes</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-primary-600">{analytics.bySeverity.low}</p>
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
                <span className="font-medium text-primary-600">+{formatCurrency(analytics.creditVolume, 'XAF')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary-600">Debits</span>
                <span className="font-medium text-primary-600">-{formatCurrency(analytics.debitVolume, 'XAF')}</span>
              </div>
              <div className="border-t border-primary-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-primary-600">Moyenne/transaction</span>
                  <span className="font-medium">{formatCurrency(analytics.avgTransaction, 'XAF')}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary-600">Taux de confirmation</span>
                <span className="font-medium text-primary-600">{analytics.confirmationRate}%</span>
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

      {/* ─── SYNTHÈSE PAR BANQUE ─── */}
      {/* Multi-bank consolidated view + intra-client benchmark.
          Only visible when the client has at least one bank connection. */}
      {analytics.banks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-primary-600" />
            <h2 className="text-sm font-bold text-primary-900 uppercase tracking-wider">
              Synthèse par banque ({analytics.banks.length})
            </h2>
          </div>

          {/* Per-bank breakdown cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {analytics.banks.map((b) => (
              <Card key={b.bankCode} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                      <Landmark className="w-4 h-4 text-primary-700" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary-900 truncate max-w-[180px]">{b.bankName}</p>
                      <p className="text-[10px] text-primary-500">
                        {b.zone ?? '—'} · {b.transactions} tx
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-pill text-[10px] font-semibold ${
                    b.anomalyRate > 0.2 ? 'bg-red-100 text-red-700'
                    : b.anomalyRate > 0.05 ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {(b.anomalyRate * 100).toFixed(1)}% anomalies
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-primary-500">Crédits</p>
                    <p className="font-semibold text-emerald-700 tabular-nums">{formatCurrency(b.creditVolume, 'XAF')}</p>
                  </div>
                  <div>
                    <p className="text-primary-500">Débits</p>
                    <p className="font-semibold text-red-700 tabular-nums">{formatCurrency(b.debitVolume, 'XAF')}</p>
                  </div>
                  <div>
                    <p className="text-primary-500">Frais détectés</p>
                    <p className="font-semibold text-primary-900 tabular-nums">{formatCurrency(b.feeVolume, 'XAF')}</p>
                    <p className="text-[10px] text-primary-400">{(b.feeRate * 100).toFixed(1)}% des débits</p>
                  </div>
                  <div>
                    <p className="text-primary-500">Économies</p>
                    <p className="font-semibold text-primary-900 tabular-nums">{formatCurrency(b.savings + b.potentialSavings, 'XAF')}</p>
                    {b.potentialSavings > 0 && (
                      <p className="text-[10px] text-amber-600">+{formatCurrency(b.potentialSavings, 'XAF')} en attente</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Intra-client benchmark — only meaningful with 2+ banks */}
          {analytics.banks.length >= 2 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-primary-600" />
                  <CardTitle>Benchmark inter-banques pour ce client</CardTitle>
                </div>
                <p className="text-xs text-primary-500 mt-1">
                  Comparaison directe des banques utilisées par ce client. Le pire et le meilleur sont signalés sur chaque métrique.
                </p>
              </CardHeader>
              <CardBody className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-primary-50 border-b border-primary-100">
                      <tr className="text-[10px] uppercase tracking-wider text-primary-600 font-semibold">
                        <th className="text-left px-4 py-2.5">Banque</th>
                        <th className="text-right px-3 py-2.5">Volume</th>
                        <th className="text-right px-3 py-2.5">Frais détectés</th>
                        <th className="text-right px-3 py-2.5">Taux de frais</th>
                        <th className="text-right px-3 py-2.5">Anomalies</th>
                        <th className="text-right px-3 py-2.5">Taux d'anomalie</th>
                        <th className="text-right px-3 py-2.5">Économies</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary-100">
                      {(() => {
                        const bs = analytics.banks;
                        const maxFeeRate = Math.max(...bs.map((b) => b.feeRate));
                        const minFeeRate = Math.min(...bs.map((b) => b.feeRate));
                        const maxAnoRate = Math.max(...bs.map((b) => b.anomalyRate));
                        const minAnoRate = Math.min(...bs.map((b) => b.anomalyRate));
                        const maxSavings = Math.max(...bs.map((b) => b.savings + b.potentialSavings));
                        return bs.map((b) => {
                          const total = b.savings + b.potentialSavings;
                          const isWorstFee = bs.length > 1 && b.feeRate === maxFeeRate && b.feeRate > 0;
                          const isBestFee = bs.length > 1 && b.feeRate === minFeeRate && b.feeRate < maxFeeRate;
                          const isWorstAno = bs.length > 1 && b.anomalyRate === maxAnoRate && b.anomalyRate > 0;
                          const isBestAno = bs.length > 1 && b.anomalyRate === minAnoRate && b.anomalyRate < maxAnoRate;
                          const isHighestSavings = bs.length > 1 && total === maxSavings && total > 0;
                          return (
                            <tr key={b.bankCode} className="hover:bg-primary-50/60">
                              <td className="px-4 py-2.5">
                                <div className="font-medium text-primary-900">{b.bankName}</div>
                                <div className="text-[10px] text-primary-500">{b.zone ?? '—'} · {b.transactions} tx</div>
                              </td>
                              <td className="text-right px-3 py-2.5 tabular-nums text-primary-700">
                                {formatCurrency(b.totalVolume, 'XAF')}
                              </td>
                              <td className="text-right px-3 py-2.5 tabular-nums text-primary-900">
                                {formatCurrency(b.feeVolume, 'XAF')}
                              </td>
                              <td className={`text-right px-3 py-2.5 tabular-nums font-semibold ${
                                isWorstFee ? 'text-red-700' : isBestFee ? 'text-emerald-700' : 'text-primary-700'
                              }`}>
                                <span className="inline-flex items-center gap-1 justify-end">
                                  {isWorstFee && <TrendingUp className="w-3 h-3" />}
                                  {isBestFee && <TrendingDown className="w-3 h-3" />}
                                  {(b.feeRate * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="text-right px-3 py-2.5 tabular-nums text-primary-900">{b.anomalies}</td>
                              <td className={`text-right px-3 py-2.5 tabular-nums font-semibold ${
                                isWorstAno ? 'text-red-700' : isBestAno ? 'text-emerald-700' : 'text-primary-700'
                              }`}>
                                <span className="inline-flex items-center gap-1 justify-end">
                                  {isWorstAno && <TrendingUp className="w-3 h-3" />}
                                  {isBestAno && <TrendingDown className="w-3 h-3" />}
                                  {(b.anomalyRate * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className={`text-right px-3 py-2.5 tabular-nums font-bold ${
                                isHighestSavings ? 'text-amber-700' : 'text-primary-900'
                              }`}>
                                {formatCurrency(total, 'XAF')}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                    <tfoot className="bg-primary-50 border-t border-primary-200">
                      <tr className="text-[11px] font-semibold">
                        <td className="px-4 py-2 text-primary-700 uppercase tracking-wider text-[10px]">Consolidé</td>
                        <td className="text-right px-3 py-2 tabular-nums">
                          {formatCurrency(analytics.banks.reduce((s, b) => s + b.totalVolume, 0), 'XAF')}
                        </td>
                        <td className="text-right px-3 py-2 tabular-nums">
                          {formatCurrency(analytics.banks.reduce((s, b) => s + b.feeVolume, 0), 'XAF')}
                        </td>
                        <td className="text-right px-3 py-2 text-primary-500 text-[10px]">—</td>
                        <td className="text-right px-3 py-2 tabular-nums">
                          {analytics.banks.reduce((s, b) => s + b.anomalies, 0)}
                        </td>
                        <td className="text-right px-3 py-2 text-primary-500 text-[10px]">—</td>
                        <td className="text-right px-3 py-2 tabular-nums">
                          {formatCurrency(
                            analytics.banks.reduce((s, b) => s + b.savings + b.potentialSavings, 0),
                            'XAF',
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
});
