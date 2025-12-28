import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  BankConditions,
} from '../types';

/**
 * Configuration pour l'audit des frais de tenue de compte
 */
interface AccountFeesConfig {
  // Tolérance sur les frais (pourcentage)
  feeTolerance: number;
  // Vérifier la fréquence des prélèvements
  checkFrequency: boolean;
  // Période attendue entre les frais (jours)
  expectedPeriod: number;
}

const DEFAULT_CONFIG: AccountFeesConfig = {
  feeTolerance: 0.05, // 5%
  checkFrequency: true,
  expectedPeriod: 30, // mensuel
};

/**
 * AccountFeesAudit - Audit des frais de tenue de compte
 *
 * Ce module analyse les frais liés à la gestion du compte:
 * - Frais de tenue de compte
 * - Abonnements et cotisations
 * - Frais de gestion
 * - Frais de clôture/ouverture
 * - Frais de relevés et courriers
 */
export class AccountFeesAudit {
  private config: AccountFeesConfig;
  private bankConditions?: BankConditions;

  constructor(config?: Partial<AccountFeesConfig>, bankConditions?: BankConditions) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bankConditions = bankConditions;
  }

  /**
   * Analyser les frais de tenue de compte
   */
  analyze(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Filtrer les transactions de frais de compte
    const accountFees = transactions.filter(t => this.isAccountFee(t));

    if (accountFees.length === 0) return anomalies;

    // 1. Vérifier les montants par rapport aux conditions contractuelles
    if (this.bankConditions) {
      anomalies.push(...this.checkAgainstContract(accountFees));
    }

    // 2. Détecter les frais en double
    anomalies.push(...this.detectDuplicateFees(accountFees));

    // 3. Vérifier la fréquence des prélèvements
    if (this.config.checkFrequency) {
      anomalies.push(...this.checkFeeFrequency(accountFees));
    }

    // 4. Détecter les augmentations non justifiées
    anomalies.push(...this.detectFeeIncreases(accountFees));

    // 5. Vérifier les frais inhabituels
    anomalies.push(...this.detectUnusualFees(accountFees));

    return anomalies;
  }

  /**
   * Identifier si une transaction est un frais de compte
   */
  private isAccountFee(transaction: Transaction): boolean {
    const keywords = [
      'tenue de compte', 'tenue compte', 'frais gestion',
      'cotisation', 'abonnement', 'frais mensuels',
      'frais trimestriels', 'frais annuels',
      'frais de releve', 'frais courrier',
      'frais dossier', 'frais ouverture', 'frais cloture',
      'commission de compte', 'maintenance compte',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Vérifier les frais par rapport au contrat
   */
  private checkAgainstContract(fees: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    if (!this.bankConditions?.accountFees) return anomalies;

    const contractFees = this.bankConditions.accountFees;

    for (const fee of fees) {
      const desc = fee.description.toLowerCase();
      const amount = Math.abs(fee.amount);

      // Vérifier les frais de tenue de compte
      if (desc.includes('tenue') && contractFees.tenueCompte) {
        const expected = contractFees.tenueCompte;
        const tolerance = expected * this.config.feeTolerance;

        if (amount > expected + tolerance) {
          anomalies.push(this.createOverchargeAnomaly(
            fee,
            'Frais de tenue de compte',
            expected,
            amount
          ));
        }
      }

      // Vérifier les frais de relevés
      if (desc.includes('releve') && contractFees.fraisReleve) {
        const expected = contractFees.fraisReleve;
        const tolerance = expected * this.config.feeTolerance;

        if (amount > expected + tolerance) {
          anomalies.push(this.createOverchargeAnomaly(
            fee,
            'Frais de relevé',
            expected,
            amount
          ));
        }
      }
    }

    return anomalies;
  }

  /**
   * Détecter les frais prélevés en double
   */
  private detectDuplicateFees(fees: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const monthlyFees = new Map<string, Transaction[]>();

    // Grouper par mois et type
    for (const fee of fees) {
      const monthKey = format(new Date(fee.date), 'yyyy-MM');
      const feeType = this.extractFeeType(fee.description);
      const key = `${monthKey}-${feeType}`;

      if (!monthlyFees.has(key)) {
        monthlyFees.set(key, []);
      }
      monthlyFees.get(key)!.push(fee);
    }

    // Détecter les doublons
    for (const [key, transactions] of monthlyFees) {
      if (transactions.length > 1) {
        const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const [, feeType] = key.split('-');

        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.DUPLICATE_FEE,
          severity: Severity.HIGH,
          confidence: 0.9,
          amount: total - Math.abs(transactions[0].amount), // Montant en trop
          transactions,
          evidence: [
            {
              type: 'FEE_TYPE',
              description: 'Type de frais',
              value: feeType,
            },
            {
              type: 'COUNT',
              description: 'Nombre de prélèvements',
              value: transactions.length,
            },
            {
              type: 'TOTAL',
              description: 'Montant total prélevé',
              value: `${total.toLocaleString('fr-FR')} FCFA`,
            },
          ],
          recommendation:
            `Frais "${feeType}" prélevé ${transactions.length} fois ce mois. ` +
            `Total: ${total.toLocaleString('fr-FR')} FCFA. ` +
            `Demander le remboursement des doublons.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Vérifier la fréquence des frais
   */
  private checkFeeFrequency(fees: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const feesByType = new Map<string, Transaction[]>();

    // Grouper par type
    for (const fee of fees) {
      const feeType = this.extractFeeType(fee.description);
      if (!feesByType.has(feeType)) {
        feesByType.set(feeType, []);
      }
      feesByType.get(feeType)!.push(fee);
    }

    // Analyser la fréquence pour chaque type
    for (const [feeType, typeFees] of feesByType) {
      if (typeFees.length < 2) continue;

      // Trier par date
      const sorted = typeFees.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Calculer les intervalles
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const days = Math.round(
          (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) /
          (1000 * 60 * 60 * 24)
        );
        intervals.push(days);
      }

      // Détecter les intervalles anormalement courts
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const shortIntervals = intervals.filter(i => i < this.config.expectedPeriod * 0.7);

      if (shortIntervals.length > 0) {
        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.FEE_ANOMALY,
          severity: Severity.MEDIUM,
          confidence: 0.75,
          amount: typeFees.reduce((sum, t) => sum + Math.abs(t.amount), 0),
          transactions: sorted,
          evidence: [
            {
              type: 'FEE_TYPE',
              description: 'Type de frais',
              value: feeType,
            },
            {
              type: 'AVG_INTERVAL',
              description: 'Intervalle moyen',
              value: `${Math.round(avgInterval)} jours`,
            },
            {
              type: 'EXPECTED',
              description: 'Intervalle attendu',
              value: `${this.config.expectedPeriod} jours`,
            },
          ],
          recommendation:
            `Frais "${feeType}" prélevé plus fréquemment que prévu. ` +
            `Intervalle moyen: ${Math.round(avgInterval)} jours vs ${this.config.expectedPeriod} attendus. ` +
            `Vérifier la périodicité contractuelle.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Détecter les augmentations de frais
   */
  private detectFeeIncreases(fees: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const feesByType = new Map<string, Transaction[]>();

    for (const fee of fees) {
      const feeType = this.extractFeeType(fee.description);
      if (!feesByType.has(feeType)) {
        feesByType.set(feeType, []);
      }
      feesByType.get(feeType)!.push(fee);
    }

    for (const [feeType, typeFees] of feesByType) {
      if (typeFees.length < 3) continue;

      const sorted = typeFees.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const amounts = sorted.map(t => Math.abs(t.amount));
      const firstAmount = amounts[0];
      const lastAmount = amounts[amounts.length - 1];

      // Détecter augmentation > 10%
      if (lastAmount > firstAmount * 1.1) {
        const increase = ((lastAmount - firstAmount) / firstAmount) * 100;

        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.FEE_ANOMALY,
          severity: increase > 25 ? Severity.HIGH : Severity.MEDIUM,
          confidence: 0.8,
          amount: lastAmount - firstAmount,
          transactions: [sorted[0], sorted[sorted.length - 1]],
          evidence: [
            {
              type: 'FEE_TYPE',
              description: 'Type de frais',
              value: feeType,
            },
            {
              type: 'INITIAL_AMOUNT',
              description: 'Montant initial',
              value: `${firstAmount.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'CURRENT_AMOUNT',
              description: 'Montant actuel',
              value: `${lastAmount.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'INCREASE',
              description: 'Augmentation',
              value: `+${increase.toFixed(1)}%`,
            },
          ],
          recommendation:
            `Augmentation de ${increase.toFixed(1)}% des frais "${feeType}". ` +
            `De ${firstAmount.toLocaleString('fr-FR')} à ${lastAmount.toLocaleString('fr-FR')} FCFA. ` +
            `Vérifier si l'augmentation est justifiée par le contrat.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Détecter les frais inhabituels
   */
  private detectUnusualFees(fees: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Calculer la moyenne et l'écart-type
    const amounts = fees.map(f => Math.abs(f.amount));
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length
    );

    // Détecter les frais > 2 écarts-types
    const threshold = mean + 2 * stdDev;

    for (const fee of fees) {
      const amount = Math.abs(fee.amount);
      if (amount > threshold) {
        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.FEE_ANOMALY,
          severity: Severity.MEDIUM,
          confidence: 0.7,
          amount,
          transactions: [fee],
          evidence: [
            {
              type: 'AMOUNT',
              description: 'Montant',
              value: `${amount.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'AVERAGE',
              description: 'Moyenne des frais',
              value: `${mean.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'MULTIPLIER',
              description: 'Fois la moyenne',
              value: `${(amount / mean).toFixed(1)}x`,
            },
          ],
          recommendation:
            `Frais inhabituellement élevé de ${amount.toLocaleString('fr-FR')} FCFA ` +
            `(${(amount / mean).toFixed(1)}x la moyenne). ` +
            `Libellé: "${fee.description}". Demander une justification.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Extraire le type de frais du libellé
   */
  private extractFeeType(description: string): string {
    const desc = description.toLowerCase();

    if (desc.includes('tenue')) return 'Tenue de compte';
    if (desc.includes('cotisation')) return 'Cotisation';
    if (desc.includes('abonnement')) return 'Abonnement';
    if (desc.includes('releve')) return 'Frais de relevé';
    if (desc.includes('courrier')) return 'Frais de courrier';
    if (desc.includes('gestion')) return 'Frais de gestion';

    return 'Frais divers';
  }

  /**
   * Créer une anomalie de surfacturation
   */
  private createOverchargeAnomaly(
    transaction: Transaction,
    feeType: string,
    expected: number,
    actual: number
  ): Anomaly {
    return {
      id: uuidv4(),
      type: AnomalyType.OVERCHARGE,
      severity: actual > expected * 1.5 ? Severity.HIGH : Severity.MEDIUM,
      confidence: 0.9,
      amount: actual - expected,
      transactions: [transaction],
      evidence: [
        {
          type: 'FEE_TYPE',
          description: 'Type de frais',
          value: feeType,
        },
        {
          type: 'EXPECTED',
          description: 'Montant contractuel',
          value: `${expected.toLocaleString('fr-FR')} FCFA`,
        },
        {
          type: 'ACTUAL',
          description: 'Montant prélevé',
          value: `${actual.toLocaleString('fr-FR')} FCFA`,
        },
        {
          type: 'OVERCHARGE',
          description: 'Surfacturation',
          value: `${(actual - expected).toLocaleString('fr-FR')} FCFA`,
        },
      ],
      recommendation:
        `Surfacturation de ${(actual - expected).toLocaleString('fr-FR')} FCFA sur "${feeType}". ` +
        `Montant contractuel: ${expected.toLocaleString('fr-FR')} FCFA, ` +
        `montant prélevé: ${actual.toLocaleString('fr-FR')} FCFA. ` +
        `Demander le remboursement.`,
      status: 'pending',
      detectedAt: new Date(),
    };
  }
}
