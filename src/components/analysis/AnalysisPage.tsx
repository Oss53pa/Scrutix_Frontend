import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Filter, Download, ChevronDown, Brain, AlertTriangle,
  TrendingUp, Shield, ChevronRight, Sparkles, Calendar
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Button,
  Progress,
  SeverityBadge,
  NoDataEmptyState,
  NoAnomaliesEmptyState,
  Badge,
} from '../ui';
import { AnomalyDetailPanel } from './AnomalyDetailPanel';
import { useTransactionStore, useAnalysisStore, useSettingsStore } from '../../store';
import { useBankStore } from '../../store/bankStore';
import { getAnalysisService, ClaudeService } from '../../services';
import { AnomalyType, Anomaly, Severity, DEFAULT_THRESHOLDS, ANOMALY_TYPE_LABELS, BankConditions } from '../../types';
import { formatCurrency, formatDate, formatConfidence } from '../../utils';

export function AnalysisPage() {
  const navigate = useNavigate();

  const { transactions } = useTransactionStore();
  const {
    currentAnalysis,
    isAnalyzing,
    progress,
    currentStep,
    startAnalysis,
    updateProgress,
    completeAnalysis,
    failAnalysis,
    getFilteredAnomalies,
  } = useAnalysisStore();
  const { thresholds, bankConditions, claudeApi, getEnabledDetectors } = useSettingsStore();
  const { banks: _banks, getGridForDate, getBankByCode } = useBankStore();

  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const isAIEnabled = claudeApi.isEnabled && claudeApi.apiKey;

  const hasData = transactions.length > 0;
  const filteredAnomalies = getFilteredAnomalies();

  // Determine the date range of transactions for grid selection
  const transactionDateRange = useMemo(() => {
    if (!hasData) return null;
    const dates = transactions.map((t) => new Date(t.date).getTime());
    return {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates)),
      midpoint: new Date((Math.min(...dates) + Math.max(...dates)) / 2),
    };
  }, [transactions, hasData]);

  // Get unique bank codes from transactions
  const transactionBankCodes = useMemo(() => {
    if (!hasData) return [];
    return [...new Set(transactions.map((t) => t.bankCode).filter(Boolean))];
  }, [transactions, hasData]);

  // Select the appropriate grid for each bank based on transaction dates
  const selectedGridsInfo = useMemo(() => {
    if (!transactionDateRange || transactionBankCodes.length === 0) return [];

    return transactionBankCodes.map((bankCode) => {
      const bank = getBankByCode(bankCode);
      if (!bank) return { bankCode, bankName: bankCode, grid: null, source: 'not_found' };

      // Try to find a grid that matches the transaction date
      const grid = getGridForDate(bank.id, transactionDateRange.midpoint);

      if (grid) {
        return {
          bankCode,
          bankName: bank.name,
          grid,
          source: 'versioned_grid',
          effectiveDate: grid.effectiveDate,
          version: grid.version,
        };
      }

      // Fallback to bank's current conditions
      if (bank.conditions) {
        return {
          bankCode,
          bankName: bank.name,
          conditions: bank.conditions,
          source: 'bank_conditions',
        };
      }

      return { bankCode, bankName: bank.name, grid: null, source: 'no_conditions' };
    });
  }, [transactionBankCodes, transactionDateRange, getBankByCode, getGridForDate]);

  const runAnalysis = useCallback(async () => {
    if (!hasData) return;

    // Get enabled detectors from settings
    const enabledDetectorStrings = getEnabledDetectors();
    const enabledDetectors = enabledDetectorStrings.map(
      (d) => AnomalyType[d as keyof typeof AnomalyType]
    ).filter(Boolean);

    const config = {
      clientId: 'default',
      dateRange: {
        start: new Date(Math.min(...transactions.map((t) => new Date(t.date).getTime()))),
        end: new Date(Math.max(...transactions.map((t) => new Date(t.date).getTime()))),
      },
      thresholds: thresholds || DEFAULT_THRESHOLDS,
      enabledDetectors,
    };

    startAnalysis(config);

    try {
      const service = getAnalysisService(thresholds);

      // Select bank conditions based on versioned grids or fallback to settings
      let analysisConditions: BankConditions;

      // First, try to use versioned grid from bankStore
      const primaryGridInfo = selectedGridsInfo[0];
      if (primaryGridInfo?.grid) {
        // Use the conditions from the versioned grid
        analysisConditions = primaryGridInfo.grid.conditions;
        console.log(`[Scrutix] Using versioned grid: ${primaryGridInfo.grid.name} (v${primaryGridInfo.version})`);
      } else if (primaryGridInfo?.conditions) {
        // Use the bank's current conditions
        analysisConditions = primaryGridInfo.conditions;
        console.log(`[Scrutix] Using bank conditions for: ${primaryGridInfo.bankName}`);
      } else {
        // Fallback to settings bankConditions
        analysisConditions = bankConditions[0] || {
          id: 'default',
          bankCode: 'DEFAULT',
          bankName: 'Banque',
          country: 'CM',
          currency: 'XAF',
          effectiveDate: new Date(),
          fees: [],
          interestRates: [],
          isActive: true,
        };
        console.log('[Scrutix] Using default conditions from settings');
      }

      // Setup Claude service if enabled
      let claudeService: ClaudeService | undefined;
      if (isAIEnabled) {
        claudeService = new ClaudeService({
          apiKey: claudeApi.apiKey,
          model: claudeApi.model,
        });
      }

      const result = await service.analyzeTransactions(
        transactions,
        analysisConditions,
        config,
        {
          onProgress: (prog, step) => updateProgress(prog, step),
          claudeService,
          enableAICategorization: claudeApi.enableCategorization,
          enableAIFraudDetection: claudeApi.enableFraudDetection,
        }
      );

      completeAnalysis(result);
    } catch (error) {
      failAnalysis(error instanceof Error ? error.message : 'Erreur inconnue');
    }
  }, [hasData, transactions, thresholds, bankConditions, claudeApi, isAIEnabled, getEnabledDetectors, startAnalysis, updateProgress, completeAnalysis, failAnalysis, selectedGridsInfo]);

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">Analyse des anomalies</h1>
          <p className="page-description">
            Détection automatique des anomalies dans vos relevés bancaires
          </p>
        </div>

        <Card>
          <CardBody>
            <NoDataEmptyState onAction={() => navigate('/import')} />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary-900">Analyse des anomalies</h1>
          <p className="text-sm text-primary-500">{transactions.length.toLocaleString('fr-FR')} transactions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowFilters(!showFilters)} disabled={isAnalyzing}>
            <Filter className="w-4 h-4" />Filtres
            <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
          <Button variant="primary" size="sm" onClick={runAnalysis} isLoading={isAnalyzing} disabled={isAnalyzing}>
            <Play className="w-4 h-4" />{isAnalyzing ? 'Analyse...' : 'Analyser'}
          </Button>
        </div>
      </div>

      {/* Grid Selection Info */}
      {selectedGridsInfo.length > 0 && !isAnalyzing && !currentAnalysis && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 text-primary-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-primary-900">Grille tarifaire</p>
              <div className="mt-1 space-y-0.5">
                {selectedGridsInfo.map((info, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <span className="text-primary-700">{info.bankName}:</span>
                    {info.source === 'versioned_grid' && info.grid ? (
                      <span className="flex items-center gap-1">
                        <Badge variant="success">{info.grid.name}</Badge>
                        <span className="text-primary-500">v{info.version}</span>
                      </span>
                    ) : info.source === 'bank_conditions' ? (
                      <Badge variant="info">Actuelles</Badge>
                    ) : (
                      <Badge variant="warning">Defaut</Badge>
                    )}
                  </div>
                ))}
              </div>
              {transactionDateRange && (
                <p className="text-xs text-primary-500 mt-1">{formatDate(transactionDateRange.start)} - {formatDate(transactionDateRange.end)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      {isAnalyzing && (
        <Card>
          <CardBody className="py-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-primary-700">{currentStep}</p>
                <p className="text-xs text-primary-500">{Math.round(progress)}%</p>
              </div>
              <Progress value={progress} />
            </div>
          </CardBody>
        </Card>
      )}

      {/* Results */}
      {currentAnalysis && !isAnalyzing && (
        <>
          {/* AI Status Banner */}
          {isAIEnabled && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary-100 rounded-lg">
                  <Brain className="w-4 h-4 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary-900">IA Active</p>
                  <p className="text-xs text-primary-600">Claude {claudeApi.model.includes('opus') ? 'Opus' : 'Sonnet'}</p>
                </div>
              </div>
              <Sparkles className="w-4 h-4 text-primary-500" />
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <AlertTriangle className="w-4 h-4 text-primary-500" />
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${currentAnalysis.statistics.totalAnomalies > 5 ? 'bg-primary-200 text-primary-800' : 'bg-primary-100 text-primary-700'}`}>
                  {currentAnalysis.statistics.totalAnomalies > 5 ? 'Élevé' : 'OK'}
                </span>
              </div>
              <p className="text-xs text-primary-500">Anomalies</p>
              <p className="text-xl font-bold text-primary-900">{currentAnalysis.statistics.totalAnomalies}</p>
            </Card>
            <Card className="p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <TrendingUp className="w-4 h-4 text-primary-500" />
              </div>
              <p className="text-xs text-primary-500">Economies</p>
              <p className="text-lg font-bold text-primary-900">{formatCurrency(currentAnalysis.statistics.potentialSavings, 'XAF')}</p>
            </Card>
            <Card className="p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                <Shield className="w-4 h-4 text-primary-500" />
              </div>
              <p className="text-xs text-primary-500">Critiques</p>
              <p className="text-xl font-bold text-primary-900">
                {(currentAnalysis.statistics.anomaliesBySeverity[Severity.CRITICAL] || 0) + (currentAnalysis.statistics.anomaliesBySeverity[Severity.HIGH] || 0)}
              </p>
            </Card>
            <Card className="p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-1">
                {currentAnalysis.summary.status === 'CRITICAL' ? <AlertTriangle className="w-4 h-4 text-primary-500" /> : currentAnalysis.summary.status === 'WARNING' ? <AlertTriangle className="w-4 h-4 text-primary-500" /> : <Shield className="w-4 h-4 text-primary-500" />}
              </div>
              <p className="text-xs text-primary-500">Statut</p>
              <p className="text-xl font-bold text-primary-900">
                {currentAnalysis.summary.status === 'CRITICAL' ? 'Critique' : currentAnalysis.summary.status === 'WARNING' ? 'Attention' : 'OK'}
              </p>
            </Card>
          </div>

          {/* Anomaly list */}
          <Card>
            <CardHeader className="py-2" action={filteredAnomalies.length > 0 && (<Button variant="secondary" size="sm"><Download className="w-3 h-3" />Export</Button>)}>
              <CardTitle className="text-sm">Anomalies ({filteredAnomalies.length})</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {filteredAnomalies.length === 0 ? (
                <div className="p-4"><NoAnomaliesEmptyState /></div>
              ) : (
                <div className="divide-y divide-primary-100">
                  {filteredAnomalies.map((anomaly, index) => {
                    const severityColors = { [Severity.CRITICAL]: 'border-l-primary-900 bg-primary-50/30', [Severity.HIGH]: 'border-l-primary-700 bg-primary-50/30', [Severity.MEDIUM]: 'border-l-primary-500 bg-primary-50/30', [Severity.LOW]: 'border-l-primary-300 bg-primary-50/30' };
                    return (
                      <div key={anomaly.id} className={`px-4 py-2.5 border-l-4 ${severityColors[anomaly.severity]} hover:bg-primary-50 cursor-pointer transition-all group`} onClick={() => { setSelectedAnomaly(anomaly); setShowDetailPanel(true); }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-primary-400 bg-primary-100 px-1.5 py-0.5 rounded">#{index + 1}</span>
                              <SeverityBadge severity={anomaly.severity} />
                              {isAIEnabled && <span className="flex items-center gap-0.5 text-xs text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-full"><Brain className="w-2.5 h-2.5" />IA</span>}
                            </div>
                            <p className="text-xs font-medium text-primary-900">{ANOMALY_TYPE_LABELS[anomaly.type]}</p>
                            <p className="text-xs text-primary-600 line-clamp-1">{anomaly.recommendation}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-primary-400">
                              <span>{anomaly.transactions.length} tx</span><span>•</span>
                              <span>{formatConfidence(anomaly.confidence)}</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-base font-bold text-primary-900">
                              +{formatCurrency(anomaly.amount, 'XAF')}
                            </p>
                            <ChevronRight className="w-4 h-4 text-primary-300 mt-1 group-hover:text-primary-500 transition-colors ml-auto" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {/* Anomaly detail panel */}
      {showDetailPanel && selectedAnomaly && (
        <AnomalyDetailPanel
          anomaly={selectedAnomaly}
          bankConditions={bankConditions[0]}
          onClose={() => {
            setShowDetailPanel(false);
            setSelectedAnomaly(null);
          }}
          onStatusChange={(status) => {
            // TODO: Update anomaly status
            console.log('Status changed:', status);
          }}
        />
      )}
    </div>
  );
}
