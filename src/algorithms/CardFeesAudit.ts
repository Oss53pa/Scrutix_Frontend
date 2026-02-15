import { v4 as uuidv4 } from 'uuid';
import { format, differenceInDays } from 'date-fns';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  BankConditions,
} from '../types';

/**
 * Configuration pour l'audit des frais de cartes bancaires
 */
interface CardFeesConfig {
  // Tolérance sur les frais (pourcentage)
  feeTolerance: number;
  // Plafond de retrait journalier par défaut
  defaultDailyWithdrawalLimit: number;
  // Plafond de paiement mensuel par défaut
  defaultMonthlyPaymentLimit: number;
  // Commission DAB étranger attendue (pourcentage)
  foreignAtmCommission: number;
}

const DEFAULT_CONFIG: CardFeesConfig = {
  feeTolerance: 0.05,
  defaultDailyWithdrawalLimit: 500000, // 500k FCFA
  defaultMonthlyPaymentLimit: 2000000, // 2M FCFA
  foreignAtmCommission: 0.03, // 3%
};

/**
 * CardFeesAudit - Audit des frais de cartes bancaires
 *
 * Ce module analyse les frais liés aux cartes:
 * - Cotisations annuelles
 * - Frais de retrait DAB
 * - Frais de paiement
 * - Frais à l'étranger
 * - Oppositions et renouvellements
 * - Dépassements de plafonds
 */
export class CardFeesAudit {
  private config: CardFeesConfig;
  private bankConditions?: BankConditions;

  constructor(config?: Partial<CardFeesConfig>, bankConditions?: BankConditions) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bankConditions = bankConditions;
  }

  /**
   * Analyser les frais de cartes
   */
  analyze(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Séparer les transactions par type
    const cardFees = transactions.filter(t => this.isCardFee(t));
    const atmWithdrawals = transactions.filter(t => this.isAtmWithdrawal(t));
    const cardPayments = transactions.filter(t => this.isCardPayment(t));

    // 1. Vérifier les cotisations cartes
    anomalies.push(...this.checkCardSubscriptions(cardFees));

    // 2. Analyser les frais de retrait
    anomalies.push(...this.analyzeAtmFees(atmWithdrawals, cardFees));

    // 3. Vérifier les plafonds
    anomalies.push(...this.checkLimits(atmWithdrawals, cardPayments));

    // 4. Analyser les frais à l'étranger
    anomalies.push(...this.analyzeForeignFees(cardFees, atmWithdrawals));

    // 5. Détecter les frais d'opposition multiples
    anomalies.push(...this.detectOppositionFees(cardFees));

    // 6. Vérifier les renouvellements
    anomalies.push(...this.checkRenewalFees(cardFees));

    return anomalies;
  }

  /**
   * Identifier si c'est un frais de carte
   */
  private isCardFee(transaction: Transaction): boolean {
    const keywords = [
      'cotisation carte', 'renouvellement carte', 'carte bancaire',
      'frais carte', 'commission carte', 'opposition carte',
      'retrait dab', 'retrait gab', 'frais retrait',
      'visa', 'mastercard', 'cb ',
    ];
    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier un retrait DAB
   */
  private isAtmWithdrawal(transaction: Transaction): boolean {
    const keywords = ['retrait', 'dab', 'gab', 'atm', 'distributeur'];
    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Identifier un paiement carte
   */
  private isCardPayment(transaction: Transaction): boolean {
    const keywords = ['paiement cb', 'tpe', 'paiement carte', 'achat carte'];
    const desc = transaction.description.toLowerCase();
    return transaction.amount < 0 && keywords.some(kw => desc.includes(kw));
  }

  /**
   * Vérifier les cotisations cartes
   */
  private checkCardSubscriptions(fees: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const subscriptions = fees.filter(f =>
      f.description.toLowerCase().includes('cotisation') ||
      f.description.toLowerCase().includes('renouvellement')
    );

    // Grouper par année
    const yearlySubscriptions = new Map<string, Transaction[]>();
    for (const sub of subscriptions) {
      const year = format(new Date(sub.date), 'yyyy');
      if (!yearlySubscriptions.has(year)) {
        yearlySubscriptions.set(year, []);
      }
      yearlySubscriptions.get(year)!.push(sub);
    }

    // Détecter les cotisations multiples la même année
    for (const [year, subs] of yearlySubscriptions) {
      if (subs.length > 1) {
        const total = subs.reduce((sum, s) => sum + Math.abs(s.amount), 0);

        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.DUPLICATE_FEE,
          severity: Severity.HIGH,
          confidence: 0.85,
          amount: total - Math.abs(subs[0].amount),
          transactions: subs,
          evidence: [
            {
              type: 'YEAR',
              description: 'Année',
              value: year,
            },
            {
              type: 'COUNT',
              description: 'Nombre de cotisations',
              value: subs.length,
            },
            {
              type: 'TOTAL',
              description: 'Total prélevé',
              value: `${total.toLocaleString('fr-FR')} FCFA`,
            },
          ],
          recommendation:
            `${subs.length} cotisations carte prélevées en ${year} pour un total de ` +
            `${total.toLocaleString('fr-FR')} FCFA. ` +
            `Vérifier s'il s'agit de cartes différentes ou de doublons à rembourser.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    // Vérifier par rapport au contrat
    if (this.bankConditions?.cardFees?.cartes) {
      for (const sub of subscriptions) {
        const amount = Math.abs(sub.amount);
        const matchingCard = this.bankConditions.cardFees.cartes.find(c =>
          amount > c.cotisation * (1 - this.config.feeTolerance) &&
          amount < c.cotisation * (1 + this.config.feeTolerance)
        );

        if (!matchingCard) {
          // Cotisation ne correspond à aucune carte connue
          const expectedCots = this.bankConditions.cardFees.cartes.map(c => c.cotisation);
          const closestCot = expectedCots.reduce((prev, curr) =>
            Math.abs(curr - amount) < Math.abs(prev - amount) ? curr : prev
          );

          if (amount > closestCot * 1.1) {
            anomalies.push({
              id: uuidv4(),
              type: AnomalyType.OVERCHARGE,
              severity: Severity.MEDIUM,
              confidence: 0.7,
              amount: amount - closestCot,
              transactions: [sub],
              evidence: [
                {
                  type: 'CHARGED',
                  description: 'Montant prélevé',
                  value: `${amount.toLocaleString('fr-FR')} FCFA`,
                },
                {
                  type: 'EXPECTED',
                  description: 'Cotisation attendue',
                  value: `${closestCot.toLocaleString('fr-FR')} FCFA`,
                },
              ],
              recommendation:
                `Cotisation carte de ${amount.toLocaleString('fr-FR')} FCFA ` +
                `supérieure aux tarifs contractuels. Vérifier la grille tarifaire.`,
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
   * Analyser les frais de retrait DAB
   */
  private analyzeAtmFees(withdrawals: Transaction[], fees: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Identifier les frais de retrait
    const atmFees = fees.filter(f =>
      f.description.toLowerCase().includes('retrait') ||
      f.description.toLowerCase().includes('dab') ||
      f.description.toLowerCase().includes('gab')
    );

    if (atmFees.length === 0) return anomalies;

    // Vérifier si frais par rapport au nombre de retraits
    const withdrawalCount = withdrawals.length;
    const freeWithdrawals = this.bankConditions?.cardFees?.retraitGratuits || 0;
    const _feePerWithdrawal = this.bankConditions?.cardFees?.fraisRetrait || 0;

    if (freeWithdrawals > 0 && withdrawalCount <= freeWithdrawals && atmFees.length > 0) {
      const totalFees = atmFees.reduce((sum, f) => sum + Math.abs(f.amount), 0);

      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.GHOST_FEE,
        severity: Severity.HIGH,
        confidence: 0.9,
        amount: totalFees,
        transactions: atmFees,
        evidence: [
          {
            type: 'WITHDRAWALS',
            description: 'Nombre de retraits',
            value: withdrawalCount,
          },
          {
            type: 'FREE_LIMIT',
            description: 'Retraits gratuits inclus',
            value: freeWithdrawals,
          },
          {
            type: 'FEES_CHARGED',
            description: 'Frais prélevés',
            value: `${totalFees.toLocaleString('fr-FR')} FCFA`,
          },
        ],
        recommendation:
          `${totalFees.toLocaleString('fr-FR')} FCFA de frais de retrait prélevés ` +
          `alors que ${withdrawalCount} retraits effectués sur ${freeWithdrawals} gratuits inclus. ` +
          `Demander le remboursement.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    return anomalies;
  }

  /**
   * Vérifier les plafonds
   */
  private checkLimits(withdrawals: Transaction[], _payments: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Grouper les retraits par jour
    const dailyWithdrawals = new Map<string, { total: number; transactions: Transaction[] }>();
    for (const w of withdrawals) {
      const dateKey = format(new Date(w.date), 'yyyy-MM-dd');
      if (!dailyWithdrawals.has(dateKey)) {
        dailyWithdrawals.set(dateKey, { total: 0, transactions: [] });
      }
      const day = dailyWithdrawals.get(dateKey)!;
      day.total += Math.abs(w.amount);
      day.transactions.push(w);
    }

    // Vérifier les dépassements
    const dailyLimit = this.bankConditions?.cardFees?.cartes?.[0]?.plafondRetrait ||
      this.config.defaultDailyWithdrawalLimit;

    for (const [date, data] of dailyWithdrawals) {
      if (data.total > dailyLimit) {
        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.LIMIT_EXCEEDED,
          severity: Severity.MEDIUM,
          confidence: 0.9,
          amount: data.total - dailyLimit,
          transactions: data.transactions,
          evidence: [
            {
              type: 'DATE',
              description: 'Date',
              value: date,
            },
            {
              type: 'TOTAL',
              description: 'Total retiré',
              value: `${data.total.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'LIMIT',
              description: 'Plafond journalier',
              value: `${dailyLimit.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'EXCESS',
              description: 'Dépassement',
              value: `${(data.total - dailyLimit).toLocaleString('fr-FR')} FCFA`,
            },
          ],
          recommendation:
            `Dépassement du plafond de retrait le ${date}: ` +
            `${data.total.toLocaleString('fr-FR')} FCFA retirés vs ` +
            `${dailyLimit.toLocaleString('fr-FR')} FCFA autorisés. ` +
            `Vérifier les frais de dépassement éventuels.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Analyser les frais à l'étranger
   */
  private analyzeForeignFees(fees: Transaction[], withdrawals: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Identifier les opérations à l'étranger
    const foreignKeywords = ['etranger', 'foreign', 'intl', 'international', 'hors zone'];
    const foreignWithdrawals = withdrawals.filter(w =>
      foreignKeywords.some(kw => w.description.toLowerCase().includes(kw))
    );

    const foreignFees = fees.filter(f =>
      foreignKeywords.some(kw => f.description.toLowerCase().includes(kw))
    );

    if (foreignWithdrawals.length > 0) {
      const totalWithdrawn = foreignWithdrawals.reduce((sum, w) => sum + Math.abs(w.amount), 0);
      const totalFees = foreignFees.reduce((sum, f) => sum + Math.abs(f.amount), 0);
      const expectedFees = totalWithdrawn * this.config.foreignAtmCommission;

      if (totalFees > expectedFees * 1.5) {
        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.OVERCHARGE,
          severity: Severity.MEDIUM,
          confidence: 0.75,
          amount: totalFees - expectedFees,
          transactions: [...foreignWithdrawals, ...foreignFees],
          evidence: [
            {
              type: 'FOREIGN_WITHDRAWALS',
              description: 'Retraits étrangers',
              value: `${totalWithdrawn.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'FEES_CHARGED',
              description: 'Frais prélevés',
              value: `${totalFees.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'EXPECTED_FEES',
              description: 'Frais attendus (3%)',
              value: `${expectedFees.toLocaleString('fr-FR')} FCFA`,
            },
          ],
          recommendation:
            `Frais de retrait étranger élevés: ${totalFees.toLocaleString('fr-FR')} FCFA ` +
            `pour ${totalWithdrawn.toLocaleString('fr-FR')} FCFA retirés. ` +
            `Vérifier le taux de commission appliqué.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Détecter les frais d'opposition multiples
   */
  private detectOppositionFees(fees: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const oppositionFees = fees.filter(f =>
      f.description.toLowerCase().includes('opposition')
    );

    if (oppositionFees.length > 1) {
      // Vérifier si multiples oppositions dans une courte période
      const sorted = oppositionFees.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      for (let i = 1; i < sorted.length; i++) {
        const days = differenceInDays(new Date(sorted[i].date), new Date(sorted[i - 1].date));

        if (days < 30) {
          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.DUPLICATE_FEE,
            severity: Severity.MEDIUM,
            confidence: 0.8,
            amount: Math.abs(sorted[i].amount),
            transactions: [sorted[i - 1], sorted[i]],
            evidence: [
              {
                type: 'INTERVAL',
                description: 'Intervalle entre oppositions',
                value: `${days} jours`,
              },
              {
                type: 'FEES',
                description: 'Frais',
                value: sorted.map(s => Math.abs(s.amount).toLocaleString('fr-FR')).join(' + ') + ' FCFA',
              },
            ],
            recommendation:
              `Multiples frais d'opposition à ${days} jours d'intervalle. ` +
              `Vérifier s'il s'agit de la même carte ou de cartes différentes.`,
            status: 'pending',
            detectedAt: new Date(),
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Vérifier les frais de renouvellement
   */
  private checkRenewalFees(fees: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const renewalFees = fees.filter(f =>
      f.description.toLowerCase().includes('renouvellement')
    );

    // Vérifier si renouvellement avant expiration normale (3 ans)
    // Simplification: alerter si plus d'un renouvellement en moins de 2 ans
    if (renewalFees.length > 1) {
      const sorted = renewalFees.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      for (let i = 1; i < sorted.length; i++) {
        const days = differenceInDays(new Date(sorted[i].date), new Date(sorted[i - 1].date));

        if (days < 700) { // < 2 ans
          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.FEE_ANOMALY,
            severity: Severity.MEDIUM,
            confidence: 0.75,
            amount: Math.abs(sorted[i].amount),
            transactions: [sorted[i - 1], sorted[i]],
            evidence: [
              {
                type: 'INTERVAL',
                description: 'Intervalle entre renouvellements',
                value: `${Math.round(days / 30)} mois`,
              },
              {
                type: 'EXPECTED',
                description: 'Intervalle normal',
                value: '36 mois (3 ans)',
              },
            ],
            recommendation:
              `Renouvellement carte après seulement ${Math.round(days / 30)} mois ` +
              `(normal: 36 mois). Vérifier la raison du renouvellement anticipé.`,
            status: 'pending',
            detectedAt: new Date(),
          });
        }
      }
    }

    return anomalies;
  }
}
