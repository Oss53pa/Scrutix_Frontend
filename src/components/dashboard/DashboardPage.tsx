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
} from 'recharts';
import { Card, CardHeader, CardTitle, CardBody, Button } from '../ui';
import { useClientStore } from '../../store/clientStore';
import { useBankStore } from '../../store/bankStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { useBillingStore } from '../../store/billingStore';
import { useTransactionStore } from '../../store/transactionStore';
import { formatCurrency } from '../../utils';
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
    // ⚠ Audit fix: anomalies stay in `pending` until reviewed, so the previous
    // "totalSavings = confirmed only" displayed 0 most of the time, which is
    // misleading. We now expose three values:
    //   - confirmedSavings: ratified by the auditor (the legal floor)
    //   - pendingSavings : detected but not yet reviewed
    //   - identifiedSavings: confirmed + pending (the operational headline)
    // Dismissed / contested are excluded from all three.
    const confirmedAnomalies = allAnomalies.filter((a) => a.status === 'confirmed');
    const pendingAnomalies = allAnomalies.filter((a) => a.status === 'pending');
    const confirmedSavings = confirmedAnomalies.reduce((sum, a) => sum + a.amount, 0);
    const pendingSavings = pendingAnomalies.reduce((sum, a) => sum + a.amount, 0);
    const identifiedSavings = confirmedSavings + pendingSavings;

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
    // ⚠ Audit fix: include pending amounts in the per-client savings figure
    // so the "Top clients" ranking is meaningful from day one. We expose
    // `confirmedSavings` separately for cabinets that want to show the ratified
    // portion only.
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
      const clientConfirmedSavings = clientAnomalies
        .filter((a) => a.status === 'confirmed')
        .reduce((sum, a) => sum + a.amount, 0);
      const clientPendingSavings = clientAnomalies
        .filter((a) => a.status === 'pending')
        .reduce((sum, a) => sum + a.amount, 0);
      const savings = clientConfirmedSavings + clientPendingSavings; // identified
      return {
        ...client,
        riskScore,
        anomalyCount: clientAnomalies.length,
        savings,
        confirmedSavings: clientConfirmedSavings,
        pendingSavings: clientPendingSavings,
      };
    });

    // Transaction volume
    const totalTransactionVolume = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Monthly trend data (last 6 months)
    // ⚠ Audit fix: same as the headline metric — show identified savings
    // (confirmed + pending) so the chart is informative even when nothing has
    // been ratified yet.
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthAnomalies = allAnomalies.filter((a) => {
        const date = new Date(a.detectedAt);
        return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
      });
      const monthSavings = monthAnomalies
        .filter((a) => a.status === 'confirmed' || a.status === 'pending')
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
      // Headline savings: detected so far (confirmed + pending). The previous
      // "totalSavings" silently meant "confirmed only" which was misleading.
      identifiedSavings,
      confirmedSavings,
      pendingSavings,
      // Backwards-compat alias — some legacy props may still reference this.
      totalSavings: identifiedSavings,
      potentialSavings: pendingSavings,
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

  // Bank distribution for pie chart — premium palette
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
        color: ['#0f0e0a', '#c9954a', '#1e2640', '#dec078', '#475066', '#8e8675'][i % 6],
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
  const _riskData = [
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
    <div className="space-y-6">
      {/* Header — premium editorial */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-2">
        <div>
          <p className="page-eyebrow mb-2">Vue d'ensemble</p>
          <h1 className="text-3xl font-bold text-ink-900 tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-ink-500 mt-1">Activité, anomalies et performance du cabinet</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/clients')}>
            <Search className="w-4 h-4" />
            Nouvelle analyse
          </Button>
          <Button size="sm" onClick={() => navigate('/import')}>
            <Plus className="w-4 h-4" />
            Importer
          </Button>
        </div>
      </div>

      {/* Primary KPI Cards — premium */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Featured: clients (ink card) */}
        <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 text-white p-5 shadow-elevated sheen">
          <div
            aria-hidden="true"
            className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-500/15 blur-2xl"
          />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400/60 to-transparent" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold text-accent-300 uppercase tracking-[0.14em]">Clients actifs</p>
              <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">{stats.clients}</p>
              <p className="mt-1 text-xs text-white/60">{stats.statements} relevés</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/10">
              <Users className="w-5 h-5 text-accent-200" />
            </div>
          </div>
        </div>

        <PremiumKpi
          label="Anomalies ce mois"
          value={stats.anomaliesThisMonth}
          icon={AlertTriangle}
          trend={
            anomalyGrowth !== 0 ? (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                  anomalyGrowth > 0 ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {anomalyGrowth > 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {anomalyGrowth > 0 ? '+' : ''}{anomalyGrowth}%
              </span>
            ) : null
          }
        />

        <PremiumKpi
          label="Économies identifiées"
          value={formatCurrency(stats.identifiedSavings, 'XAF')}
          accent
          icon={PiggyBank}
          subtitle={
            stats.confirmedSavings > 0
              ? `${formatCurrency(stats.confirmedSavings, 'XAF')} confirmées · ${formatCurrency(stats.pendingSavings, 'XAF')} en attente`
              : `${formatCurrency(stats.pendingSavings, 'XAF')} à confirmer`
          }
        />

        <PremiumKpi
          label="Taux de confirmation"
          value={`${stats.confirmedRate}%`}
          icon={Target}
          subtitle={`${stats.allAnomalies.filter((a) => a.status === 'confirmed').length}/${stats.allAnomalies.length}`}
          progress={stats.confirmedRate}
        />
      </div>

      {/* Critical Alerts Banner — premium */}
      {stats.criticalCount > 0 && (
        <div className="relative overflow-hidden rounded-card border border-red-200/70 bg-gradient-to-r from-red-50 via-red-50/70 to-amber-50/50 p-4 shadow-card animate-fade-in">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/70 to-transparent" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-card">
                <ShieldAlert className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-900 tracking-tight">
                  {stats.criticalCount} anomalie{stats.criticalCount > 1 ? 's' : ''} critique{stats.criticalCount > 1 ? 's' : ''} détectée{stats.criticalCount > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-red-700">Action immédiate requise</p>
              </div>
            </div>
            <Button variant="danger" size="sm" onClick={() => navigate('/clients')}>
              Voir
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Severity strip — single elegant row */}
      <Card className="p-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-primary-100/70">
          <SeverityCell icon={Zap} label="Critiques" value={stats.criticalCount} tone="red" />
          <SeverityCell icon={AlertTriangle} label="Hautes" value={stats.highCount} tone="orange" />
          <SeverityCell icon={Activity} label="Moyennes" value={stats.mediumCount} tone="amber" />
          <SeverityCell icon={CheckCircle2} label="Basses" value={stats.lowCount} tone="emerald" />
        </div>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolution Chart */}
        <Card>
          <CardHeader className="py-3">
            <div>
              <p className="page-eyebrow text-[10px]">Tendance</p>
              <CardTitle className="text-sm mt-0.5">Évolution mensuelle</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div style={{ width: '100%', height: 192 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
                <AreaChart data={stats.monthlyTrend}>
                  <defs>
                    <linearGradient id="colorAnomalies" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f0e0a" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0f0e0a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(218 214 200 / 0.5)" />
                  <XAxis dataKey="month" stroke="#475066" fontSize={11} tickLine={false} axisLine={{ stroke: 'rgb(218 214 200 / 0.5)' }} />
                  <YAxis yAxisId="left" stroke="#475066" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#059669" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid rgb(218 214 200)', borderRadius: '12px', boxShadow: '0 12px 32px -8px rgb(15 14 10 / 0.12)', fontSize: 12 }}
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
                    stroke="#0f0e0a"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorAnomalies)"
                    name="Anomalies"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="critical"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={{ fill: '#dc2626', r: 3 }}
                    name="Critiques"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="savings"
                    stroke="#059669"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSavings)"
                    name="Économies"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {/* Anomaly Types Distribution */}
        <Card>
          <CardHeader className="py-3">
            <div>
              <p className="page-eyebrow text-[10px]">Distribution</p>
              <CardTitle className="text-sm mt-0.5">Types d'anomalies</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-3">
              {topAnomalyTypes.length > 0 ? (
                topAnomalyTypes.map((item, idx) => (
                  <div key={item.type} className="flex items-center gap-3 group">
                    <span className="text-[10px] font-bold text-accent-600 w-6 tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-ink-900 tracking-tight">{item.label}</span>
                        <span className="text-xs font-bold text-ink-900 tabular-nums">{item.count}</span>
                      </div>
                      <div className="h-1.5 bg-canvas-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-ink-700 to-ink-900 rounded-full transition-all duration-700 ease-premium group-hover:from-accent-500 group-hover:to-accent-700"
                          style={{ width: `${(item.count / Math.max(...topAnomalyTypes.map((t) => t.count))) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-ink-400 text-sm">Aucune anomalie</div>
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
          <CardHeader className="py-3" action={<Button variant="ghost" size="sm" onClick={() => navigate('/clients')}>Voir tous <ArrowRight className="w-3 h-3 ml-1" /></Button>}>
            <div>
              <p className="page-eyebrow text-[10px]">Performance</p>
              <CardTitle className="text-sm mt-0.5">Top clients</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-primary-100/60">
              {[...stats.clientRiskScores]
                .sort((a, b) => {
                  // Primary: identified savings (confirmed + pending)
                  // Tie-breaker: anomaly count (so ranking stays meaningful
                  // even before any anomaly is ratified)
                  if (b.savings !== a.savings) return b.savings - a.savings;
                  return b.anomalyCount - a.anomalyCount;
                })
                .slice(0, 4)
                .map((client, idx) => (
                  <div
                    key={client.id}
                    className="group px-5 py-3 flex items-center gap-3 hover:bg-canvas-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/clients/${client.id}`)}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-[11px] tabular-nums ${
                      idx === 0 ? 'bg-gradient-to-br from-accent-400 to-accent-600 shadow-glow' :
                      'bg-gradient-to-br from-ink-700 to-ink-900'
                    }`}>{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-900 tracking-tight truncate group-hover:text-accent-700 transition-colors">{client.name}</p>
                      <p className="text-xs text-ink-500">{client.anomalyCount} anomalies détectées</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-700 tabular-nums">{formatCurrency(client.savings, 'XAF')}</p>
                      <div className="flex items-center gap-1.5 justify-end mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${client.riskScore > 60 ? 'bg-red-500' : client.riskScore > 30 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        <span className="text-[11px] text-ink-500 tabular-nums">{client.riskScore}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              {stats.clientRiskScores.length === 0 && (
                <div className="px-4 py-6 text-center text-ink-400 text-sm">Aucun client</div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Pending Analysis Banner */}
      {stats.pendingStatements > 0 && (
        <div className="relative overflow-hidden rounded-card border border-blue-200/60 bg-gradient-to-r from-blue-50 via-blue-50/60 to-canvas-50 p-4 shadow-card">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-card">
                <FileSearch className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900 tracking-tight">
                  {stats.pendingStatements} relevé{stats.pendingStatements > 1 ? 's' : ''} en attente
                </p>
                <p className="text-xs text-blue-700">Lancer l'analyse pour découvrir les anomalies</p>
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={() => navigate('/clients')}>
              Analyser
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Quick Actions & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <Card>
          <CardHeader className="py-3">
            <div>
              <p className="page-eyebrow text-[10px]">Raccourcis</p>
              <CardTitle className="text-sm mt-0.5">Actions rapides</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="space-y-2 pt-0">
            <Button variant="primary" size="sm" className="w-full justify-start" onClick={() => navigate('/import')}>
              <Plus className="w-4 h-4" />Nouvel Audit
            </Button>
            <Button variant="secondary" size="sm" className="w-full justify-start" onClick={() => navigate('/reports')}>
              <FileText className="w-4 h-4" />Rapport
            </Button>
            <Button variant="secondary" size="sm" className="w-full justify-start" onClick={() => navigate('/clients')}>
              <Users className="w-4 h-4" />Client
            </Button>
            <Button variant="secondary" size="sm" className="w-full justify-start" onClick={() => navigate('/banks')}>
              <Landmark className="w-4 h-4" />Banques
            </Button>
          </CardBody>
        </Card>

        {/* Volume Stats */}
        <Card className="lg:col-span-2">
          <CardHeader className="py-3">
            <div>
              <p className="page-eyebrow text-[10px]">Mesures</p>
              <CardTitle className="text-sm mt-0.5">Volume d'activité</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <VolumeCell icon={BarChart3} value={transactions.length} label="Transactions" />
              <VolumeCell icon={FileText} value={stats.analyzedStatements} label="Analyses" />
              <VolumeCell icon={TrendingUp} value={formatCurrency(stats.totalTransactionVolume, 'XAF')} label="Volume" small />
              <VolumeCell icon={Calendar} value={invoices.length} label="Factures" />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================================
   Premium helper components — Dashboard
   ============================================================================ */

interface PremiumKpiProps {
  label: string;
  value: string | number;
  icon: typeof Users;
  subtitle?: string;
  trend?: React.ReactNode;
  accent?: boolean;
  progress?: number;
}

function PremiumKpi({ label, value, icon: Icon, subtitle, trend, accent, progress }: PremiumKpiProps) {
  return (
    <div className="relative overflow-hidden rounded-card bg-white border border-primary-100/70 p-5 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 ease-premium">
      {accent && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400/70 to-transparent" />
      )}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-[0.14em]">{label}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight tabular-nums truncate ${
            accent ? 'text-emerald-700' : 'text-ink-900'
          }`}>{value}</p>
          {subtitle && <p className="mt-1 text-xs text-ink-400 truncate">{subtitle}</p>}
          {trend && <div className="mt-1.5">{trend}</div>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
          accent
            ? 'bg-gradient-to-br from-accent-50 to-accent-100 border-accent-200/60 text-accent-700'
            : 'bg-canvas-100 border-primary-200/60 text-ink-700'
        }`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {typeof progress === 'number' && (
        <div className="mt-4 h-1 bg-canvas-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-ink-700 to-accent-500 transition-all duration-700 ease-premium"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

interface SeverityCellProps {
  icon: typeof Users;
  label: string;
  value: number;
  tone: 'red' | 'orange' | 'amber' | 'emerald';
}

function SeverityCell({ icon: Icon, label, value, tone }: SeverityCellProps) {
  const tones: Record<SeverityCellProps['tone'], { dot: string; text: string; bg: string }> = {
    red: { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
    orange: { dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50' },
    amber: { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
    emerald: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  };
  const t = tones[tone];
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className={`relative w-10 h-10 rounded-xl ${t.bg} flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${t.text}`} />
        <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${t.dot} ring-2 ring-white`} />
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums tracking-tight ${t.text}`}>{value}</p>
        <p className="text-[11px] font-medium text-ink-500 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

interface VolumeCellProps {
  icon: typeof Users;
  value: number | string;
  label: string;
  small?: boolean;
}

function VolumeCell({ icon: Icon, value, label, small }: VolumeCellProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-canvas-50 border border-primary-100/60 p-3 group hover:border-accent-300/40 hover:bg-white transition-all duration-200 ease-premium">
      <Icon className="w-4 h-4 text-ink-500 mb-1.5 group-hover:text-accent-600 transition-colors" />
      <p className={`font-bold text-ink-900 tabular-nums tracking-tight ${small ? 'text-sm' : 'text-xl'}`}>{value}</p>
      <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
