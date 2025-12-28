import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Download, Calendar, Trash2, Eye,
  Brain, Loader2, Building2, Landmark, ChevronRight, LayoutGrid, List,
  FileCheck, Clock, Archive, Printer
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Modal,
  Select,
} from '../ui';
import { useAnalysisStore, useTransactionStore, useSettingsStore, useClientStore } from '../../store';
import { ReportService } from '../../services';
import { formatCurrency, formatDate } from '../../utils';
import { Severity } from '../../types';
import { ReportViewer, generateScrutixAuditReport } from '../reporting';
import type { FullReport, BankStatement, ClientReport, Client } from '../../types';

type ViewMode = 'table' | 'card';
type TabType = 'statements' | 'reports';

export function ReportsPage() {
  const navigate = useNavigate();
  const { currentAnalysis, analysisHistory } = useAnalysisStore();
  const { transactions } = useTransactionStore();
  const { claudeApi } = useSettingsStore();
  const { clients, statements, reports, addReport, deleteReport } = useClientStore();

  const [activeTab, setActiveTab] = useState<TabType>('statements');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [showViewer, setShowViewer] = useState(false);
  const [previewReport, setPreviewReport] = useState<FullReport | null>(null);
  const [selectedStatement, setSelectedStatement] = useState<BankStatement | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportConfig, setReportConfig] = useState({
    type: 'audit' as 'audit' | 'summary' | 'detailed' | 'recovery',
    includeAI: true,
  });

  // Get client by ID
  const getClient = (clientId: string) => clients.find(c => c.id === clientId);

  // Get statement stats
  const getStatementStats = (statement: BankStatement) => {
    const statementTransactions = transactions.filter(
      t => t.clientId === statement.clientId &&
      new Date(t.date) >= new Date(statement.periodStart) &&
      new Date(t.date) <= new Date(statement.periodEnd)
    );

    const allAnalyses = [...(currentAnalysis ? [currentAnalysis] : []), ...(analysisHistory || [])];
    const anomalies = allAnalyses.flatMap(a => a.anomalies).filter(an =>
      an.transactions.some(t =>
        t.clientId === statement.clientId &&
        new Date(t.date) >= new Date(statement.periodStart) &&
        new Date(t.date) <= new Date(statement.periodEnd)
      )
    );

    const totalAmount = anomalies.reduce((sum, a) => sum + a.amount, 0);

    return {
      transactions: statementTransactions.length,
      anomalies: anomalies.length,
      amount: totalAmount,
    };
  };

  // Get reports for a statement
  const getStatementReports = (statement: BankStatement) => {
    return reports.filter(r =>
      r.clientId === statement.clientId &&
      new Date(r.period.start).getTime() === new Date(statement.periodStart).getTime() &&
      new Date(r.period.end).getTime() === new Date(statement.periodEnd).getTime()
    );
  };

  // Generate report for statement
  const handleGenerateReport = async (statement: BankStatement) => {
    const client = getClient(statement.clientId);
    if (!client) return;

    setGenerating(true);
    try {
      const stats = getStatementStats(statement);

      // Create report data
      const reportData: ClientReport = {
        id: `report-${Date.now()}`,
        clientId: statement.clientId,
        title: `Rapport ${reportConfig.type} - ${client.name}`,
        type: reportConfig.type,
        period: {
          start: new Date(statement.periodStart),
          end: new Date(statement.periodEnd),
        },
        anomalyCount: stats.anomalies,
        totalAmount: stats.amount,
        recoveredAmount: 0,
        status: 'final',
        generatedAt: new Date(),
      };

      // Add to store
      addReport(reportData);

      // Generate PDF
      const allAnalyses = [...(currentAnalysis ? [currentAnalysis] : []), ...(analysisHistory || [])];
      const analysisData = allAnalyses.find(a =>
        a.anomalies.some(an => an.transactions.some(t => t.clientId === statement.clientId))
      );

      if (analysisData) {
        const pdfData = {
          title: reportData.title,
          clientName: client.name,
          period: reportData.period,
          anomalies: analysisData.anomalies.filter(an =>
            an.transactions.some(t => t.clientId === statement.clientId)
          ),
          statistics: analysisData.statistics,
          summary: analysisData.summary,
          includeAIAnalysis: reportConfig.includeAI && claudeApi.isEnabled,
          aiSummary: analysisData.summary.message,
        };
        ReportService.downloadPDF(pdfData);
      }

      setShowGenerateModal(false);
      setSelectedStatement(null);
    } catch (error) {
      console.error('Erreur generation rapport:', error);
    } finally {
      setGenerating(false);
    }
  };

  // View report
  const handleViewReport = (statement: BankStatement) => {
    const client = getClient(statement.clientId);
    if (!client) return;

    const allAnalyses = [...(currentAnalysis ? [currentAnalysis] : []), ...(analysisHistory || [])];
    const analysisData = allAnalyses.find(a =>
      a.anomalies.some(an => an.transactions.some(t => t.clientId === statement.clientId))
    ) || createEmptyAnalysis(client);

    const report = generateScrutixAuditReport({
      client: client as any,
      analysis: analysisData,
      auditorName: 'Expert-Comptable',
      auditorCompany: 'Cabinet d\'Expertise Comptable',
    });

    setPreviewReport(report);
    setShowViewer(true);
  };

  // Create empty analysis for preview
  const createEmptyAnalysis = (client: Client) => {
    const defaultDate = new Date();
    return {
      id: 'demo-analysis',
      status: 'completed' as const,
      startedAt: defaultDate,
      completedAt: defaultDate,
      anomalies: [],
      config: {
        dateRange: { start: new Date(defaultDate.getFullYear(), 0, 1), end: defaultDate },
        transactionIds: [],
        clientId: client.id,
        rules: [],
      },
      statistics: {
        totalTransactions: 0,
        analyzedTransactions: 0,
        totalAnomalies: 0,
        totalAnomalyAmount: 0,
        potentialSavings: 0,
        anomaliesBySeverity: {
          [Severity.CRITICAL]: 0,
          [Severity.HIGH]: 0,
          [Severity.MEDIUM]: 0,
          [Severity.LOW]: 0,
        },
        anomaliesByType: {},
      },
      summary: {
        status: 'OK' as const,
        message: 'Aucune anomalie detectee.',
        keyFindings: [],
        recommendations: [],
      },
    };
  };

  const statusConfig = {
    imported: { label: 'Importe', color: 'bg-blue-100 text-blue-700', icon: Clock },
    analyzed: { label: 'Analyse', color: 'bg-green-100 text-green-700', icon: FileCheck },
    archived: { label: 'Archive', color: 'bg-gray-100 text-gray-700', icon: Archive },
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-primary-900">Rapports</h1>
        <p className="text-sm text-primary-500">Generez des rapports d'audit bancaire</p>
      </div>

      {/* Tabs & View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex border-b border-primary-200">
          <button
            onClick={() => setActiveTab('statements')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'statements'
                ? 'border-primary-900 text-primary-900'
                : 'border-transparent text-primary-500 hover:text-primary-700'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-1.5" />
            Releves ({statements.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'reports'
                ? 'border-primary-900 text-primary-900'
                : 'border-transparent text-primary-500 hover:text-primary-700'
            }`}
          >
            <FileCheck className="w-4 h-4 inline mr-1.5" />
            Rapports generes ({reports.length})
          </button>
        </div>
        <div className="flex border border-primary-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-primary-900 text-white' : 'bg-white text-primary-500 hover:bg-primary-50'}`}
            title="Vue tableau"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 transition-colors ${viewMode === 'card' ? 'bg-primary-900 text-white' : 'bg-white text-primary-500 hover:bg-primary-50'}`}
            title="Vue cartes"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Statements Tab */}
      {activeTab === 'statements' && (
        <>
          {viewMode === 'table' ? (
            /* Table View - Always show */
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-primary-50 border-b border-primary-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Client</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Banque</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Période</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Opérations</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Anomalies</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Montant</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Statut</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Rapports</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary-100">
                    {statements.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center">
                          <FileText className="w-8 h-8 text-primary-300 mx-auto mb-2" />
                          <p className="text-sm text-primary-500">
                            Aucun releve importe.{' '}
                            <button
                              onClick={() => navigate('/import')}
                              className="text-primary-900 underline hover:text-primary-700"
                            >
                              Importer des releves
                            </button>
                          </p>
                        </td>
                      </tr>
                    ) : (
                      statements.map((statement) => {
                      const client = getClient(statement.clientId);
                      const stats = getStatementStats(statement);
                      const statementReports = getStatementReports(statement);
                      const StatusIcon = statusConfig[statement.status].icon;

                      return (
                        <tr key={statement.id} className="hover:bg-primary-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-primary-900 flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-4 h-4 text-white" />
                              </div>
                              <span className="text-sm font-medium text-primary-900">
                                {client?.name || 'Client inconnu'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Landmark className="w-3.5 h-3.5 text-primary-400" />
                              <span className="text-sm text-primary-600">{statement.bankName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-primary-400" />
                              <span className="text-xs text-primary-600">
                                {formatDate(statement.periodStart)} - {formatDate(statement.periodEnd)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm text-primary-600">{stats.transactions}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {stats.anomalies > 0 ? (
                              <Badge variant="warning">{stats.anomalies}</Badge>
                            ) : (
                              <span className="text-sm text-primary-400">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-medium text-green-600">
                              {formatCurrency(stats.amount, 'XAF')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[statement.status].color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusConfig[statement.status].label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {statementReports.length > 0 ? (
                              <Badge variant="secondary">{statementReports.length}</Badge>
                            ) : (
                              <span className="text-sm text-primary-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleViewReport(statement)}
                                className="p-1.5 hover:bg-primary-100 rounded text-primary-500 hover:text-primary-700"
                                title="Voir le rapport"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedStatement(statement);
                                  setShowGenerateModal(true);
                                }}
                                className="p-1.5 hover:bg-blue-50 rounded text-primary-500 hover:text-blue-600"
                                title="Generer un rapport"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => navigate(`/clients/${statement.clientId}`)}
                                className="p-1.5 hover:bg-primary-100 rounded text-primary-500 hover:text-primary-700"
                                title="Voir le client"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            /* Card View */
            statements.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="w-8 h-8 text-primary-300 mx-auto mb-2" />
                <p className="text-sm text-primary-500">
                  Aucun releve importe.{' '}
                  <button
                    onClick={() => navigate('/import')}
                    className="text-primary-900 underline hover:text-primary-700"
                  >
                    Importer des releves
                  </button>
                </p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {statements.map((statement) => {
                const client = getClient(statement.clientId);
                const stats = getStatementStats(statement);
                const statementReports = getStatementReports(statement);
                const StatusIcon = statusConfig[statement.status].icon;

                return (
                  <Card key={statement.id} className="p-3 hover:border-primary-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary-900 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-primary-900">{client?.name || 'Client inconnu'}</h3>
                          <p className="text-xs text-primary-500">{statement.bankName}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[statement.status].color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig[statement.status].label}
                      </span>
                    </div>

                    <div className="text-xs text-primary-500 mb-3 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(statement.periodStart)} - {formatDate(statement.periodEnd)}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-center p-2 bg-primary-50 rounded">
                        <p className="text-lg font-bold text-primary-900">{stats.transactions}</p>
                        <p className="text-xs text-primary-500">Tx</p>
                      </div>
                      <div className="text-center p-2 bg-amber-50 rounded">
                        <p className="text-lg font-bold text-amber-600">{stats.anomalies}</p>
                        <p className="text-xs text-primary-500">Anom.</p>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded">
                        <p className="text-sm font-bold text-green-600">{formatCurrency(stats.amount, 'XAF')}</p>
                        <p className="text-xs text-primary-500">Montant</p>
                      </div>
                    </div>

                    {statementReports.length > 0 && (
                      <div className="mb-3 p-2 bg-blue-50 rounded flex items-center justify-between">
                        <span className="text-xs text-blue-700">{statementReports.length} rapport(s) genere(s)</span>
                        <FileCheck className="w-4 h-4 text-blue-600" />
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-primary-100">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleViewReport(statement)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Voir
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedStatement(statement);
                          setShowGenerateModal(true);
                        }}
                      >
                        <Printer className="w-3 h-3 mr-1" />
                        Generer
                      </Button>
                    </div>
                  </Card>
                );
              })}
              </div>
            )
          )}
        </>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <>
          {viewMode === 'table' ? (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-primary-50 border-b border-primary-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Titre</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Client</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Période</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Anomalies</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Montant</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Statut</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Créé le</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-primary-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary-100">
                    {reports.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center">
                          <FileCheck className="w-8 h-8 text-primary-300 mx-auto mb-2" />
                          <p className="text-sm text-primary-500">Aucun rapport genere</p>
                          <p className="text-xs text-primary-400 mt-1">Generez des rapports depuis l'onglet Releves</p>
                        </td>
                      </tr>
                    ) : (
                      reports.map((report) => {
                      const client = getClient(report.clientId);
                      const typeLabels = {
                        audit: 'Audit complet',
                        summary: 'Synthetique',
                        detailed: 'Detaille',
                        recovery: 'Recouvrement',
                      };
                      const statusLabels = {
                        draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700' },
                        final: { label: 'Final', color: 'bg-green-100 text-green-700' },
                        sent: { label: 'Envoye', color: 'bg-blue-100 text-blue-700' },
                      };

                      return (
                        <tr key={report.id} className="hover:bg-primary-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-red-500" />
                              <span className="text-sm font-medium text-primary-900">{report.title}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-primary-600">{client?.name || 'Client inconnu'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-primary-500">{typeLabels[report.type]}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-primary-600">
                              {formatDate(report.period.start)} - {formatDate(report.period.end)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="secondary">{report.anomalyCount}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-medium text-green-600">
                              {formatCurrency(report.totalAmount, 'XAF')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabels[report.status].color}`}>
                              {statusLabels[report.status].label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-primary-500">{formatDate(report.generatedAt)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  const statement = statements.find(s =>
                                    s.clientId === report.clientId &&
                                    new Date(s.periodStart).getTime() === new Date(report.period.start).getTime()
                                  );
                                  if (statement) handleViewReport(statement);
                                }}
                                className="p-1.5 hover:bg-primary-100 rounded text-primary-500 hover:text-primary-700"
                                title="Voir le rapport"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteReport(report.id)}
                                className="p-1.5 hover:bg-red-50 rounded text-primary-500 hover:text-red-600"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            reports.length === 0 ? (
              <Card className="p-8 text-center">
                <FileCheck className="w-8 h-8 text-primary-300 mx-auto mb-2" />
                <p className="text-sm text-primary-500">Aucun rapport genere</p>
                <p className="text-xs text-primary-400 mt-1">Generez des rapports depuis l'onglet Releves</p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {reports.map((report) => {
                const client = getClient(report.clientId);
                const typeLabels = {
                  audit: 'Audit complet',
                  summary: 'Synthetique',
                  detailed: 'Detaille',
                  recovery: 'Recouvrement',
                };

                return (
                  <Card key={report.id} className="p-3 hover:border-primary-300 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <FileText className="w-4 h-4 text-red-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-primary-900 line-clamp-1">{report.title}</h3>
                          <p className="text-xs text-primary-500">{client?.name}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                      <div className="flex items-center gap-1 text-primary-500">
                        <Calendar className="w-3 h-3" />
                        {formatDate(report.generatedAt)}
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">{typeLabels[report.type]}</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="p-2 bg-primary-50 rounded text-center">
                        <p className="text-lg font-bold text-primary-900">{report.anomalyCount}</p>
                        <p className="text-xs text-primary-500">Anomalies</p>
                      </div>
                      <div className="p-2 bg-green-50 rounded text-center">
                        <p className="text-sm font-bold text-green-600">{formatCurrency(report.totalAmount, 'XAF')}</p>
                        <p className="text-xs text-primary-500">Montant</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-primary-100">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          const statement = statements.find(s =>
                            s.clientId === report.clientId &&
                            new Date(s.periodStart).getTime() === new Date(report.period.start).getTime()
                          );
                          if (statement) handleViewReport(statement);
                        }}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Voir
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteReport(report.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
              </div>
            )
          )}
        </>
      )}

      {/* Generate Report Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => {
          setShowGenerateModal(false);
          setSelectedStatement(null);
        }}
        title="Generer un rapport"
      >
        {selectedStatement && (
          <div className="space-y-4">
            <div className="p-3 bg-primary-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-primary-500" />
                <span className="font-medium">{getClient(selectedStatement.clientId)?.name}</span>
              </div>
              <div className="text-sm text-primary-600">
                {selectedStatement.bankName} • {formatDate(selectedStatement.periodStart)} - {formatDate(selectedStatement.periodEnd)}
              </div>
            </div>

            <Select
              label="Type de rapport"
              value={reportConfig.type}
              onChange={(e) => setReportConfig({ ...reportConfig, type: e.target.value as any })}
              options={[
                { value: 'audit', label: 'Rapport d\'audit complet' },
                { value: 'summary', label: 'Rapport synthetique' },
                { value: 'detailed', label: 'Rapport detaille' },
                { value: 'recovery', label: 'Rapport de recouvrement' },
              ]}
            />

            {claudeApi.isEnabled && (
              <label className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportConfig.includeAI}
                  onChange={(e) => setReportConfig({ ...reportConfig, includeAI: e.target.checked })}
                  className="w-4 h-4"
                />
                <Brain className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-purple-700">Inclure l'analyse IA</span>
              </label>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowGenerateModal(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => handleGenerateReport(selectedStatement)}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                Generer et telecharger
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Report Viewer Modal */}
      {showViewer && previewReport && (
        <ReportViewer
          report={previewReport}
          onClose={() => setShowViewer(false)}
        />
      )}
    </div>
  );
}
