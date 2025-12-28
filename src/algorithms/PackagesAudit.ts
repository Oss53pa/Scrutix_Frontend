import { v4 as uuidv4 } from 'uuid';
import { format, differenceInMonths } from 'date-fns';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  BankConditions,
} from '../types';

/**
 * Configuration pour l'audit des packages et assurances
 */
interface PackagesConfig {
  // Tolérance sur les frais (pourcentage)
  feeTolerance: number;
  // Seuil d'augmentation significative
  significantIncreaseThreshold: number;
  // Vérifier les assurances
  checkInsurance: boolean;
  // Vérifier les packages
  checkPackages: boolean;
}

const DEFAULT_CONFIG: PackagesConfig = {
  feeTolerance: 0.05,
  significantIncreaseThreshold: 0.15, // 15%
  checkInsurance: true,
  checkPackages: true,
};

/**
 * PackagesAudit - Audit des packages et assurances bancaires
 *
 * Ce module analyse:
 * - Packages bancaires (forfaits tout-compris)
 * - Assurances moyens de paiement
 * - Assurances découvert
 * - Assurances comptes
 * - Garanties et protections diverses
 * - Options et services optionnels facturés
 */
export class PackagesAudit {
  private config: PackagesConfig;
  private bankConditions?: BankConditions;

  constructor(config?: Partial<PackagesConfig>, bankConditions?: BankConditions) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bankConditions = bankConditions;
  }

  /**
   * Analyser les packages et assurances
   */
  analyze(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // 1. Analyser les packages bancaires
    if (this.config.checkPackages) {
      anomalies.push(...this.analyzePackageFees(transactions));
    }

    // 2. Analyser les assurances moyens de paiement
    if (this.config.checkInsurance) {
      anomalies.push(...this.analyzePaymentInsurance(transactions));
    }

    // 3. Analyser les assurances découvert
    anomalies.push(...this.analyzeOverdraftInsurance(transactions));

    // 4. Détecter les doublons assurance/package
    anomalies.push(...this.detectInsurancePackageOverlap(transactions));

    // 5. Analyser les augmentations de cotisations
    anomalies.push(...this.analyzeContributionIncreases(transactions));

    // 6. Détecter les options non utilisées
    anomalies.push(...this.detectUnusedOptions(transactions));

    return anomalies;
  }

  /**
   * Analyser les frais de packages bancaires
   */
  private analyzePackageFees(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const packageFees = transactions.filter(t => this.isPackageFee(t));

    if (packageFees.length === 0) return anomalies;

    // Regrouper par type de package
    const packagesByType = new Map<string, Transaction[]>();

    for (const fee of packageFees) {
      const packageType = this.extractPackageType(fee.description);
      if (!packagesByType.has(packageType)) {
        packagesByType.set(packageType, []);
      }
      packagesByType.get(packageType)!.push(fee);
    }

    for (const [packageType, fees] of packagesByType) {
      // Vérifier les doublons mensuels
      const monthlyFees = new Map<string, Transaction[]>();

      for (const fee of fees) {
        const month = format(new Date(fee.date), 'yyyy-MM');
        if (!monthlyFees.has(month)) {
          monthlyFees.set(month, []);
        }
        monthlyFees.get(month)!.push(fee);
      }

      for (const [month, monthFees] of monthlyFees) {
        if (monthFees.length > 1) {
          const totalAmount = monthFees.reduce((sum, f) => sum + Math.abs(f.amount), 0);

          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.DUPLICATE_FEE,
            severity: Severity.HIGH,
            confidence: 0.9,
            amount: totalAmount - Math.abs(monthFees[0].amount),
            transactions: monthFees,
            evidence: [
              {
                type: 'PACKAGE',
                description: 'Type de package',
                value: packageType,
              },
              {
                type: 'MONTH',
                description: 'Mois concerné',
                value: month,
              },
              {
                type: 'COUNT',
                description: 'Nombre de prélèvements',
                value: monthFees.length,
              },
              {
                type: 'TOTAL',
                description: 'Total prélevé',
                value: `${totalAmount.toLocaleString('fr-FR')} FCFA`,
              },
            ],
            recommendation:
              `Package "${packageType}" prélevé ${monthFees.length} fois en ${month}. ` +
              `Total: ${totalAmount.toLocaleString('fr-FR')} FCFA. ` +
              `Demander le remboursement du/des doublon(s).`,
            status: 'pending',
            detectedAt: new Date(),
          });
        }
      }

      // Vérifier par rapport au contrat
      if (this.bankConditions?.packageFees?.[packageType]) {
        for (const fee of fees) {
          const amount = Math.abs(fee.amount);
          const expected = this.bankConditions.packageFees[packageType];

          if (amount > expected * (1 + this.config.feeTolerance)) {
            anomalies.push(this.createOverchargeAnomaly(
              fee,
              `Package ${packageType}`,
              expected,
              amount
            ));
          }
        }
      }
    }

    return anomalies;
  }

  /**
   * Analyser les assurances moyens de paiement
   */
  private analyzePaymentInsurance(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const insuranceFees = transactions.filter(t => this.isPaymentInsurance(t));

    if (insuranceFees.length === 0) return anomalies;

    // Vérifier la cohérence avec l'utilisation
    const cardOperations = transactions.filter(t =>
      t.description.toLowerCase().includes('cb') ||
      t.description.toLowerCase().includes('carte') ||
      t.description.toLowerCase().includes('paiement')
    );

    // Calculer le total des primes d'assurance
    const totalPremiums = insuranceFees.reduce((sum, f) => sum + Math.abs(f.amount), 0);

    // Si peu d'opérations par carte mais beaucoup de primes
    if (cardOperations.length < 12 && totalPremiums > 50000) { // Moins de 1 op/mois
      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.FEE_ANOMALY,
        severity: Severity.MEDIUM,
        confidence: 0.7,
        amount: totalPremiums,
        transactions: insuranceFees.slice(0, 5),
        evidence: [
          {
            type: 'PREMIUMS',
            description: 'Total des primes',
            value: `${totalPremiums.toLocaleString('fr-FR')} FCFA`,
          },
          {
            type: 'CARD_OPS',
            description: 'Opérations carte détectées',
            value: cardOperations.length.toString(),
          },
          {
            type: 'RATIO',
            description: 'Coût par opération',
            value: cardOperations.length > 0
              ? `${(totalPremiums / cardOperations.length).toLocaleString('fr-FR')} FCFA`
              : 'N/A',
          },
        ],
        recommendation:
          `Assurance moyens de paiement coûteuse: ${totalPremiums.toLocaleString('fr-FR')} FCFA ` +
          `pour ${cardOperations.length} opérations carte détectées. ` +
          `Évaluer la pertinence de cette assurance par rapport à l'utilisation réelle.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    // Vérifier les montants contractuels
    if (this.bankConditions?.insuranceFees?.paymentMeans) {
      for (const fee of insuranceFees) {
        const amount = Math.abs(fee.amount);
        const expected = this.bankConditions.insuranceFees.paymentMeans;

        if (amount > expected * (1 + this.config.feeTolerance)) {
          anomalies.push(this.createOverchargeAnomaly(
            fee,
            'Assurance moyens de paiement',
            expected,
            amount
          ));
        }
      }
    }

    return anomalies;
  }

  /**
   * Analyser les assurances découvert
   */
  private analyzeOverdraftInsurance(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const overdraftInsurance = transactions.filter(t => this.isOverdraftInsurance(t));

    if (overdraftInsurance.length === 0) return anomalies;

    // Vérifier si le compte a réellement été à découvert
    const overdraftInterests = transactions.filter(t =>
      t.description.toLowerCase().includes('interet debiteur') ||
      t.description.toLowerCase().includes('agios')
    );

    const totalPremiums = overdraftInsurance.reduce((sum, f) => sum + Math.abs(f.amount), 0);

    if (overdraftInterests.length === 0 && totalPremiums > 20000) {
      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.GHOST_FEE,
        severity: Severity.MEDIUM,
        confidence: 0.75,
        amount: totalPremiums,
        transactions: overdraftInsurance,
        evidence: [
          {
            type: 'PREMIUMS',
            description: 'Total primes assurance découvert',
            value: `${totalPremiums.toLocaleString('fr-FR')} FCFA`,
          },
          {
            type: 'OVERDRAFT_DETECTED',
            description: 'Agios/découverts détectés',
            value: '0',
          },
        ],
        recommendation:
          `Assurance découvert payée (${totalPremiums.toLocaleString('fr-FR')} FCFA) ` +
          `sans utilisation du découvert détectée. ` +
          `Si le compte reste créditeur, envisager la résiliation de cette assurance.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    return anomalies;
  }

  /**
   * Détecter les doublons entre assurance et package
   */
  private detectInsurancePackageOverlap(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const packageFees = transactions.filter(t => this.isPackageFee(t));
    const insuranceFees = transactions.filter(t =>
      this.isPaymentInsurance(t) || this.isOverdraftInsurance(t)
    );

    if (packageFees.length === 0 || insuranceFees.length === 0) return anomalies;

    // Vérifier si un package "tout-compris" existe
    const allInclusivePackage = packageFees.find(p =>
      p.description.toLowerCase().includes('tout compris') ||
      p.description.toLowerCase().includes('premium') ||
      p.description.toLowerCase().includes('integral')
    );

    if (allInclusivePackage) {
      // Le package devrait inclure les assurances
      const monthlyInsurance = new Map<string, Transaction[]>();

      for (const fee of insuranceFees) {
        const month = format(new Date(fee.date), 'yyyy-MM');
        if (!monthlyInsurance.has(month)) {
          monthlyInsurance.set(month, []);
        }
        monthlyInsurance.get(month)!.push(fee);
      }

      const packageMonth = format(new Date(allInclusivePackage.date), 'yyyy-MM');
      const sameMonthInsurance = monthlyInsurance.get(packageMonth);

      if (sameMonthInsurance && sameMonthInsurance.length > 0) {
        const totalInsurance = sameMonthInsurance.reduce((sum, f) => sum + Math.abs(f.amount), 0);

        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.DUPLICATE_FEE,
          severity: Severity.HIGH,
          confidence: 0.85,
          amount: totalInsurance,
          transactions: [allInclusivePackage, ...sameMonthInsurance],
          evidence: [
            {
              type: 'PACKAGE',
              description: 'Package souscrit',
              value: allInclusivePackage.description,
            },
            {
              type: 'PACKAGE_AMOUNT',
              description: 'Montant package',
              value: `${Math.abs(allInclusivePackage.amount).toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'INSURANCE_COUNT',
              description: 'Assurances facturées en plus',
              value: sameMonthInsurance.length.toString(),
            },
            {
              type: 'INSURANCE_TOTAL',
              description: 'Total assurances',
              value: `${totalInsurance.toLocaleString('fr-FR')} FCFA`,
            },
          ],
          recommendation:
            `Package "${allInclusivePackage.description}" et assurances facturés séparément. ` +
            `Vérifier si les assurances sont incluses dans le package. ` +
            `Potentiel doublon: ${totalInsurance.toLocaleString('fr-FR')} FCFA.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Analyser les augmentations de cotisations
   */
  private analyzeContributionIncreases(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const recurringFees = transactions.filter(t =>
      this.isPackageFee(t) || this.isPaymentInsurance(t) || this.isOverdraftInsurance(t)
    );

    if (recurringFees.length < 6) return anomalies;

    // Regrouper par type
    const feesByType = new Map<string, Transaction[]>();

    for (const fee of recurringFees) {
      const feeType = this.extractFeeType(fee.description);
      if (!feesByType.has(feeType)) {
        feesByType.set(feeType, []);
      }
      feesByType.get(feeType)!.push(fee);
    }

    for (const [feeType, fees] of feesByType) {
      if (fees.length < 3) continue;

      // Trier par date
      const sorted = fees.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const firstAmount = Math.abs(sorted[0].amount);
      const lastAmount = Math.abs(sorted[sorted.length - 1].amount);

      if (lastAmount > firstAmount * (1 + this.config.significantIncreaseThreshold)) {
        const increase = ((lastAmount - firstAmount) / firstAmount) * 100;
        const monthsSpan = differenceInMonths(
          new Date(sorted[sorted.length - 1].date),
          new Date(sorted[0].date)
        );

        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.FEE_ANOMALY,
          severity: increase > 30 ? Severity.HIGH : Severity.MEDIUM,
          confidence: 0.8,
          amount: lastAmount - firstAmount,
          transactions: [sorted[0], sorted[sorted.length - 1]],
          evidence: [
            {
              type: 'FEE_TYPE',
              description: 'Type de cotisation',
              value: feeType,
            },
            {
              type: 'INITIAL',
              description: 'Montant initial',
              value: `${firstAmount.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'CURRENT',
              description: 'Montant actuel',
              value: `${lastAmount.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'INCREASE',
              description: 'Augmentation',
              value: `+${increase.toFixed(1)}%`,
            },
            {
              type: 'PERIOD',
              description: 'Sur période',
              value: `${monthsSpan} mois`,
            },
          ],
          recommendation:
            `Augmentation de ${increase.toFixed(1)}% sur "${feeType}" en ${monthsSpan} mois. ` +
            `De ${firstAmount.toLocaleString('fr-FR')} à ${lastAmount.toLocaleString('fr-FR')} FCFA. ` +
            `Vérifier la justification et négocier si possible.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Détecter les options non utilisées
   */
  private detectUnusedOptions(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const optionFees = transactions.filter(t => this.isOptionalService(t));

    if (optionFees.length === 0) return anomalies;

    // Regrouper par type d'option
    const optionsByType = new Map<string, Transaction[]>();

    for (const fee of optionFees) {
      const optionType = this.extractOptionType(fee.description);
      if (!optionsByType.has(optionType)) {
        optionsByType.set(optionType, []);
      }
      optionsByType.get(optionType)!.push(fee);
    }

    for (const [optionType, fees] of optionsByType) {
      // Vérifier si des opérations liées existent
      const relatedOps = this.findRelatedOperations(transactions, optionType);
      const totalFees = fees.reduce((sum, f) => sum + Math.abs(f.amount), 0);

      if (relatedOps.length === 0 && fees.length >= 3) {
        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.GHOST_FEE,
          severity: Severity.MEDIUM,
          confidence: 0.7,
          amount: totalFees,
          transactions: fees,
          evidence: [
            {
              type: 'OPTION',
              description: 'Option/Service',
              value: optionType,
            },
            {
              type: 'FEE_COUNT',
              description: 'Nombre de prélèvements',
              value: fees.length.toString(),
            },
            {
              type: 'TOTAL',
              description: 'Total payé',
              value: `${totalFees.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'USAGE',
              description: 'Utilisations détectées',
              value: '0',
            },
          ],
          recommendation:
            `Option "${optionType}" facturée ${fees.length} fois ` +
            `(${totalFees.toLocaleString('fr-FR')} FCFA) sans utilisation détectée. ` +
            `Évaluer l'intérêt de cette option et envisager sa résiliation.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Identifier un frais de package
   */
  private isPackageFee(transaction: Transaction): boolean {
    const keywords = [
      'package', 'forfait', 'formule', 'offre',
      'convention', 'tout compris', 'premium', 'integral',
      'essentiel', 'confort', 'privilege',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier une assurance moyens de paiement
   */
  private isPaymentInsurance(transaction: Transaction): boolean {
    const keywords = [
      'assurance carte', 'assurance cb', 'assurance moyens paiement',
      'protection carte', 'garantie carte', 'securite carte',
      'assurance vol', 'assurance perte',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier une assurance découvert
   */
  private isOverdraftInsurance(transaction: Transaction): boolean {
    const keywords = [
      'assurance decouvert', 'protection decouvert',
      'garantie decouvert', 'assurance facilite',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier un service optionnel
   */
  private isOptionalService(transaction: Transaction): boolean {
    const keywords = [
      'option', 'service', 'abonnement', 'souscription',
      'supplement', 'additif',
    ];

    const excludeKeywords = ['package', 'forfait', 'assurance'];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 &&
      keywords.some(kw => desc.includes(kw)) &&
      !excludeKeywords.some(kw => desc.includes(kw));
  }

  /**
   * Extraire le type de package
   */
  private extractPackageType(description: string): string {
    const desc = description.toLowerCase();

    if (desc.includes('premium') || desc.includes('privilege')) return 'Premium';
    if (desc.includes('confort')) return 'Confort';
    if (desc.includes('essentiel') || desc.includes('basique')) return 'Essentiel';
    if (desc.includes('pro') || desc.includes('professionnel')) return 'Professionnel';
    if (desc.includes('tout compris') || desc.includes('integral')) return 'Tout compris';

    return 'Standard';
  }

  /**
   * Extraire le type de frais
   */
  private extractFeeType(description: string): string {
    const desc = description.toLowerCase();

    if (desc.includes('package') || desc.includes('forfait')) return 'Package bancaire';
    if (desc.includes('assurance carte')) return 'Assurance carte';
    if (desc.includes('assurance decouvert')) return 'Assurance découvert';
    if (desc.includes('assurance')) return 'Assurance';

    return 'Cotisation';
  }

  /**
   * Extraire le type d'option
   */
  private extractOptionType(description: string): string {
    const desc = description.toLowerCase();

    if (desc.includes('sms') || desc.includes('alerte')) return 'Alertes SMS';
    if (desc.includes('chequier')) return 'Chéquier';
    if (desc.includes('epargne')) return 'Option épargne';
    if (desc.includes('international')) return 'Option international';

    return 'Option diverses';
  }

  /**
   * Trouver les opérations liées à une option
   */
  private findRelatedOperations(transactions: Transaction[], optionType: string): Transaction[] {
    const related: Transaction[] = [];

    switch (optionType) {
      case 'Alertes SMS':
        // Les alertes ne génèrent pas d'opérations visibles
        break;
      case 'Chéquier':
        related.push(...transactions.filter(t =>
          t.description.toLowerCase().includes('cheque') ||
          t.description.toLowerCase().includes('chq')
        ));
        break;
      case 'Option international':
        related.push(...transactions.filter(t =>
          t.description.toLowerCase().includes('international') ||
          t.description.toLowerCase().includes('etranger')
        ));
        break;
      default:
        break;
    }

    return related;
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
