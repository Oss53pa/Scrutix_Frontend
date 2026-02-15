import { v4 as uuidv4 } from 'uuid';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  Evidence,
  BankConditions,
  FeeSchedule,
  DetectionThresholds,
} from '../types';

interface OverchargeAnalysis {
  transaction: Transaction;
  isOvercharge: boolean;
  chargedAmount: number;
  expectedAmount: number;
  excessAmount: number;
  excessPercentage: number;
  serviceType: string;
  matchedFee: FeeSchedule | null;
  reasons: string[];
}

interface HistoricalFeeData {
  [serviceType: string]: Array<{
    date: Date;
    amount: number;
  }>;
}

export class OverchargeAnalyzer {
  private thresholds: DetectionThresholds['overchargeDetection'];

  // Service type detection patterns
  private servicePatterns: Record<string, RegExp[]> = {
    ACCOUNT_MAINTENANCE: [/tenue.*compte/i, /frais.*compte/i, /gestion.*compte/i],
    TRANSFER_NATIONAL: [/virement.*national/i, /vir\b/i, /transfer.*local/i],
    TRANSFER_INTERNATIONAL: [/virement.*international/i, /swift/i, /transfer.*étranger/i],
    CARD_FEE: [/carte/i, /card/i, /visa/i, /mastercard/i],
    ATM: [/retrait.*dab/i, /retrait.*gab/i, /atm/i, /distributeur/i],
    OVERDRAFT: [/agios/i, /découvert/i, /intérêts.*débiteurs/i],
    SMS: [/sms/i, /notification/i, /alerte/i],
    STATEMENT: [/relevé/i, /extrait/i, /statement/i],
    OTHER: [],
  };

  constructor(thresholds?: DetectionThresholds['overchargeDetection']) {
    this.thresholds = thresholds || {
      tolerancePercentage: 0.02,
      useHistoricalBaseline: true,
    };
  }

  /**
   * Detect overcharges by comparing to bank conditions
   */
  detectOvercharges(
    transactions: Transaction[],
    bankConditions: BankConditions,
    historicalData?: HistoricalFeeData
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Filter to fee transactions
    const fees = transactions.filter((t) => t.amount < 0);

    for (const fee of fees) {
      const analysis = this.analyzeFee(fee, bankConditions, historicalData);

      if (analysis.isOvercharge) {
        anomalies.push(this.createAnomaly(analysis, bankConditions));
      }
    }

    return anomalies;
  }

  /**
   * Analyze a fee for overcharging
   */
  private analyzeFee(
    fee: Transaction,
    bankConditions: BankConditions,
    historicalData?: HistoricalFeeData
  ): OverchargeAnalysis {
    const serviceType = this.detectServiceType(fee);
    const chargedAmount = Math.abs(fee.amount);
    const reasons: string[] = [];

    // Find matching fee in bank conditions
    const matchedFee = this.findMatchingFee(serviceType, bankConditions);

    let expectedAmount = 0;
    let isOvercharge = false;

    if (matchedFee) {
      expectedAmount = this.calculateExpectedAmount(matchedFee, chargedAmount);

      // Compare with official rate
      const tolerance = expectedAmount * this.thresholds.tolerancePercentage;
      if (chargedAmount > expectedAmount + tolerance) {
        isOvercharge = true;
        reasons.push('Dépasse le tarif officiel');
      }
    }

    // Compare with historical average if enabled
    if (this.thresholds.useHistoricalBaseline && historicalData) {
      const historicalAvg = this.getHistoricalAverage(serviceType, historicalData);

      if (historicalAvg && historicalAvg > 0 && chargedAmount > historicalAvg * 1.2) {
        const increasePercent = Math.round((chargedAmount / historicalAvg - 1) * 100);
        isOvercharge = true;
        reasons.push(`Augmentation de ${increasePercent}% par rapport à l'historique`);

        // Use historical as expected if no official rate or if lower
        if (!matchedFee || historicalAvg < expectedAmount) {
          expectedAmount = historicalAvg;
        }
      }
    }

    // Flag unmatched high fees for manual review (not as automatic overcharge)
    // Only flag if no historical baseline and the amount seems unusually high
    if (!matchedFee && !isOvercharge && serviceType === 'OTHER') {
      // For unmatched fees, we don't assume overcharge - we flag for review
      // This avoids false positives from arbitrary thresholds
      if (chargedAmount > 50000) {
        reasons.push('Frais élevé sans correspondance tarifaire - à vérifier manuellement');
        // Don't set isOvercharge, but keep expectedAmount at 0 to flag for review
      }
    }

    const excessAmount = Math.max(0, chargedAmount - expectedAmount);
    // Avoid division by zero
    const excessPercentage = expectedAmount > 0 ? excessAmount / expectedAmount : (isOvercharge ? 1 : 0);

    return {
      transaction: fee,
      isOvercharge,
      chargedAmount,
      expectedAmount,
      excessAmount,
      excessPercentage,
      serviceType,
      matchedFee,
      reasons,
    };
  }

  /**
   * Detect service type from transaction description
   */
  private detectServiceType(transaction: Transaction): string {
    const description = transaction.description.toLowerCase();

    for (const [type, patterns] of Object.entries(this.servicePatterns)) {
      if (patterns.some((pattern) => pattern.test(description))) {
        return type;
      }
    }

    return 'OTHER';
  }

  /**
   * Find matching fee schedule in bank conditions
   */
  private findMatchingFee(
    serviceType: string,
    bankConditions: BankConditions
  ): FeeSchedule | null {
    // Map service type to fee codes
    const codeMapping: Record<string, string[]> = {
      ACCOUNT_MAINTENANCE: ['TDC', 'TENUE', 'COMPTE'],
      TRANSFER_NATIONAL: ['VIR', 'VIRN', 'TRANSFER'],
      TRANSFER_INTERNATIONAL: ['VIRI', 'SWIFT', 'TRANSFERI'],
      CARD_FEE: ['CARTE', 'CARD', 'CB'],
      ATM: ['RET', 'DAB', 'GAB', 'ATM'],
      SMS: ['SMS', 'NOTIF'],
      STATEMENT: ['REL', 'EXTRAIT', 'STATEMENT'],
    };

    const codes = codeMapping[serviceType] || [];

    for (const fee of bankConditions.fees) {
      if (codes.some((code) => fee.code.toUpperCase().includes(code))) {
        return fee;
      }
      if (
        codes.some((code) =>
          fee.name.toUpperCase().includes(code.toUpperCase())
        )
      ) {
        return fee;
      }
    }

    return null;
  }

  /**
   * Calculate expected amount based on fee schedule
   * For percentage fees, we use the minimum amount as the expected floor
   */
  private calculateExpectedAmount(
    fee: FeeSchedule,
    chargedAmount: number,
    baseTransactionAmount?: number
  ): number {
    switch (fee.type) {
      case 'fixed':
        return fee.amount;

      case 'percentage': {
        const rate = fee.percentage || 0;
        // If we have a base transaction amount, calculate the percentage
        if (baseTransactionAmount && rate > 0) {
          const calculatedFee = baseTransactionAmount * rate;
          // Apply min/max if defined
          const minAmount = fee.minAmount || 0;
          const maxAmount = fee.maxAmount || Infinity;
          return Math.min(Math.max(calculatedFee, minAmount), maxAmount);
        }
        // Fallback: use the fixed amount as minimum expected
        return fee.amount || fee.minAmount || 0;
      }

      case 'tiered': {
        // For tiered fees, use the amount as the expected value
        // The tiers should be validated during import
        return fee.amount;
      }

      default:
        return fee.amount;
    }
  }

  /**
   * Get historical average for a service type
   */
  private getHistoricalAverage(
    serviceType: string,
    historicalData: HistoricalFeeData
  ): number | null {
    const history = historicalData[serviceType];
    if (!history || history.length === 0) return null;

    const sum = history.reduce((total, item) => total + item.amount, 0);
    return sum / history.length;
  }

  /**
   * Create anomaly from analysis
   */
  private createAnomaly(analysis: OverchargeAnalysis, bankConditions?: BankConditions): Anomaly {
    return {
      id: uuidv4(),
      type: AnomalyType.OVERCHARGE,
      severity: this.calculateSeverity(analysis.excessAmount, analysis.excessPercentage),
      confidence: this.calculateConfidence(analysis),
      amount: analysis.excessAmount,
      transactions: [analysis.transaction],
      evidence: this.generateEvidence(analysis, bankConditions),
      recommendation: this.generateRecommendation(analysis, bankConditions),
      status: 'pending',
      detectedAt: new Date(),
    };
  }

  /**
   * Calculate severity
   */
  private calculateSeverity(excessAmount: number, excessPercentage: number): Severity {
    if (excessAmount > 20000 || excessPercentage > 0.5) return Severity.CRITICAL;
    if (excessAmount > 10000 || excessPercentage > 0.3) return Severity.HIGH;
    if (excessAmount > 5000 || excessPercentage > 0.2) return Severity.MEDIUM;
    return Severity.LOW;
  }

  /**
   * Calculate confidence based on analysis quality
   */
  private calculateConfidence(analysis: OverchargeAnalysis): number {
    let confidence = 0.6;

    // Higher confidence if matched to official fee
    if (analysis.matchedFee) confidence += 0.25;

    // Higher confidence for larger excesses
    if (analysis.excessPercentage > 0.3) confidence += 0.1;

    // Multiple reasons increase confidence
    if (analysis.reasons.length > 1) confidence += 0.05;

    return Math.min(confidence, 0.98);
  }

  /**
   * Generate evidence with source references
   */
  private generateEvidence(analysis: OverchargeAnalysis, bankConditions?: BankConditions): Evidence[] {
    const evidence: Evidence[] = [];
    const bankName = bankConditions?.bankName || 'Banque';
    const gridDate = bankConditions?.effectiveDate
      ? new Date(bankConditions.effectiveDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      : '';
    const sourceName = gridDate ? `Grille tarifaire ${bankName} - ${gridDate}` : `Conditions ${bankName}`;

    // Comparaison montant facturé vs attendu
    evidence.push({
      type: 'COMPARISON',
      description: 'Comparaison tarifaire',
      value: analysis.excessAmount,
      expectedValue: analysis.expectedAmount,
      appliedValue: analysis.chargedAmount,
      source: sourceName,
      conditionRef: analysis.matchedFee
        ? `${analysis.matchedFee.code} - ${analysis.matchedFee.name}`
        : undefined,
    });

    // Écart en pourcentage
    evidence.push({
      type: 'EXCESS_PERCENTAGE',
      description: 'Écart constaté',
      value: `+${Math.round(analysis.excessPercentage * 100)}% (${Math.round(analysis.excessAmount).toLocaleString('fr-FR')} FCFA)`,
    });

    // Référence au tarif officiel si trouvé
    if (analysis.matchedFee) {
      const feeDetails = analysis.matchedFee.type === 'percentage' && analysis.matchedFee.percentage
        ? `${(analysis.matchedFee.percentage * 100).toFixed(2)}%${analysis.matchedFee.minAmount ? ` (min: ${analysis.matchedFee.minAmount} FCFA)` : ''}`
        : `${analysis.matchedFee.amount.toLocaleString('fr-FR')} FCFA`;

      evidence.push({
        type: 'OFFICIAL_RATE',
        description: 'Tarif contractuel',
        value: feeDetails,
        source: sourceName,
        conditionRef: `Section: ${this.getServiceTypeLabel(analysis.serviceType)}`,
        reference: analysis.matchedFee.code,
      });
    }

    // Type de service identifié
    evidence.push({
      type: 'SERVICE_TYPE',
      description: 'Type de service',
      value: this.getServiceTypeLabel(analysis.serviceType),
    });

    // Motifs de l'anomalie
    for (const reason of analysis.reasons) {
      evidence.push({
        type: 'REASON',
        description: 'Motif de détection',
        value: reason,
      });
    }

    return evidence;
  }

  /**
   * Get human-readable service type label
   */
  private getServiceTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      ACCOUNT_MAINTENANCE: 'Tenue de compte',
      TRANSFER_NATIONAL: 'Virement national',
      TRANSFER_INTERNATIONAL: 'Virement international',
      CARD_FEE: 'Frais de carte',
      ATM: 'Retrait DAB',
      OVERDRAFT: 'Agios/Découvert',
      SMS: 'Notification SMS',
      STATEMENT: 'Relevé de compte',
      OTHER: 'Autre',
    };

    return labels[type] || type;
  }

  /**
   * Generate recommendation with source reference
   */
  private generateRecommendation(analysis: OverchargeAnalysis, bankConditions?: BankConditions): string {
    const excess = Math.round(analysis.excessAmount).toLocaleString('fr-FR');
    const percentage = Math.round(analysis.excessPercentage * 100);
    const charged = Math.round(analysis.chargedAmount).toLocaleString('fr-FR');
    const expected = Math.round(analysis.expectedAmount).toLocaleString('fr-FR');
    const bankName = bankConditions?.bankName || 'la banque';

    let recommendation = `Surfacturation de ${excess} FCFA (+${percentage}%) détectée pour ${this.getServiceTypeLabel(analysis.serviceType)}. `;
    recommendation += `Montant facturé: ${charged} FCFA vs tarif contractuel: ${expected} FCFA. `;

    if (analysis.matchedFee) {
      recommendation += `Référence: ${analysis.matchedFee.code} - ${analysis.matchedFee.name}. `;
    }

    recommendation += `Réclamer auprès de ${bankName} le remboursement de ${excess} FCFA et l'application du tarif contractuel.`;

    return recommendation;
  }
}
