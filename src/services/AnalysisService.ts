import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  BankConditions,
  DailyBalance,
  AnalysisConfig,
  AnalysisResult,
  AnalysisStatus,
  AnalysisStatistics,
  AnalysisSummary,
  DetectionThresholds,
  AIAuditResponse,
} from '../types';
// Modules existants
import { DuplicateDetector } from '../algorithms/DuplicateDetector';
import { GhostFeeDetector } from '../algorithms/GhostFeeDetector';
import { OverchargeAnalyzer } from '../algorithms/OverchargeAnalyzer';
import { InterestCalculator } from '../algorithms/InterestCalculator';
// Nouveaux modules d'audit
import { ValueDateAudit } from '../algorithms/ValueDateAudit';
import { SuspiciousAudit } from '../algorithms/SuspiciousAudit';
import { ComplianceAudit } from '../algorithms/ComplianceAudit';
import { CashflowAudit } from '../algorithms/CashflowAudit';
import { ReconciliationAudit } from '../algorithms/ReconciliationAudit';
import { MultiBankAudit } from '../algorithms/MultiBankAudit';
import { OhadaAudit } from '../algorithms/OhadaAudit';
import { AmlAudit } from '../algorithms/AmlAudit';
// Modules d'audit par catégorie de frais
import { AccountFeesAudit } from '../algorithms/AccountFeesAudit';
import { CardFeesAudit } from '../algorithms/CardFeesAudit';
import { PaymentMethodsAudit } from '../algorithms/PaymentMethodsAudit';
import { InternationalAudit } from '../algorithms/InternationalAudit';
import { AncillaryServicesAudit } from '../algorithms/AncillaryServicesAudit';
import { PackagesAudit } from '../algorithms/PackagesAudit';
import { ClaudeService } from './ClaudeService';

interface AnalysisOptions {
  accountBalances?: DailyBalance[];
  historicalData?: Record<string, Array<{ date: Date; amount: number }>>;
  onProgress?: (progress: number, step: string) => void;
  claudeService?: ClaudeService;
  enableAICategorization?: boolean;
  enableAIFraudDetection?: boolean;
}

interface ExtendedAnalysisResult extends AnalysisResult {
  aiAnalysis?: AIAuditResponse;
  categorizedTransactions?: number;
  fraudPatternsDetected?: number;
}

export class AnalysisService {
  // Modules existants
  private duplicateDetector: DuplicateDetector;
  private ghostFeeDetector: GhostFeeDetector;
  private overchargeAnalyzer: OverchargeAnalyzer;
  private interestCalculator: InterestCalculator;
  // Nouveaux modules
  private valueDateAudit: ValueDateAudit;
  private suspiciousAudit: SuspiciousAudit;
  private cashflowAudit: CashflowAudit;
  private reconciliationAudit: ReconciliationAudit;
  private ohadaAudit: OhadaAudit;
  private amlAudit: AmlAudit;
  // Modules d'audit par catégorie de frais
  private accountFeesAudit: AccountFeesAudit;
  private cardFeesAudit: CardFeesAudit;
  private paymentMethodsAudit: PaymentMethodsAudit;
  private internationalAudit: InternationalAudit;
  private ancillaryServicesAudit: AncillaryServicesAudit;
  private packagesAudit: PackagesAudit;

  constructor(thresholds?: DetectionThresholds) {
    // Modules existants
    this.duplicateDetector = new DuplicateDetector(thresholds?.duplicateDetection);
    this.ghostFeeDetector = new GhostFeeDetector(thresholds?.ghostFeeDetection);
    this.overchargeAnalyzer = new OverchargeAnalyzer(thresholds?.overchargeDetection);
    this.interestCalculator = new InterestCalculator(thresholds?.interestCalculation);
    // Nouveaux modules (pas de thresholds custom pour l'instant)
    this.valueDateAudit = new ValueDateAudit();
    this.suspiciousAudit = new SuspiciousAudit();
    this.cashflowAudit = new CashflowAudit();
    this.reconciliationAudit = new ReconciliationAudit();
    this.ohadaAudit = new OhadaAudit();
    this.amlAudit = new AmlAudit();
    // Modules d'audit par catégorie de frais
    this.accountFeesAudit = new AccountFeesAudit();
    this.cardFeesAudit = new CardFeesAudit();
    this.paymentMethodsAudit = new PaymentMethodsAudit();
    this.internationalAudit = new InternationalAudit();
    this.ancillaryServicesAudit = new AncillaryServicesAudit();
    this.packagesAudit = new PackagesAudit();
  }

  /**
   * Run complete analysis on transactions
   */
  async analyzeTransactions(
    transactions: Transaction[],
    bankConditions: BankConditions,
    config: AnalysisConfig,
    options?: AnalysisOptions
  ): Promise<ExtendedAnalysisResult> {
    const startedAt = new Date();
    const progress = options?.onProgress || (() => {});

    try {
      progress(5, 'Initialisation de l\'analyse...');

      // Filter transactions by date range if specified
      const filteredTransactions = this.filterTransactions(transactions, config);

      progress(10, `Analyse de ${filteredTransactions.length} transactions...`);

      // Run enabled detectors
      const allAnomalies: Anomaly[] = [];
      let currentProgress = 10;
      const progressPerDetector = 20;

      // Duplicate detection
      if (config.enabledDetectors.includes(AnomalyType.DUPLICATE_FEE)) {
        progress(currentProgress, 'Détection des doublons...');
        const duplicates = await this.runDetector(() =>
          this.duplicateDetector.detectDuplicates(filteredTransactions, bankConditions)
        );
        allAnomalies.push(...duplicates);
        currentProgress += progressPerDetector;
      }

      // Ghost fee detection
      if (config.enabledDetectors.includes(AnomalyType.GHOST_FEE)) {
        progress(currentProgress, 'Détection des frais fantômes...');
        const ghostFees = await this.runDetector(() =>
          this.ghostFeeDetector.detectGhostFees(filteredTransactions, bankConditions)
        );
        allAnomalies.push(...ghostFees);
        currentProgress += progressPerDetector;
      }

      // Overcharge detection
      if (config.enabledDetectors.includes(AnomalyType.OVERCHARGE)) {
        progress(currentProgress, 'Analyse des surfacturations...');
        const overcharges = await this.runDetector(() =>
          this.overchargeAnalyzer.detectOvercharges(
            filteredTransactions,
            bankConditions,
            options?.historicalData
          )
        );
        allAnomalies.push(...overcharges);
        currentProgress += progressPerDetector;
      }

      // Interest error detection
      if (
        config.enabledDetectors.includes(AnomalyType.INTEREST_ERROR) &&
        options?.accountBalances
      ) {
        progress(currentProgress, 'Vérification des calculs d\'intérêts...');
        const interestErrors = await this.runDetector(() =>
          this.interestCalculator.verifyInterestCharges(
            filteredTransactions,
            bankConditions,
            options.accountBalances!
          )
        );
        allAnomalies.push(...interestErrors);
        currentProgress += progressPerDetector / 2;
      }

      // === NOUVEAUX MODULES D'AUDIT ===

      // Value Date Audit - Dates de valeur
      if (config.enabledDetectors.includes(AnomalyType.VALUE_DATE_ERROR)) {
        progress(currentProgress, 'Contrôle des dates de valeur...');
        const valueDateAudit = new ValueDateAudit({}, bankConditions);
        const valueDateAnomalies = await this.runDetector(() =>
          valueDateAudit.analyze(filteredTransactions)
        );
        allAnomalies.push(...valueDateAnomalies);
        currentProgress += 5;
      }

      // Suspicious Audit - Opérations suspectes
      if (config.enabledDetectors.includes(AnomalyType.SUSPICIOUS_TRANSACTION)) {
        progress(currentProgress, 'Détection des opérations suspectes...');
        const suspiciousAnomalies = await this.runDetector(() =>
          this.suspiciousAudit.analyze(filteredTransactions)
        );
        allAnomalies.push(...suspiciousAnomalies);
        currentProgress += 5;
      }

      // Compliance Audit - Conformité contractuelle
      if (config.enabledDetectors.includes(AnomalyType.COMPLIANCE_VIOLATION)) {
        progress(currentProgress, 'Audit de conformité contractuelle...');
        const complianceAudit = new ComplianceAudit(bankConditions);
        const complianceAnomalies = await this.runDetector(() =>
          complianceAudit.analyze(filteredTransactions)
        );
        allAnomalies.push(...complianceAnomalies);
        currentProgress += 5;
      }

      // Cashflow Audit - Analyse trésorerie
      if (config.enabledDetectors.includes(AnomalyType.CASHFLOW_ANOMALY)) {
        progress(currentProgress, 'Analyse de trésorerie...');
        const cashflowAnomalies = await this.runDetector(() =>
          this.cashflowAudit.analyze(filteredTransactions)
        );
        allAnomalies.push(...cashflowAnomalies);
        currentProgress += 5;
      }

      // Reconciliation Audit - Rapprochement
      if (config.enabledDetectors.includes(AnomalyType.RECONCILIATION_GAP)) {
        progress(currentProgress, 'Analyse de rapprochement...');
        const reconciliationAnomalies = await this.runDetector(() =>
          this.reconciliationAudit.analyze(filteredTransactions)
        );
        allAnomalies.push(...reconciliationAnomalies);
        currentProgress += 5;
      }

      // Multi-Bank Audit - Multi-banques
      if (config.enabledDetectors.includes(AnomalyType.MULTI_BANK_ISSUE)) {
        progress(currentProgress, 'Analyse multi-banques...');
        const multiBankAudit = new MultiBankAudit([bankConditions]);
        const multiBankAnomalies = await this.runDetector(() =>
          multiBankAudit.analyze(filteredTransactions)
        );
        allAnomalies.push(...multiBankAnomalies);
        currentProgress += 5;
      }

      // OHADA Audit - Conformité OHADA
      if (config.enabledDetectors.includes(AnomalyType.OHADA_NON_COMPLIANCE)) {
        progress(currentProgress, 'Contrôle conformité OHADA...');
        const ohadaAnomalies = await this.runDetector(() =>
          this.ohadaAudit.analyze(filteredTransactions)
        );
        allAnomalies.push(...ohadaAnomalies);
        currentProgress += 5;
      }

      // AML Audit - Anti-blanchiment
      if (config.enabledDetectors.includes(AnomalyType.AML_ALERT)) {
        progress(currentProgress, 'Détection anti-blanchiment (LCB-FT)...');
        const amlAnomalies = await this.runDetector(() =>
          this.amlAudit.analyze(filteredTransactions)
        );
        allAnomalies.push(...amlAnomalies);
        currentProgress += 3;
      }

      // === MODULES D'AUDIT PAR CATÉGORIE DE FRAIS ===

      // Account Fees Audit - Frais de tenue de compte
      if (config.enabledDetectors.includes(AnomalyType.FEE_ANOMALY)) {
        progress(currentProgress, 'Audit des frais de tenue de compte...');
        const accountFeesAudit = new AccountFeesAudit({}, bankConditions);
        const accountFeesAnomalies = await this.runDetector(() =>
          accountFeesAudit.analyze(filteredTransactions)
        );
        allAnomalies.push(...accountFeesAnomalies);
        currentProgress += 3;
      }

      // Card Fees Audit - Frais de cartes bancaires
      if (config.enabledDetectors.includes(AnomalyType.FEE_ANOMALY)) {
        progress(currentProgress, 'Audit des frais de cartes bancaires...');
        const cardFeesAudit = new CardFeesAudit({}, bankConditions);
        const cardFeesAnomalies = await this.runDetector(() =>
          cardFeesAudit.analyze(filteredTransactions)
        );
        allAnomalies.push(...cardFeesAnomalies);
        currentProgress += 3;
      }

      // Payment Methods Audit - Moyens de paiement
      if (config.enabledDetectors.includes(AnomalyType.FEE_ANOMALY)) {
        progress(currentProgress, 'Audit des moyens de paiement...');
        const paymentMethodsAudit = new PaymentMethodsAudit({}, bankConditions);
        const paymentMethodsAnomalies = await this.runDetector(() =>
          paymentMethodsAudit.analyze(filteredTransactions)
        );
        allAnomalies.push(...paymentMethodsAnomalies);
        currentProgress += 3;
      }

      // International Audit - Opérations internationales
      if (config.enabledDetectors.includes(AnomalyType.FEE_ANOMALY)) {
        progress(currentProgress, 'Audit des opérations internationales...');
        const internationalAudit = new InternationalAudit({}, bankConditions);
        const internationalAnomalies = await this.runDetector(() =>
          internationalAudit.analyze(filteredTransactions)
        );
        allAnomalies.push(...internationalAnomalies);
        currentProgress += 3;
      }

      // Ancillary Services Audit - Services annexes
      if (config.enabledDetectors.includes(AnomalyType.FEE_ANOMALY)) {
        progress(currentProgress, 'Audit des services annexes...');
        const ancillaryServicesAudit = new AncillaryServicesAudit({}, bankConditions);
        const ancillaryServicesAnomalies = await this.runDetector(() =>
          ancillaryServicesAudit.analyze(filteredTransactions)
        );
        allAnomalies.push(...ancillaryServicesAnomalies);
        currentProgress += 3;
      }

      // Packages Audit - Packages et assurances
      if (config.enabledDetectors.includes(AnomalyType.FEE_ANOMALY)) {
        progress(currentProgress, 'Audit des packages et assurances...');
        const packagesAudit = new PackagesAudit({}, bankConditions);
        const packagesAnomalies = await this.runDetector(() =>
          packagesAudit.analyze(filteredTransactions)
        );
        allAnomalies.push(...packagesAnomalies);
      }

      progress(70, 'Calcul des statistiques...');

      // Calculate statistics
      const statistics = this.calculateStatistics(filteredTransactions, allAnomalies);

      // AI-powered analysis (if Claude service is available)
      let aiAnalysis: AIAuditResponse | undefined;
      let categorizedCount = 0;
      let fraudPatternsCount = 0;

      if (options?.claudeService) {
        // AI Categorization
        if (options.enableAICategorization && filteredTransactions.length > 0) {
          progress(75, 'Catégorisation IA des transactions...');
          try {
            const categories = await options.claudeService.categorizeTransactions(
              filteredTransactions.slice(0, 200) // Limit for API costs
            );
            categorizedCount = categories.filter(c => c.confidence > 0.5).length;
          } catch (error) {
            console.error('Erreur catégorisation IA:', error);
          }
        }

        // AI Fraud Detection
        if (options.enableAIFraudDetection && filteredTransactions.length > 0) {
          progress(82, 'Détection de fraude IA...');
          try {
            const fraudPatterns = await options.claudeService.detectFraudPatterns(
              filteredTransactions,
              allAnomalies
            );
            fraudPatternsCount = fraudPatterns.filter(f => f.isSuspicious).length;
          } catch (error) {
            console.error('Erreur détection fraude IA:', error);
          }
        }

        // AI Deep Analysis of anomalies
        if (allAnomalies.length > 0) {
          progress(88, 'Analyse approfondie IA...');
          try {
            aiAnalysis = await options.claudeService.analyzeAnomalies(
              allAnomalies,
              bankConditions
            );
          } catch (error) {
            console.error('Erreur analyse IA:', error);
          }
        }
      }

      progress(95, 'Génération du résumé...');

      // Generate summary (enhanced with AI insights if available)
      const summary = this.generateSummary(allAnomalies, statistics, aiAnalysis);

      progress(100, 'Analyse terminée');

      return {
        id: `analysis-${Date.now()}`,
        config,
        status: AnalysisStatus.COMPLETED,
        progress: 100,
        anomalies: allAnomalies,
        statistics,
        summary,
        startedAt,
        completedAt: new Date(),
        aiAnalysis,
        categorizedTransactions: categorizedCount,
        fraudPatternsDetected: fraudPatternsCount,
      };
    } catch (error) {
      return {
        id: `analysis-${Date.now()}`,
        config,
        status: AnalysisStatus.FAILED,
        progress: 0,
        anomalies: [],
        statistics: this.emptyStatistics(),
        summary: {
          status: 'CRITICAL',
          message: `Erreur lors de l'analyse: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          keyFindings: [],
          recommendations: [],
          estimatedRecovery: 0,
        },
        startedAt,
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Run a detector with async wrapper for potential web worker support
   */
  private async runDetector<T>(detector: () => T): Promise<T> {
    // For now, run synchronously
    // Could be enhanced to use web workers for heavy computation
    return detector();
  }

  /**
   * Filter transactions based on config
   */
  private filterTransactions(
    transactions: Transaction[],
    config: AnalysisConfig
  ): Transaction[] {
    return transactions.filter((t) => {
      // Filter by client
      if (config.clientId && t.clientId !== config.clientId) {
        return false;
      }

      // Filter by date range
      const txDate = new Date(t.date);
      if (config.dateRange.start && txDate < config.dateRange.start) {
        return false;
      }
      if (config.dateRange.end && txDate > config.dateRange.end) {
        return false;
      }

      // Filter by bank codes
      if (config.bankCodes && config.bankCodes.length > 0) {
        if (!config.bankCodes.includes(t.bankCode)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Calculate analysis statistics
   */
  private calculateStatistics(
    transactions: Transaction[],
    anomalies: Anomaly[]
  ): AnalysisStatistics {
    const totalTransactions = transactions.length;
    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalAnomalies = anomalies.length;
    const totalAnomalyAmount = anomalies.reduce((sum, a) => sum + a.amount, 0);

    // Count by type
    const anomaliesByType: Record<AnomalyType, number> = {
      // Modules existants
      [AnomalyType.DUPLICATE_FEE]: 0,
      [AnomalyType.GHOST_FEE]: 0,
      [AnomalyType.OVERCHARGE]: 0,
      [AnomalyType.INTEREST_ERROR]: 0,
      [AnomalyType.UNAUTHORIZED]: 0,
      [AnomalyType.ROUNDING_ABUSE]: 0,
      // Nouveaux modules
      [AnomalyType.VALUE_DATE_ERROR]: 0,
      [AnomalyType.SUSPICIOUS_TRANSACTION]: 0,
      [AnomalyType.COMPLIANCE_VIOLATION]: 0,
      [AnomalyType.CASHFLOW_ANOMALY]: 0,
      [AnomalyType.RECONCILIATION_GAP]: 0,
      [AnomalyType.MULTI_BANK_ISSUE]: 0,
      [AnomalyType.OHADA_NON_COMPLIANCE]: 0,
      [AnomalyType.AML_ALERT]: 0,
      // Modules d'audit par catégorie de frais
      [AnomalyType.FEE_ANOMALY]: 0,
    };

    // Count by severity
    const anomaliesBySeverity: Record<Severity, number> = {
      [Severity.LOW]: 0,
      [Severity.MEDIUM]: 0,
      [Severity.HIGH]: 0,
      [Severity.CRITICAL]: 0,
    };

    for (const anomaly of anomalies) {
      anomaliesByType[anomaly.type]++;
      anomaliesBySeverity[anomaly.severity]++;
    }

    return {
      totalTransactions,
      totalAmount,
      totalAnomalies,
      totalAnomalyAmount,
      anomaliesByType,
      anomaliesBySeverity,
      anomalyRate: totalTransactions > 0 ? (totalAnomalies / totalTransactions) * 100 : 0,
      potentialSavings: totalAnomalyAmount,
    };
  }

  /**
   * Generate analysis summary
   */
  private generateSummary(
    anomalies: Anomaly[],
    statistics: AnalysisStatistics,
    aiAnalysis?: AIAuditResponse
  ): AnalysisSummary {
    const criticalCount = statistics.anomaliesBySeverity[Severity.CRITICAL];
    const highCount = statistics.anomaliesBySeverity[Severity.HIGH];

    // Determine status
    let status: 'OK' | 'WARNING' | 'CRITICAL';
    if (criticalCount > 0) {
      status = 'CRITICAL';
    } else if (highCount > 0 || statistics.totalAnomalies > 10) {
      status = 'WARNING';
    } else {
      status = 'OK';
    }

    // Generate message
    let message: string;
    if (statistics.totalAnomalies === 0) {
      message = 'Aucune anomalie détectée. Les frais bancaires semblent conformes.';
    } else {
      message =
        `${statistics.totalAnomalies} anomalie${statistics.totalAnomalies > 1 ? 's' : ''} détectée${statistics.totalAnomalies > 1 ? 's' : ''} ` +
        `pour un montant total de ${Math.round(statistics.totalAnomalyAmount).toLocaleString('fr-FR')} FCFA. ` +
        `Taux d'anomalie: ${statistics.anomalyRate.toFixed(1)}%.`;
    }

    // Extract key findings
    let keyFindings = this.extractKeyFindings(anomalies, statistics);

    // Generate recommendations
    let recommendations = this.generateRecommendations(anomalies, statistics);

    // Enhance with AI insights if available
    if (aiAnalysis?.analysis) {
      // Add AI findings to key findings
      if (aiAnalysis.analysis.findings?.length > 0) {
        const aiFindings = aiAnalysis.analysis.findings
          .slice(0, 3)
          .map(f => `[IA] ${f.description}`);
        keyFindings = [...keyFindings, ...aiFindings].slice(0, 5);
      }

      // Add AI recommendations
      if (aiAnalysis.analysis.recommendations?.length > 0) {
        const aiRecs = aiAnalysis.analysis.recommendations
          .slice(0, 2)
          .map(r => `[IA] ${r}`);
        recommendations = [...recommendations, ...aiRecs].slice(0, 5);
      }

      // Enhance message with AI summary
      if (aiAnalysis.analysis.summary) {
        message += ` Analyse IA: ${aiAnalysis.analysis.summary}`;
      }
    }

    return {
      status,
      message,
      keyFindings,
      recommendations,
      estimatedRecovery: statistics.potentialSavings,
    };
  }

  /**
   * Extract key findings from anomalies
   */
  private extractKeyFindings(
    anomalies: Anomaly[],
    statistics: AnalysisStatistics
  ): string[] {
    const findings: string[] = [];

    const typeLabels: Record<AnomalyType, string> = {
      // Modules existants
      [AnomalyType.DUPLICATE_FEE]: 'frais en double',
      [AnomalyType.GHOST_FEE]: 'frais fantômes',
      [AnomalyType.OVERCHARGE]: 'surfacturations',
      [AnomalyType.INTEREST_ERROR]: 'erreurs d\'intérêts',
      [AnomalyType.UNAUTHORIZED]: 'frais non autorisés',
      [AnomalyType.ROUNDING_ABUSE]: 'abus d\'arrondi',
      // Nouveaux modules
      [AnomalyType.VALUE_DATE_ERROR]: 'erreurs de dates de valeur',
      [AnomalyType.SUSPICIOUS_TRANSACTION]: 'opérations suspectes',
      [AnomalyType.COMPLIANCE_VIOLATION]: 'non-conformités',
      [AnomalyType.CASHFLOW_ANOMALY]: 'anomalies de trésorerie',
      [AnomalyType.RECONCILIATION_GAP]: 'écarts de rapprochement',
      [AnomalyType.MULTI_BANK_ISSUE]: 'problèmes multi-banques',
      [AnomalyType.OHADA_NON_COMPLIANCE]: 'non-conformités OHADA',
      [AnomalyType.AML_ALERT]: 'alertes anti-blanchiment',
      // Modules d'audit par catégorie
      [AnomalyType.FEE_ANOMALY]: 'anomalies de frais',
    };

    // Group by type
    for (const [type, count] of Object.entries(statistics.anomaliesByType)) {
      if (count > 0) {
        const typeAnomalies = anomalies.filter((a) => a.type === type);
        const amount = typeAnomalies.reduce((sum, a) => sum + a.amount, 0);

        findings.push(
          `${count} ${typeLabels[type as AnomalyType]} (${Math.round(amount).toLocaleString('fr-FR')} FCFA)`
        );
      }
    }

    // Add critical findings
    const criticalAnomalies = anomalies.filter((a) => a.severity === Severity.CRITICAL);
    if (criticalAnomalies.length > 0) {
      findings.unshift(
        `${criticalAnomalies.length} anomalie${criticalAnomalies.length > 1 ? 's' : ''} critique${criticalAnomalies.length > 1 ? 's' : ''} requérant une attention immédiate`
      );
    }

    return findings.slice(0, 5);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    anomalies: Anomaly[],
    statistics: AnalysisStatistics
  ): string[] {
    const recommendations: string[] = [];

    if (statistics.anomaliesByType[AnomalyType.DUPLICATE_FEE] > 0) {
      recommendations.push(
        'Mettre en place un contrôle mensuel des doublons de frais'
      );
    }

    if (statistics.anomaliesByType[AnomalyType.GHOST_FEE] > 0) {
      recommendations.push(
        'Demander des factures détaillées pour tous les frais non identifiés'
      );
    }

    if (statistics.anomaliesByType[AnomalyType.OVERCHARGE] > 0) {
      recommendations.push(
        'Renégocier les conditions tarifaires avec la banque'
      );
    }

    if (statistics.anomaliesByType[AnomalyType.INTEREST_ERROR] > 0) {
      recommendations.push(
        'Demander le détail des calculs d\'intérêts à la banque'
      );
    }

    // Recommandations pour les nouveaux modules
    if (statistics.anomaliesByType[AnomalyType.VALUE_DATE_ERROR] > 0) {
      recommendations.push(
        'Vérifier les dates de valeur et réclamer les intérêts indûment prélevés'
      );
    }

    if (statistics.anomaliesByType[AnomalyType.SUSPICIOUS_TRANSACTION] > 0) {
      recommendations.push(
        'Analyser en détail les opérations suspectes identifiées'
      );
    }

    if (statistics.anomaliesByType[AnomalyType.COMPLIANCE_VIOLATION] > 0) {
      recommendations.push(
        'Mettre en conformité avec les conditions contractuelles'
      );
    }

    if (statistics.anomaliesByType[AnomalyType.CASHFLOW_ANOMALY] > 0) {
      recommendations.push(
        'Optimiser la gestion de trésorerie pour éviter les découverts'
      );
    }

    if (statistics.anomaliesByType[AnomalyType.RECONCILIATION_GAP] > 0) {
      recommendations.push(
        'Effectuer un rapprochement complet et identifier les écritures manquantes'
      );
    }

    if (statistics.anomaliesByType[AnomalyType.OHADA_NON_COMPLIANCE] > 0) {
      recommendations.push(
        'Régulariser les non-conformités OHADA identifiées'
      );
    }

    if (statistics.anomaliesByType[AnomalyType.AML_ALERT] > 0) {
      recommendations.push(
        'URGENT: Transmettre les alertes LCB-FT au responsable conformité'
      );
    }

    if (statistics.anomaliesByType[AnomalyType.FEE_ANOMALY] > 0) {
      recommendations.push(
        'Analyser les frais bancaires par catégorie et réclamer les remboursements'
      );
    }

    if (statistics.totalAnomalies > 10) {
      recommendations.push(
        'Envisager de changer de banque ou de renégocier l\'ensemble des conditions'
      );
    }

    if (statistics.potentialSavings > 100000) {
      recommendations.push(
        'Engager rapidement une procédure de réclamation formelle'
      );
    }

    return recommendations.slice(0, 5);
  }

  /**
   * Create empty statistics object
   */
  private emptyStatistics(): AnalysisStatistics {
    return {
      totalTransactions: 0,
      totalAmount: 0,
      totalAnomalies: 0,
      totalAnomalyAmount: 0,
      anomaliesByType: {
        // Modules existants
        [AnomalyType.DUPLICATE_FEE]: 0,
        [AnomalyType.GHOST_FEE]: 0,
        [AnomalyType.OVERCHARGE]: 0,
        [AnomalyType.INTEREST_ERROR]: 0,
        [AnomalyType.UNAUTHORIZED]: 0,
        [AnomalyType.ROUNDING_ABUSE]: 0,
        // Nouveaux modules
        [AnomalyType.VALUE_DATE_ERROR]: 0,
        [AnomalyType.SUSPICIOUS_TRANSACTION]: 0,
        [AnomalyType.COMPLIANCE_VIOLATION]: 0,
        [AnomalyType.CASHFLOW_ANOMALY]: 0,
        [AnomalyType.RECONCILIATION_GAP]: 0,
        [AnomalyType.MULTI_BANK_ISSUE]: 0,
        [AnomalyType.OHADA_NON_COMPLIANCE]: 0,
        [AnomalyType.AML_ALERT]: 0,
        // Modules d'audit par catégorie
        [AnomalyType.FEE_ANOMALY]: 0,
      },
      anomaliesBySeverity: {
        [Severity.LOW]: 0,
        [Severity.MEDIUM]: 0,
        [Severity.HIGH]: 0,
        [Severity.CRITICAL]: 0,
      },
      anomalyRate: 0,
      potentialSavings: 0,
    };
  }
}

// Singleton instance for convenience
let instance: AnalysisService | null = null;

export function getAnalysisService(thresholds?: DetectionThresholds): AnalysisService {
  if (!instance || thresholds) {
    instance = new AnalysisService(thresholds);
  }
  return instance;
}
