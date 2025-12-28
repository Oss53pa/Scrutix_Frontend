import { v4 as uuidv4 } from 'uuid';
import { format, differenceInHours } from 'date-fns';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  BankConditions,
} from '../types';

/**
 * Configuration pour l'audit multi-banques
 */
interface MultiBankConfig {
  // Fenêtre de temps pour détecter les virements circulaires (heures)
  circularTransferWindow: number;
  // Tolérance de montant pour matching (pourcentage)
  amountTolerance: number;
  // Seuil pour les concentrations suspectes (pourcentage)
  concentrationThreshold: number;
  // Nombre minimum de comptes pour analyse pertinente
  minAccounts: number;
}

const DEFAULT_CONFIG: MultiBankConfig = {
  circularTransferWindow: 48, // 48 heures
  amountTolerance: 0.02, // 2%
  concentrationThreshold: 0.8, // 80% des flux
  minAccounts: 2,
};

/**
 * Statistiques par banque
 */
interface BankStats {
  bankCode: string;
  bankName: string;
  accountCount: number;
  transactionCount: number;
  totalCredits: number;
  totalDebits: number;
  totalFees: number;
  avgBalance: number;
}

/**
 * MultiBankAudit - Analyse multi-banques consolidée
 *
 * Ce module analyse les opérations sur plusieurs banques:
 * - Détection des virements circulaires
 * - Comparaison des frais entre banques
 * - Optimisation de la gestion de trésorerie
 * - Consolidation des positions
 */
export class MultiBankAudit {
  private config: MultiBankConfig;
  private bankConditions: Map<string, BankConditions>;

  constructor(
    bankConditions: BankConditions[] = [],
    config?: Partial<MultiBankConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bankConditions = new Map(bankConditions.map(bc => [bc.bankCode, bc]));
  }

  /**
   * Analyser les transactions multi-banques
   */
  analyze(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Grouper par banque
    const byBank = this.groupByBank(transactions);

    // Vérifier qu'on a assez de banques
    if (byBank.size < this.config.minAccounts) {
      return anomalies; // Pas assez de données multi-banques
    }

    // 1. Calculer les statistiques par banque
    const bankStats = this.calculateBankStats(byBank);

    // 2. Détecter les virements circulaires
    anomalies.push(...this.detectCircularTransfers(transactions, byBank));

    // 3. Comparer les frais entre banques
    anomalies.push(...this.compareBankFees(bankStats));

    // 4. Détecter les concentrations anormales
    anomalies.push(...this.detectConcentration(bankStats, transactions));

    // 5. Optimisation de trésorerie
    anomalies.push(...this.analyzeTreasuryOptimization(bankStats, byBank));

    // 6. Détecter les doublons inter-banques
    anomalies.push(...this.detectCrossBankDuplicates(transactions));

    return anomalies;
  }

  /**
   * Grouper les transactions par banque
   */
  private groupByBank(transactions: Transaction[]): Map<string, Transaction[]> {
    const byBank = new Map<string, Transaction[]>();

    for (const t of transactions) {
      const bankKey = t.bankCode || 'UNKNOWN';
      if (!byBank.has(bankKey)) {
        byBank.set(bankKey, []);
      }
      byBank.get(bankKey)!.push(t);
    }

    return byBank;
  }

  /**
   * Calculer les statistiques par banque
   */
  private calculateBankStats(byBank: Map<string, Transaction[]>): Map<string, BankStats> {
    const stats = new Map<string, BankStats>();

    for (const [bankCode, transactions] of byBank) {
      const credits = transactions.filter(t => t.amount > 0);
      const debits = transactions.filter(t => t.amount < 0);
      const fees = transactions.filter(t =>
        t.description.toLowerCase().includes('frais') ||
        t.description.toLowerCase().includes('commission')
      );

      const accounts = new Set(transactions.map(t => t.accountNumber));
      const balances = transactions.map(t => t.balance);
      const avgBalance = balances.length > 0
        ? balances.reduce((a, b) => a + b, 0) / balances.length
        : 0;

      stats.set(bankCode, {
        bankCode,
        bankName: transactions[0]?.bankName || bankCode,
        accountCount: accounts.size,
        transactionCount: transactions.length,
        totalCredits: credits.reduce((sum, t) => sum + t.amount, 0),
        totalDebits: Math.abs(debits.reduce((sum, t) => sum + t.amount, 0)),
        totalFees: Math.abs(fees.reduce((sum, t) => sum + t.amount, 0)),
        avgBalance,
      });
    }

    return stats;
  }

  /**
   * Détecter les virements circulaires (A→B→C→A)
   */
  private detectCircularTransfers(
    transactions: Transaction[],
    _byBank: Map<string, Transaction[]>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Chercher les virements sortants et entrants de montants similaires
    const transfers = transactions.filter(t =>
      t.description.toLowerCase().includes('virement') ||
      t.description.toLowerCase().includes('transfer')
    );

    // Grouper par montant approximatif
    const byAmount = new Map<number, Transaction[]>();
    for (const t of transfers) {
      const roundedAmount = Math.round(Math.abs(t.amount) / 1000) * 1000;
      if (!byAmount.has(roundedAmount)) {
        byAmount.set(roundedAmount, []);
      }
      byAmount.get(roundedAmount)!.push(t);
    }

    // Chercher les patterns circulaires
    for (const [, amountTransfers] of byAmount) {
      if (amountTransfers.length < 3) continue;

      // Séparer crédits et débits
      const credits = amountTransfers.filter(t => t.amount > 0);
      const debits = amountTransfers.filter(t => t.amount < 0);

      // Chercher les correspondances temporelles
      for (const credit of credits) {
        for (const debit of debits) {
          if (credit.bankCode === debit.bankCode) continue;

          const timeDiff = Math.abs(
            differenceInHours(new Date(credit.date), new Date(debit.date))
          );

          if (timeDiff <= this.config.circularTransferWindow) {
            const amountDiff = Math.abs(credit.amount + debit.amount);
            const tolerance = Math.abs(credit.amount) * this.config.amountTolerance;

            if (amountDiff <= tolerance) {
              anomalies.push(this.createCircularTransferAnomaly(credit, debit));
            }
          }
        }
      }
    }

    return anomalies;
  }

  /**
   * Comparer les frais entre banques
   */
  private compareBankFees(bankStats: Map<string, BankStats>): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const stats = Array.from(bankStats.values());

    if (stats.length < 2) return anomalies;

    // Calculer le ratio frais/volume pour chaque banque
    const feeRatios = stats.map(s => ({
      ...s,
      feeRatio: s.totalFees / (s.totalCredits + s.totalDebits),
    })).filter(s => s.totalCredits + s.totalDebits > 0);

    if (feeRatios.length < 2) return anomalies;

    // Trouver les banques les plus et moins chères
    feeRatios.sort((a, b) => a.feeRatio - b.feeRatio);

    const cheapest = feeRatios[0];
    const mostExpensive = feeRatios[feeRatios.length - 1];

    // Si l'écart est significatif (> 50%)
    if (mostExpensive.feeRatio > cheapest.feeRatio * 1.5) {
      const potentialSavings = (mostExpensive.feeRatio - cheapest.feeRatio) *
                               (mostExpensive.totalCredits + mostExpensive.totalDebits);

      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.MULTI_BANK_ISSUE,
        severity: potentialSavings > 100000 ? Severity.HIGH : Severity.MEDIUM,
        confidence: 0.75,
        amount: potentialSavings,
        transactions: [],
        evidence: [
          {
            type: 'CHEAPEST_BANK',
            description: 'Banque la moins chère',
            value: `${cheapest.bankName} (${(cheapest.feeRatio * 100).toFixed(2)}% de frais)`,
          },
          {
            type: 'MOST_EXPENSIVE_BANK',
            description: 'Banque la plus chère',
            value: `${mostExpensive.bankName} (${(mostExpensive.feeRatio * 100).toFixed(2)}% de frais)`,
          },
          {
            type: 'POTENTIAL_SAVINGS',
            description: 'Économies potentielles',
            value: `${potentialSavings.toLocaleString('fr-FR')} FCFA`,
          },
          {
            type: 'FEE_DIFFERENCE',
            description: 'Différence de frais',
            value: `${((mostExpensive.feeRatio / cheapest.feeRatio - 1) * 100).toFixed(1)}%`,
          },
        ],
        recommendation:
          `Écart significatif de frais entre ${mostExpensive.bankName} et ${cheapest.bankName}. ` +
          `Économies potentielles de ${potentialSavings.toLocaleString('fr-FR')} FCFA ` +
          `en transférant une partie de l'activité vers la banque moins chère.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    return anomalies;
  }

  /**
   * Détecter les concentrations anormales
   */
  private detectConcentration(
    bankStats: Map<string, BankStats>,
    _transactions: Transaction[]
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const stats = Array.from(bankStats.values());

    const totalVolume = stats.reduce((sum, s) => sum + s.totalCredits + s.totalDebits, 0);

    for (const stat of stats) {
      const bankVolume = stat.totalCredits + stat.totalDebits;
      const concentration = bankVolume / totalVolume;

      if (concentration > this.config.concentrationThreshold) {
        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.MULTI_BANK_ISSUE,
          severity: Severity.MEDIUM,
          confidence: 0.8,
          amount: bankVolume,
          transactions: [],
          evidence: [
            {
              type: 'BANK',
              description: 'Banque',
              value: stat.bankName,
            },
            {
              type: 'CONCENTRATION',
              description: 'Concentration',
              value: `${(concentration * 100).toFixed(1)}%`,
            },
            {
              type: 'VOLUME',
              description: 'Volume',
              value: `${bankVolume.toLocaleString('fr-FR')} FCFA`,
            },
          ],
          recommendation:
            `Concentration élevée (${(concentration * 100).toFixed(1)}%) des flux bancaires ` +
            `sur ${stat.bankName}. Envisager une diversification pour réduire le risque ` +
            `et optimiser les conditions tarifaires.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Analyser les opportunités d'optimisation de trésorerie
   */
  private analyzeTreasuryOptimization(
    bankStats: Map<string, BankStats>,
    _byBank: Map<string, Transaction[]>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const stats = Array.from(bankStats.values());

    // Chercher les comptes avec solde moyen élevé mais frais élevés
    for (const stat of stats) {
      if (stat.avgBalance > 5000000 && stat.totalFees > 50000) { // > 5M solde, > 50k frais
        const _conditions = this.bankConditions.get(stat.bankCode);

        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.MULTI_BANK_ISSUE,
          severity: Severity.LOW,
          confidence: 0.7,
          amount: stat.totalFees,
          transactions: [],
          evidence: [
            {
              type: 'BANK',
              description: 'Banque',
              value: stat.bankName,
            },
            {
              type: 'AVG_BALANCE',
              description: 'Solde moyen',
              value: `${stat.avgBalance.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'TOTAL_FEES',
              description: 'Frais totaux',
              value: `${stat.totalFees.toLocaleString('fr-FR')} FCFA`,
            },
          ],
          recommendation:
            `Solde moyen élevé de ${stat.avgBalance.toLocaleString('fr-FR')} FCFA ` +
            `chez ${stat.bankName} avec ${stat.totalFees.toLocaleString('fr-FR')} FCFA de frais. ` +
            `Négocier une réduction des frais ou des conditions préférentielles basées sur ce solde.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    // Chercher les déséquilibres de trésorerie
    const positiveBalanceBanks = stats.filter(s => s.avgBalance > 0);
    const negativeBalanceBanks = stats.filter(s => s.avgBalance < 0);

    if (positiveBalanceBanks.length > 0 && negativeBalanceBanks.length > 0) {
      const excessCash = positiveBalanceBanks.reduce((sum, s) => sum + s.avgBalance, 0);
      const overdraftNeeded = Math.abs(negativeBalanceBanks.reduce((sum, s) => sum + s.avgBalance, 0));

      if (excessCash > overdraftNeeded * 0.5) {
        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.MULTI_BANK_ISSUE,
          severity: Severity.MEDIUM,
          confidence: 0.85,
          amount: Math.min(excessCash, overdraftNeeded),
          transactions: [],
          evidence: [
            {
              type: 'EXCESS_CASH',
              description: 'Excédent de trésorerie',
              value: `${excessCash.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'OVERDRAFT',
              description: 'Découvert utilisé',
              value: `${overdraftNeeded.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'BANKS_WITH_EXCESS',
              description: 'Banques excédentaires',
              value: positiveBalanceBanks.map(s => s.bankName).join(', '),
            },
            {
              type: 'BANKS_WITH_OVERDRAFT',
              description: 'Banques en découvert',
              value: negativeBalanceBanks.map(s => s.bankName).join(', '),
            },
          ],
          recommendation:
            `Déséquilibre de trésorerie: ${excessCash.toLocaleString('fr-FR')} FCFA d'excédent ` +
            `alors que ${overdraftNeeded.toLocaleString('fr-FR')} FCFA de découvert sont utilisés ailleurs. ` +
            `Optimiser les équilibrages inter-banques pour réduire les frais financiers.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Détecter les doublons inter-banques
   */
  private detectCrossBankDuplicates(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Grouper par montant et date
    const grouped = new Map<string, Transaction[]>();

    for (const t of transactions) {
      const key = `${Math.abs(t.amount)}_${format(new Date(t.date), 'yyyy-MM-dd')}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(t);
    }

    // Chercher les groupes avec transactions de banques différentes
    for (const [, group] of grouped) {
      const banks = new Set(group.map(t => t.bankCode));

      if (banks.size > 1 && group.length >= 2) {
        // Même montant, même date, banques différentes
        const hasDebit = group.some(t => t.amount < 0);
        const hasCredit = group.some(t => t.amount > 0);

        // Si pas de paire crédit/débit, c'est potentiellement un doublon
        if (!hasDebit || !hasCredit) {
          const totalAmount = group.reduce((sum, t) => sum + Math.abs(t.amount), 0);

          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.MULTI_BANK_ISSUE,
            severity: Severity.MEDIUM,
            confidence: 0.7,
            amount: totalAmount,
            transactions: group,
            evidence: [
              {
                type: 'AMOUNT',
                description: 'Montant',
                value: `${(totalAmount / group.length).toLocaleString('fr-FR')} FCFA`,
              },
              {
                type: 'BANKS',
                description: 'Banques concernées',
                value: Array.from(banks).join(', '),
              },
              {
                type: 'COUNT',
                description: 'Occurrences',
                value: group.length,
              },
            ],
            recommendation:
              `${group.length} transactions similaires détectées le même jour sur différentes banques. ` +
              `Vérifier s'il ne s'agit pas d'un doublon de paiement.`,
            status: 'pending',
            detectedAt: new Date(),
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Créer anomalie pour virement circulaire
   */
  private createCircularTransferAnomaly(credit: Transaction, debit: Transaction): Anomaly {
    return {
      id: uuidv4(),
      type: AnomalyType.MULTI_BANK_ISSUE,
      severity: Severity.HIGH,
      confidence: 0.85,
      amount: Math.abs(credit.amount),
      transactions: [credit, debit],
      evidence: [
        {
          type: 'CREDIT_BANK',
          description: 'Banque créditée',
          value: `${credit.bankName} (+${credit.amount.toLocaleString('fr-FR')} FCFA)`,
        },
        {
          type: 'DEBIT_BANK',
          description: 'Banque débitée',
          value: `${debit.bankName} (${debit.amount.toLocaleString('fr-FR')} FCFA)`,
        },
        {
          type: 'TIME_DIFF',
          description: 'Écart temporel',
          value: `${differenceInHours(new Date(credit.date), new Date(debit.date))} heures`,
        },
      ],
      recommendation:
        `Possible virement circulaire détecté: ${Math.abs(debit.amount).toLocaleString('fr-FR')} FCFA ` +
        `transférés de ${debit.bankName} vers ${credit.bankName}. ` +
        `Vérifier la justification économique de ce mouvement.`,
      status: 'pending',
      detectedAt: new Date(),
    };
  }
}
