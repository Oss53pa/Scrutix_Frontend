import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  FileText,
  Search,
  PiggyBank,
  FileBarChart,
  Upload,
  Pencil,
  ClipboardList,
} from 'lucide-react';
import { Card, Button, Badge } from '../ui';
import { useClientStore } from '../../store/clientStore';
import { useBankStore } from '../../store/bankStore';
import { useTransactionStore } from '../../store/transactionStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { Severity, AnomalyType, ANOMALY_TYPE_LABELS } from '../../types';
import { AddAccountModal } from './AddAccountModal';
import {
  OverviewTab,
  InfoTab,
  StatementsTab,
  AnalysesTab,
  SavingsTab,
  ReportsTab,
  TabType,
  ClientAnalytics,
} from './client-detail';

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { getClient, statements, reports, addAccount, removeAccount } = useClientStore();
  const { banks } = useBankStore();
  const { transactions } = useTransactionStore();
  const { analysisHistory = [], currentAnalysis } = useAnalysisStore();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);

  const client = id ? getClient(id) : undefined;

  // Client-specific data
  const clientStatements = useMemo(() =>
    client ? statements.filter((s) => s.clientId === client.id) : [],
    [client, statements]
  );

  const clientTransactions = useMemo(() =>
    client ? transactions.filter((t) => t.clientId === client.id) : [],
    [client, transactions]
  );

  const allResults = useMemo(() =>
    [...(currentAnalysis ? [currentAnalysis] : []), ...analysisHistory],
    [currentAnalysis, analysisHistory]
  );

  const clientAnomalies = useMemo(() =>
    client
      ? allResults.flatMap((r) => r.anomalies).filter((a) =>
          a.transactions.some((t) => t.clientId === client.id)
        )
      : [],
    [client, allResults]
  );

  const clientReports = useMemo(() =>
    client ? reports.filter((r) => r.clientId === client.id) : [],
    [client, reports]
  );

  // Comprehensive analytics
  const analytics = useMemo((): ClientAnalytics | null => {
    if (!client) return null;
    const now = new Date();

    const confirmedAnomalies = clientAnomalies.filter((a) => a.status === 'confirmed');
    const pendingAnomalies = clientAnomalies.filter((a) => a.status === 'pending');
    const totalSavings = confirmedAnomalies.reduce((sum, a) => sum + a.amount, 0);
    const potentialSavings = pendingAnomalies.reduce((sum, a) => sum + a.amount, 0);

    // Risk score calculation
    let riskScore = 0;
    clientAnomalies.forEach((a) => {
      if (a.severity === Severity.CRITICAL) riskScore += 25;
      else if (a.severity === Severity.HIGH) riskScore += 15;
      else if (a.severity === Severity.MEDIUM) riskScore += 8;
      else riskScore += 3;
    });
    riskScore = Math.min(100, riskScore);
    const riskLevel = riskScore > 60 ? 'Eleve' : riskScore > 30 ? 'Moyen' : 'Faible';
    const riskColor = riskScore > 60 ? 'red' : riskScore > 30 ? 'yellow' : 'green';

    // Anomalies by severity
    const bySeverity = {
      critical: clientAnomalies.filter((a) => a.severity === Severity.CRITICAL).length,
      high: clientAnomalies.filter((a) => a.severity === Severity.HIGH).length,
      medium: clientAnomalies.filter((a) => a.severity === Severity.MEDIUM).length,
      low: clientAnomalies.filter((a) => a.severity === Severity.LOW).length,
    };

    // Anomalies by type
    const byType: Record<string, { count: number; amount: number }> = {};
    clientAnomalies.forEach((a) => {
      const type = a.type;
      if (!byType[type]) byType[type] = { count: 0, amount: 0 };
      byType[type].count += 1;
      byType[type].amount += a.amount;
    });
    const topTypes = Object.entries(byType)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([type, data]) => ({
        type,
        label: ANOMALY_TYPE_LABELS[type as AnomalyType] || type,
        ...data,
      }));

    // Transaction volume analysis
    const totalVolume = clientTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const creditVolume = clientTransactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const debitVolume = clientTransactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const avgTransaction = clientTransactions.length > 0 ? totalVolume / clientTransactions.length : 0;

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthTransactions = clientTransactions.filter((t) => {
        const date = new Date(t.date);
        return date >= month && date <= monthEnd;
      });

      const monthAnomalies = clientAnomalies.filter((a) => {
        const date = new Date(a.detectedAt);
        return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
      });

      const volume = monthTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const savings = monthAnomalies
        .filter((a) => a.status === 'confirmed')
        .reduce((sum, a) => sum + a.amount, 0);

      monthlyTrend.push({
        month: month.toLocaleDateString('fr-FR', { month: 'short' }),
        transactions: monthTransactions.length,
        volume,
        anomalies: monthAnomalies.length,
        savings,
      });
    }

    // Bank distribution
    const bankDistribution: Record<string, number> = {};
    clientTransactions.forEach((t) => {
      const bank = banks.find((b) => b.code === t.bankCode);
      const name = bank?.name || 'Autre';
      bankDistribution[name] = (bankDistribution[name] || 0) + 1;
    });

    // Confirmation rate
    const confirmationRate = clientAnomalies.length > 0
      ? Math.round((confirmedAnomalies.length / clientAnomalies.length) * 100)
      : 0;

    // Bank fees analysis
    const feeTransactions = clientTransactions.filter((t) =>
      t.description.toLowerCase().includes('frais') ||
      t.description.toLowerCase().includes('commission') ||
      t.description.toLowerCase().includes('agios') ||
      t.amount < 0
    );
    const totalFees = feeTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      totalSavings,
      potentialSavings,
      riskScore,
      riskLevel,
      riskColor: riskColor as 'red' | 'yellow' | 'green',
      bySeverity,
      topTypes,
      totalVolume,
      creditVolume,
      debitVolume,
      avgTransaction,
      monthlyTrend,
      totalFees,
      bankDistribution: Object.entries(bankDistribution).map(([name, count], i) => ({
        name,
        count,
        color: ['#171717', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][i % 5],
      })),
      confirmationRate,
      confirmedCount: confirmedAnomalies.length,
      pendingCount: pendingAnomalies.length,
    };
  }, [client, clientTransactions, clientAnomalies, banks]);

  // Early return if no client
  if (!client || !analytics) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-medium text-primary-900 mb-2">Client non trouve</h2>
        <Button onClick={() => navigate('/clients')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux clients
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as TabType, label: 'Vue d\'ensemble', icon: Building2 },
    { id: 'info' as TabType, label: 'Fiche client', icon: ClipboardList },
    { id: 'statements' as TabType, label: 'Journal releves', icon: FileText, count: clientStatements.length },
    { id: 'analyses' as TabType, label: 'Analyses', icon: Search, count: clientAnomalies.length },
    { id: 'savings' as TabType, label: 'Economies', icon: PiggyBank },
    { id: 'reports' as TabType, label: 'Journal rapports', icon: FileBarChart, count: clientReports.length },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-900 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary-900">{client.name}</h1>
              <p className="text-sm text-primary-500">{client.code}</p>
            </div>
            <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
              Risque {analytics.riskLevel}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowEditClient(true)}>
            <Pencil className="w-3 h-3 mr-1" />Modifier
          </Button>
          <Button size="sm" onClick={() => navigate('/import')}>
            <Upload className="w-3 h-3 mr-1" />Import
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-primary-200">
        <nav className="flex gap-0.5 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-primary-900 text-primary-900' : 'border-transparent text-primary-500 hover:text-primary-700'}`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{tab.count}</Badge>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          analytics={analytics}
          clientTransactions={clientTransactions}
          clientAnomalies={clientAnomalies}
        />
      )}

      {activeTab === 'info' && (
        <InfoTab
          client={client}
          banks={banks}
          setShowAddAccount={setShowAddAccount}
          removeAccount={removeAccount}
        />
      )}

      {activeTab === 'statements' && (
        <StatementsTab
          clientStatements={clientStatements}
          navigate={navigate}
        />
      )}

      {activeTab === 'analyses' && (
        <AnalysesTab
          clientAnomalies={clientAnomalies}
          analytics={analytics}
          navigate={navigate}
        />
      )}

      {activeTab === 'savings' && (
        <SavingsTab
          analytics={analytics}
          clientAnomalies={clientAnomalies}
        />
      )}

      {activeTab === 'reports' && (
        <ReportsTab
          clientReports={clientReports}
          navigate={navigate}
        />
      )}

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onSave={(account) => {
          addAccount(client.id, account);
          setShowAddAccount(false);
        }}
        banks={banks}
      />
    </div>
  );
}
