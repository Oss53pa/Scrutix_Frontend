import { useState, useEffect } from 'react';
import {
  X, AlertTriangle, TrendingUp, FileText, MessageSquare,
  CheckCircle, XCircle, Clock, Target, Lightbulb, Scale,
  Brain, Loader2, ChevronRight, Copy, Flag,
  History, Zap, Shield, DollarSign, Plus, Check
} from 'lucide-react';
import { Anomaly, Severity, BankConditions, ANOMALY_TYPE_LABELS, SEVERITY_LABELS } from '../../types';
import { Button, SeverityBadge, AnomalyTypeBadge } from '../ui';
import { formatCurrency, formatDate } from '../../utils';
import { useSettingsStore, useReportStore } from '../../store';
import { ClaudeService } from '../../services/ClaudeService';

interface AnomalyDetailPanelProps {
  anomaly: Anomaly;
  bankConditions?: BankConditions;
  onClose: () => void;
  onStatusChange?: (status: Anomaly['status']) => void;
}

interface AIInsight {
  explanation: string;
  impact: string;
  rootCause: string;
  similarPatterns: string[];
  actionPlan: { priority: number; action: string; deadline: string }[];
  legalContext: string;
  recoveryStrategy: string;
  riskAssessment: { level: string; factors: string[] };
}

export function AnomalyDetailPanel({
  anomaly,
  bankConditions,
  onClose,
  onStatusChange,
}: AnomalyDetailPanelProps) {
  const { claudeApi } = useSettingsStore();
  const {
    addAnomalyToDraft,
    confirmAnomaly,
    dismissAnomaly,
    contestAnomaly,
    isAnomalyInDraft,
    getAnomalyStatus,
  } = useReportStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'ai' | 'transactions' | 'actions'>('overview');
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const inDraft = isAnomalyInDraft(anomaly.id);
  const currentStatus = getAnomalyStatus(anomaly.id);

  const showFeedback = (message: string) => {
    setActionFeedback(message);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const handleAddToReport = () => {
    addAnomalyToDraft(anomaly);
    showFeedback('Anomalie ajoutée au rapport');
  };

  const handleConfirm = () => {
    if (!inDraft) addAnomalyToDraft(anomaly);
    confirmAnomaly(anomaly);
    onStatusChange?.('confirmed');
    showFeedback('Anomalie confirmée et ajoutée au rapport');
  };

  const handleDismiss = () => {
    dismissAnomaly(anomaly);
    onStatusChange?.('dismissed');
    showFeedback('Anomalie écartée');
  };

  const handleContest = () => {
    if (!inDraft) addAnomalyToDraft(anomaly);
    contestAnomaly(anomaly);
    onStatusChange?.('contested');
    showFeedback('Anomalie marquée comme contestée');
  };

  const handleCopyDetails = () => {
    const details = `
Anomalie: ${ANOMALY_TYPE_LABELS[anomaly.type]}
Sévérité: ${SEVERITY_LABELS[anomaly.severity]}
Montant: ${formatCurrency(anomaly.amount, 'XAF')}
Confiance: ${(anomaly.confidence * 100).toFixed(0)}%

Description: ${anomaly.recommendation}

Transactions concernées:
${anomaly.transactions.map(t => `- ${formatDate(t.date)}: ${t.description} = ${formatCurrency(t.amount, 'XAF')}`).join('\n')}
    `.trim();
    navigator.clipboard.writeText(details);
    showFeedback('Détails copiés dans le presse-papier');
  };

  // Severity colors and icons
  const severityConfig = {
    [Severity.CRITICAL]: { color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50', icon: AlertTriangle },
    [Severity.HIGH]: { color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50', icon: AlertTriangle },
    [Severity.MEDIUM]: { color: 'bg-yellow-500', textColor: 'text-yellow-700', bgLight: 'bg-yellow-50', icon: Flag },
    [Severity.LOW]: { color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50', icon: Flag },
  };

  const config = severityConfig[anomaly.severity];
  const SeverityIcon = config.icon;

  // Fetch AI insight
  const fetchAIInsight = async () => {
    if (!claudeApi.isEnabled || !claudeApi.apiKey) return;

    setLoadingAI(true);
    setAiError(null);

    try {
      const service = new ClaudeService({
        apiKey: claudeApi.apiKey,
        model: claudeApi.model,
      });

      const prompt = `Tu es un expert-comptable spécialisé dans l'audit bancaire africain (CEMAC/UEMOA).

Analyse cette anomalie bancaire en détail:

TYPE: ${ANOMALY_TYPE_LABELS[anomaly.type]}
SÉVÉRITÉ: ${SEVERITY_LABELS[anomaly.severity]}
MONTANT: ${anomaly.amount.toLocaleString('fr-FR')} FCFA
CONFIANCE: ${(anomaly.confidence * 100).toFixed(0)}%

TRANSACTIONS CONCERNÉES:
${anomaly.transactions.map(t => `- ${formatDate(t.date)}: ${t.description} = ${t.amount.toLocaleString('fr-FR')} FCFA`).join('\n')}

PREUVES:
${anomaly.evidence.map(e => `- ${e.description}: ${e.value}`).join('\n')}

${bankConditions ? `CONDITIONS BANCAIRES (${bankConditions.bankName}):
Frais: ${bankConditions.fees.map(f => `${f.name}: ${f.amount} FCFA`).join(', ')}` : ''}

Fournis une analyse experte avec:
1. Explication claire du problème pour un non-spécialiste
2. Impact financier réel et potentiel
3. Cause racine probable
4. Patterns similaires à surveiller
5. Plan d'action priorité (avec délais)
6. Contexte légal/réglementaire CEMAC/COBAC
7. Stratégie de récupération des fonds
8. Évaluation du risque

Réponds en JSON:
{
  "explanation": "Explication claire en 2-3 phrases",
  "impact": "Impact financier détaillé",
  "rootCause": "Cause racine identifiée",
  "similarPatterns": ["Pattern 1 à surveiller", "Pattern 2"],
  "actionPlan": [
    {"priority": 1, "action": "Action immédiate", "deadline": "24h"},
    {"priority": 2, "action": "Action suivante", "deadline": "1 semaine"}
  ],
  "legalContext": "Contexte réglementaire applicable",
  "recoveryStrategy": "Stratégie de récupération",
  "riskAssessment": {
    "level": "ÉLEVÉ/MOYEN/FAIBLE",
    "factors": ["Facteur de risque 1", "Facteur 2"]
  }
}`;

      const response = await service.analyzeAnomalies([anomaly], bankConditions);

      // Also get detailed insight
      const messages = [{ role: 'user' as const, content: prompt }];
      const detailResponse = await (service as any).callClaude(messages, 2000);

      try {
        const jsonMatch = detailResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const insight = JSON.parse(jsonMatch[0]) as AIInsight;
          setAiInsight(insight);
        }
      } catch {
        // Fallback to basic insight
        setAiInsight({
          explanation: response.analysis?.summary || 'Analyse en cours...',
          impact: `Impact potentiel de ${formatCurrency(anomaly.amount, 'XAF')}`,
          rootCause: 'Analyse approfondie requise',
          similarPatterns: [],
          actionPlan: [
            { priority: 1, action: 'Vérifier les détails de la transaction', deadline: '24h' },
            { priority: 2, action: 'Contacter la banque si confirmé', deadline: '1 semaine' },
          ],
          legalContext: 'Règlement COBAC applicable',
          recoveryStrategy: 'Réclamation formelle auprès de la banque',
          riskAssessment: { level: 'MOYEN', factors: ['Montant significatif'] },
        });
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Erreur IA');
    } finally {
      setLoadingAI(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai' && !aiInsight && !loadingAI) {
      fetchAIInsight();
    }
  }, [activeTab]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className={`${config.bgLight} p-6 border-b`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 ${config.color} rounded-lg`}>
                <SeverityIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <AnomalyTypeBadge type={anomaly.type} />
                  <SeverityBadge severity={anomaly.severity} />
                </div>
                <h2 className="text-lg font-semibold text-primary-900">
                  {ANOMALY_TYPE_LABELS[anomaly.type]}
                </h2>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg transition">
              <X className="w-5 h-5 text-primary-500" />
            </button>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/60 rounded-lg p-3">
              <p className="text-xs text-primary-500 mb-1">Montant</p>
              <p className="text-xl font-bold text-primary-900">
                {formatCurrency(anomaly.amount, 'XAF')}
              </p>
            </div>
            <div className="bg-white/60 rounded-lg p-3">
              <p className="text-xs text-primary-500 mb-1">Confiance IA</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-primary-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${anomaly.confidence >= 0.8 ? 'bg-green-500' : anomaly.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${anomaly.confidence * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{(anomaly.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="bg-white/60 rounded-lg p-3">
              <p className="text-xs text-primary-500 mb-1">Transactions</p>
              <p className="text-xl font-bold text-primary-900">
                {anomaly.transactions.length}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-primary-50">
          {[
            { id: 'overview', label: 'Aperçu', icon: FileText },
            { id: 'ai', label: 'Analyse IA', icon: Brain },
            { id: 'transactions', label: 'Transactions', icon: History },
            { id: 'actions', label: 'Actions', icon: Zap },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-white text-primary-900 border-b-2 border-primary-600'
                  : 'text-primary-500 hover:text-primary-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Recommendation */}
              <div className={`${config.bgLight} rounded-lg p-4`}>
                <div className="flex items-start gap-3">
                  <Lightbulb className={`w-5 h-5 ${config.textColor} mt-0.5`} />
                  <div>
                    <h4 className="font-medium text-primary-900 mb-1">Recommandation</h4>
                    <p className="text-primary-700">{anomaly.recommendation}</p>
                  </div>
                </div>
              </div>

              {/* Evidence */}
              <div>
                <h4 className="flex items-center gap-2 text-sm font-medium text-primary-700 mb-3">
                  <Scale className="w-4 h-4" />
                  Preuves détectées
                </h4>
                <div className="space-y-2">
                  {anomaly.evidence.map((ev, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-primary-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-200 rounded-full flex items-center justify-center">
                          <Target className="w-4 h-4 text-primary-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-primary-900">{ev.description}</p>
                          <p className="text-xs text-primary-500">{ev.type}</p>
                        </div>
                      </div>
                      <span className="font-mono text-sm font-medium text-primary-900 bg-white px-3 py-1 rounded">
                        {String(ev.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border border-primary-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-primary-500" />
                    <span className="text-xs text-primary-500">Détecté le</span>
                  </div>
                  <p className="font-medium text-primary-900">{formatDate(anomaly.detectedAt)}</p>
                </div>
                <div className="p-4 border border-primary-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-primary-500" />
                    <span className="text-xs text-primary-500">Statut</span>
                  </div>
                  <p className="font-medium text-primary-900">
                    {anomaly.status === 'pending' ? 'En attente' :
                     anomaly.status === 'confirmed' ? 'Confirmé' :
                     anomaly.status === 'dismissed' ? 'Écarté' : 'Contesté'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI Analysis Tab */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              {!claudeApi.isEnabled ? (
                <div className="text-center py-8">
                  <Brain className="w-12 h-12 text-primary-300 mx-auto mb-3" />
                  <p className="text-primary-600 mb-2">Analyse IA non activée</p>
                  <p className="text-sm text-primary-400">
                    Activez Claude dans les paramètres pour obtenir une analyse approfondie
                  </p>
                </div>
              ) : loadingAI ? (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 text-purple-500 mx-auto mb-3 animate-spin" />
                  <p className="text-primary-600">Analyse IA en cours...</p>
                </div>
              ) : aiError ? (
                <div className="text-center py-8">
                  <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                  <p className="text-red-600 mb-2">Erreur d'analyse</p>
                  <p className="text-sm text-primary-400">{aiError}</p>
                  <Button variant="secondary" className="mt-4" onClick={fetchAIInsight}>
                    Réessayer
                  </Button>
                </div>
              ) : aiInsight ? (
                <>
                  {/* AI Explanation */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
                    <div className="flex items-start gap-3">
                      <Brain className="w-5 h-5 text-purple-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-primary-900 mb-2">Explication IA</h4>
                        <p className="text-primary-700">{aiInsight.explanation}</p>
                      </div>
                    </div>
                  </div>

                  {/* Impact & Root Cause */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border border-primary-200 rounded-lg">
                      <h4 className="flex items-center gap-2 text-sm font-medium text-primary-700 mb-2">
                        <DollarSign className="w-4 h-4" />
                        Impact financier
                      </h4>
                      <p className="text-sm text-primary-600">{aiInsight.impact}</p>
                    </div>
                    <div className="p-4 border border-primary-200 rounded-lg">
                      <h4 className="flex items-center gap-2 text-sm font-medium text-primary-700 mb-2">
                        <Target className="w-4 h-4" />
                        Cause racine
                      </h4>
                      <p className="text-sm text-primary-600">{aiInsight.rootCause}</p>
                    </div>
                  </div>

                  {/* Risk Assessment */}
                  <div className={`p-4 rounded-lg ${
                    aiInsight.riskAssessment.level === 'ÉLEVÉ' ? 'bg-red-50 border border-red-200' :
                    aiInsight.riskAssessment.level === 'MOYEN' ? 'bg-yellow-50 border border-yellow-200' :
                    'bg-green-50 border border-green-200'
                  }`}>
                    <h4 className="flex items-center gap-2 text-sm font-medium text-primary-700 mb-2">
                      <Shield className="w-4 h-4" />
                      Évaluation du risque: <span className="font-bold">{aiInsight.riskAssessment.level}</span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {aiInsight.riskAssessment.factors.map((factor, i) => (
                        <span key={i} className="text-xs px-2 py-1 bg-white rounded-full">
                          {factor}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action Plan */}
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-medium text-primary-700 mb-3">
                      <Zap className="w-4 h-4" />
                      Plan d'action prioritaire
                    </h4>
                    <div className="space-y-2">
                      {aiInsight.actionPlan.map((action, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                            action.priority === 1 ? 'bg-red-500' : action.priority === 2 ? 'bg-orange-500' : 'bg-blue-500'
                          }`}>
                            {action.priority}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-primary-900">{action.action}</p>
                          </div>
                          <span className="text-xs text-primary-500 bg-white px-2 py-1 rounded">
                            {action.deadline}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Legal Context */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="flex items-center gap-2 text-sm font-medium text-blue-800 mb-2">
                      <Scale className="w-4 h-4" />
                      Contexte réglementaire
                    </h4>
                    <p className="text-sm text-blue-700">{aiInsight.legalContext}</p>
                  </div>

                  {/* Recovery Strategy */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="flex items-center gap-2 text-sm font-medium text-green-800 mb-2">
                      <TrendingUp className="w-4 h-4" />
                      Stratégie de récupération
                    </h4>
                    <p className="text-sm text-green-700">{aiInsight.recoveryStrategy}</p>
                  </div>

                  {/* Similar Patterns */}
                  {aiInsight.similarPatterns.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-medium text-primary-700 mb-3">
                        <History className="w-4 h-4" />
                        Patterns similaires à surveiller
                      </h4>
                      <div className="space-y-2">
                        {aiInsight.similarPatterns.map((pattern, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-primary-600">
                            <ChevronRight className="w-4 h-4 text-primary-400" />
                            {pattern}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <Button variant="primary" onClick={fetchAIInsight}>
                    <Brain className="w-4 h-4" />
                    Lancer l'analyse IA
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <p className="text-sm text-primary-500">
                {anomaly.transactions.length} transaction(s) impliquée(s) dans cette anomalie
              </p>
              {anomaly.transactions.map((tx, i) => (
                <div key={tx.id} className="p-4 border border-primary-200 rounded-lg hover:bg-primary-50 transition">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-primary-400">#{i + 1}</span>
                      <span className="text-sm font-medium text-primary-900">{formatDate(tx.date)}</span>
                    </div>
                    <span className={`font-bold ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(tx.amount, 'XAF')}
                    </span>
                  </div>
                  <p className="text-sm text-primary-700 mb-2">{tx.description}</p>
                  <div className="flex items-center gap-4 text-xs text-primary-400">
                    <span>Réf: {tx.reference || 'N/A'}</span>
                    <span>Compte: {tx.accountNumber}</span>
                    <span>Solde: {formatCurrency(tx.balance, 'XAF')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions Tab */}
          {activeTab === 'actions' && (
            <div className="space-y-4">
              {/* Feedback message */}
              {actionFeedback && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {actionFeedback}
                </div>
              )}

              {/* Current status */}
              {currentStatus && (
                <div className={`p-3 rounded-lg ${
                  currentStatus === 'confirmed' ? 'bg-green-50 border border-green-200' :
                  currentStatus === 'dismissed' ? 'bg-gray-50 border border-gray-200' :
                  currentStatus === 'contested' ? 'bg-orange-50 border border-orange-200' :
                  'bg-blue-50 border border-blue-200'
                }`}>
                  <p className="text-sm font-medium">
                    Statut actuel: {
                      currentStatus === 'confirmed' ? '✓ Confirmée' :
                      currentStatus === 'dismissed' ? '✗ Écartée' :
                      currentStatus === 'contested' ? '⚠ Contestée' :
                      '○ Sélectionnée'
                    }
                  </p>
                </div>
              )}

              {/* Add to report */}
              <Button
                variant={inDraft ? 'secondary' : 'primary'}
                className="w-full justify-center"
                onClick={handleAddToReport}
                disabled={inDraft}
              >
                {inDraft ? (
                  <>
                    <Check className="w-4 h-4" />
                    Ajoutée au rapport
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Ajouter au rapport
                  </>
                )}
              </Button>

              {/* Status actions */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={currentStatus === 'confirmed' ? 'primary' : 'secondary'}
                  className="w-full justify-center"
                  onClick={handleConfirm}
                >
                  <CheckCircle className="w-4 h-4" />
                  Valider
                </Button>
                <Button
                  variant={currentStatus === 'dismissed' ? 'primary' : 'secondary'}
                  className="w-full justify-center"
                  onClick={handleDismiss}
                >
                  <XCircle className="w-4 h-4" />
                  Écarter
                </Button>
              </div>

              <Button
                variant={currentStatus === 'contested' ? 'primary' : 'secondary'}
                className="w-full justify-center"
                onClick={handleContest}
              >
                <MessageSquare className="w-4 h-4" />
                Contester auprès de la banque
              </Button>

              <hr className="my-4" />

              {/* Utility actions */}
              <div className="space-y-2">
                <Button variant="secondary" size="sm" className="w-full justify-start" onClick={handleCopyDetails}>
                  <Copy className="w-4 h-4" />
                  Copier les détails
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => window.location.href = '/reports'}
                >
                  <FileText className="w-4 h-4" />
                  Aller aux rapports
                </Button>
              </div>

              {anomaly.notes && (
                <div className="mt-4 p-3 bg-primary-50 rounded-lg">
                  <h4 className="text-sm font-medium text-primary-700 mb-1">Notes</h4>
                  <p className="text-sm text-primary-600">{anomaly.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-primary-50 flex items-center justify-between">
          <span className="text-xs text-primary-400">
            ID: {anomaly.id}
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
