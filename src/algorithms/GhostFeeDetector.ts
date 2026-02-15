import { v4 as uuidv4 } from 'uuid';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  TransactionType,
  DetectionThresholds,
  BankConditions,
} from '../types';
import { feeDescriptionSuspicionScore, isRoundAmount, shannonEntropy } from './utils/entropy';
import { descriptionSimilarity } from './utils/similarity';

interface GhostFeeAnalysis {
  transaction: Transaction;
  isGhost: boolean;
  suspicionScore: number;
  hasAssociatedService: boolean;
  isRecurring: boolean;
  reasons: string[];
}

export class GhostFeeDetector {
  private thresholds: DetectionThresholds['ghostFeeDetection'];

  // Patterns indicating fees
  private feePatterns: RegExp[] = [
    /frais/i,
    /commission/i,
    /taxe/i,
    /prélèvement/i,
    /redevance/i,
    /cotisation/i,
    /abonnement/i,
    /fee/i,
    /charge/i,
  ];

  // Patterns indicating legitimate services
  private servicePatterns: RegExp[] = [
    /virement/i,
    /retrait/i,
    /dépôt|depot/i,
    /carte/i,
    /chèque|cheque/i,
    /transfer/i,
    /paiement/i,
    /achat/i,
    /prélèvement.*(?:edf|orange|sfr|free|eau|électricité)/i,
  ];

  constructor(thresholds?: DetectionThresholds['ghostFeeDetection']) {
    this.thresholds = thresholds || {
      entropyThreshold: 2.5,
      orphanWindowDays: 1,
      minConfidence: 0.7,
    };
  }

  /**
   * Detect ghost fees (fees without associated services)
   */
  detectGhostFees(transactions: Transaction[], bankConditions?: BankConditions): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Filter to potential fee transactions
    const potentialFees = transactions.filter((t) => this.isPotentialFee(t));

    for (const fee of potentialFees) {
      const analysis = this.analyzeFee(fee, transactions);

      if (analysis.isGhost && analysis.suspicionScore >= this.thresholds.minConfidence) {
        anomalies.push(this.createAnomaly(analysis, bankConditions));
      }
    }

    return anomalies;
  }

  /**
   * Check if transaction looks like a fee
   */
  private isPotentialFee(transaction: Transaction): boolean {
    // Must be a debit
    if (transaction.amount >= 0) return false;

    // Check if explicitly marked as fee
    if (transaction.type === TransactionType.FEE) return true;

    // Check description patterns
    return this.feePatterns.some((pattern) =>
      pattern.test(transaction.description)
    );
  }

  /**
   * Analyze a potential fee for ghost characteristics
   */
  private analyzeFee(fee: Transaction, allTransactions: Transaction[]): GhostFeeAnalysis {
    const reasons: string[] = [];
    let suspicionScore = 0;

    // 1. Calculate description suspicion
    const descScore = feeDescriptionSuspicionScore(fee.description);
    if (descScore > 0.3) {
      suspicionScore += descScore * 0.4;
      reasons.push('Description vague ou générique');
    }

    // 2. Check for associated service transaction
    const hasService = this.findAssociatedService(fee, allTransactions);
    if (!hasService) {
      suspicionScore += 0.3;
      reasons.push('Aucun service associé trouvé');
    }

    // 3. Check for round amount
    if (isRoundAmount(fee.amount)) {
      suspicionScore += 0.1;
      reasons.push('Montant rond suspect');
    }

    // 4. Check description entropy
    const entropy = shannonEntropy(fee.description);
    if (entropy < this.thresholds.entropyThreshold) {
      suspicionScore += 0.15;
      reasons.push('Description trop simple');
    } else if (entropy > 4.0) {
      suspicionScore += 0.1;
      reasons.push('Description possiblement auto-générée');
    }

    // 5. Check for recurring pattern
    const isRecurring = this.checkRecurringPattern(fee, allTransactions);
    if (isRecurring && !hasService) {
      suspicionScore += 0.15;
      reasons.push('Frais récurrent sans service identifiable');
    }

    // 6. Check for missing reference
    if (!fee.reference || fee.reference.trim() === '') {
      suspicionScore += 0.1;
      reasons.push('Absence de référence');
    }

    // 7. Check for month-end timing (common for padding)
    const feeDate = new Date(fee.date);
    const dayOfMonth = feeDate.getDate();
    const daysInMonth = new Date(feeDate.getFullYear(), feeDate.getMonth() + 1, 0).getDate();
    if (dayOfMonth >= daysInMonth - 2) {
      suspicionScore += 0.05;
      reasons.push('Frais en fin de mois');
    }

    return {
      transaction: fee,
      isGhost: suspicionScore >= this.thresholds.minConfidence && !hasService,
      suspicionScore: Math.min(suspicionScore, 1),
      hasAssociatedService: hasService,
      isRecurring,
      reasons,
    };
  }

  /**
   * Find if there's an associated service transaction
   */
  private findAssociatedService(
    fee: Transaction,
    allTransactions: Transaction[]
  ): boolean {
    const feeDate = new Date(fee.date);
    const windowMs = this.thresholds.orphanWindowDays * 24 * 60 * 60 * 1000;

    return allTransactions.some((t) => {
      if (t.id === fee.id) return false;

      // Must be within time window
      const tDate = new Date(t.date);
      const diff = Math.abs(tDate.getTime() - feeDate.getTime());
      if (diff > windowMs) return false;

      // Must be a service transaction
      const isService = this.servicePatterns.some((pattern) =>
        pattern.test(t.description)
      );

      if (!isService) return false;

      // Check if descriptions are related
      const similarity = descriptionSimilarity(fee.description, t.description);
      if (similarity > 0.3) return true;

      // Check for common keywords
      const feeKeywords = this.extractKeywords(fee.description);
      const serviceKeywords = this.extractKeywords(t.description);

      return feeKeywords.some((k) => serviceKeywords.includes(k));
    });
  }

  /**
   * Extract meaningful keywords from description
   */
  private extractKeywords(description: string): string[] {
    return description
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .filter(
        (word) =>
          !['frais', 'commission', 'pour', 'avec', 'dans', 'sur'].includes(word)
      );
  }

  /**
   * Check if fee is part of a recurring pattern
   */
  private checkRecurringPattern(
    fee: Transaction,
    allTransactions: Transaction[]
  ): boolean {
    const feeDate = new Date(fee.date);
    const threeMonthsAgo = new Date(feeDate);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const similarFees = allTransactions.filter((t) => {
      if (t.id === fee.id) return false;

      const tDate = new Date(t.date);
      if (tDate < threeMonthsAgo || tDate >= feeDate) return false;

      // Similar amount (within 5%)
      const amountDiff = Math.abs(t.amount - fee.amount) / Math.abs(fee.amount);
      if (amountDiff > 0.05) return false;

      // Similar description
      const descSim = descriptionSimilarity(t.description, fee.description);
      return descSim > 0.7;
    });

    return similarFees.length >= 2;
  }

  /**
   * Create anomaly from analysis
   */
  private createAnomaly(analysis: GhostFeeAnalysis, bankConditions?: BankConditions): Anomaly {
    const { transaction, suspicionScore, isRecurring } = analysis;

    return {
      id: uuidv4(),
      type: AnomalyType.GHOST_FEE,
      severity: this.calculateSeverity(transaction.amount, isRecurring),
      confidence: suspicionScore,
      amount: Math.abs(transaction.amount),
      transactions: [transaction],
      evidence: this.generateEvidence(analysis, bankConditions),
      recommendation: this.generateRecommendation(analysis, bankConditions),
      status: 'pending',
      detectedAt: new Date(),
    };
  }

  /**
   * Calculate severity based on amount and recurrence
   */
  private calculateSeverity(amount: number, isRecurring: boolean): Severity {
    const absAmount = Math.abs(amount);

    if (isRecurring && absAmount > 5000) return Severity.CRITICAL;
    if (absAmount > 20000) return Severity.HIGH;
    if (absAmount > 5000 || isRecurring) return Severity.MEDIUM;
    return Severity.LOW;
  }

  /**
   * Generate evidence for the anomaly with source references
   */
  private generateEvidence(analysis: GhostFeeAnalysis, bankConditions?: BankConditions): Evidence[] {
    const evidence: Evidence[] = [];
    const bankName = bankConditions?.bankName || 'Banque';
    const gridDate = bankConditions?.effectiveDate
      ? new Date(bankConditions.effectiveDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      : '';
    const sourceName = gridDate ? `Grille tarifaire ${bankName} - ${gridDate}` : `Conditions ${bankName}`;

    // Vérification dans la grille tarifaire
    evidence.push({
      type: 'GRID_CHECK',
      description: 'Vérification tarifaire',
      value: `${Math.abs(analysis.transaction.amount).toLocaleString('fr-FR')} FCFA`,
      source: sourceName,
      conditionRef: 'Aucune correspondance trouvée dans la grille',
    });

    evidence.push({
      type: 'SUSPICION_SCORE',
      description: 'Score de suspicion',
      value: `${Math.round(analysis.suspicionScore * 100)}%`,
    });

    if (!analysis.hasAssociatedService) {
      evidence.push({
        type: 'NO_SERVICE',
        description: 'Service associé',
        value: 'Aucune opération correspondante identifiée',
      });
    }

    if (analysis.isRecurring) {
      evidence.push({
        type: 'RECURRING',
        description: 'Pattern récurrent',
        value: 'Frais similaires détectés sur les 3 derniers mois',
      });
    }

    // Libellé de la transaction
    evidence.push({
      type: 'DESCRIPTION',
      description: 'Libellé bancaire',
      value: analysis.transaction.description,
    });

    // Add reasons
    for (const reason of analysis.reasons) {
      evidence.push({
        type: 'REASON',
        description: 'Motif de suspicion',
        value: reason,
      });
    }

    return evidence;
  }

  /**
   * Generate recommendation with source reference
   */
  private generateRecommendation(analysis: GhostFeeAnalysis, bankConditions?: BankConditions): string {
    const amount = Math.abs(analysis.transaction.amount);
    const formattedAmount = Math.round(amount).toLocaleString('fr-FR');
    const bankName = bankConditions?.bankName || 'la banque';

    if (analysis.isRecurring) {
      return (
        `Frais fantôme récurrent de ${formattedAmount} FCFA - libellé "${analysis.transaction.description}" sans correspondance dans la grille tarifaire. ` +
        `Réclamer auprès de ${bankName} une justification détaillée et le remboursement rétroactif si non justifié.`
      );
    }

    return (
      `Frais fantôme de ${formattedAmount} FCFA - libellé "${analysis.transaction.description}" non identifié dans la grille tarifaire. ` +
      `Réclamer auprès de ${bankName} le justificatif du service rendu ou le remboursement.`
    );
  }
}
