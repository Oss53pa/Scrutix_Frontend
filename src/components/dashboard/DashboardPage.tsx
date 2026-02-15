import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  FileSearch,
  AlertTriangle,
  TrendingUp,
  Plus,
  FileText,
  Search,
  ArrowRight,
  CheckCircle2,
  Landmark,
  PiggyBank,
  ShieldAlert,
  BarChart3,
  Activity,
  Target,
  Zap,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  Line,
  Bar,
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
  RadialBarChart,
  RadialBar,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardBody, Button, Badge, SeverityBadge } from '../ui';
import { useClientStore } from '../../store/clientStore';
import { useBankStore } from '../../store/bankStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { useBillingStore } from '../../store/billingStore';
import { useTransactionStore } from '../../store/transactionStore';
import { formatCurrency, formatDate } from '../../utils';
import { Severity, AnomalyType, ANOMALY_TYPE_LABELS } from '../../types';

export function DashboardPage() {
  const navigate = useNavigate();
  const { clients, statements } = useClientStore();
  const { banks } = useBankStore();
  const { analysisHistory = [], currentAnalysis } = useAnalysisStore();
  const { invoices = [] } = useBillingStore();
  const { transactions } = useTransactionStore();

  // Calculate comprehensive stats
  const stats = useMemo(() => {
    const allAnomalies = [
      ...(currentAnalysis?.anomalies || []),
      ...(analysisHistory || []).flatMap((r) => r.anomalies),
    ];

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    // Anomalies this month vs last month
    const anomaliesThisMonth = allAnomalies.filter((a) => {
      const date = new Date(a.detectedAt);
      return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
    });

    const anomaliesLastMonth = allAnomalies.filter((a) => {
      const date = new Date(a.detectedAt);
      return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
    });

    // Savings
    const confirmedAnomalies = allAnomalies.filter((a) => a.status === 'confirmed');
    const totalSavings = confirmedAnomalies.reduce((sum, a) => sum + a.amount, 0);
    const potentialSavings = allAnomalies
      .filter((a) => a.status === 'pending')
      .reduce((sum, a) => sum + a.amount, 0);

    // By severity
    const criticalCount = allAnomalies.filter((a) => a.severity === Severity.CRITICAL).length;
    const highCount = allAnomalies.filter((a) => a.severity === Severity.HIGH).length;
    const mediumCount = allAnomalies.filter((a) => a.severity === Severity.MEDIUM).length;
    const lowCount = allAnomalies.filter((a) => a.severity === Severity.LOW).length;

    // By type
    const byType = Object.values(AnomalyType).reduce((acc, type) => {
      acc[type] = allAnomalies.filter((a) => a.type === type).length;
      return acc;
    }, {} as Record<string, number>);

    // Statements stats
    const analyzedStatements = statements.filter((s) => s.status === 'analyzed').length;
    const pendingStatements = statements.filter((s) => s.status === 'imported').length;

    // Client risk scores (simulated based on anomalies)
    const clientRiskScores = clients.map((client) => {
      const clientAnomalies = allAnomalies.filter((a) =>
        a.transactions.some((t) => t.clientId === client.id)
      );
      const riskScore = Math.min(
        100,
        clientAnomalies.reduce((score, a) => {
          if (a.severity === Severity.CRITICAL) return score + 25;
          if (a.severity === Severity.HIGH) return score + 15;
          if (a.severity === Severity.MEDIUM) return score + 8;
          return score + 3;
        }, 0)
      );
      const savings = clientAnomalies
        .filter((a) => a.status === 'confirmed')
        .reduce((sum, a) => sum + a.amount, 0);
      return { ...client, riskScore, anomalyCount: clientAnomalies.length, savings };
    });

    // Transaction volume
    const totalTransactionVolume = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Monthly trend data (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthAnomalies = allAnomalies.filter((a) => {
        const date = new Date(a.detectedAt);
        return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
      });
      const monthSavings = monthAnomalies
        .filter((a) => a.status === 'confirmed')
        .reduce((sum, a) => sum + a.amount, 0);
      monthlyTrend.push({
        month: month.toLocaleDateString('fr-FR', { month: 'short' }),
        anomalies: monthAnomalies.length,
        savings: monthSavings,
        critical: monthAnomalies.filter((a) => a.severity === Severity.CRITICAL).length,
      });
    }

    return {
      clients: clients.length,
      statements: statements.length,
      analyzedStatements,
      pendingStatements,
      allAnomalies,
      anomaliesThisMonth: anomaliesThisMonth.length,
      anomaliesLastMonth: anomaliesLastMonth.length,
      totalSavings,
      potentialSavings,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      byType,
      clientRiskScores,
      totalTransactionVolume,
      monthlyTrend,
      confirmedRate: allAnomalies.length > 0
        ? Math.round((confirmedAnomalies.length / allAnomalies.length) * 100)
        : 0,
    };
  }, [clients, statements, currentAnalysis, analysisHistory, transactions]);

  // Bank distribution for pie chart
  const bankDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    transactions.forEach((t) => {
      const bank = banks.find((b) => b.code === t.bankCode);
      const name = bank?.name || 'Autre';
      distribution[name] = (distribution[name] || 0) + 1;
    });
    return Object.entries(distribution)
      .map(([name, value], i) => ({
        name,
        value,
        color: ['#171717', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#737373'][i % 6],
      }))
      .slice(0, 6);
  }, [transactions, banks]);

  // Top anomaly types
  const topAnomalyTypes = useMemo(() => {
    return Object.entries(stats.byType)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({
        type,
        label: ANOMALY_TYPE_LABELS[type as AnomalyType] || type,
        count,
      }));
  }, [stats.byType]);

  // Risk distribution for radial chart
  const riskData = [
    { name: 'Critique', value: stats.criticalCount, fill: '#ef4444' },
    { name: 'Haute', value: stats.highCount, fill: '#f97316' },
    { name: 'Moyenne', value: stats.mediumCount, fill: '#eab308' },
    { name: 'Basse', value: stats.lowCount, fill: '#22c55e' },
  ];

  // Calculate growth percentages
  const anomalyGrowth = stats.anomaliesLastMonth > 0
    ? Math.round(((stats.anomaliesThisMonth - stats.anomaliesLastMonth) / stats.anomaliesLastMonth) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary-900">Tableau de bord</h1>
          <p className="text-sm text-primary-500">Vue d'ensemble de l'activité du cabinet</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/analyses')}>
            <Search className="w-4 h-4 mr-1" />
            Nouvelle analyse
          </Button>
          <Button size="sm" onClick={() => navigate('/import')}>
            <Plus className="w-4 h-4 mr-1" />
            Importer
          </Button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3 bg-gradient-to-br from-primary-900 to-primary-800 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-primary-300">Clients actifs</p>
              <p className="text-2xl font-bold">{stats.clients}</p>
              <p className="text-xs text-primary-400">{stats.statements} relevés</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-primary-500">Anomalies ce mois</p>
              <p className="text-2xl font-bold text-primary-900">{stats.anomaliesThisMonth}</p>
              <div className="flex items-center gap-1">
                {anomalyGrowth > 0 ? (
                  <ArrowUpRight className="w-3 h-3 text-primary-500" />
                ) : anomalyGrowth < 0 ? (
                  <ArrowDownRight className="w-3 h-3 text-primary-500" />
                ) : null}
                <span className={`text-xs ${anomalyGrowth > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {anomalyGrowth > 0 ? '+' : ''}{anomalyGrowth}%
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-primary-600" />
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-primary-500">Economies realisees</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(stats.totalSavings, 'XAF')}</p>
              <p className="text-xs text-primary-400">+{formatCurrency(stats.potentialSavings, 'XAF')}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <PiggyBank className="w-5 h-5 text-primary-600" />
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-primary-500">Taux de confirmation</p>
              <p className="text-2xl font-bold text-blue-600">{stats.confirmedRate}%</p>
              <p className="text-xs text-primary-400">{stats.allAnomalies.filter((a) => a.status === 'confirmed').length}/{stats.allAnomalies.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Critical Alerts Banner */}
      {stats.criticalCount > 0 && (
        <Card className="p-3 bg-red-50 border-red-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800">
                  {stats.criticalCount} anomalie{stats.criticalCount > 1 ? 's' : ''} critique{stats.criticalCount > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-red-600">Action immediate requise</p>
              </div>
            </div>
            <Button variant="primary" size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => navigate('/analyses')}>
              Voir
            </Button>
          </div>
        </Card>
      )}

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-red-600">{stats.criticalCount}</p>
              <p className="text-xs text-primary-500">Critiques</p>
            </div>
          </div>
        </Card>
        <Card className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-orange-600">{stats.highCount}</p>
              <p className="text-xs text-primary-500">Hautes</p>
            </div>
          </div>
        </Card>
        <Card className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-yellow-600">{stats.mediumCount}</p>
              <p className="text-xs text-primary-500">Moyennes</p>
            </div>
          </div>
        </Card>
        <Card className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-green-600">{stats.lowCount}</p>
              <p className="text-xs text-primary-500">Basses</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolution Chart */}
        <Card>
          <CardHeader className="py-2">
            <CardTitle className="text-sm">Evolution mensuelle</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <div style={{ width: '100%', height: 192 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
                <AreaChart data={stats.monthlyTrend}>
                  <defs>
                    <linearGradient id="colorAnomalies" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#171717" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#171717" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="month" stroke="#737373" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#737373" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#22c55e" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}
                    formatter={(value: number, name: string) => [
                      name === 'savings' ? formatCurrency(value, 'XAF') : value,
                      name === 'savings' ? 'Economies' : name === 'anomalies' ? 'Anomalies' : 'Critiques'
                    ]}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="anomalies"
                    stroke="#171717"
                    fillOpacity={1}
                    fill="url(#colorAnomalies)"
                    name="Anomalies"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="critical"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ fill: '#ef4444' }}
                    name="Critiques"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="savings"
                    stroke="#22c55e"
                    fillOpacity={1}
                    fill="url(#colorSavings)"
                    name="Economies"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {/* Anomaly Types Distribution */}
        <Card>
          <CardHeader className="py-2">
            <CardTitle className="text-sm">Types d'anomalies</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-2">
              {topAnomalyTypes.length > 0 ? (
                topAnomalyTypes.map((item, idx) => (
                  <div key={item.type} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary-400 w-5">#{idx + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-primary-900">{item.label}</span>
                        <span className="text-xs font-bold text-primary-900">{item.count}</span>
                      </div>
                      <div className="h-1.5 bg-primary-100 rounded-full overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-primary-900 rounded-full"
                          style={{ width: `${(item.count / Math.max(...topAnomalyTypes.map((t) => t.count))) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-primary-500 text-sm">Aucune anomalie</div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Third Row - Bank Distribution & Top Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bank Distribution */}
        <Card>
          <CardHeader className="py-2">
            <CardTitle className="text-sm">Repartition par banque</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <div style={{ width: '100%', height: 160 }}>
              {bankDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
                  <PieChart>
                    <Pie data={bankDistribution} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                      {bankDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value} tx`, 'Vol.']} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value) => <span className="text-xs">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-primary-500 text-sm">Aucune donnee</div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Top Clients by Savings */}
        <Card className="lg:col-span-2">
          <CardHeader className="py-2" action={<Button variant="ghost" size="sm" onClick={() => navigate('/clients')}>Voir <ArrowRight className="w-3 h-3 ml-1" /></Button>}>
            <CardTitle className="text-sm">Top clients</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-primary-100">
              {stats.clientRiskScores
                .sort((a, b) => b.savings - a.savings)
                .slice(0, 4)
                .map((client, idx) => (
                  <div key={client.id} className="px-4 py-2 flex items-center gap-3 hover:bg-primary-50 cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                    <div className="w-6 h-6 rounded bg-primary-900 flex items-center justify-center text-white font-bold text-xs">{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary-900 truncate">{client.name}</p>
                      <p className="text-xs text-primary-500">{client.anomalyCount} anomalies</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">{formatCurrency(client.savings, 'XAF')}</p>
                      <div className="flex items-center gap-1 justify-end">
                        <div className={`w-1.5 h-1.5 rounded-full ${client.riskScore > 60 ? 'bg-red-500' : client.riskScore > 30 ? 'bg-yellow-500' : 'bg-green-500'}`} />
                        <span className="text-xs text-primary-500">{client.riskScore}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              {stats.clientRiskScores.length === 0 && (
                <div className="px-4 py-4 text-center text-primary-500 text-sm">Aucun client</div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Pending Analysis Banner */}
      {stats.pendingStatements > 0 && (
        <Card className="p-3 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <FileSearch className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-800">{stats.pendingStatements} releve{stats.pendingStatements > 1 ? 's' : ''} en attente</p>
                <p className="text-xs text-blue-600">Lancer l'analyse</p>
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={() => navigate('/analyses')}>Analyser</Button>
          </div>
        </Card>
      )}

      {/* Quick Actions & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <Card>
          <CardHeader className="py-2">
            <CardTitle className="text-sm">Actions rapides</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 pt-0">
            <Button variant="primary" size="sm" className="w-full justify-start" onClick={() => navigate('/import')}>
              <Plus className="w-4 h-4 mr-1" />Nouvel Audit
            </Button>
            <Button variant="secondary" size="sm" className="w-full justify-start" onClick={() => navigate('/reports')}>
              <FileText className="w-4 h-4 mr-1" />Rapport
            </Button>
            <Button variant="secondary" size="sm" className="w-full justify-start" onClick={() => navigate('/clients')}>
              <Users className="w-4 h-4 mr-1" />Client
            </Button>
            <Button variant="secondary" size="sm" className="w-full justify-start" onClick={() => navigate('/banks')}>
              <Landmark className="w-4 h-4 mr-1" />Banques
            </Button>
          </CardBody>
        </Card>

        {/* Volume Stats */}
        <Card className="lg:col-span-2">
          <CardHeader className="py-2">
            <CardTitle className="text-sm">Volume d'activite</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="text-center p-2 bg-primary-50 rounded-lg">
                <BarChart3 className="w-4 h-4 text-primary-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-primary-900">{transactions.length}</p>
                <p className="text-xs text-primary-500">Transactions</p>
              </div>
              <div className="text-center p-2 bg-primary-50 rounded-lg">
                <FileText className="w-4 h-4 text-primary-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-primary-900">{stats.analyzedStatements}</p>
                <p className="text-xs text-primary-500">Analyses</p>
              </div>
              <div className="text-center p-2 bg-primary-50 rounded-lg">
                <TrendingUp className="w-4 h-4 text-primary-600 mx-auto mb-1" />
                <p className="text-sm font-bold text-primary-900">{formatCurrency(stats.totalTransactionVolume, 'XAF')}</p>
                <p className="text-xs text-primary-500">Volume</p>
              </div>
              <div className="text-center p-2 bg-primary-50 rounded-lg">
                <Calendar className="w-4 h-4 text-primary-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-primary-900">{invoices.length}</p>
                <p className="text-xs text-primary-500">Factures</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
