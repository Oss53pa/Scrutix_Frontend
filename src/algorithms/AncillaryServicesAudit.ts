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
 * Configuration pour l'audit des services annexes
 */
interface AncillaryServicesConfig {
  // Tolérance sur les frais (pourcentage)
  feeTolerance: number;
  // Vérifier les frais de banque en ligne
  checkOnlineBanking: boolean;
  // Vérifier les frais de coffre-fort
  checkSafeDeposit: boolean;
  // Vérifier les certifications
  checkCertifications: boolean;
}

const DEFAULT_CONFIG: AncillaryServicesConfig = {
  feeTolerance: 0.05,
  checkOnlineBanking: true,
  checkSafeDeposit: true,
  checkCertifications: true,
};

/**
 * AncillaryServicesAudit - Audit des services annexes bancaires
 *
 * Ce module analyse les frais liés aux services bancaires annexes:
 * - Banque en ligne et services digitaux
 * - Coffres-forts et location
 * - Certifications et attestations
 * - Services de messagerie et alertes
 * - Archivage et consultation d'historiques
 * - Services spéciaux (domiciliation, etc.)
 */
export class AncillaryServicesAudit {
  private config: AncillaryServicesConfig;
  private bankConditions?: BankConditions;

  constructor(config?: Partial<AncillaryServicesConfig>, bankConditions?: BankConditions) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bankConditions = bankConditions;
  }

  /**
   * Analyser les frais de services annexes
   */
  analyze(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // 1. Analyser les frais de banque en ligne
    if (this.config.checkOnlineBanking) {
      anomalies.push(...this.analyzeOnlineBankingFees(transactions));
    }

    // 2. Analyser les frais de coffre-fort
    if (this.config.checkSafeDeposit) {
      anomalies.push(...this.analyzeSafeDepositFees(transactions));
    }

    // 3. Analyser les certifications et attestations
    if (this.config.checkCertifications) {
      anomalies.push(...this.analyzeCertificationFees(transactions));
    }

    // 4. Analyser les frais de messagerie et alertes
    anomalies.push(...this.analyzeMessagingFees(transactions));

    // 5. Analyser les frais d'archivage
    anomalies.push(...this.analyzeArchivingFees(transactions));

    // 6. Détecter les services inutilisés facturés
    anomalies.push(...this.detectUnusedServicesFees(transactions));

    return anomalies;
  }

  /**
   * Analyser les frais de banque en ligne
   */
  private analyzeOnlineBankingFees(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const onlineFees = transactions.filter(t => this.isOnlineBankingFee(t));

    if (onlineFees.length === 0) return anomalies;

    // Vérifier les frais d'abonnement banque en ligne
    const subscriptionFees = onlineFees.filter(t =>
      t.description.toLowerCase().includes('abonnement') ||
      t.description.toLowerCase().includes('cotisation')
    );

    if (subscriptionFees.length > 0) {
      // Regrouper par mois pour détecter les doublons
      const monthlyFees = new Map<string, Transaction[]>();

      for (const fee of subscriptionFees) {
        const month = format(new Date(fee.date), 'yyyy-MM');
        if (!monthlyFees.has(month)) {
          monthlyFees.set(month, []);
        }
        monthlyFees.get(month)!.push(fee);
      }

      for (const [month, fees] of monthlyFees) {
        if (fees.length > 1) {
          const totalAmount = fees.reduce((sum, f) => sum + Math.abs(f.amount), 0);

          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.DUPLICATE_FEE,
            severity: Severity.MEDIUM,
            confidence: 0.85,
            amount: totalAmount - Math.abs(fees[0].amount),
            transactions: fees,
            evidence: [
              {
                type: 'MONTH',
                description: 'Mois concerné',
                value: month,
              },
              {
                type: 'COUNT',
                description: 'Nombre de prélèvements',
                value: fees.length,
              },
              {
                type: 'TOTAL',
                description: 'Total prélevé',
                value: `${totalAmount.toLocaleString('fr-FR')} FCFA`,
              },
            ],
            recommendation:
              `Abonnement banque en ligne prélevé ${fees.length} fois en ${month}. ` +
              `Total: ${totalAmount.toLocaleString('fr-FR')} FCFA. ` +
              `Vérifier et demander remboursement des doublons.`,
            status: 'pending',
            detectedAt: new Date(),
          });
        }
      }

      // Vérifier par rapport au contrat
      if (this.bankConditions?.onlineBankingFees?.subscription) {
        for (const fee of subscriptionFees) {
          const amount = Math.abs(fee.amount);
          const expected = this.bankConditions.onlineBankingFees.subscription;

          if (amount > expected * (1 + this.config.feeTolerance)) {
            anomalies.push(this.createOverchargeAnomaly(
              fee,
              'Abonnement banque en ligne',
              expected,
              amount
            ));
          }
        }
      }
    }

    // Vérifier les frais de token/authentification
    const tokenFees = onlineFees.filter(t =>
      t.description.toLowerCase().includes('token') ||
      t.description.toLowerCase().includes('digipass') ||
      t.description.toLowerCase().includes('authentification')
    );

    if (tokenFees.length > 0 && this.bankConditions?.onlineBankingFees?.token) {
      for (const fee of tokenFees) {
        const amount = Math.abs(fee.amount);
        const expected = this.bankConditions.onlineBankingFees.token;

        if (amount > expected * (1 + this.config.feeTolerance)) {
          anomalies.push(this.createOverchargeAnomaly(
            fee,
            'Token/Digipass',
            expected,
            amount
          ));
        }
      }
    }

    return anomalies;
  }

  /**
   * Analyser les frais de coffre-fort
   */
  private analyzeSafeDepositFees(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const safeFees = transactions.filter(t => this.isSafeDepositFee(t));

    if (safeFees.length === 0) return anomalies;

    // Regrouper par type de frais
    const rentalFees = safeFees.filter(t =>
      t.description.toLowerCase().includes('location') ||
      t.description.toLowerCase().includes('loyer')
    );

    const accessFees = safeFees.filter(t =>
      t.description.toLowerCase().includes('acces') ||
      t.description.toLowerCase().includes('ouverture')
    );

    // Vérifier les frais de location
    if (rentalFees.length > 0) {
      // Analyser la fréquence (devrait être annuelle ou semestrielle)
      const yearlyFees = new Map<string, Transaction[]>();

      for (const fee of rentalFees) {
        const year = format(new Date(fee.date), 'yyyy');
        if (!yearlyFees.has(year)) {
          yearlyFees.set(year, []);
        }
        yearlyFees.get(year)!.push(fee);
      }

      for (const [year, fees] of yearlyFees) {
        // Plus de 2 prélèvements par an est suspect
        if (fees.length > 2) {
          const totalAmount = fees.reduce((sum, f) => sum + Math.abs(f.amount), 0);

          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.FEE_ANOMALY,
            severity: Severity.MEDIUM,
            confidence: 0.8,
            amount: totalAmount,
            transactions: fees,
            evidence: [
              {
                type: 'YEAR',
                description: 'Année',
                value: year,
              },
              {
                type: 'COUNT',
                description: 'Nombre de prélèvements',
                value: fees.length,
              },
              {
                type: 'TOTAL',
                description: 'Total prélevé',
                value: `${totalAmount.toLocaleString('fr-FR')} FCFA`,
              },
            ],
            recommendation:
              `Location coffre-fort prélevée ${fees.length} fois en ${year}. ` +
              `La facturation devrait être annuelle ou semestrielle. ` +
              `Vérifier les conditions et demander remboursement des excédents.`,
            status: 'pending',
            detectedAt: new Date(),
          });
        }
      }
    }

    // Vérifier les frais d'accès excessifs
    if (accessFees.length > 0) {
      const amounts = accessFees.map(f => Math.abs(f.amount));
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

      for (const fee of accessFees) {
        const amount = Math.abs(fee.amount);
        if (amount > avgAmount * 2) {
          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.FEE_ANOMALY,
            severity: Severity.LOW,
            confidence: 0.7,
            amount: amount - avgAmount,
            transactions: [fee],
            evidence: [
              {
                type: 'AMOUNT',
                description: 'Frais prélevé',
                value: `${amount.toLocaleString('fr-FR')} FCFA`,
              },
              {
                type: 'AVERAGE',
                description: 'Frais moyen',
                value: `${avgAmount.toLocaleString('fr-FR')} FCFA`,
              },
            ],
            recommendation:
              `Frais d'accès coffre-fort élevé: ${amount.toLocaleString('fr-FR')} FCFA ` +
              `vs moyenne ${avgAmount.toLocaleString('fr-FR')} FCFA. ` +
              `Vérifier la nature de l'opération.`,
            status: 'pending',
            detectedAt: new Date(),
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Analyser les frais de certifications et attestations
   */
  private analyzeCertificationFees(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const certFees = transactions.filter(t => this.isCertificationFee(t));

    if (certFees.length === 0) return anomalies;

    // Regrouper par mois pour détecter les demandes multiples
    const monthlyCerts = new Map<string, Transaction[]>();

    for (const fee of certFees) {
      const month = format(new Date(fee.date), 'yyyy-MM');
      if (!monthlyCerts.has(month)) {
        monthlyCerts.set(month, []);
      }
      monthlyCerts.get(month)!.push(fee);
    }

    for (const [month, fees] of monthlyCerts) {
      if (fees.length >= 3) {
        const totalAmount = fees.reduce((sum, f) => sum + Math.abs(f.amount), 0);

        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.FEE_ANOMALY,
          severity: Severity.LOW,
          confidence: 0.65,
          amount: totalAmount,
          transactions: fees,
          evidence: [
            {
              type: 'MONTH',
              description: 'Mois concerné',
              value: month,
            },
            {
              type: 'COUNT',
              description: 'Nombre de certifications',
              value: fees.length,
            },
            {
              type: 'TOTAL',
              description: 'Total des frais',
              value: `${totalAmount.toLocaleString('fr-FR')} FCFA`,
            },
          ],
          recommendation:
            `${fees.length} demandes de certification/attestation en ${month}. ` +
            `Total: ${totalAmount.toLocaleString('fr-FR')} FCFA. ` +
            `Vérifier si certaines peuvent être regroupées ou évitées.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    // Vérifier par rapport aux tarifs contractuels
    if (this.bankConditions?.certificationFees) {
      for (const fee of certFees) {
        const amount = Math.abs(fee.amount);
        const desc = fee.description.toLowerCase();

        let expectedFee: number | undefined;
        let feeType = '';

        if (desc.includes('rib') || desc.includes('releve identite')) {
          expectedFee = this.bankConditions.certificationFees.rib;
          feeType = 'RIB';
        } else if (desc.includes('attestation')) {
          expectedFee = this.bankConditions.certificationFees.attestation;
          feeType = 'Attestation';
        } else if (desc.includes('certification')) {
          expectedFee = this.bankConditions.certificationFees.certification;
          feeType = 'Certification';
        }

        if (expectedFee && amount > expectedFee * (1 + this.config.feeTolerance)) {
          anomalies.push(this.createOverchargeAnomaly(fee, feeType, expectedFee, amount));
        }
      }
    }

    return anomalies;
  }

  /**
   * Analyser les frais de messagerie et alertes
   */
  private analyzeMessagingFees(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const messagingFees = transactions.filter(t => this.isMessagingFee(t));

    if (messagingFees.length === 0) return anomalies;

    // Regrouper par mois
    const monthlyFees = new Map<string, Transaction[]>();

    for (const fee of messagingFees) {
      const month = format(new Date(fee.date), 'yyyy-MM');
      if (!monthlyFees.has(month)) {
        monthlyFees.set(month, []);
      }
      monthlyFees.get(month)!.push(fee);
    }

    // Calculer la moyenne mensuelle
    const monthlyTotals = Array.from(monthlyFees.values())
      .map(fees => fees.reduce((sum, f) => sum + Math.abs(f.amount), 0));

    if (monthlyTotals.length >= 3) {
      const avgMonthly = monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length;

      for (const [month, fees] of monthlyFees) {
        const monthTotal = fees.reduce((sum, f) => sum + Math.abs(f.amount), 0);

        if (monthTotal > avgMonthly * 2) {
          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.FEE_ANOMALY,
            severity: Severity.LOW,
            confidence: 0.7,
            amount: monthTotal - avgMonthly,
            transactions: fees,
            evidence: [
              {
                type: 'MONTH',
                description: 'Mois concerné',
                value: month,
              },
              {
                type: 'TOTAL',
                description: 'Total du mois',
                value: `${monthTotal.toLocaleString('fr-FR')} FCFA`,
              },
              {
                type: 'AVERAGE',
                description: 'Moyenne mensuelle',
                value: `${avgMonthly.toLocaleString('fr-FR')} FCFA`,
              },
            ],
            recommendation:
              `Frais de messagerie/alertes élevés en ${month}: ${monthTotal.toLocaleString('fr-FR')} FCFA ` +
              `(moyenne: ${avgMonthly.toLocaleString('fr-FR')} FCFA). ` +
              `Vérifier le paramétrage des alertes et les tarifs unitaires.`,
            status: 'pending',
            detectedAt: new Date(),
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Analyser les frais d'archivage et consultation
   */
  private analyzeArchivingFees(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const archivingFees = transactions.filter(t => this.isArchivingFee(t));

    if (archivingFees.length === 0) return anomalies;

    // Détecter les frais de recherche d'historique élevés
    const searchFees = archivingFees.filter(t =>
      t.description.toLowerCase().includes('recherche') ||
      t.description.toLowerCase().includes('historique')
    );

    for (const fee of searchFees) {
      const amount = Math.abs(fee.amount);

      if (amount > 10000) { // Seuil arbitraire pour les frais de recherche
        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.FEE_ANOMALY,
          severity: Severity.MEDIUM,
          confidence: 0.75,
          amount,
          transactions: [fee],
          evidence: [
            {
              type: 'AMOUNT',
              description: 'Frais de recherche',
              value: `${amount.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'DESCRIPTION',
              description: 'Libellé',
              value: fee.description,
            },
          ],
          recommendation:
            `Frais de recherche d'historique élevé: ${amount.toLocaleString('fr-FR')} FCFA. ` +
            `Vérifier si l'historique est disponible via la banque en ligne ` +
            `(souvent gratuit) avant de demander des recherches payantes.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Détecter les services inutilisés facturés
   */
  private detectUnusedServicesFees(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Identifier les abonnements récurrents
    const subscriptionFees = transactions.filter(t =>
      t.amount < 0 &&
      (t.description.toLowerCase().includes('abonnement') ||
        t.description.toLowerCase().includes('cotisation') ||
        t.description.toLowerCase().includes('forfait'))
    );

    if (subscriptionFees.length === 0) return anomalies;

    // Regrouper par type de service
    const serviceGroups = new Map<string, Transaction[]>();

    for (const fee of subscriptionFees) {
      const serviceType = this.extractServiceType(fee.description);
      if (!serviceGroups.has(serviceType)) {
        serviceGroups.set(serviceType, []);
      }
      serviceGroups.get(serviceType)!.push(fee);
    }

    // Pour chaque service, vérifier s'il y a des opérations associées
    for (const [serviceType, fees] of serviceGroups) {
      const totalFees = fees.reduce((sum, f) => sum + Math.abs(f.amount), 0);

      // Vérifier si des opérations liées existent
      const relatedOperations = transactions.filter(t =>
        t !== fees[0] && // Exclure les frais eux-mêmes
        this.isRelatedOperation(t, serviceType)
      );

      if (relatedOperations.length === 0 && fees.length >= 3) {
        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.GHOST_FEE,
          severity: Severity.MEDIUM,
          confidence: 0.7,
          amount: totalFees,
          transactions: fees,
          evidence: [
            {
              type: 'SERVICE',
              description: 'Service facturé',
              value: serviceType,
            },
            {
              type: 'COUNT',
              description: 'Nombre de prélèvements',
              value: fees.length,
            },
            {
              type: 'TOTAL',
              description: 'Total des frais',
              value: `${totalFees.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'USAGE',
              description: 'Opérations liées détectées',
              value: '0',
            },
          ],
          recommendation:
            `Service "${serviceType}" facturé ${fees.length} fois pour ${totalFees.toLocaleString('fr-FR')} FCFA ` +
            `sans opérations liées détectées. ` +
            `Vérifier l'utilité de ce service et envisager sa résiliation.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Identifier un frais de banque en ligne
   */
  private isOnlineBankingFee(transaction: Transaction): boolean {
    const keywords = [
      'banque en ligne', 'e-banking', 'web banking', 'mobile banking',
      'application mobile', 'token', 'digipass', 'authentification',
      'abonnement internet', 'services en ligne',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier un frais de coffre-fort
   */
  private isSafeDepositFee(transaction: Transaction): boolean {
    const keywords = [
      'coffre', 'coffre-fort', 'safe', 'location coffre',
      'loyer coffre', 'acces coffre',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier un frais de certification
   */
  private isCertificationFee(transaction: Transaction): boolean {
    const keywords = [
      'attestation', 'certification', 'rib', 'releve identite',
      'copie conforme', 'document certifie', 'lettre de reference',
      'reference bancaire',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier un frais de messagerie
   */
  private isMessagingFee(transaction: Transaction): boolean {
    const keywords = [
      'sms', 'alerte', 'notification', 'messagerie',
      'push notification', 'email alert',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier un frais d'archivage
   */
  private isArchivingFee(transaction: Transaction): boolean {
    const keywords = [
      'archivage', 'archive', 'historique', 'recherche documents',
      'consultation historique', 'documents anciens',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Extraire le type de service depuis une description
   */
  private extractServiceType(description: string): string {
    const desc = description.toLowerCase();

    if (desc.includes('banque en ligne') || desc.includes('e-banking')) return 'Banque en ligne';
    if (desc.includes('mobile') || desc.includes('app')) return 'Services mobiles';
    if (desc.includes('coffre')) return 'Coffre-fort';
    if (desc.includes('sms') || desc.includes('alerte')) return 'Alertes SMS';
    if (desc.includes('token') || desc.includes('digipass')) return 'Authentification';

    return 'Service divers';
  }

  /**
   * Vérifier si une opération est liée à un type de service
   */
  private isRelatedOperation(transaction: Transaction, serviceType: string): boolean {
    const desc = transaction.description.toLowerCase();

    switch (serviceType) {
      case 'Banque en ligne':
        return desc.includes('virement en ligne') || desc.includes('operation web');
      case 'Services mobiles':
        return desc.includes('operation mobile') || desc.includes('paiement mobile');
      case 'Alertes SMS':
        return false; // Les alertes n'ont pas d'opérations liées directes
      default:
        return false;
    }
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
