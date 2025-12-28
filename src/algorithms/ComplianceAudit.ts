import { v4 as uuidv4 } from 'uuid';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  BankConditions,
  FeeSchedule,
} from '../types';

/**
 * Configuration pour l'audit de conformité contractuelle
 */
interface ComplianceConfig {
  // Tolérance sur les frais (pourcentage)
  feeTolerance: number;
  // Tolérance sur les taux d'intérêt (points de base)
  rateTolerance: number;
  // Vérifier les plafonds
  checkLimits: boolean;
}

const DEFAULT_CONFIG: ComplianceConfig = {
  feeTolerance: 0.02, // 2%
  rateTolerance: 10, // 10 points de base
  checkLimits: true,
};

/**
 * ComplianceAudit - Audit de conformité contractuelle
 *
 * Compare les frais appliqués aux conditions contractuelles:
 * - Vérification des barèmes de frais
 * - Contrôle des taux d'intérêt
 * - Détection des frais non prévus au contrat
 * - Vérification des plafonds
 */
export class ComplianceAudit {
  private config: ComplianceConfig;
  private bankConditions: BankConditions;

  constructor(bankConditions: BankConditions, config?: Partial<ComplianceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bankConditions = bankConditions;
  }

  /**
   * Analyser la conformité des transactions aux conditions bancaires
   */
  analyze(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Filtrer les transactions de type frais
    const feeTransactions = transactions.filter(t =>
      t.amount < 0 && this.isFeeTransaction(t)
    );

    for (const transaction of feeTransactions) {
      // 1. Vérifier si le frais est prévu au contrat
      const matchingFee = this.findMatchingFee(transaction);

      if (!matchingFee) {
        // Frais non reconnu dans le barème
        anomalies.push(this.createUnauthorizedFeeAnomaly(transaction));
      } else {
        // 2. Vérifier le montant
        const overcharge = this.checkFeeAmount(transaction, matchingFee);
        if (overcharge > 0) {
          anomalies.push(this.createOverchargeAnomaly(transaction, matchingFee, overcharge));
        }
      }
    }

    // 3. Vérifier les taux d'intérêt
    const interestAnomalies = this.checkInterestRates(transactions);
    anomalies.push(...interestAnomalies);

    // 4. Vérifier les plafonds
    if (this.config.checkLimits) {
      const limitAnomalies = this.checkLimits(transactions);
      anomalies.push(...limitAnomalies);
    }

    return anomalies;
  }

  /**
   * Déterminer si une transaction est un frais
   */
  private isFeeTransaction(transaction: Transaction): boolean {
    const feeKeywords = [
      'frais', 'commission', 'cotisation', 'abonnement',
      'tenue', 'gestion', 'service', 'prelevement',
      'agio', 'interet', 'penalite', 'rejet',
    ];

    const description = transaction.description.toLowerCase();
    return feeKeywords.some(keyword => description.includes(keyword));
  }

  /**
   * Trouver le frais correspondant dans les conditions bancaires
   */
  private findMatchingFee(transaction: Transaction): FeeSchedule | null {
    const description = transaction.description.toLowerCase();

    for (const fee of this.bankConditions.fees) {
      const feeName = fee.name.toLowerCase();
      if (description.includes(feeName) || feeName.includes(description.split(' ')[0])) {
        return fee;
      }
    }

    // Recherche par code si disponible
    if (transaction.reference) {
      const matchByCode = this.bankConditions.fees.find(f =>
        f.code === transaction.reference
      );
      if (matchByCode) return matchByCode;
    }

    return null;
  }

  /**
   * Vérifier le montant d'un frais par rapport au barème
   */
  private checkFeeAmount(transaction: Transaction, fee: FeeSchedule): number {
    const actualAmount = Math.abs(transaction.amount);
    let expectedAmount: number;

    switch (fee.type) {
      case 'fixed':
        expectedAmount = fee.amount;
        break;
      case 'percentage':
        // On ne peut pas calculer sans la base, utiliser le montant comme référence
        expectedAmount = fee.amount;
        break;
      case 'tiered':
        expectedAmount = fee.amount; // Simplification
        break;
      default:
        expectedAmount = fee.amount;
    }

    // Appliquer les limites
    if (fee.minAmount && expectedAmount < fee.minAmount) {
      expectedAmount = fee.minAmount;
    }
    if (fee.maxAmount && expectedAmount > fee.maxAmount) {
      expectedAmount = fee.maxAmount;
    }

    // Calculer la surcharge avec tolérance
    const tolerance = expectedAmount * this.config.feeTolerance;
    if (actualAmount > expectedAmount + tolerance) {
      return actualAmount - expectedAmount;
    }

    return 0;
  }

  /**
   * Vérifier les taux d'intérêt appliqués
   */
  private checkInterestRates(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Chercher les transactions d'intérêts
    const interestTransactions = transactions.filter(t =>
      t.description.toLowerCase().includes('interet') ||
      t.description.toLowerCase().includes('agio')
    );

    // Grouper par mois pour analyse
    const monthlyInterests = new Map<string, Transaction[]>();
    for (const t of interestTransactions) {
      const monthKey = new Date(t.date).toISOString().slice(0, 7);
      if (!monthlyInterests.has(monthKey)) {
        monthlyInterests.set(monthKey, []);
      }
      monthlyInterests.get(monthKey)!.push(t);
    }

    // Vérifier si les taux sont conformes
    const _authorizedRate = this.bankConditions.interestRates.find(r => r.type === 'authorized');
    const usureRate = this.bankConditions.creditFees?.tauxUsure;

    if (usureRate) {
      for (const [month, monthTransactions] of monthlyInterests) {
        const totalInterest = monthTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

        // Si les intérêts semblent excessifs (heuristique simple)
        // En réalité, il faudrait recalculer avec les soldes quotidiens
        if (totalInterest > 0) {
          // Marquer pour révision manuelle si montant significatif
          if (totalInterest > 50000) { // > 50k FCFA
            anomalies.push({
              id: uuidv4(),
              type: AnomalyType.COMPLIANCE_VIOLATION,
              severity: Severity.MEDIUM,
              confidence: 0.6,
              amount: totalInterest,
              transactions: monthTransactions,
              evidence: [
                {
                  type: 'INTEREST_AMOUNT',
                  description: 'Montant des intérêts',
                  value: `${totalInterest.toLocaleString('fr-FR')} FCFA`,
                },
                {
                  type: 'PERIOD',
                  description: 'Période',
                  value: month,
                },
                {
                  type: 'USURY_RATE',
                  description: 'Taux d\'usure applicable',
                  value: usureRate ? `${usureRate}%` : 'Non défini',
                },
              ],
              recommendation:
                `Vérifier le calcul des intérêts de ${totalInterest.toLocaleString('fr-FR')} FCFA ` +
                `pour ${month}. Comparer avec le taux contractuel et le taux d'usure. ` +
                `Demander le détail du calcul à la banque.`,
              status: 'pending',
              detectedAt: new Date(),
            });
          }
        }
      }
    }

    return anomalies;
  }

  /**
   * Vérifier les plafonds
   */
  private checkLimits(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Vérifier les retraits DAB
    const atmWithdrawals = transactions.filter(t =>
      t.description.toLowerCase().includes('retrait') ||
      t.description.toLowerCase().includes('dab') ||
      t.description.toLowerCase().includes('gab')
    );

    // Grouper par jour
    const dailyWithdrawals = new Map<string, number>();
    for (const t of atmWithdrawals) {
      const dateKey = new Date(t.date).toISOString().slice(0, 10);
      dailyWithdrawals.set(dateKey, (dailyWithdrawals.get(dateKey) || 0) + Math.abs(t.amount));
    }

    // Vérifier les plafonds carte
    const cards = this.bankConditions.cardFees?.cartes || [];
    const maxDailyWithdrawal = Math.max(...cards.map(c => c.plafondRetrait), 500000);

    for (const [date, total] of dailyWithdrawals) {
      if (total > maxDailyWithdrawal) {
        const dayTransactions = atmWithdrawals.filter(t =>
          new Date(t.date).toISOString().slice(0, 10) === date
        );

        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.COMPLIANCE_VIOLATION,
          severity: Severity.MEDIUM,
          confidence: 0.85,
          amount: total - maxDailyWithdrawal,
          transactions: dayTransactions,
          evidence: [
            {
              type: 'DAILY_TOTAL',
              description: 'Total retraits du jour',
              value: `${total.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'LIMIT',
              description: 'Plafond journalier',
              value: `${maxDailyWithdrawal.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'EXCESS',
              description: 'Dépassement',
              value: `${(total - maxDailyWithdrawal).toLocaleString('fr-FR')} FCFA`,
            },
          ],
          recommendation:
            `Dépassement du plafond de retrait le ${date}: ` +
            `${total.toLocaleString('fr-FR')} FCFA retirés vs plafond de ` +
            `${maxDailyWithdrawal.toLocaleString('fr-FR')} FCFA. ` +
            `Vérifier les autorisations et les frais éventuels de dépassement.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Créer une anomalie pour frais non autorisé
   */
  private createUnauthorizedFeeAnomaly(transaction: Transaction): Anomaly {
    return {
      id: uuidv4(),
      type: AnomalyType.COMPLIANCE_VIOLATION,
      severity: Severity.HIGH,
      confidence: 0.8,
      amount: Math.abs(transaction.amount),
      transactions: [transaction],
      evidence: [
        {
          type: 'FEE_TYPE',
          description: 'Type de frais',
          value: 'Non référencé dans le barème',
        },
        {
          type: 'FEE_DESCRIPTION',
          description: 'Libellé',
          value: transaction.description,
        },
        {
          type: 'FEE_AMOUNT',
          description: 'Montant prélevé',
          value: `${Math.abs(transaction.amount).toLocaleString('fr-FR')} FCFA`,
        },
      ],
      recommendation:
        `Frais de ${Math.abs(transaction.amount).toLocaleString('fr-FR')} FCFA non prévu dans ` +
        `les conditions tarifaires: "${transaction.description}". ` +
        `Demander la justification ou le remboursement de ce frais.`,
      status: 'pending',
      detectedAt: new Date(),
    };
  }

  /**
   * Créer une anomalie pour surfacturation
   */
  private createOverchargeAnomaly(
    transaction: Transaction,
    fee: FeeSchedule,
    overcharge: number
  ): Anomaly {
    return {
      id: uuidv4(),
      type: AnomalyType.COMPLIANCE_VIOLATION,
      severity: overcharge > 5000 ? Severity.HIGH : Severity.MEDIUM,
      confidence: 0.9,
      amount: overcharge,
      transactions: [transaction],
      evidence: [
        {
          type: 'FEE_NAME',
          description: 'Frais concerné',
          value: fee.name,
        },
        {
          type: 'EXPECTED_AMOUNT',
          description: 'Montant attendu',
          value: `${fee.amount.toLocaleString('fr-FR')} FCFA`,
        },
        {
          type: 'ACTUAL_AMOUNT',
          description: 'Montant prélevé',
          value: `${Math.abs(transaction.amount).toLocaleString('fr-FR')} FCFA`,
        },
        {
          type: 'OVERCHARGE',
          description: 'Surfacturation',
          value: `${overcharge.toLocaleString('fr-FR')} FCFA`,
        },
      ],
      recommendation:
        `Surfacturation de ${overcharge.toLocaleString('fr-FR')} FCFA sur "${fee.name}". ` +
        `Montant contractuel: ${fee.amount.toLocaleString('fr-FR')} FCFA, ` +
        `montant prélevé: ${Math.abs(transaction.amount).toLocaleString('fr-FR')} FCFA. ` +
        `Demander le remboursement de la différence.`,
      status: 'pending',
      detectedAt: new Date(),
    };
  }
}
