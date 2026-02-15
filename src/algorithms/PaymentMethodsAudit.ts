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
 * Configuration pour l'audit des moyens de paiement
 */
interface PaymentMethodsConfig {
  // Tolérance sur les frais (pourcentage)
  feeTolerance: number;
  // Seuil pour frais de virement élevés
  highTransferFeeThreshold: number;
  // Vérifier les frais de chéquier
  checkChequebookFees: boolean;
  // Vérifier les frais d'effets de commerce
  checkBillOfExchangeFees: boolean;
}

const DEFAULT_CONFIG: PaymentMethodsConfig = {
  feeTolerance: 0.05,
  highTransferFeeThreshold: 5000, // FCFA
  checkChequebookFees: true,
  checkBillOfExchangeFees: true,
};

/**
 * PaymentMethodsAudit - Audit des moyens de paiement
 *
 * Ce module analyse les frais liés aux moyens de paiement:
 * - Chèques: frais de chéquier, opposition, impayés, certification
 * - Effets de commerce: escompte, encaissement, impayés
 * - Virements: frais SEPA, hors zone, instantanés
 * - Prélèvements: rejets, mandats
 */
export class PaymentMethodsAudit {
  private config: PaymentMethodsConfig;
  private bankConditions?: BankConditions;

  constructor(config?: Partial<PaymentMethodsConfig>, bankConditions?: BankConditions) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bankConditions = bankConditions;
  }

  /**
   * Analyser les frais de moyens de paiement
   */
  analyze(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // 1. Analyser les frais de chèques
    if (this.config.checkChequebookFees) {
      anomalies.push(...this.analyzeCheckFees(transactions));
    }

    // 2. Analyser les effets de commerce
    if (this.config.checkBillOfExchangeFees) {
      anomalies.push(...this.analyzeBillOfExchangeFees(transactions));
    }

    // 3. Analyser les frais de virements
    anomalies.push(...this.analyzeTransferFees(transactions));

    // 4. Analyser les prélèvements et rejets
    anomalies.push(...this.analyzeDirectDebitFees(transactions));

    // 5. Détecter les frais en double
    anomalies.push(...this.detectDuplicatePaymentFees(transactions));

    return anomalies;
  }

  /**
   * Analyser les frais liés aux chèques
   */
  private analyzeCheckFees(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const checkFees = transactions.filter(t => this.isCheckFee(t));

    // Vérifier les frais de chéquier
    const chequebookFees = checkFees.filter(t =>
      t.description.toLowerCase().includes('chequier') ||
      t.description.toLowerCase().includes('carnet de cheque')
    );

    for (const fee of chequebookFees) {
      const amount = Math.abs(fee.amount);

      if (this.bankConditions?.checkFees?.chequebook) {
        const expected = this.bankConditions.checkFees.chequebook;
        const tolerance = expected * this.config.feeTolerance;

        if (amount > expected + tolerance) {
          anomalies.push(this.createOverchargeAnomaly(
            fee,
            'Frais de chéquier',
            expected,
            amount
          ));
        }
      }
    }

    // Vérifier les frais d'opposition
    const oppositionFees = checkFees.filter(t =>
      t.description.toLowerCase().includes('opposition cheque')
    );

    for (const fee of oppositionFees) {
      const amount = Math.abs(fee.amount);

      if (this.bankConditions?.checkFees?.opposition) {
        const expected = this.bankConditions.checkFees.opposition;
        const tolerance = expected * this.config.feeTolerance;

        if (amount > expected + tolerance) {
          anomalies.push(this.createOverchargeAnomaly(
            fee,
            'Opposition chèque',
            expected,
            amount
          ));
        }
      }
    }

    // Analyser les chèques impayés
    const unpaidChecks = checkFees.filter(t =>
      t.description.toLowerCase().includes('impaye') ||
      t.description.toLowerCase().includes('rejete')
    );

    if (unpaidChecks.length > 0) {
      const _totalUnpaidFees = unpaidChecks.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      // Regrouper par mois
      const monthlyUnpaid = new Map<string, Transaction[]>();
      for (const check of unpaidChecks) {
        const month = format(new Date(check.date), 'yyyy-MM');
        if (!monthlyUnpaid.has(month)) {
          monthlyUnpaid.set(month, []);
        }
        monthlyUnpaid.get(month)!.push(check);
      }

      // Alerter si plusieurs impayés dans le même mois
      for (const [month, checks] of monthlyUnpaid) {
        if (checks.length >= 2) {
          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.FEE_ANOMALY,
            severity: Severity.HIGH,
            confidence: 0.85,
            amount: checks.reduce((sum, t) => sum + Math.abs(t.amount), 0),
            transactions: checks,
            evidence: [
              {
                type: 'MONTH',
                description: 'Mois concerné',
                value: month,
              },
              {
                type: 'COUNT',
                description: 'Nombre de chèques impayés',
                value: checks.length,
              },
              {
                type: 'TOTAL_FEES',
                description: 'Total des frais',
                value: `${checks.reduce((sum, t) => sum + Math.abs(t.amount), 0).toLocaleString('fr-FR')} FCFA`,
              },
            ],
            recommendation:
              `${checks.length} chèques impayés détectés en ${month}. ` +
              `Total des frais: ${checks.reduce((sum, t) => sum + Math.abs(t.amount), 0).toLocaleString('fr-FR')} FCFA. ` +
              `Vérifier les causes récurrentes et négocier les frais si motifs bancaires.`,
            status: 'pending',
            detectedAt: new Date(),
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Analyser les frais d'effets de commerce
   */
  private analyzeBillOfExchangeFees(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const billFees = transactions.filter(t => this.isBillOfExchangeFee(t));

    if (billFees.length === 0) return anomalies;

    // Frais d'escompte
    const discountFees = billFees.filter(t =>
      t.description.toLowerCase().includes('escompte')
    );

    // Analyser le taux d'escompte implicite
    if (discountFees.length >= 3) {
      const amounts = discountFees.map(t => Math.abs(t.amount));
      const avgFee = amounts.reduce((a, b) => a + b, 0) / amounts.length;

      // Détecter les frais anormalement élevés
      for (const fee of discountFees) {
        const amount = Math.abs(fee.amount);
        if (amount > avgFee * 2) {
          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.FEE_ANOMALY,
            severity: Severity.MEDIUM,
            confidence: 0.75,
            amount: amount - avgFee,
            transactions: [fee],
            evidence: [
              {
                type: 'AMOUNT',
                description: 'Frais prélevé',
                value: `${amount.toLocaleString('fr-FR')} FCFA`,
              },
              {
                type: 'AVERAGE',
                description: 'Frais moyen escompte',
                value: `${avgFee.toLocaleString('fr-FR')} FCFA`,
              },
              {
                type: 'RATIO',
                description: 'Ratio vs moyenne',
                value: `${(amount / avgFee).toFixed(1)}x`,
              },
            ],
            recommendation:
              `Frais d'escompte anormalement élevé: ${amount.toLocaleString('fr-FR')} FCFA ` +
              `(${(amount / avgFee).toFixed(1)}x la moyenne). ` +
              `Vérifier le calcul des agios et le taux appliqué.`,
            status: 'pending',
            detectedAt: new Date(),
          });
        }
      }
    }

    // Effets impayés
    const unpaidBills = billFees.filter(t =>
      t.description.toLowerCase().includes('effet impaye') ||
      t.description.toLowerCase().includes('effet rejete')
    );

    if (unpaidBills.length > 0 && this.bankConditions?.billOfExchangeFees?.unpaid) {
      for (const bill of unpaidBills) {
        const amount = Math.abs(bill.amount);
        const expected = this.bankConditions.billOfExchangeFees.unpaid;

        if (amount > expected * (1 + this.config.feeTolerance)) {
          anomalies.push(this.createOverchargeAnomaly(
            bill,
            'Effet impayé',
            expected,
            amount
          ));
        }
      }
    }

    return anomalies;
  }

  /**
   * Analyser les frais de virements
   */
  private analyzeTransferFees(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const transferFees = transactions.filter(t => this.isTransferFee(t));

    if (transferFees.length === 0) return anomalies;

    // Catégoriser les virements
    const domesticTransfers = transferFees.filter(t => this.isDomesticTransfer(t));
    const _internationalTransfers = transferFees.filter(t => this.isInternationalTransfer(t));

    // Analyser les virements domestiques
    if (domesticTransfers.length > 0 && this.bankConditions?.transferFees?.domestic) {
      for (const transfer of domesticTransfers) {
        const amount = Math.abs(transfer.amount);
        const expected = this.bankConditions.transferFees.domestic;

        if (amount > expected * (1 + this.config.feeTolerance)) {
          anomalies.push(this.createOverchargeAnomaly(
            transfer,
            'Virement national',
            expected,
            amount
          ));
        }
      }
    }

    // Détecter les frais de virement élevés
    for (const fee of transferFees) {
      const amount = Math.abs(fee.amount);
      if (amount > this.config.highTransferFeeThreshold) {
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
              description: 'Frais de virement',
              value: `${amount.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'THRESHOLD',
              description: 'Seuil d\'alerte',
              value: `${this.config.highTransferFeeThreshold.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'DESCRIPTION',
              description: 'Libellé',
              value: fee.description,
            },
          ],
          recommendation:
            `Frais de virement élevé: ${amount.toLocaleString('fr-FR')} FCFA. ` +
            `Vérifier si les conditions tarifaires sont respectées et si une ` +
            `offre groupée pourrait réduire ces frais.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    // Analyser la fréquence des virements
    const monthlyTransfers = new Map<string, Transaction[]>();
    for (const transfer of transferFees) {
      const month = format(new Date(transfer.date), 'yyyy-MM');
      if (!monthlyTransfers.has(month)) {
        monthlyTransfers.set(month, []);
      }
      monthlyTransfers.get(month)!.push(transfer);
    }

    // Identifier les mois avec beaucoup de frais de virements
    for (const [month, transfers] of monthlyTransfers) {
      if (transfers.length > 20) {
        const totalFees = transfers.reduce((sum, t) => sum + Math.abs(t.amount), 0);

        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.FEE_ANOMALY,
          severity: Severity.LOW,
          confidence: 0.65,
          amount: totalFees,
          transactions: transfers.slice(0, 5), // Premiers 5 exemples
          evidence: [
            {
              type: 'MONTH',
              description: 'Mois concerné',
              value: month,
            },
            {
              type: 'COUNT',
              description: 'Nombre de virements',
              value: transfers.length,
            },
            {
              type: 'TOTAL_FEES',
              description: 'Total des frais',
              value: `${totalFees.toLocaleString('fr-FR')} FCFA`,
            },
          ],
          recommendation:
            `Volume élevé de virements en ${month}: ${transfers.length} opérations ` +
            `pour ${totalFees.toLocaleString('fr-FR')} FCFA de frais. ` +
            `Envisager un forfait virements ou une renégociation tarifaire.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Analyser les frais de prélèvements et rejets
   */
  private analyzeDirectDebitFees(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const debitFees = transactions.filter(t => this.isDirectDebitFee(t));

    if (debitFees.length === 0) return anomalies;

    // Rejets de prélèvements
    const rejections = debitFees.filter(t =>
      t.description.toLowerCase().includes('rejet') ||
      t.description.toLowerCase().includes('prelevement refuse')
    );

    if (rejections.length > 0) {
      // Regrouper par mois
      const monthlyRejections = new Map<string, Transaction[]>();
      for (const rejection of rejections) {
        const month = format(new Date(rejection.date), 'yyyy-MM');
        if (!monthlyRejections.has(month)) {
          monthlyRejections.set(month, []);
        }
        monthlyRejections.get(month)!.push(rejection);
      }

      for (const [month, monthRejections] of monthlyRejections) {
        if (monthRejections.length >= 2) {
          const totalFees = monthRejections.reduce((sum, t) => sum + Math.abs(t.amount), 0);

          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.FEE_ANOMALY,
            severity: Severity.MEDIUM,
            confidence: 0.8,
            amount: totalFees,
            transactions: monthRejections,
            evidence: [
              {
                type: 'MONTH',
                description: 'Mois concerné',
                value: month,
              },
              {
                type: 'COUNT',
                description: 'Nombre de rejets',
                value: monthRejections.length,
              },
              {
                type: 'TOTAL_FEES',
                description: 'Total des frais',
                value: `${totalFees.toLocaleString('fr-FR')} FCFA`,
              },
            ],
            recommendation:
              `${monthRejections.length} rejets de prélèvements en ${month}. ` +
              `Frais totaux: ${totalFees.toLocaleString('fr-FR')} FCFA. ` +
              `Vérifier la gestion de trésorerie et les dates de prélèvement.`,
            status: 'pending',
            detectedAt: new Date(),
          });
        }
      }
    }

    // Frais de mise en place de mandats
    const mandateFees = debitFees.filter(t =>
      t.description.toLowerCase().includes('mandat') ||
      t.description.toLowerCase().includes('autorisation prelevement')
    );

    if (mandateFees.length > 0 && this.bankConditions?.directDebitFees?.mandate) {
      for (const fee of mandateFees) {
        const amount = Math.abs(fee.amount);
        const expected = this.bankConditions.directDebitFees.mandate;

        if (amount > expected * (1 + this.config.feeTolerance)) {
          anomalies.push(this.createOverchargeAnomaly(
            fee,
            'Frais de mandat de prélèvement',
            expected,
            amount
          ));
        }
      }
    }

    return anomalies;
  }

  /**
   * Détecter les frais de paiement en double
   */
  private detectDuplicatePaymentFees(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const paymentFees = transactions.filter(t =>
      this.isCheckFee(t) || this.isTransferFee(t) || this.isDirectDebitFee(t)
    );

    const dailyFees = new Map<string, Transaction[]>();

    for (const fee of paymentFees) {
      const dateKey = format(new Date(fee.date), 'yyyy-MM-dd');
      const amount = Math.abs(fee.amount);
      const key = `${dateKey}-${amount}`;

      if (!dailyFees.has(key)) {
        dailyFees.set(key, []);
      }
      dailyFees.get(key)!.push(fee);
    }

    for (const [, fees] of dailyFees) {
      if (fees.length > 1) {
        // Vérifier si les libellés sont similaires
        const desc1 = fees[0].description.toLowerCase();
        const similarFees = fees.filter(f =>
          this.calculateSimilarity(f.description.toLowerCase(), desc1) > 0.7
        );

        if (similarFees.length > 1) {
          const totalAmount = similarFees.reduce((sum, f) => sum + Math.abs(f.amount), 0);
          const duplicateAmount = totalAmount - Math.abs(similarFees[0].amount);

          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.DUPLICATE_FEE,
            severity: Severity.HIGH,
            confidence: 0.9,
            amount: duplicateAmount,
            transactions: similarFees,
            evidence: [
              {
                type: 'DATE',
                description: 'Date',
                value: format(new Date(fees[0].date), 'dd/MM/yyyy'),
              },
              {
                type: 'COUNT',
                description: 'Nombre d\'occurrences',
                value: similarFees.length,
              },
              {
                type: 'UNIT_AMOUNT',
                description: 'Montant unitaire',
                value: `${Math.abs(fees[0].amount).toLocaleString('fr-FR')} FCFA`,
              },
              {
                type: 'DUPLICATE_AMOUNT',
                description: 'Montant en double',
                value: `${duplicateAmount.toLocaleString('fr-FR')} FCFA`,
              },
            ],
            recommendation:
              `Frais potentiellement prélevé ${similarFees.length} fois le même jour. ` +
              `Montant en double: ${duplicateAmount.toLocaleString('fr-FR')} FCFA. ` +
              `Demander une vérification et le remboursement si confirmé.`,
            status: 'pending',
            detectedAt: new Date(),
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Identifier si une transaction est un frais de chèque
   */
  private isCheckFee(transaction: Transaction): boolean {
    const keywords = [
      'cheque', 'chequier', 'chq', 'carnet de cheque',
      'opposition cheque', 'cheque impaye', 'cheque rejete',
      'certification cheque', 'cheque de banque',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier si une transaction est un frais d'effet de commerce
   */
  private isBillOfExchangeFee(transaction: Transaction): boolean {
    const keywords = [
      'effet', 'escompte', 'billet', 'traite',
      'lcr', 'lettre de change', 'encaissement effet',
      'effet impaye', 'effet rejete', 'prorogation',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier si une transaction est un frais de virement
   */
  private isTransferFee(transaction: Transaction): boolean {
    const keywords = [
      'virement', 'vir', 'transfer', 'swift',
      'frais envoi', 'frais reception', 'frais vir',
      'ordre de virement', 'virement instantane',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier un virement domestique
   */
  private isDomesticTransfer(transaction: Transaction): boolean {
    const domesticKeywords = ['national', 'local', 'interne', 'zone'];
    const internationalKeywords = ['international', 'swift', 'etranger', 'hors zone'];

    const desc = transaction.description.toLowerCase();

    // Si contient des mots internationaux, ce n'est pas domestique
    if (internationalKeywords.some(kw => desc.includes(kw))) return false;

    // Si contient des mots domestiques, c'est domestique
    if (domesticKeywords.some(kw => desc.includes(kw))) return true;

    // Par défaut, considérer comme domestique
    return true;
  }

  /**
   * Identifier un virement international
   */
  private isInternationalTransfer(transaction: Transaction): boolean {
    const keywords = ['international', 'swift', 'etranger', 'hors zone', 'devises'];
    const desc = transaction.description.toLowerCase();
    return keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier si une transaction est un frais de prélèvement
   */
  private isDirectDebitFee(transaction: Transaction): boolean {
    const keywords = [
      'prelevement', 'prelev', 'prlv',
      'rejet prelevement', 'mandat', 'autorisation prelevement',
      'tip', 'sdd', 'sepa direct debit',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Calculer la similarité entre deux chaînes (Jaccard simplifié)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
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
