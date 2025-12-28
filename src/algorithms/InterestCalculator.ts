import { v4 as uuidv4 } from 'uuid';
import { eachDayOfInterval, differenceInDays } from 'date-fns';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  Evidence,
  BankConditions,
  DailyBalance,
  DetectionThresholds,
  TransactionType,
} from '../types';

interface InterestAnalysis {
  transaction: Transaction;
  hasError: boolean;
  chargedAmount: number;
  theoreticalAmount: number;
  difference: number;
  period: InterestPeriod | null;
  reason: string;
  details: InterestCalculationDetails;
}

interface InterestPeriod {
  startDate: Date;
  endDate: Date;
  days: number;
}

interface InterestCalculationDetails {
  dailyBalances: Array<{ date: Date; balance: number; interest: number }>;
  totalDebitDays: number;
  averageDebitBalance: number;
  appliedRate: number;
  theoreticalRate: number;
}

export class InterestCalculator {
  private thresholds: DetectionThresholds['interestCalculation'];

  constructor(thresholds?: DetectionThresholds['interestCalculation']) {
    this.thresholds = thresholds || {
      toleranceAmount: 1,
      tolerancePercentage: 0.01,
    };
  }

  /**
   * Verify interest charges against theoretical calculations
   */
  verifyInterestCharges(
    transactions: Transaction[],
    bankConditions: BankConditions,
    accountBalances: DailyBalance[]
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Find interest transactions
    const interestTransactions = transactions.filter(
      (t) => t.type === TransactionType.INTEREST || this.isInterestTransaction(t)
    );

    for (const interest of interestTransactions) {
      const analysis = this.analyzeInterestCharge(
        interest,
        accountBalances,
        bankConditions
      );

      if (analysis.hasError) {
        anomalies.push(this.createAnomaly(analysis));
      }
    }

    return anomalies;
  }

  /**
   * Check if transaction is an interest charge
   */
  private isInterestTransaction(transaction: Transaction): boolean {
    const patterns = [
      /int[eé]r[eê]t/i,
      /agios/i,
      /d[eé]couvert/i,
      /debit.*interest/i,
    ];

    return patterns.some((p) => p.test(transaction.description));
  }

  /**
   * Analyze an interest charge
   */
  private analyzeInterestCharge(
    charge: Transaction,
    balances: DailyBalance[],
    conditions: BankConditions
  ): InterestAnalysis {
    // Identify the calculation period
    const period = this.identifyPeriod(charge, balances);

    if (!period) {
      return {
        transaction: charge,
        hasError: true,
        chargedAmount: Math.abs(charge.amount),
        theoreticalAmount: 0,
        difference: Math.abs(charge.amount),
        period: null,
        reason: 'Période de calcul non identifiable',
        details: this.emptyDetails(),
      };
    }

    // Get relevant interest rate
    const overdraftRate = conditions.interestRates.find(
      (r) => r.type === 'overdraft'
    );
    const annualRate = overdraftRate?.rate || 0.18;
    const dayCountConvention = overdraftRate?.dayCountConvention || 'ACT/360';

    // Calculate theoretical interest
    const details = this.calculateTheoreticalInterest(
      period,
      balances.filter((b) => b.accountNumber === charge.accountNumber),
      annualRate,
      dayCountConvention
    );

    const charged = Math.abs(charge.amount);
    const theoretical = details.dailyBalances.reduce(
      (sum, d) => sum + d.interest,
      0
    );
    const difference = Math.abs(charged - theoretical);

    // Check if within tolerance
    const toleranceAmount = Math.max(
      this.thresholds.toleranceAmount,
      theoretical * this.thresholds.tolerancePercentage
    );

    const hasError = difference > toleranceAmount;

    let reason = '';
    if (hasError) {
      const ratio = theoretical > 0 ? charged / theoretical : charged;
      if (ratio > 1.5) {
        reason = "Taux d'intérêt appliqué supérieur au taux contractuel";
      } else if (ratio > 1.1) {
        reason = 'Erreur de calcul ou jours supplémentaires facturés';
      } else if (charged > theoretical) {
        reason = 'Surfacturation des intérêts';
      } else {
        reason = 'Sous-facturation (en faveur du client)';
      }
    }

    return {
      transaction: charge,
      hasError,
      chargedAmount: charged,
      theoreticalAmount: theoretical,
      difference,
      period,
      reason,
      details: {
        ...details,
        theoreticalRate: annualRate,
        appliedRate: this.estimateAppliedRate(charged, details),
      },
    };
  }

  /**
   * Identify the period for interest calculation
   */
  private identifyPeriod(
    charge: Transaction,
    balances: DailyBalance[]
  ): InterestPeriod | null {
    const chargeDate = new Date(charge.date);

    // Interest is typically calculated for the previous month
    const endDate = new Date(chargeDate.getFullYear(), chargeDate.getMonth(), 0);
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    // Verify we have balance data for this period
    const periodBalances = balances.filter((b) => {
      const bDate = new Date(b.date);
      return bDate >= startDate && bDate <= endDate;
    });

    if (periodBalances.length === 0) {
      // Try current month
      const altStart = new Date(chargeDate.getFullYear(), chargeDate.getMonth(), 1);
      const altEnd = new Date(chargeDate);

      const altBalances = balances.filter((b) => {
        const bDate = new Date(b.date);
        return bDate >= altStart && bDate <= altEnd;
      });

      if (altBalances.length > 0) {
        return {
          startDate: altStart,
          endDate: altEnd,
          days: differenceInDays(altEnd, altStart) + 1,
        };
      }

      return null;
    }

    return {
      startDate,
      endDate,
      days: differenceInDays(endDate, startDate) + 1,
    };
  }

  /**
   * Calculate theoretical interest day by day
   */
  private calculateTheoreticalInterest(
    period: InterestPeriod,
    balances: DailyBalance[],
    annualRate: number,
    dayCountConvention: string
  ): Omit<InterestCalculationDetails, 'appliedRate' | 'theoreticalRate'> {
    const daysInYear = dayCountConvention === 'ACT/360' ? 360 : 365;
    const dailyRate = annualRate / daysInYear;

    const days = eachDayOfInterval({
      start: period.startDate,
      end: period.endDate,
    });

    const dailyInterests: Array<{ date: Date; balance: number; interest: number }> = [];
    let totalDebitDays = 0;
    let totalDebitBalance = 0;

    for (const day of days) {
      const balance = this.getBalanceForDay(day, balances);
      let interest = 0;

      if (balance < 0) {
        // Only charge interest on negative balances
        interest = Math.abs(balance) * dailyRate;
        totalDebitDays++;
        totalDebitBalance += Math.abs(balance);
      }

      dailyInterests.push({ date: day, balance, interest });
    }

    return {
      dailyBalances: dailyInterests,
      totalDebitDays,
      averageDebitBalance: totalDebitDays > 0 ? totalDebitBalance / totalDebitDays : 0,
    };
  }

  /**
   * Get balance for a specific day
   */
  private getBalanceForDay(date: Date, balances: DailyBalance[]): number {
    // Find exact match
    const exactMatch = balances.find(
      (b) => new Date(b.date).toDateString() === date.toDateString()
    );
    if (exactMatch) return exactMatch.balance;

    // Find closest previous balance
    const previousBalances = balances
      .filter((b) => new Date(b.date) <= date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return previousBalances[0]?.balance || 0;
  }

  /**
   * Estimate the rate that was actually applied
   */
  private estimateAppliedRate(
    chargedAmount: number,
    details: Omit<InterestCalculationDetails, 'appliedRate' | 'theoreticalRate'>
  ): number {
    if (details.totalDebitDays === 0 || details.averageDebitBalance === 0) {
      return 0;
    }

    // Reverse calculate the rate
    // Interest = Principal * Rate * Days / 360
    const estimatedRate =
      (chargedAmount * 360) / (details.averageDebitBalance * details.totalDebitDays);

    return estimatedRate;
  }

  /**
   * Create empty details object
   */
  private emptyDetails(): InterestCalculationDetails {
    return {
      dailyBalances: [],
      totalDebitDays: 0,
      averageDebitBalance: 0,
      appliedRate: 0,
      theoreticalRate: 0,
    };
  }

  /**
   * Create anomaly from analysis
   */
  private createAnomaly(analysis: InterestAnalysis): Anomaly {
    return {
      id: uuidv4(),
      type: AnomalyType.INTEREST_ERROR,
      severity: this.calculateSeverity(analysis.difference),
      confidence: 0.9,
      amount: analysis.difference,
      transactions: [analysis.transaction],
      evidence: this.generateEvidence(analysis),
      recommendation: this.generateRecommendation(analysis),
      status: 'pending',
      detectedAt: new Date(),
    };
  }

  /**
   * Calculate severity
   */
  private calculateSeverity(difference: number): Severity {
    if (difference > 10000) return Severity.CRITICAL;
    if (difference > 5000) return Severity.HIGH;
    if (difference > 1000) return Severity.MEDIUM;
    return Severity.LOW;
  }

  /**
   * Generate evidence
   */
  private generateEvidence(analysis: InterestAnalysis): Evidence[] {
    const evidence: Evidence[] = [];

    if (analysis.period) {
      evidence.push({
        type: 'CALCULATION_PERIOD',
        description: 'Période de calcul',
        value: `${analysis.period.startDate.toLocaleDateString('fr-FR')} - ${analysis.period.endDate.toLocaleDateString('fr-FR')}`,
      });

      evidence.push({
        type: 'DEBIT_DAYS',
        description: 'Jours en débit',
        value: `${analysis.details.totalDebitDays} jours`,
      });
    }

    evidence.push({
      type: 'AMOUNT_COMPARISON',
      description: 'Comparaison des montants',
      value: `Facturé: ${Math.round(analysis.chargedAmount).toLocaleString('fr-FR')} FCFA, Théorique: ${Math.round(analysis.theoreticalAmount).toLocaleString('fr-FR')} FCFA`,
    });

    evidence.push({
      type: 'DIFFERENCE',
      description: 'Écart constaté',
      value: `${Math.round(analysis.difference).toLocaleString('fr-FR')} FCFA`,
    });

    if (analysis.details.theoreticalRate > 0) {
      evidence.push({
        type: 'RATE_COMPARISON',
        description: 'Taux appliqué vs contractuel',
        value: `${(analysis.details.appliedRate * 100).toFixed(2)}% vs ${(analysis.details.theoreticalRate * 100).toFixed(2)}%`,
      });
    }

    if (analysis.reason) {
      evidence.push({
        type: 'REASON',
        description: 'Cause probable',
        value: analysis.reason,
      });
    }

    return evidence;
  }

  /**
   * Generate recommendation
   */
  private generateRecommendation(analysis: InterestAnalysis): string {
    const charged = Math.round(analysis.chargedAmount).toLocaleString('fr-FR');
    const theoretical = Math.round(analysis.theoreticalAmount).toLocaleString('fr-FR');
    const difference = Math.round(analysis.difference).toLocaleString('fr-FR');

    return (
      `Erreur de calcul d'intérêts détectée. Montant facturé: ${charged} FCFA, ` +
      `montant théorique: ${theoretical} FCFA. ` +
      `Réclamer la correction et le remboursement de ${difference} FCFA. ` +
      `Demander le détail du calcul jour par jour à la banque.`
    );
  }
}
