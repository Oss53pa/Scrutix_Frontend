import { useMemo } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  Landmark,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import type {
  FullReport,
  ReportViewerConfig,
  ReportCoverConfig,
  ReportBackCoverConfig,
  ReportViewerPage,
  ReportTableData,
  ReportChartData,
  ReportStatistic,
} from '../../types';
import type { Anomaly, AnalysisResult, Client } from '../../types';
import { formatCurrency, formatDate } from '../../utils';
import { ANOMALY_TYPE_LABELS, SEVERITY_LABELS, Severity, AnomalyType } from '../../types';

interface ScrutixAuditReportProps {
  client: Client;
  analysis: AnalysisResult;
  auditorName?: string;
  auditorCompany?: string;
  auditorLogo?: string;
}

// Couleurs par sévérité
const SEVERITY_COLORS: Record<Severity, string> = {
  [Severity.LOW]: '#6b7280',
  [Severity.MEDIUM]: '#f59e0b',
  [Severity.HIGH]: '#ef4444',
  [Severity.CRITICAL]: '#7f1d1d',
};

// Génère un rapport complet pour le ReportViewer
export function generateScrutixAuditReport({
  client,
  analysis,
  auditorName = 'Expert-Comptable',
  auditorCompany = 'Cabinet d\'Expertise Comptable',
  auditorLogo,
}: ScrutixAuditReportProps): FullReport {
  const currency = client.currency || 'XAF';
  const now = new Date();

  // Configuration générale
  const config: ReportViewerConfig = {
    id: `audit-${analysis.id}`,
    title: `Rapport d'Audit Bancaire`,
    subtitle: `Analyse des frais et anomalies`,
    clientName: client.name,
    auditorName,
    period: {
      start: analysis.config.dateRange.start,
      end: analysis.config.dateRange.end,
    },
    createdAt: now,
    type: 'audit',
    status: 'draft',
    language: 'fr',
    currency: currency as 'XAF' | 'XOF' | 'EUR',
  };

  // Configuration page de garde
  const coverConfig: ReportCoverConfig = {
    primaryColor: '#1e3a5f',
    secondaryColor: '#0f2744',
    accentColor: '#3b82f6',
    logo: auditorLogo,
    title: 'Rapport d\'Audit Bancaire',
    subtitle: 'Analyse des frais et conditions bancaires',
    clientName: client.name,
    reference: `REF-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${analysis.id.slice(-6).toUpperCase()}`,
    confidentialityLevel: 'confidential',
    authorName: auditorName,
    authorTitle: 'Expert-Comptable',
    date: now,
    period: {
      start: analysis.config.dateRange.start,
      end: analysis.config.dateRange.end,
    },
    version: '1.0',
  };

  // Configuration couverture arrière
  const backCoverConfig: ReportBackCoverConfig = {
    companyName: auditorCompany,
    address: 'Votre adresse\nVille, Pays',
    showLogo: true,
    showQRCode: false,
    backgroundColor: '#1e3a5f',
    textColor: '#ffffff',
    legalMention: 'Document confidentiel - Usage strictement réservé au client',
    disclaimer: `Ce rapport a été établi sur la base des relevés bancaires fournis par le client.
Les anomalies identifiées sont soumises à vérification auprès des établissements bancaires concernés.
Scrutix et ${auditorCompany} déclinent toute responsabilité quant à l'exhaustivité des données analysées.`,
    copyright: `© ${now.getFullYear()} ${auditorCompany} - Propulsé par Scrutix`,
  };

  // Statistiques
  const statistics: ReportStatistic[] = [
    {
      id: 'total-transactions',
      label: 'Transactions analysées',
      value: analysis.statistics.totalTransactions,
    },
    {
      id: 'total-anomalies',
      label: 'Anomalies détectées',
      value: analysis.statistics.totalAnomalies,
      color: analysis.statistics.totalAnomalies > 0 ? '#ef4444' : '#22c55e',
    },
    {
      id: 'total-amount',
      label: 'Montant des anomalies',
      value: analysis.statistics.totalAnomalyAmount,
    },
    {
      id: 'potential-savings',
      label: 'Économies potentielles',
      value: analysis.statistics.potentialSavings,
      color: '#22c55e',
    },
  ];

  // Tableau récapitulatif par type d'anomalie
  const hasAnomalies = analysis.anomalies.length > 0;
  const anomaliesByTypeRows = Object.entries(analysis.statistics.anomaliesByType || {})
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => {
      const anomaliesOfType = analysis.anomalies.filter((a) => a.type === type);
      const amount = anomaliesOfType.reduce((sum, a) => sum + a.amount, 0);
      const totalAmount = analysis.statistics.totalAnomalyAmount || 1;
      const percentage = (amount / totalAmount) * 100;
      return [
        ANOMALY_TYPE_LABELS[type as AnomalyType] || type,
        count,
        amount,
        `${percentage.toFixed(1)}%`,
      ];
    })
    .sort((a, b) => (b[2] as number) - (a[2] as number));

  const anomaliesByTypeTable: ReportTableData = {
    id: 'anomalies-by-type',
    title: 'Répartition des anomalies par type',
    headers: ['Type d\'anomalie', 'Nombre', 'Montant total', '% du total'],
    rows: hasAnomalies ? anomaliesByTypeRows : [['Aucune anomalie détectée', '-', '-', '-']],
    totals: hasAnomalies ? [
      'TOTAL',
      analysis.statistics.totalAnomalies,
      analysis.statistics.totalAnomalyAmount,
      '100%',
    ] : undefined,
    striped: true,
    sortable: hasAnomalies,
  };

  // Tableau des anomalies détaillées
  const anomaliesDetailRows = analysis.anomalies
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 50) // Top 50
    .map((anomaly) => [
      formatDate(anomaly.detectedAt),
      ANOMALY_TYPE_LABELS[anomaly.type] || anomaly.type,
      SEVERITY_LABELS[anomaly.severity],
      anomaly.recommendation.slice(0, 60) + (anomaly.recommendation.length > 60 ? '...' : ''),
      anomaly.amount,
    ]);

  const anomaliesDetailTable: ReportTableData = {
    id: 'anomalies-detail',
    title: 'Détail des anomalies détectées',
    headers: ['Date', 'Type', 'Sévérité', 'Description', 'Montant'],
    rows: hasAnomalies ? anomaliesDetailRows : [['—', 'Aucune anomalie', '—', 'Aucune anomalie à afficher', '—']],
    totals: hasAnomalies ? [
      '',
      '',
      '',
      `${analysis.anomalies.length} anomalies`,
      analysis.statistics.totalAnomalyAmount,
    ] : undefined,
    striped: true,
    sortable: hasAnomalies,
  };

  // Graphique par type d'anomalie
  const chartByTypeData = Object.entries(analysis.statistics.anomaliesByType || {})
    .filter(([_, count]) => count > 0)
    .map(([type, _]) => {
      const anomaliesOfType = analysis.anomalies.filter((a) => a.type === type);
      const amount = anomaliesOfType.reduce((sum, a) => sum + a.amount, 0);
      return {
        label: ANOMALY_TYPE_LABELS[type as AnomalyType] || type,
        value: amount,
      };
    })
    .sort((a, b) => b.value - a.value);

  const anomaliesByTypeChart: ReportChartData = {
    id: 'chart-by-type',
    type: 'bar',
    title: 'Montants par type d\'anomalie',
    subtitle: hasAnomalies
      ? `Total: ${formatCurrency(analysis.statistics.totalAnomalyAmount, currency)}`
      : 'Aucune donnée disponible',
    data: hasAnomalies ? chartByTypeData : [{ label: 'Aucune donnée', value: 0 }],
    showLegend: false,
    showValues: hasAnomalies,
  };

  // Graphique par sévérité
  const chartBySeverityData = Object.entries(analysis.statistics.anomaliesBySeverity || {})
    .filter(([_, count]) => count > 0)
    .map(([severity, count]) => ({
      label: SEVERITY_LABELS[severity as Severity],
      value: count,
      color: SEVERITY_COLORS[severity as Severity],
    }));

  const anomaliesBySeverityChart: ReportChartData = {
    id: 'chart-by-severity',
    type: 'donut',
    title: 'Répartition par sévérité',
    data: hasAnomalies ? chartBySeverityData : [{ label: 'Aucune donnée', value: 1, color: '#e5e5e5' }],
    showLegend: true,
    showValues: hasAnomalies,
  };

  // Pages du rapport
  const summaryContent = hasAnomalies
    ? `Ce rapport présente les résultats de l'audit des frais bancaires pour ${client.name} sur la période du ${formatDate(analysis.config.dateRange.start)} au ${formatDate(analysis.config.dateRange.end)}.

L'analyse a porté sur ${analysis.statistics.totalTransactions.toLocaleString('fr-FR')} transactions et a permis d'identifier ${analysis.statistics.totalAnomalies} anomalies potentielles représentant un montant total de ${formatCurrency(analysis.statistics.totalAnomalyAmount, currency)}.

${analysis.summary.status === 'CRITICAL'
  ? '⚠️ ATTENTION: Des anomalies critiques ont été identifiées et nécessitent une action immédiate.'
  : analysis.summary.status === 'WARNING'
  ? '⚠️ Plusieurs anomalies significatives ont été détectées et méritent une attention particulière.'
  : '✓ La situation globale est satisfaisante avec quelques points d\'amélioration possibles.'}`
    : `**Ceci est un modèle de rapport de démonstration.**

Ce rapport illustre la structure et la présentation des rapports d'audit bancaire générés par Scrutix pour ${client.name}.

Pour obtenir un rapport avec des données réelles:
1. Importez vos relevés bancaires
2. Configurez les conditions tarifaires de vos banques
3. Lancez une analyse des transactions
4. Générez votre rapport personnalisé

Scrutix vous aidera à identifier les anomalies et optimiser vos frais bancaires.`;

  const pages: ReportViewerPage[] = [
    // Page 1: Sommaire exécutif
    {
      id: 'page-summary',
      pageNumber: 1,
      type: 'content',
      sections: [
        {
          id: 'section-title',
          type: 'content',
          title: 'Sommaire Exécutif',
          content: summaryContent,
          visible: true,
        },
        {
          id: 'section-stats',
          type: 'summary',
          title: 'Indicateurs clés',
          visible: true,
        },
      ],
      header: { show: true, title: 'Rapport d\'Audit Bancaire - Scrutix' },
      footer: { show: true, showPageNumber: true, text: client.name },
    },
    // Page 2: Analyse par type
    {
      id: 'page-by-type',
      pageNumber: 2,
      type: 'content',
      sections: [
        {
          id: 'section-type-table',
          type: 'table',
          title: 'Analyse par type d\'anomalie',
          content: { tableId: 'anomalies-by-type' },
          visible: true,
        },
        {
          id: 'section-type-chart',
          type: 'chart',
          title: '',
          content: { chartId: 'chart-by-type' },
          visible: true,
        },
      ],
      header: { show: true, title: 'Rapport d\'Audit Bancaire - Scrutix' },
      footer: { show: true, showPageNumber: true, text: client.name },
    },
    // Page 3: Analyse par sévérité
    {
      id: 'page-by-severity',
      pageNumber: 3,
      type: 'content',
      sections: [
        {
          id: 'section-severity-chart',
          type: 'chart',
          title: 'Analyse par niveau de sévérité',
          content: { chartId: 'chart-by-severity' },
          visible: true,
        },
        {
          id: 'section-recommendations',
          type: 'content',
          title: 'Recommandations',
          content: {
            type: 'list',
            items: analysis.summary.recommendations,
          },
          visible: true,
        },
      ],
      header: { show: true, title: 'Rapport d\'Audit Bancaire - Scrutix' },
      footer: { show: true, showPageNumber: true, text: client.name },
    },
    // Page 4: Détail des anomalies
    {
      id: 'page-detail',
      pageNumber: 4,
      type: 'table',
      sections: [
        {
          id: 'section-detail-table',
          type: 'table',
          title: 'Détail des anomalies (Top 50)',
          content: { tableId: 'anomalies-detail' },
          visible: true,
        },
      ],
      header: { show: true, title: 'Rapport d\'Audit Bancaire - Scrutix' },
      footer: { show: true, showPageNumber: true, text: client.name },
    },
    // Page 5: Conclusions
    {
      id: 'page-conclusion',
      pageNumber: 5,
      type: 'content',
      sections: [
        {
          id: 'section-conclusion',
          type: 'content',
          title: 'Conclusions et prochaines étapes',
          content: hasAnomalies
            ? `${analysis.summary.message}

**Économies potentielles identifiées:** ${formatCurrency(analysis.statistics.potentialSavings, currency)}

**Prochaines étapes recommandées:**
1. Transmettre ce rapport aux établissements bancaires concernés
2. Négocier le remboursement des frais injustifiés
3. Revoir les conditions tarifaires avec les banques
4. Mettre en place un suivi régulier des frais bancaires

Pour toute question concernant ce rapport, n'hésitez pas à contacter votre expert-comptable.`
            : `**Ce rapport est un modèle de démonstration.**

Ce document illustre le format et la présentation des rapports d'audit bancaire Scrutix.

**Pour générer un vrai rapport:**
1. Rendez-vous sur la page d'import pour charger vos relevés bancaires
2. Configurez les conditions tarifaires dans la section Banques
3. Lancez une analyse depuis la page Analyses
4. Revenez ici pour générer votre rapport personnalisé

Scrutix analyse automatiquement vos transactions et identifie les anomalies de facturation bancaire.`,
          visible: true,
        },
        {
          id: 'section-signature',
          type: 'content',
          title: '',
          content: `
---

Fait à _____________, le ${formatDate(now)}

Signature: _________________________

${auditorName}
${auditorCompany}
          `,
          visible: true,
        },
      ],
      header: { show: true, title: 'Rapport d\'Audit Bancaire - Scrutix' },
      footer: { show: true, showPageNumber: true, text: client.name },
    },
  ];

  return {
    config,
    coverConfig,
    backCoverConfig,
    pages,
    comments: [],
    statistics,
    tables: [anomaliesByTypeTable, anomaliesDetailTable],
    charts: [anomaliesByTypeChart, anomaliesBySeverityChart],
  };
}

// Hook pour générer le rapport
export function useScrutixAuditReport(props: ScrutixAuditReportProps): FullReport {
  return useMemo(() => generateScrutixAuditReport(props), [
    props.client,
    props.analysis,
    props.auditorName,
    props.auditorCompany,
    props.auditorLogo,
  ]);
}
