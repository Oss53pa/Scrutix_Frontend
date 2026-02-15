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
 * Configuration pour l'audit des opérations internationales
 */
interface InternationalConfig {
  // Tolérance sur les frais (pourcentage)
  feeTolerance: number;
  // Marge acceptable sur le taux de change (pourcentage)
  exchangeRateMargin: number;
  // Seuil d'alerte pour les frais SWIFT
  swiftFeeThreshold: number;
  // Vérifier les opérations de change
  checkExchangeOperations: boolean;
  // Codes des zones monétaires (CEMAC/UEMOA)
  monetaryZoneCodes: string[];
}

const DEFAULT_CONFIG: InternationalConfig = {
  feeTolerance: 0.05,
  exchangeRateMargin: 0.03, // 3%
  swiftFeeThreshold: 15000, // FCFA
  checkExchangeOperations: true,
  monetaryZoneCodes: ['XAF', 'XOF'], // Zone Franc
};

/**
 * Taux de référence simulés (en production, récupérer depuis une API)
 */
const REFERENCE_RATES: Record<string, number> = {
  'EUR': 655.957, // Parité fixe FCFA/EUR
  'USD': 600,     // Approximatif
  'GBP': 750,     // Approximatif
};

/**
 * InternationalAudit - Audit des opérations internationales et de change
 *
 * Ce module analyse:
 * - Frais de virements internationaux (SWIFT, etc.)
 * - Opérations de change et taux appliqués
 * - Frais documentaires (crédits documentaires, remises)
 * - Garanties internationales
 * - Opérations en devises
 */
export class InternationalAudit {
  private config: InternationalConfig;
  private bankConditions?: BankConditions;

  constructor(config?: Partial<InternationalConfig>, bankConditions?: BankConditions) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bankConditions = bankConditions;
  }

  /**
   * Analyser les opérations internationales
   */
  analyze(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // 1. Analyser les frais de virements internationaux
    anomalies.push(...this.analyzeInternationalTransferFees(transactions));

    // 2. Vérifier les opérations de change
    if (this.config.checkExchangeOperations) {
      anomalies.push(...this.analyzeExchangeOperations(transactions));
    }

    // 3. Analyser les frais documentaires
    anomalies.push(...this.analyzeDocumentaryFees(transactions));

    // 4. Détecter les frais de garanties internationales
    anomalies.push(...this.analyzeInternationalGuarantees(transactions));

    // 5. Vérifier les opérations intra-zone (CEMAC/UEMOA)
    anomalies.push(...this.analyzeIntraZoneOperations(transactions));

    return anomalies;
  }

  /**
   * Analyser les frais de virements internationaux
   */
  private analyzeInternationalTransferFees(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const internationalFees = transactions.filter(t => this.isInternationalTransferFee(t));

    if (internationalFees.length === 0) return anomalies;

    // Catégoriser par type de virement
    const swiftFees = internationalFees.filter(t =>
      t.description.toLowerCase().includes('swift')
    );

    const _targetFees = internationalFees.filter(t =>
      t.description.toLowerCase().includes('target') ||
      t.description.toLowerCase().includes('sepa')
    );

    // Vérifier les frais SWIFT
    for (const fee of swiftFees) {
      const amount = Math.abs(fee.amount);

      if (this.bankConditions?.internationalFees?.swift) {
        const expected = this.bankConditions.internationalFees.swift;
        const tolerance = expected * this.config.feeTolerance;

        if (amount > expected + tolerance) {
          anomalies.push(this.createOverchargeAnomaly(
            fee,
            'Virement SWIFT',
            expected,
            amount
          ));
        }
      }

      // Alerte si frais très élevés
      if (amount > this.config.swiftFeeThreshold) {
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
              description: 'Frais SWIFT',
              value: `${amount.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'THRESHOLD',
              description: 'Seuil d\'alerte',
              value: `${this.config.swiftFeeThreshold.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'DESCRIPTION',
              description: 'Libellé',
              value: fee.description,
            },
          ],
          recommendation:
            `Frais SWIFT élevé: ${amount.toLocaleString('fr-FR')} FCFA. ` +
            `Vérifier si l'option de partage des frais (SHA/BEN/OUR) est optimale ` +
            `et si les conditions négociées sont respectées.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    // Analyser la fréquence des virements internationaux
    const monthlyInternational = new Map<string, Transaction[]>();
    for (const fee of internationalFees) {
      const month = format(new Date(fee.date), 'yyyy-MM');
      if (!monthlyInternational.has(month)) {
        monthlyInternational.set(month, []);
      }
      monthlyInternational.get(month)!.push(fee);
    }

    for (const [month, fees] of monthlyInternational) {
      if (fees.length >= 5) {
        const totalFees = fees.reduce((sum, f) => sum + Math.abs(f.amount), 0);
        const avgFee = totalFees / fees.length;

        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.FEE_ANOMALY,
          severity: Severity.LOW,
          confidence: 0.6,
          amount: totalFees,
          transactions: fees.slice(0, 5),
          evidence: [
            {
              type: 'MONTH',
              description: 'Mois concerné',
              value: month,
            },
            {
              type: 'COUNT',
              description: 'Nombre de virements',
              value: fees.length,
            },
            {
              type: 'TOTAL_FEES',
              description: 'Total des frais',
              value: `${totalFees.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'AVG_FEE',
              description: 'Frais moyen',
              value: `${avgFee.toLocaleString('fr-FR')} FCFA`,
            },
          ],
          recommendation:
            `Volume important de virements internationaux en ${month}: ${fees.length} opérations. ` +
            `Total des frais: ${totalFees.toLocaleString('fr-FR')} FCFA. ` +
            `Négocier un forfait ou des conditions préférentielles.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Analyser les opérations de change
   */
  private analyzeExchangeOperations(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const exchangeOps = transactions.filter(t => this.isExchangeOperation(t));

    if (exchangeOps.length === 0) return anomalies;

    // Regrouper les opérations de change par devise
    const exchangeByDevise = new Map<string, Transaction[]>();

    for (const op of exchangeOps) {
      const devise = this.extractDevise(op.description);
      if (!exchangeByDevise.has(devise)) {
        exchangeByDevise.set(devise, []);
      }
      exchangeByDevise.get(devise)!.push(op);
    }

    // Analyser les marges de change
    for (const [devise, ops] of exchangeByDevise) {
      if (devise === 'UNKNOWN') continue;

      const referenceRate = REFERENCE_RATES[devise];
      if (!referenceRate) continue;

      // Essayer d'extraire les taux appliqués depuis les descriptions
      for (const op of ops) {
        const appliedRate = this.extractExchangeRate(op.description, op.amount);

        if (appliedRate) {
          const margin = Math.abs((appliedRate - referenceRate) / referenceRate);

          if (margin > this.config.exchangeRateMargin) {
            anomalies.push({
              id: uuidv4(),
              type: AnomalyType.OVERCHARGE,
              severity: margin > 0.05 ? Severity.HIGH : Severity.MEDIUM,
              confidence: 0.7,
              amount: Math.abs(op.amount) * margin,
              transactions: [op],
              evidence: [
                {
                  type: 'DEVISE',
                  description: 'Devise',
                  value: devise,
                },
                {
                  type: 'APPLIED_RATE',
                  description: 'Taux appliqué',
                  value: appliedRate.toFixed(4),
                },
                {
                  type: 'REFERENCE_RATE',
                  description: 'Taux de référence',
                  value: referenceRate.toFixed(4),
                },
                {
                  type: 'MARGIN',
                  description: 'Marge banque',
                  value: `${(margin * 100).toFixed(2)}%`,
                },
              ],
              recommendation:
                `Marge de change élevée sur opération ${devise}: ${(margin * 100).toFixed(2)}%. ` +
                `Taux appliqué: ${appliedRate.toFixed(4)} vs référence: ${referenceRate.toFixed(4)}. ` +
                `Comparer avec d'autres établissements et négocier les conditions.`,
              status: 'pending',
              detectedAt: new Date(),
            });
          }
        }
      }
    }

    // Détecter les frais de change excessifs
    const changeFees = transactions.filter(t =>
      t.amount < 0 &&
      (t.description.toLowerCase().includes('commission change') ||
        t.description.toLowerCase().includes('frais change'))
    );

    for (const fee of changeFees) {
      const amount = Math.abs(fee.amount);

      if (this.bankConditions?.exchangeFees?.commission) {
        const expected = this.bankConditions.exchangeFees.commission;

        if (amount > expected * (1 + this.config.feeTolerance)) {
          anomalies.push(this.createOverchargeAnomaly(
            fee,
            'Commission de change',
            expected,
            amount
          ));
        }
      }
    }

    return anomalies;
  }

  /**
   * Analyser les frais documentaires
   */
  private analyzeDocumentaryFees(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const documentaryFees = transactions.filter(t => this.isDocumentaryFee(t));

    if (documentaryFees.length === 0) return anomalies;

    // Crédits documentaires
    const lcFees = documentaryFees.filter(t =>
      t.description.toLowerCase().includes('credit documentaire') ||
      t.description.toLowerCase().includes('credoc') ||
      t.description.toLowerCase().includes('l/c')
    );

    // Analyser les frais de crédits documentaires
    if (lcFees.length > 0) {
      const amounts = lcFees.map(f => Math.abs(f.amount));
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

      for (const fee of lcFees) {
        const amount = Math.abs(fee.amount);

        // Détecter les frais anormalement élevés
        if (amount > avgAmount * 2.5) {
          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.FEE_ANOMALY,
            severity: Severity.MEDIUM,
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
                description: 'Moyenne des frais L/C',
                value: `${avgAmount.toLocaleString('fr-FR')} FCFA`,
              },
              {
                type: 'RATIO',
                description: 'Ratio vs moyenne',
                value: `${(amount / avgAmount).toFixed(1)}x`,
              },
            ],
            recommendation:
              `Frais de crédit documentaire élevé: ${amount.toLocaleString('fr-FR')} FCFA ` +
              `(${(amount / avgAmount).toFixed(1)}x la moyenne). ` +
              `Vérifier la nature de l'opération et les conditions appliquées.`,
            status: 'pending',
            detectedAt: new Date(),
          });
        }
      }
    }

    // Remises documentaires
    const remiseFees = documentaryFees.filter(t =>
      t.description.toLowerCase().includes('remise documentaire') ||
      t.description.toLowerCase().includes('encaissement documentaire')
    );

    if (remiseFees.length > 0 && this.bankConditions?.documentaryFees?.remise) {
      for (const fee of remiseFees) {
        const amount = Math.abs(fee.amount);
        const expected = this.bankConditions.documentaryFees.remise;

        if (amount > expected * (1 + this.config.feeTolerance)) {
          anomalies.push(this.createOverchargeAnomaly(
            fee,
            'Remise documentaire',
            expected,
            amount
          ));
        }
      }
    }

    return anomalies;
  }

  /**
   * Analyser les garanties internationales
   */
  private analyzeInternationalGuarantees(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const guaranteeFees = transactions.filter(t => this.isGuaranteeFee(t));

    if (guaranteeFees.length === 0) return anomalies;

    // Regrouper par trimestre pour détecter les renouvellements
    const quarterlyGuarantees = new Map<string, Transaction[]>();

    for (const fee of guaranteeFees) {
      const date = new Date(fee.date);
      const quarter = `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;

      if (!quarterlyGuarantees.has(quarter)) {
        quarterlyGuarantees.set(quarter, []);
      }
      quarterlyGuarantees.get(quarter)!.push(fee);
    }

    // Détecter les doublons potentiels de commissions
    for (const [quarter, fees] of quarterlyGuarantees) {
      if (fees.length > 1) {
        // Grouper par montant similaire
        const amountGroups = new Map<number, Transaction[]>();

        for (const fee of fees) {
          const amount = Math.round(Math.abs(fee.amount) / 100) * 100; // Arrondir à 100 FCFA
          if (!amountGroups.has(amount)) {
            amountGroups.set(amount, []);
          }
          amountGroups.get(amount)!.push(fee);
        }

        for (const [, groupFees] of amountGroups) {
          if (groupFees.length > 1) {
            const totalAmount = groupFees.reduce((sum, f) => sum + Math.abs(f.amount), 0);

            anomalies.push({
              id: uuidv4(),
              type: AnomalyType.DUPLICATE_FEE,
              severity: Severity.MEDIUM,
              confidence: 0.75,
              amount: totalAmount - Math.abs(groupFees[0].amount),
              transactions: groupFees,
              evidence: [
                {
                  type: 'QUARTER',
                  description: 'Trimestre',
                  value: quarter,
                },
                {
                  type: 'COUNT',
                  description: 'Nombre de prélèvements',
                  value: groupFees.length,
                },
                {
                  type: 'UNIT_AMOUNT',
                  description: 'Montant similaire',
                  value: `${Math.abs(groupFees[0].amount).toLocaleString('fr-FR')} FCFA`,
                },
              ],
              recommendation:
                `Plusieurs commissions de garantie similaires en ${quarter}. ` +
                `Vérifier s'il s'agit de doublons ou de garanties distinctes. ` +
                `Demander le détail des garanties concernées.`,
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
   * Analyser les opérations intra-zone (CEMAC/UEMOA)
   */
  private analyzeIntraZoneOperations(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Virements intra-zone ne devraient pas avoir de frais de change
    const intraZoneOps = transactions.filter(t => this.isIntraZoneOperation(t));

    for (const op of intraZoneOps) {
      // Chercher des frais de change associés le même jour
      const opDate = format(new Date(op.date), 'yyyy-MM-dd');

      const changeFees = transactions.filter(t =>
        format(new Date(t.date), 'yyyy-MM-dd') === opDate &&
        t.amount < 0 &&
        (t.description.toLowerCase().includes('change') ||
          t.description.toLowerCase().includes('conversion'))
      );

      if (changeFees.length > 0) {
        const totalChangeFees = changeFees.reduce((sum, f) => sum + Math.abs(f.amount), 0);

        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.GHOST_FEE,
          severity: Severity.HIGH,
          confidence: 0.85,
          amount: totalChangeFees,
          transactions: [op, ...changeFees],
          evidence: [
            {
              type: 'OPERATION',
              description: 'Opération intra-zone',
              value: op.description,
            },
            {
              type: 'ZONE',
              description: 'Zone monétaire',
              value: 'CEMAC/UEMOA (XAF/XOF)',
            },
            {
              type: 'CHANGE_FEES',
              description: 'Frais de change prélevés',
              value: `${totalChangeFees.toLocaleString('fr-FR')} FCFA`,
            },
          ],
          recommendation:
            `Frais de change prélevés sur opération intra-zone FCFA. ` +
            `Les virements entre pays de la zone Franc (CEMAC/UEMOA) ne devraient pas ` +
            `engendrer de frais de conversion. Demander le remboursement.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Identifier un frais de virement international
   */
  private isInternationalTransferFee(transaction: Transaction): boolean {
    const keywords = [
      'virement international', 'swift', 'vir etranger',
      'transfert international', 'virement hors zone',
      'vir international', 'frais swift', 'target',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier une opération de change
   */
  private isExchangeOperation(transaction: Transaction): boolean {
    const keywords = [
      'change', 'devise', 'conversion', 'forex',
      'achat devise', 'vente devise', 'eur', 'usd', 'gbp',
    ];

    const desc = transaction.description.toLowerCase();
    return keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier un frais documentaire
   */
  private isDocumentaryFee(transaction: Transaction): boolean {
    const keywords = [
      'credit documentaire', 'credoc', 'l/c', 'letter of credit',
      'remise documentaire', 'encaissement documentaire',
      'ouverture credoc', 'amendement credoc', 'confirmation credoc',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier un frais de garantie
   */
  private isGuaranteeFee(transaction: Transaction): boolean {
    const keywords = [
      'garantie', 'caution', 'sblc', 'standby',
      'garantie bancaire', 'lettre de garantie',
      'commission garantie', 'engagement par signature',
    ];

    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier une opération intra-zone
   */
  private isIntraZoneOperation(transaction: Transaction): boolean {
    const intraZoneKeywords = [
      'cemac', 'uemoa', 'zone franc', 'xaf', 'xof',
      'cameroun', 'gabon', 'congo', 'tchad', 'centrafrique', 'guinee equatoriale',
      'senegal', 'cote ivoire', 'mali', 'burkina', 'benin', 'togo', 'niger',
    ];

    const desc = transaction.description.toLowerCase();
    return intraZoneKeywords.some(kw => desc.includes(kw));
  }

  /**
   * Extraire la devise depuis une description
   */
  private extractDevise(description: string): string {
    const devises = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'];
    const desc = description.toUpperCase();

    for (const devise of devises) {
      if (desc.includes(devise)) return devise;
    }

    return 'UNKNOWN';
  }

  /**
   * Extraire le taux de change depuis une description
   */
  private extractExchangeRate(description: string, _amount: number): number | null {
    // Patterns pour extraire le taux: "TAUX 655.957" ou "@ 655.957"
    const patterns = [
      /taux\s*[:=]?\s*([\d.,]+)/i,
      /@\s*([\d.,]+)/,
      /cours\s*[:=]?\s*([\d.,]+)/i,
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        const rate = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(rate) && rate > 0) return rate;
      }
    }

    return null;
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
