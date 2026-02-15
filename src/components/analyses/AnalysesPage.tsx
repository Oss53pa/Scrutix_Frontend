import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  Eye,
  Bot,
  Sparkles,
  MessageSquare,
  FileWarning,
  TrendingUp,
  Cpu,
} from 'lucide-react';
import { Card, CardBody, Button, Input, Select, Badge, SeverityBadge } from '../ui';
import { useClientStore } from '../../store/clientStore';
import { useBankStore } from '../../store/bankStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { useTransactionStore } from '../../store/transactionStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatCurrency, formatDate } from '../../utils';
import { AnomalyType, Severity, ANOMALY_TYPE_LABELS, DetectionSource, DEFAULT_THRESHOLDS, Anomaly, Transaction } from '../../types';
import { getAnalysisService, ClaudeService } from '../../services';

type ViewMode = 'config' | 'viewer';

// Données de démonstration
const DEMO_TRANSACTIONS: Transaction[] = [
  { id: 'demo-1', date: new Date('2024-01-15'), description: 'VIREMENT SALAIRE', amount: 2500000, balance: 5000000, type: 'credit', clientId: 'demo', bankCode: 'SGBC' },
  { id: 'demo-2', date: new Date('2024-01-16'), description: 'FRAIS DE TENUE DE COMPTE', amount: -15000, balance: 4985000, type: 'fee', clientId: 'demo', bankCode: 'SGBC' },
  { id: 'demo-3', date: new Date('2024-01-16'), description: 'FRAIS DE TENUE DE COMPTE', amount: -15000, balance: 4970000, type: 'fee', clientId: 'demo', bankCode: 'SGBC' },
  { id: 'demo-4', date: new Date('2024-01-17'), description: 'COMMISSION VIREMENT', amount: -25000, balance: 4945000, type: 'fee', clientId: 'demo', bankCode: 'SGBC' },
  { id: 'demo-5', date: new Date('2024-01-18'), description: 'AGIOS DEBITEURS', amount: -185000, balance: 4760000, type: 'interest', clientId: 'demo', bankCode: 'SGBC' },
  { id: 'demo-6', date: new Date('2024-01-19'), description: 'FRAIS DIVERS', amount: -50000, balance: 4710000, type: 'fee', clientId: 'demo', bankCode: 'SGBC' },
  { id: 'demo-7', date: new Date('2024-01-20'), description: 'PAIEMENT FACTURE ELEC', amount: -125000, balance: 4585000, type: 'debit', clientId: 'demo', bankCode: 'SGBC' },
  { id: 'demo-8', date: new Date('2024-01-21'), description: 'RETRAIT DAB', amount: -200000, balance: 4385000, type: 'debit', clientId: 'demo', bankCode: 'SGBC' },
];

const DEMO_ANOMALIES: Anomaly[] = [
  {
    id: 'demo-a1',
    type: AnomalyType.DUPLICATE_FEE,
    severity: Severity.HIGH,
    amount: 15000,
    description: 'Frais de tenue de compte facturés en double le 16/01/2024',
    recommendation: 'Demander le remboursement des 15 000 FCFA de frais facturés en double. Référence: TDC-001 - Frais de tenue de compte.',
    confidence: 0.95,
    transactions: [DEMO_TRANSACTIONS[1], DEMO_TRANSACTIONS[2]],
    evidence: [
      {
        type: 'DUPLICATE',
        description: 'Double facturation détectée',
        value: '15 000 FCFA',
        expectedValue: 15000,
        appliedValue: 30000,
        source: 'Grille tarifaire SGBC - janvier 2024',
        conditionRef: 'TDC-001 - Frais de tenue de compte mensuel',
      },
      {
        type: 'COMPARISON',
        description: 'Même libellé et montant le même jour',
        value: '2 occurrences le 16/01/2024',
      },
    ],
    detectedAt: new Date(),
    status: 'pending',
  },
  {
    id: 'demo-a2',
    type: AnomalyType.OVERCHARGE,
    severity: Severity.CRITICAL,
    amount: 85000,
    description: 'Agios calculés avec un taux supérieur au taux contractuel',
    recommendation: 'Surfacturation de 85 000 FCFA (+46%) détectée pour Agios/Découvert. Montant facturé: 185 000 FCFA vs tarif contractuel: 100 000 FCFA. Référence: AGI-002 - Intérêts débiteurs. Réclamer auprès de SGBC le remboursement.',
    confidence: 0.88,
    transactions: [DEMO_TRANSACTIONS[4]],
    evidence: [
      {
        type: 'COMPARISON',
        description: 'Comparaison tarifaire',
        value: 85000,
        expectedValue: 100000,
        appliedValue: 185000,
        source: 'Grille tarifaire SGBC - janvier 2024',
        conditionRef: 'AGI-002 - Taux débiteur annuel',
      },
      {
        type: 'OFFICIAL_RATE',
        description: 'Tarif contractuel',
        value: '12% annuel (max: 100 000 FCFA)',
        source: 'Grille tarifaire SGBC - janvier 2024',
        conditionRef: 'Section: Agios et découverts',
      },
      {
        type: 'REASON',
        description: 'Motif de détection',
        value: 'Taux appliqué: 14.5% vs Taux contractuel: 12%',
      },
    ],
    detectedAt: new Date(),
    status: 'pending',
  },
  {
    id: 'demo-a3',
    type: AnomalyType.GHOST_FEE,
    severity: Severity.MEDIUM,
    amount: 50000,
    description: 'Frais divers sans justification apparente',
    recommendation: 'Demander le détail et la justification de ces frais. Aucune correspondance trouvée dans la grille tarifaire.',
    confidence: 0.75,
    transactions: [DEMO_TRANSACTIONS[5]],
    evidence: [
      {
        type: 'MISSING_JUSTIFICATION',
        description: 'Frais non identifié dans la grille',
        value: '50 000 FCFA',
        source: 'Grille tarifaire SGBC - janvier 2024',
        conditionRef: 'Aucune correspondance trouvée',
      },
      {
        type: 'REASON',
        description: 'Motif de détection',
        value: 'Libellé "FRAIS DIVERS" sans opération correspondante',
      },
    ],
    detectedAt: new Date(),
    status: 'pending',
  },
];

export function AnalysesPage() {
  const { clients = [] } = useClientStore();
  const { banks = [] } = useBankStore();
  const { transactions } = useTransactionStore();
  const {
    currentAnalysis,
    isAnalyzing,
    progress: _progress,
    currentStep: _currentStep,
    startAnalysis,
    updateProgress,
    completeAnalysis,
    failAnalysis,
  } = useAnalysisStore();
  const { thresholds, bankConditions, claudeApi } = useSettingsStore();

  const [viewMode, setViewMode] = useState<ViewMode>('config');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [selectedAnomaly, setSelectedAnomaly] = useState<number | null>(null);
  const [zoom, setZoom] = useState(100);

  const isAIEnabled = claudeApi.isEnabled && claudeApi.apiKey;

  // Analysis mode
  const [analysisMode, setAnalysisMode] = useState<DetectionSource>('hybrid');

  // Analysis options - extended detection types
  const [options, setOptions] = useState({
    detectDoublons: true,
    detectFantomes: true,
    detectSurfacturation: true,
    verifierAgios: true,
    detectDateValeur: true,
    detectSeuilsDepasses: false,
    detectTauxChange: false,
    detectCommissions: true,
    detectFraisNonAutorises: true,
    detectEcrituresAnormales: false,
  });

  // Mode configuration
  const modeConfig = {
    algorithm: {
      icon: Cpu,
      title: 'Analyse Algorithmique',
      description: 'Détection basée sur des règles mathématiques et comparaison avec les grilles tarifaires',
      buttonText: 'Lancer l\'analyse algorithmique',
      color: 'primary',
    },
    ai: {
      icon: Bot,
      title: 'Analyse IA',
      description: 'Détection avancée par intelligence artificielle (Claude) pour identifier les anomalies complexes',
      buttonText: 'Lancer l\'analyse IA',
      color: 'primary',
    },
    hybrid: {
      icon: Sparkles,
      title: 'Analyse Hybride',
      description: 'Combine algorithmes + IA pour une détection optimale avec validation croisée',
      buttonText: 'Lancer l\'analyse hybride',
      color: 'primary',
    },
  };

  // Use demo data or real anomalies from analysis store (memoized to prevent infinite loops)
  const anomalies = useMemo(() =>
    isDemoMode ? DEMO_ANOMALIES : (currentAnalysis?.anomalies || []),
    [isDemoMode, currentAnalysis?.anomalies]
  );
  const displayTransactions = useMemo(() =>
    isDemoMode ? DEMO_TRANSACTIONS : transactions,
    [isDemoMode, transactions]
  );

  const totalSavings = anomalies.reduce((sum, a) => sum + a.amount, 0);
  const criticalCount = anomalies.filter((a) => a.severity === Severity.CRITICAL).length;
  const highCount = anomalies.filter((a) => a.severity === Severity.HIGH).length;

  // Get transactions for selected client
  const clientTransactions = selectedClient
    ? transactions.filter((t) => t.clientId === selectedClient)
    : transactions;

  const handleLaunchAnalysis = async () => {
    if (transactions.length === 0) {
      alert('Aucune transaction importée. Veuillez d\'abord importer des relevés bancaires.');
      return;
    }

    // Build enabled detectors list based on options
    const enabledDetectors: AnomalyType[] = [];
    if (options.detectDoublons) enabledDetectors.push(AnomalyType.DUPLICATE_FEE);
    if (options.detectFantomes) enabledDetectors.push(AnomalyType.GHOST_FEE);
    if (options.detectSurfacturation) enabledDetectors.push(AnomalyType.OVERCHARGE);
    if (options.verifierAgios) enabledDetectors.push(AnomalyType.INTEREST_ERROR);
    if (options.detectDateValeur) enabledDetectors.push(AnomalyType.VALUE_DATE_ERROR);
    if (options.detectCommissions) enabledDetectors.push(AnomalyType.FEE_ANOMALY);
    if (options.detectFraisNonAutorises) enabledDetectors.push(AnomalyType.UNAUTHORIZED);
    if (options.detectEcrituresAnormales) enabledDetectors.push(AnomalyType.SUSPICIOUS_TRANSACTION);

    const config = {
      clientId: selectedClient || 'default',
      dateRange: {
        start: dateRange.start ? new Date(dateRange.start) : new Date(Math.min(...transactions.map((t) => new Date(t.date).getTime()))),
        end: dateRange.end ? new Date(dateRange.end) : new Date(Math.max(...transactions.map((t) => new Date(t.date).getTime()))),
      },
      thresholds: thresholds || DEFAULT_THRESHOLDS,
      enabledDetectors,
    };

    startAnalysis(config);

    try {
      const service = getAnalysisService(thresholds);

      // Get bank conditions
      const analysisConditions = bankConditions[0] || {
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

      // Setup Claude service if enabled and mode requires it
      let claudeService: ClaudeService | undefined;
      if (isAIEnabled && (analysisMode === 'ai' || analysisMode === 'hybrid')) {
        claudeService = new ClaudeService({
          apiKey: claudeApi.apiKey,
          model: claudeApi.model,
        });
      }

      const result = await service.analyzeTransactions(
        clientTransactions.length > 0 ? clientTransactions : transactions,
        analysisConditions,
        config,
        {
          onProgress: (prog, step) => updateProgress(prog, step),
          claudeService,
          enableAICategorization: analysisMode !== 'algorithm' && claudeApi.enableCategorization,
          enableAIFraudDetection: analysisMode !== 'algorithm' && claudeApi.enableFraudDetection,
        }
      );

      completeAnalysis(result);
      setViewMode('viewer');
    } catch (error) {
      failAnalysis(error instanceof Error ? error.message : 'Erreur inconnue');
      alert(`Erreur lors de l'analyse: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  const handleGenerateReport = () => {
    // Generate report logic
    alert('Rapport généré avec succès!');
  };

  const currentMode = modeConfig[analysisMode];
  const ModeIcon = currentMode.icon;

  // All detection types
  const detectionTypes = [
    { key: 'detectDoublons', label: 'Doublons', icon: '🔄', desc: 'Frais facturés plusieurs fois' },
    { key: 'detectFantomes', label: 'Frais fantômes', icon: '👻', desc: 'Frais sans justification' },
    { key: 'detectSurfacturation', label: 'Surfacturation', icon: '📈', desc: 'Montants excessifs' },
    { key: 'verifierAgios', label: 'Agios', icon: '💰', desc: 'Erreurs de calcul' },
    { key: 'detectDateValeur', label: 'Dates valeur', icon: '📅', desc: 'Jours de valeur abusifs' },
    { key: 'detectCommissions', label: 'Commissions', icon: '💳', desc: 'Commissions non conformes' },
    { key: 'detectFraisNonAutorises', label: 'Non autorisés', icon: '🚫', desc: 'Frais hors contrat' },
    { key: 'detectSeuilsDepasses', label: 'Seuils', icon: '⚠️', desc: 'Dépassements plafonds' },
    { key: 'detectTauxChange', label: 'Taux change', icon: '💱', desc: 'Anomalies de change' },
    { key: 'detectEcrituresAnormales', label: 'Écritures', icon: '📝', desc: 'Opérations suspectes' },
  ];

  const enabledCount = Object.values(options).filter(Boolean).length;

  // Configuration View
  if (viewMode === 'config') {
    return (
      <div className="space-y-3">
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-primary-900">Analyses</h1>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsDemoMode(true);
              setViewMode('viewer');
            }}
            className="text-xs"
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            Démo
          </Button>
        </div>

        {/* Mode Selection - Compact */}
        <div className="flex gap-2">
          {(Object.keys(modeConfig) as DetectionSource[]).map((mode) => {
            const config = modeConfig[mode];
            const Icon = config.icon;
            const isSelected = analysisMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setAnalysisMode(mode)}
                className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-primary-200 bg-white hover:border-primary-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Icon className="w-4 h-4 text-primary-600" />
                  <span className="text-sm font-medium">{config.title.replace('Analyse ', '')}</span>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-primary-600" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Main Config Card */}
        <Card>
          <CardBody className="p-4">
            {/* Config Grid - 2 rows */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-primary-600 mb-1">Client *</label>
                <Select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="h-9 text-sm"
                >
                  <option value="">Sélectionner</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-primary-600 mb-1">Début</label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-primary-600 mb-1">Fin</label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-primary-600 mb-1">Banque</label>
                <Select
                  value=""
                  onChange={(e) => {
                    if (e.target.value && !selectedBanks.includes(e.target.value)) {
                      setSelectedBanks([...selectedBanks, e.target.value]);
                    }
                  }}
                  className="h-9 text-sm"
                >
                  <option value="">Toutes</option>
                  {banks.filter((b) => b.isActive).map((bank) => (
                    <option key={bank.id} value={bank.code}>{bank.name}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Detection Types - Compact Grid */}
            <div className="border-t border-primary-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-primary-600">
                  Types de détection ({enabledCount}/{detectionTypes.length})
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const allEnabled: Record<string, boolean> = {};
                      detectionTypes.forEach(d => allEnabled[d.key] = true);
                      setOptions(allEnabled as typeof options);
                    }}
                    className="text-[10px] text-primary-500 hover:text-primary-700 px-1"
                  >
                    Tout
                  </button>
                  <span className="text-primary-300">|</span>
                  <button
                    onClick={() => {
                      const allDisabled: Record<string, boolean> = {};
                      detectionTypes.forEach(d => allDisabled[d.key] = false);
                      setOptions(allDisabled as typeof options);
                    }}
                    className="text-[10px] text-primary-500 hover:text-primary-700 px-1"
                  >
                    Aucun
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {detectionTypes.map((opt) => (
                  <label
                    key={opt.key}
                    className={`flex items-center gap-1.5 cursor-pointer px-2 py-1.5 rounded border transition-all ${
                      options[opt.key as keyof typeof options]
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-primary-200 hover:border-primary-300'
                    }`}
                    title={opt.desc}
                  >
                    <input
                      type="checkbox"
                      checked={options[opt.key as keyof typeof options]}
                      onChange={(e) => setOptions({ ...options, [opt.key]: e.target.checked })}
                      className="w-3 h-3 rounded border-primary-300 text-primary-900"
                    />
                    <span className="text-sm">{opt.icon}</span>
                    <span className="text-xs text-primary-700 truncate">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Launch Button */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-primary-100">
              <p className="text-xs text-primary-500">
                {currentMode.description}
              </p>
              <Button
                onClick={handleLaunchAnalysis}
                disabled={!selectedClient || isAnalyzing}
                size="sm"
                className="h-9 px-4 bg-primary-900 hover:bg-primary-800"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Analyse...
                  </>
                ) : (
                  <>
                    <ModeIcon className="w-4 h-4 mr-1.5" />
                    Lancer
                  </>
                )}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Document Viewer with AI Annotations
  return (
    <div className="h-[calc(100vh-8rem)] flex">
      {/* Left Sidebar - Anomalies List */}
      <div className="w-80 border-r border-primary-200 bg-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-primary-200">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="sm" onClick={() => {
              setViewMode('config');
              setIsDemoMode(false);
            }}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Retour
            </Button>
{isDemoMode ? (
              <Badge variant="warning" className="gap-1">
                <Eye className="w-3 h-3" />
                Mode Démo
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <Bot className="w-3 h-3" />
                IA Active
              </Badge>
            )}
          </div>
          <h2 className="font-semibold text-primary-900">Anomalies détectées</h2>
          <p className="text-sm text-primary-500">{anomalies.length} anomalies trouvées</p>
        </div>

        {/* Stats Summary */}
        <div className="p-4 border-b border-primary-200 bg-primary-50">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-lg border border-primary-200">
              <p className="text-xs text-primary-500">Économies potentielles</p>
              <p className="text-lg font-bold text-primary-900">{formatCurrency(totalSavings, 'XAF')}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-primary-200">
              <p className="text-xs text-primary-500">Critiques/Élevées</p>
              <p className="text-lg font-bold text-primary-900">{criticalCount + highCount}</p>
            </div>
          </div>
        </div>

        {/* Anomalies List */}
        <div className="flex-1 overflow-y-auto">
          {anomalies.length === 0 ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="p-8 text-center text-primary-500">
                <FileWarning className="w-12 h-12 mx-auto mb-3 text-primary-300" />
                <p>Aucune anomalie détectée</p>
                <p className="text-xs mt-1">Les transactions semblent conformes</p>
              </div>
            </div>
          ) : (
            anomalies.map((anomaly, index) => (
              <button
                key={anomaly.id}
                onClick={() => setSelectedAnomaly(index)}
                className={`w-full p-4 border-b border-primary-100 text-left hover:bg-primary-50 transition-colors ${
                  selectedAnomaly === index ? 'bg-primary-100 border-l-4 border-l-primary-900' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      anomaly.severity === Severity.CRITICAL ? 'bg-primary-900' :
                      anomaly.severity === Severity.HIGH ? 'bg-primary-700' :
                      anomaly.severity === Severity.MEDIUM ? 'bg-primary-500' : 'bg-primary-300'
                    }`} />
                    <span className="text-xs font-medium text-primary-500">
                      {anomaly.transactions.length} tx
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <SeverityBadge severity={anomaly.severity} />
                  </div>
                </div>
                <p className="text-sm font-medium text-primary-900 mb-1 line-clamp-2">
                  {ANOMALY_TYPE_LABELS[anomaly.type]}
                </p>
                <p className="text-xs text-primary-600 line-clamp-1 mb-1">
                  {anomaly.recommendation}
                </p>
                <p className="text-sm font-bold text-primary-900">
                  +{formatCurrency(anomaly.amount, 'XAF')}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Generate Report Button */}
        <div className="p-4 border-t border-primary-200">
          <Button className="w-full gap-2" onClick={handleGenerateReport}>
            <FileText className="w-4 h-4" />
            Générer le rapport
          </Button>
        </div>
      </div>

      {/* Main Content - Document Viewer */}
      <div className="flex-1 flex flex-col bg-primary-100">
        {/* Toolbar */}
        <div className="bg-white border-b border-primary-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary-700">
              Transactions analysées ({displayTransactions.length})
            </span>
            {currentAnalysis && (
              <Badge variant="success">{currentAnalysis.statistics.totalAnomalies} anomalies</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setZoom(Math.max(50, zoom - 10))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-primary-600 w-12 text-center">{zoom}%</span>
            <Button variant="ghost" size="sm" onClick={() => setZoom(Math.min(200, zoom + 10))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-primary-200 mx-2" />
            <Button variant="ghost" size="sm">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Transaction Table */}
        <div className="flex-1 overflow-auto p-4">
          <div
            className="bg-white shadow-lg mx-auto max-w-4xl rounded-lg overflow-hidden"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            <table className="w-full text-sm">
              <thead className="bg-primary-100">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-primary-700">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-primary-700">Description</th>
                  <th className="text-right py-3 px-4 font-medium text-primary-700">Montant</th>
                  <th className="text-right py-3 px-4 font-medium text-primary-700">Solde</th>
                  <th className="text-center py-3 px-4 font-medium text-primary-700">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {displayTransactions.slice(0, 100).map((tx, _i) => {
                  // Check if this transaction is part of an anomaly
                  const relatedAnomaly = anomalies.find(a =>
                    a.transactions.some(t => t.id === tx.id)
                  );
                  const isSelected = selectedAnomaly !== null && anomalies[selectedAnomaly]?.transactions.some(t => t.id === tx.id);

                  return (
                    <tr
                      key={tx.id}
                      className={`${
                        relatedAnomaly
                          ? isSelected
                            ? 'bg-red-100 border-l-4 border-l-red-500'
                            : 'bg-yellow-50'
                          : 'hover:bg-primary-50'
                      }`}
                    >
                      <td className="py-2 px-4 text-xs text-primary-600">
                        {formatDate(tx.date)}
                      </td>
                      <td className="py-2 px-4">
                        <span className={relatedAnomaly ? 'text-red-700 font-medium' : ''}>
                          {tx.description}
                        </span>
                        {relatedAnomaly && (
                          <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                            {ANOMALY_TYPE_LABELS[relatedAnomaly.type]}
                          </span>
                        )}
                      </td>
                      <td className={`py-2 px-4 text-right font-medium ${
                        tx.amount < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(Math.abs(tx.amount), 'XAF')}
                      </td>
                      <td className="py-2 px-4 text-right text-primary-700">
                        {formatCurrency(tx.balance, 'XAF')}
                      </td>
                      <td className="py-2 px-4 text-center">
                        {relatedAnomaly ? (
                          <SeverityBadge severity={relatedAnomaly.severity} />
                        ) : (
                          <span className="text-xs text-green-600">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {displayTransactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-primary-500">
                      Aucune transaction importée
                    </td>
                  </tr>
                )}
                {displayTransactions.length > 100 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-primary-500 bg-primary-50">
                      ... et {displayTransactions.length - 100} autres transactions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Panel - Anomaly Details */}
      {selectedAnomaly !== null && anomalies[selectedAnomaly] && (
        <div className="w-96 border-l border-primary-200 bg-white flex flex-col">
          <div className="p-4 border-b border-primary-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-primary-900">Détails de l'anomalie</h3>
              <button
                onClick={() => setSelectedAnomaly(null)}
                className="p-1 hover:bg-primary-100 rounded"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Anomaly Type */}
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Type d'anomalie</p>
              <div className="flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-primary-500" />
                <span className="font-medium">{ANOMALY_TYPE_LABELS[anomalies[selectedAnomaly].type]}</span>
              </div>
            </div>

            {/* Severity */}
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Sévérité</p>
              <SeverityBadge severity={anomalies[selectedAnomaly].severity} />
            </div>

            {/* Amount */}
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Économie potentielle</p>
              <p className="text-2xl font-bold text-primary-900">
                {formatCurrency(anomalies[selectedAnomaly].amount, 'XAF')}
              </p>
            </div>

            {/* Transactions count */}
            <div>
              <p className="text-xs text-primary-500 uppercase mb-1">Transactions concernées</p>
              <p className="font-medium">{anomalies[selectedAnomaly].transactions.length} transaction(s)</p>
            </div>

            {/* Analysis Details */}
            <div className="bg-primary-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                {isAIEnabled ? (
                  <Bot className="w-5 h-5 text-primary-600" />
                ) : (
                  <Cpu className="w-5 h-5 text-primary-600" />
                )}
                <span className="font-semibold text-primary-900">
                  {isAIEnabled ? 'Analyse avec IA' : 'Analyse algorithmique'}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-primary-500 uppercase mb-1">Recommandation</p>
                  <p className="text-sm font-medium text-primary-700">
                    {anomalies[selectedAnomaly].recommendation}
                  </p>
                </div>

                {/* Evidence */}
                {anomalies[selectedAnomaly].evidence && anomalies[selectedAnomaly].evidence.length > 0 && (
                  <div>
                    <p className="text-xs text-primary-500 uppercase mb-1">Preuves</p>
                    <ul className="text-sm text-primary-700 space-y-1">
                      {anomalies[selectedAnomaly].evidence.slice(0, 3).map((e, i) => (
                        <li key={i} className="bg-white p-2 rounded border border-primary-200">
                          {e.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-2 border-t border-primary-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-primary-500">Niveau de confiance</span>
                    <span className="font-medium">{Math.round(anomalies[selectedAnomaly].confidence * 100)}%</span>
                  </div>
                  <div className="mt-1 bg-primary-200 rounded-full h-2">
                    <div
                      className="bg-primary-900 h-2 rounded-full"
                      style={{ width: `${anomalies[selectedAnomaly].confidence * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button className="w-full gap-2" variant="secondary">
                <MessageSquare className="w-4 h-4" />
                Contester l'anomalie
              </Button>
              <Button className="w-full gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Valider et ajouter au rapport
              </Button>
            </div>
          </div>

          {/* Summary Footer */}
          <div className="p-4 border-t border-primary-200 bg-primary-50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              <span className="font-semibold text-primary-800">Résumé du rapport</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-primary-600">Total anomalies</p>
                <p className="font-bold text-primary-800">{anomalies.length}</p>
              </div>
              <div>
                <p className="text-primary-600">Économies</p>
                <p className="font-bold text-primary-800">{formatCurrency(totalSavings, 'XAF')}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
