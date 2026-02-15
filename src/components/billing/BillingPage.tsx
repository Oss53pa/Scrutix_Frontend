import { useState, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Download,
  Mail,
  Eye,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Wallet,
  Calculator,
  Printer,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Target,
  Banknote,
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  Line,
  Area,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardBody, Button, Input, Select, Modal, Badge } from '../ui';
import { useBillingStore } from '../../store/billingStore';
import { useClientStore } from '../../store/clientStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { formatCurrency, formatDate } from '../../utils';
import type { Invoice } from '../../types';
import { ANOMALY_TYPE_LABELS, AnomalyType } from '../../types';

type TabType = 'dashboard' | 'invoices' | 'calculator';

export function BillingPage() {
  const {
    invoices,
    addInvoice,
    getMonthlyStats,
    generateInvoiceNumber,
  } = useBillingStore();
  const { clients } = useClientStore();
  const { analysisHistory = [], currentAnalysis } = useAnalysisStore();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  const now = new Date();
  const _monthlyStats = getMonthlyStats(now.getFullYear(), now.getMonth());

  // Comprehensive billing analytics
  const analytics = useMemo(() => {
    const allAnomalies = [
      ...(currentAnalysis?.anomalies || []),
      ...(analysisHistory || []).flatMap((r) => r.anomalies),
    ];

    // Calculate totals
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalPaid = invoices.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0);
    const totalPending = invoices.filter((inv) => inv.status === 'sent').reduce((sum, inv) => sum + inv.total, 0);
    const totalOverdue = invoices.filter((inv) => inv.status === 'overdue').reduce((sum, inv) => sum + inv.total, 0);
    const totalDraft = invoices.filter((inv) => inv.status === 'draft').reduce((sum, inv) => sum + inv.total, 0);

    // Payment rate
    const paymentRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

    // DSO (Days Sales Outstanding) - average days to get paid
    const paidInvoices = invoices.filter((inv) => inv.status === 'paid' && inv.paidAt);
    const avgDSO = paidInvoices.length > 0
      ? Math.round(
          paidInvoices.reduce((sum, inv) => {
            const issued = new Date(inv.dateEmission).getTime();
            const paid = new Date(inv.paidAt!).getTime();
            return sum + (paid - issued) / (1000 * 60 * 60 * 24);
          }, 0) / paidInvoices.length
        )
      : 30; // default estimate

    // Aging analysis
    const aging = {
      current: 0, // 0-30 days
      days30: 0, // 31-60 days
      days60: 0, // 61-90 days
      days90: 0, // 90+ days
    };
    const unpaidInvoices = invoices.filter((inv) => inv.status === 'sent' || inv.status === 'overdue');
    unpaidInvoices.forEach((inv) => {
      const daysSinceIssued = Math.floor((now.getTime() - new Date(inv.dateEmission).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceIssued <= 30) aging.current += inv.total;
      else if (daysSinceIssued <= 60) aging.days30 += inv.total;
      else if (daysSinceIssued <= 90) aging.days60 += inv.total;
      else aging.days90 += inv.total;
    });

    // Revenue by client
    const revenueByClient: Record<string, { name: string; total: number; paid: number; count: number }> = {};
    invoices.forEach((inv) => {
      if (!revenueByClient[inv.clientId]) {
        revenueByClient[inv.clientId] = { name: inv.clientName, total: 0, paid: 0, count: 0 };
      }
      revenueByClient[inv.clientId].total += inv.total;
      revenueByClient[inv.clientId].count += 1;
      if (inv.status === 'paid') {
        revenueByClient[inv.clientId].paid += inv.total;
      }
    });
    const topClients = Object.values(revenueByClient)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Monthly evolution (last 6 months)
    const monthlyEvolution = [];
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthInvoices = invoices.filter((inv) => {
        const date = new Date(inv.dateEmission);
        return date >= month && date <= monthEnd;
      });
      const invoiced = monthInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const paid = monthInvoices.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0);
      const commissions = monthInvoices.reduce((sum, inv) => {
        return sum + inv.lignes.filter((l) => l.type === 'commission').reduce((s, l) => s + l.montant, 0);
      }, 0);
      monthlyEvolution.push({
        month: month.toLocaleDateString('fr-FR', { month: 'short' }),
        invoiced,
        paid,
        commissions,
        count: monthInvoices.length,
      });
    }

    // Revenue breakdown by type
    const revenueByType = {
      forfait: 0,
      commission: 0,
      service: 0,
    };
    invoices.forEach((inv) => {
      inv.lignes.forEach((ligne) => {
        if (ligne.type === 'forfait') revenueByType.forfait += ligne.montant;
        else if (ligne.type === 'commission') revenueByType.commission += ligne.montant;
        else revenueByType.service += ligne.montant;
      });
    });

    // Commission by anomaly type (simulated based on anomalies)
    const commissionsByType: Record<string, number> = {};
    allAnomalies.filter((a) => a.status === 'confirmed').forEach((a) => {
      const typeLabel = ANOMALY_TYPE_LABELS[a.type as AnomalyType] || a.type;
      commissionsByType[typeLabel] = (commissionsByType[typeLabel] || 0) + a.amount * 0.2; // 20% commission
    });
    const topCommissionTypes = Object.entries(commissionsByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, amount]) => ({ type, amount }));

    // Month-over-month growth
    const lastMonthTotal = monthlyEvolution[4]?.invoiced || 0;
    const thisMonthTotal = monthlyEvolution[5]?.invoiced || 0;
    const growth = lastMonthTotal > 0 ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100) : 0;

    // Invoices stats
    const invoiceStats = {
      total: invoices.length,
      paid: invoices.filter((i) => i.status === 'paid').length,
      sent: invoices.filter((i) => i.status === 'sent').length,
      overdue: invoices.filter((i) => i.status === 'overdue').length,
      draft: invoices.filter((i) => i.status === 'draft').length,
    };

    return {
      totalInvoiced,
      totalPaid,
      totalPending,
      totalOverdue,
      totalDraft,
      paymentRate,
      avgDSO,
      aging,
      topClients,
      monthlyEvolution,
      revenueByType,
      topCommissionTypes,
      growth,
      invoiceStats,
    };
  }, [invoices, currentAnalysis, analysisHistory]);

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Chart colors
  const COLORS = {
    primary: '#171717',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    purple: '#8b5cf6',
    gray: '#737373',
  };

  const _pieColors = [COLORS.primary, COLORS.info, COLORS.success, COLORS.warning, COLORS.purple];

  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />Payee</Badge>;
      case 'sent':
        return <Badge variant="warning"><Clock className="w-3 h-3 mr-1" />Envoyee</Badge>;
      case 'overdue':
        return <Badge variant="error"><AlertCircle className="w-3 h-3 mr-1" />En retard</Badge>;
      case 'draft':
        return <Badge variant="secondary">Brouillon</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Download invoice as PDF
  const handleDownloadInvoice = (invoice: Invoice) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(23, 23, 23);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURE', 20, 25);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`N° ${invoice.numero}`, pageWidth - 20, 20, { align: 'right' });
    doc.text(`Date: ${formatDate(invoice.dateEmission)}`, pageWidth - 20, 28, { align: 'right' });

    doc.setTextColor(23, 23, 23);
    doc.setFontSize(10);
    doc.text('Cabinet d\'Expertise Comptable', 20, 55);
    doc.text('Audit & Conseil', 20, 62);
    doc.text('CEMAC / UEMOA', 20, 69);

    doc.setFont('helvetica', 'bold');
    doc.text('FACTURE A:', pageWidth - 80, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.clientName, pageWidth - 80, 62);
    doc.text(`Periode: ${formatDate(invoice.periode.start)} - ${formatDate(invoice.periode.end)}`, pageWidth - 80, 69);

    const tableData = invoice.lignes.map(ligne => [
      ligne.description,
      ligne.quantite.toString(),
      formatCurrency(ligne.prixUnitaire, 'XAF'),
      formatCurrency(ligne.montant, 'XAF'),
    ]);

    (doc as any).autoTable({
      startY: 85,
      head: [['Description', 'Qte', 'Prix unitaire', 'Montant']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [23, 23, 23], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 40, halign: 'right' },
        3: { cellWidth: 40, halign: 'right' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.text('Sous-total:', pageWidth - 70, finalY);
    doc.text(formatCurrency(invoice.sousTotal, 'XAF'), pageWidth - 20, finalY, { align: 'right' });

    doc.text(`TVA (${(invoice.tauxTva * 100).toFixed(2)}%):`, pageWidth - 70, finalY + 8);
    doc.text(formatCurrency(invoice.tva, 'XAF'), pageWidth - 20, finalY + 8, { align: 'right' });

    doc.setFillColor(23, 23, 23);
    doc.rect(pageWidth - 90, finalY + 12, 70, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL:', pageWidth - 85, finalY + 20);
    doc.text(formatCurrency(invoice.total, 'XAF'), pageWidth - 22, finalY + 20, { align: 'right' });

    doc.setTextColor(23, 23, 23);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Date d'echeance: ${formatDate(invoice.dateEcheance)}`, 20, finalY + 35);

    if (invoice.status === 'paid') {
      doc.setTextColor(34, 197, 94);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('PAYEE', pageWidth / 2, finalY + 50, { align: 'center' });
    }

    doc.setTextColor(115, 115, 115);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Merci pour votre confiance.', pageWidth / 2, 280, { align: 'center' });
    doc.text('Scrutix - Solution d\'audit bancaire - Developpe par Atlas Studio', pageWidth / 2, 286, { align: 'center' });

    doc.save(`Facture_${invoice.numero}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary-900">Facturation</h1>
          <p className="text-sm text-primary-500">Gerez les honoraires et factures du cabinet</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setActiveTab('calculator')}>
            <Calculator className="w-3 h-3 mr-1" />
            Calculer honoraires
          </Button>
          <Button size="sm" onClick={() => setShowCreateInvoice(true)}>
            <Plus className="w-3 h-3 mr-1" />
            Nouvelle facture
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-primary-200">
        <nav className="flex gap-0.5">
          {[
            { id: 'dashboard' as TabType, label: 'Tableau de bord', icon: BarChart3 },
            { id: 'invoices' as TabType, label: 'Factures', icon: Receipt, count: invoices.length },
            { id: 'calculator' as TabType, label: 'Calculateur', icon: Calculator },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-900 text-primary-900'
                  : 'border-transparent text-primary-500 hover:text-primary-700'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count !== undefined && (
                <Badge variant="secondary" className="ml-1 text-xs">{tab.count}</Badge>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          {/* Primary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-3 bg-gradient-to-br from-primary-900 to-primary-800 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-primary-300">Chiffre d'affaires</p>
                  <p className="text-xl font-bold mt-0.5">{formatCurrency(analytics.totalInvoiced, 'XAF')}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {analytics.growth >= 0 ? (
                      <ArrowUpRight className="w-3 h-3 text-primary-300" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 text-primary-300" />
                    )}
                    <span className="text-xs text-primary-300">
                      {analytics.growth >= 0 ? '+' : ''}{analytics.growth}% ce mois
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Banknote className="w-5 h-5" />
                </div>
              </div>
            </Card>

            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-primary-500">Encaisse</p>
                  <p className="text-xl font-bold text-primary-600 mt-0.5">{formatCurrency(analytics.totalPaid, 'XAF')}</p>
                  <p className="text-xs text-primary-400 mt-1">{analytics.paymentRate}% du total facture</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary-600" />
                </div>
              </div>
            </Card>

            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-primary-500">En attente</p>
                  <p className="text-xl font-bold text-primary-600 mt-0.5">{formatCurrency(analytics.totalPending, 'XAF')}</p>
                  <p className="text-xs text-primary-400 mt-1">{analytics.invoiceStats.sent} facture{analytics.invoiceStats.sent > 1 ? 's' : ''}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary-600" />
                </div>
              </div>
            </Card>

            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-primary-500">DSO moyen</p>
                  <p className="text-xl font-bold text-primary-600 mt-0.5">{analytics.avgDSO} jours</p>
                  <p className="text-xs text-primary-400 mt-1">Delai moyen de paiement</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary-600" />
                </div>
              </div>
            </Card>
          </div>

          {/* Overdue Alert */}
          {analytics.totalOverdue > 0 && (
            <Card className="p-3 bg-primary-50 border-primary-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary-800">{formatCurrency(analytics.totalOverdue, 'XAF')} en retard de paiement</p>
                    <p className="text-xs text-primary-600">{analytics.invoiceStats.overdue} facture{analytics.invoiceStats.overdue > 1 ? 's' : ''} a relancer</p>
                  </div>
                </div>
                <Button variant="primary" size="sm" onClick={() => setActiveTab('invoices')}>
                  Voir les factures
                </Button>
              </div>
            </Card>
          )}

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-primary-900">{analytics.invoiceStats.total}</p>
              <p className="text-xs text-primary-500">Factures totales</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-primary-600">{analytics.invoiceStats.paid}</p>
              <p className="text-xs text-primary-500">Payees</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-primary-600">{analytics.invoiceStats.sent}</p>
              <p className="text-xs text-primary-500">En attente</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-primary-600">{analytics.invoiceStats.overdue}</p>
              <p className="text-xs text-primary-500">En retard</p>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue Evolution */}
            <Card>
              <CardHeader>
                <CardTitle>Evolution du chiffre d'affaires</CardTitle>
              </CardHeader>
              <CardBody>
                <div style={{ width: '100%', height: 192 }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
                    <ComposedChart data={analytics.monthlyEvolution}>
                      <defs>
                        <linearGradient id="colorInvoiced" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="month" stroke="#737373" fontSize={12} />
                      <YAxis stroke="#737373" fontSize={12} tickFormatter={(v) => `${v / 1000000}M`} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value, 'XAF')}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="invoiced"
                        stroke={COLORS.primary}
                        fill="url(#colorInvoiced)"
                        name="Facture"
                      />
                      <Bar dataKey="paid" fill={COLORS.success} name="Encaisse" radius={[4, 4, 0, 0]} />
                      <Line
                        type="monotone"
                        dataKey="commissions"
                        stroke={COLORS.info}
                        strokeWidth={2}
                        dot={{ fill: COLORS.info }}
                        name="Commissions"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>

            {/* Revenue by Type */}
            <Card>
              <CardHeader>
                <CardTitle>Repartition des revenus</CardTitle>
              </CardHeader>
              <CardBody>
                <div style={{ height: 192 }} className="flex items-center">
                  <div className="w-1/2">
                    <ResponsiveContainer width="100%" height={160} minWidth={100} minHeight={100} debounce={50}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Forfaits', value: analytics.revenueByType.forfait },
                            { name: 'Commissions', value: analytics.revenueByType.commission },
                            { name: 'Services', value: analytics.revenueByType.service },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          <Cell fill={COLORS.primary} />
                          <Cell fill={COLORS.info} />
                          <Cell fill={COLORS.success} />
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value, 'XAF')} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary-900" />
                      <div className="flex-1">
                        <p className="text-xs font-medium">Forfaits</p>
                        <p className="text-sm font-bold">{formatCurrency(analytics.revenueByType.forfait, 'XAF')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                      <div className="flex-1">
                        <p className="text-xs font-medium">Commissions</p>
                        <p className="text-sm font-bold">{formatCurrency(analytics.revenueByType.commission, 'XAF')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary-300" />
                      <div className="flex-1">
                        <p className="text-xs font-medium">Services</p>
                        <p className="text-sm font-bold">{formatCurrency(analytics.revenueByType.service, 'XAF')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Third Row - Aging & Top Clients */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Aging Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Anciennete des creances</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-primary-600">0-30 jours</span>
                      <span className="text-sm font-bold text-primary-600">{formatCurrency(analytics.aging.current, 'XAF')}</span>
                    </div>
                    <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: `${(analytics.aging.current / (analytics.totalPending + analytics.totalOverdue || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-primary-600">31-60 jours</span>
                      <span className="text-sm font-bold text-primary-600">{formatCurrency(analytics.aging.days30, 'XAF')}</span>
                    </div>
                    <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-400 rounded-full"
                        style={{ width: `${(analytics.aging.days30 / (analytics.totalPending + analytics.totalOverdue || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-primary-600">61-90 jours</span>
                      <span className="text-sm font-bold text-primary-600">{formatCurrency(analytics.aging.days60, 'XAF')}</span>
                    </div>
                    <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-300 rounded-full"
                        style={{ width: `${(analytics.aging.days60 / (analytics.totalPending + analytics.totalOverdue || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-primary-600">90+ jours</span>
                      <span className="text-sm font-bold text-primary-600">{formatCurrency(analytics.aging.days90, 'XAF')}</span>
                    </div>
                    <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-200 rounded-full"
                        style={{ width: `${(analytics.aging.days90 / (analytics.totalPending + analytics.totalOverdue || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Top Clients */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Top clients par chiffre d'affaires</CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                <div className="divide-y divide-primary-100">
                  {analytics.topClients.length > 0 ? (
                    analytics.topClients.map((client, idx) => (
                      <div key={idx} className="px-4 py-2 flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-primary-900 flex items-center justify-center text-white font-bold text-xs">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-primary-900">{client.name}</p>
                          <p className="text-xs text-primary-500">{client.count} factures</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-primary-900">{formatCurrency(client.total, 'XAF')}</p>
                          <p className="text-xs text-primary-600">{formatCurrency(client.paid, 'XAF')} encaisse</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-primary-500 text-sm">
                      Aucune facture emise
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Commission Types */}
          {analytics.topCommissionTypes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Commissions par type d'anomalie</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {analytics.topCommissionTypes.map((item, idx) => (
                    <div key={idx} className="p-3 bg-primary-50 rounded-lg">
                      <p className="text-xs text-primary-500 truncate">{item.type}</p>
                      <p className="text-sm font-bold text-primary-900 mt-0.5">{formatCurrency(item.amount, 'XAF')}</p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
              <Input
                type="text"
                placeholder="Rechercher une facture..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tous les statuts</option>
              <option value="draft">Brouillon</option>
              <option value="sent">Envoyee</option>
              <option value="paid">Payee</option>
              <option value="overdue">En retard</option>
            </Select>
          </div>

          {/* Invoices Table */}
          <Card>
            <CardBody className="p-0">
              <table className="w-full">
                <thead className="bg-primary-50 border-b border-primary-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-primary-500 uppercase">Numero</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-primary-500 uppercase">Client</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-primary-500 uppercase">Date</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-primary-500 uppercase">Montant</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-primary-500 uppercase">Statut</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-primary-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-100">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-primary-50">
                      <td className="px-6 py-4 font-medium text-primary-900">{invoice.numero}</td>
                      <td className="px-6 py-4 text-primary-700">{invoice.clientName}</td>
                      <td className="px-6 py-4 text-sm text-primary-600">{formatDate(invoice.dateEmission)}</td>
                      <td className="px-6 py-4 text-right font-medium text-primary-900">{formatCurrency(invoice.total, 'XAF')}</td>
                      <td className="px-6 py-4">{getStatusBadge(invoice.status)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="p-2 hover:bg-primary-100 rounded-lg text-primary-600"
                            onClick={() => setViewingInvoice(invoice)}
                            title="Voir la facture"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 hover:bg-primary-100 rounded-lg text-primary-600"
                            onClick={() => handleDownloadInvoice(invoice)}
                            title="Telecharger PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {invoice.status !== 'paid' && (
                            <button className="p-2 hover:bg-primary-100 rounded-lg text-primary-600" title="Envoyer par email">
                              <Mail className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredInvoices.length === 0 && (
                <div className="p-8 text-center">
                  <Receipt className="w-10 h-10 text-primary-300 mx-auto mb-3" />
                  <h3 className="font-medium text-primary-900 mb-1">Aucune facture</h3>
                  <p className="text-sm text-primary-500 mb-4">Creez votre premiere facture</p>
                  <Button size="sm" onClick={() => setShowCreateInvoice(true)}>
                    <Plus className="w-3 h-3 mr-1" />
                    Nouvelle facture
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Calculator Tab */}
      {activeTab === 'calculator' && (
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Calculateur d'honoraires</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-primary-700 mb-1">
                    Selectionner un client
                  </label>
                  <Select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                    <option value="">Choisir un client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </Select>
                </div>

                {selectedClientId && (
                  <>
                    <div className="border-t border-primary-200 pt-4">
                      <h4 className="font-medium text-primary-900 mb-3">Configuration des honoraires</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-primary-600 mb-1">Forfait mensuel</label>
                          <Input type="number" placeholder="50000" />
                        </div>
                        <div>
                          <label className="block text-sm text-primary-600 mb-1">Commission succes (%)</label>
                          <Input type="number" placeholder="20" />
                        </div>
                        <div>
                          <label className="block text-sm text-primary-600 mb-1">Seuil minimum</label>
                          <Input type="number" placeholder="100000" />
                        </div>
                        <div>
                          <label className="block text-sm text-primary-600 mb-1">Periode</label>
                          <Select>
                            <option>Janvier 2024</option>
                            <option>Fevrier 2024</option>
                            <option>Mars 2024</option>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-primary-200 pt-4">
                      <h4 className="font-medium text-primary-900 mb-3">Calcul des honoraires</h4>
                      <div className="space-y-2 bg-primary-50 rounded-lg p-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-primary-600">Forfait mensuel</span>
                          <span className="font-medium">{formatCurrency(50000, 'XAF')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-primary-600">Economies realisees</span>
                          <span className="font-medium">{formatCurrency(625000, 'XAF')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-primary-600">Commission (20%)</span>
                          <span className="font-medium">{formatCurrency(125000, 'XAF')}</span>
                        </div>
                        <div className="border-t border-primary-300 pt-2 flex justify-between">
                          <span className="font-bold text-primary-900">Total a facturer</span>
                          <span className="font-bold text-primary-900 text-lg">{formatCurrency(175000, 'XAF')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1">Modifier</Button>
                      <Button size="sm" className="flex-1">Generer la facture</Button>
                    </div>
                  </>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        isOpen={showCreateInvoice}
        onClose={() => setShowCreateInvoice(false)}
        clients={clients}
        onSave={(invoice) => {
          addInvoice(invoice);
          setShowCreateInvoice(false);
        }}
        generateNumber={generateInvoiceNumber}
      />

      {/* View Invoice Modal */}
      <ViewInvoiceModal
        invoice={viewingInvoice}
        onClose={() => setViewingInvoice(null)}
        onDownload={handleDownloadInvoice}
        getStatusBadge={getStatusBadge}
      />
    </div>
  );
}

// Create Invoice Modal
interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  onSave: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => void;
  generateNumber: () => string;
}

function CreateInvoiceModal({ isOpen, onClose, clients, onSave, generateNumber }: CreateInvoiceModalProps) {
  const [clientId, setClientId] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>([
    { description: 'Forfait mensuel audit', quantite: 1, prixUnitaire: 50000, montant: 50000, type: 'forfait' },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    const sousTotal = lines.reduce((sum, l) => sum + l.montant, 0);
    const tauxTva = 0.1925;
    const tva = sousTotal * tauxTva;

    onSave({
      numero: generateNumber(),
      clientId,
      clientName: client.name,
      periode: { start: new Date(), end: new Date() },
      lignes: lines,
      sousTotal,
      tva,
      tauxTva,
      total: sousTotal + tva,
      status: 'draft',
      dateEmission: new Date(),
      dateEcheance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle facture" className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-primary-700 mb-1">Client *</label>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="">Selectionner un client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-primary-700 mb-2">Lignes de facture</label>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Input
                  value={line.description}
                  onChange={(e) => {
                    const newLines = [...lines];
                    newLines[idx].description = e.target.value;
                    setLines(newLines);
                  }}
                  placeholder="Description"
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={line.prixUnitaire}
                  onChange={(e) => {
                    const newLines = [...lines];
                    newLines[idx].prixUnitaire = Number(e.target.value);
                    newLines[idx].montant = newLines[idx].quantite * newLines[idx].prixUnitaire;
                    setLines(newLines);
                  }}
                  className="w-32"
                />
                <button
                  type="button"
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setLines([...lines, { description: '', quantite: 1, prixUnitaire: 0, montant: 0, type: 'service' }])}
          >
            <Plus className="w-4 h-4 mr-1" />
            Ajouter une ligne
          </Button>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-primary-200">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit">Creer la facture</Button>
        </div>
      </form>
    </Modal>
  );
}

// View Invoice Modal
interface ViewInvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onDownload: (invoice: Invoice) => void;
  getStatusBadge: (status: Invoice['status']) => React.ReactNode;
}

function ViewInvoiceModal({ invoice, onClose, onDownload, getStatusBadge }: ViewInvoiceModalProps) {
  if (!invoice) return null;

  return (
    <Modal isOpen={!!invoice} onClose={onClose} title={`Facture ${invoice.numero}`} size="lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between p-4 bg-primary-900 text-white rounded-lg">
          <div>
            <h2 className="text-2xl font-bold">FACTURE</h2>
            <p className="text-primary-300 mt-1">N° {invoice.numero}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-primary-300">Date d'emission</p>
            <p className="font-medium">{formatDate(invoice.dateEmission)}</p>
          </div>
        </div>

        {/* Client Info */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-primary-500 uppercase font-medium mb-1">Cabinet</p>
            <p className="font-medium text-primary-900">Cabinet d'Expertise Comptable</p>
            <p className="text-sm text-primary-600">Audit & Conseil</p>
            <p className="text-sm text-primary-600">CEMAC / UEMOA</p>
          </div>
          <div>
            <p className="text-xs text-primary-500 uppercase font-medium mb-1">Facture a</p>
            <p className="font-medium text-primary-900">{invoice.clientName}</p>
            <p className="text-sm text-primary-600">
              Periode: {formatDate(invoice.periode.start)} - {formatDate(invoice.periode.end)}
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-primary-500">Statut:</span>
          {getStatusBadge(invoice.status)}
          {invoice.status !== 'paid' && (
            <span className="text-sm text-primary-500 ml-4">
              <Calendar className="w-4 h-4 inline mr-1" />
              Echeance: {formatDate(invoice.dateEcheance)}
            </span>
          )}
        </div>

        {/* Lines Table */}
        <div className="border border-primary-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-primary-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-primary-500 uppercase">Description</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-primary-500 uppercase">Qte</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-primary-500 uppercase">Prix unit.</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-primary-500 uppercase">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {invoice.lignes.map((ligne, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3 text-primary-900">{ligne.description}</td>
                  <td className="px-4 py-3 text-center text-primary-600">{ligne.quantite}</td>
                  <td className="px-4 py-3 text-right text-primary-600">{formatCurrency(ligne.prixUnitaire, 'XAF')}</td>
                  <td className="px-4 py-3 text-right font-medium text-primary-900">{formatCurrency(ligne.montant, 'XAF')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-primary-500">Sous-total</span>
              <span className="text-primary-900">{formatCurrency(invoice.sousTotal, 'XAF')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-primary-500">TVA ({(invoice.tauxTva * 100).toFixed(2)}%)</span>
              <span className="text-primary-900">{formatCurrency(invoice.tva, 'XAF')}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-primary-200">
              <span className="font-bold text-primary-900">TOTAL</span>
              <span className="font-bold text-xl text-primary-900">{formatCurrency(invoice.total, 'XAF')}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t border-primary-200">
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onDownload(invoice)}>
              <Download className="w-4 h-4 mr-2" />
              Telecharger PDF
            </Button>
            <Button variant="primary" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimer
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
