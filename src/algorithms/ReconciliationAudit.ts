import { v4 as uuidv4 } from 'uuid';
import { format, differenceInDays } from 'date-fns';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
} from '../types';

/**
 * Configuration pour le rapprochement
 */
interface ReconciliationConfig {
  // Tolérance de montant (pourcentage)
  amountTolerance: number;
  // Fenêtre de temps pour matcher (jours)
  dateWindow: number;
  // Seuil de similarité des libellés
  descriptionSimilarity: number;
}

const DEFAULT_CONFIG: ReconciliationConfig = {
  amountTolerance: 0.01, // 1%
  dateWindow: 5,
  descriptionSimilarity: 0.6,
};

/**
 * Enregistrement comptable à rapprocher
 */
export interface AccountingEntry {
  id: string;
  date: Date;
  amount: number;
  description: string;
  reference?: string;
  accountCode?: string;
}

/**
 * Résultat de matching
 */
interface MatchResult {
  bankTransaction: Transaction;
  accountingEntry: AccountingEntry | null;
  matchScore: number;
  matchType: 'exact' | 'partial' | 'unmatched';
}

/**
 * ReconciliationAudit - Rapprochement bancaire automatisé
 *
 * Ce module compare les transactions bancaires avec les écritures comptables:
 * - Matching automatique par montant et date
 * - Détection des écritures non rapprochées
 * - Identification des écarts
 * - Suggestion de rapprochements
 */
export class ReconciliationAudit {
  private config: ReconciliationConfig;

  constructor(config?: Partial<ReconciliationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Effectuer le rapprochement et détecter les anomalies
   */
  analyze(
    transactions: Transaction[],
    accountingEntries: AccountingEntry[] = []
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Si pas d'écritures comptables, faire l'auto-rapprochement bancaire
    if (accountingEntries.length === 0) {
      return this.selfReconciliation(transactions);
    }

    // Rapprochement complet
    const matches = this.matchTransactions(transactions, accountingEntries);

    // 1. Transactions bancaires non rapprochées
    const unmatchedBank = matches.filter(m => m.matchType === 'unmatched');
    if (unmatchedBank.length > 0) {
      anomalies.push(this.createUnmatchedBankAnomaly(unmatchedBank));
    }

    // 2. Écritures comptables non rapprochées
    const unmatchedAccounting = this.findUnmatchedAccounting(accountingEntries, matches);
    if (unmatchedAccounting.length > 0) {
      anomalies.push(this.createUnmatchedAccountingAnomaly(unmatchedAccounting));
    }

    // 3. Rapprochements partiels (écarts)
    const partialMatches = matches.filter(m => m.matchType === 'partial');
    for (const partial of partialMatches) {
      if (partial.accountingEntry) {
        anomalies.push(this.createPartialMatchAnomaly(partial));
      }
    }

    return anomalies;
  }

  /**
   * Auto-rapprochement bancaire (sans données comptables)
   */
  private selfReconciliation(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Grouper par compte
    const byAccount = new Map<string, Transaction[]>();
    for (const t of transactions) {
      if (!byAccount.has(t.accountNumber)) {
        byAccount.set(t.accountNumber, []);
      }
      byAccount.get(t.accountNumber)!.push(t);
    }

    for (const [account, accountTransactions] of byAccount) {
      // Vérifier la continuité des soldes
      const sorted = [...accountTransactions].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Détecter les écarts
      const gaps = this.detectBalanceGaps(sorted);
      if (gaps.length > 0) {
        anomalies.push(this.createBalanceGapsAnomaly(account, gaps));
      }

      // Détecter les transactions orphelines
      const orphans = this.detectOrphanTransactions(sorted);
      for (const orphan of orphans) {
        anomalies.push(this.createOrphanAnomaly(orphan));
      }
    }

    return anomalies;
  }

  /**
   * Matcher les transactions avec les écritures comptables
   */
  private matchTransactions(
    transactions: Transaction[],
    entries: AccountingEntry[]
  ): MatchResult[] {
    const results: MatchResult[] = [];
    const usedEntries = new Set<string>();

    for (const transaction of transactions) {
      let bestMatch: { entry: AccountingEntry; score: number } | null = null;

      for (const entry of entries) {
        if (usedEntries.has(entry.id)) continue;

        const score = this.calculateMatchScore(transaction, entry);

        if (score > 0.8 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { entry, score };
        }
      }

      if (bestMatch && bestMatch.score >= 0.95) {
        results.push({
          bankTransaction: transaction,
          accountingEntry: bestMatch.entry,
          matchScore: bestMatch.score,
          matchType: 'exact',
        });
        usedEntries.add(bestMatch.entry.id);
      } else if (bestMatch) {
        results.push({
          bankTransaction: transaction,
          accountingEntry: bestMatch.entry,
          matchScore: bestMatch.score,
          matchType: 'partial',
        });
        usedEntries.add(bestMatch.entry.id);
      } else {
        results.push({
          bankTransaction: transaction,
          accountingEntry: null,
          matchScore: 0,
          matchType: 'unmatched',
        });
      }
    }

    return results;
  }

  /**
   * Calculer le score de matching
   */
  private calculateMatchScore(transaction: Transaction, entry: AccountingEntry): number {
    let score = 0;

    // Score montant (40%)
    const amountMatch = this.matchAmount(transaction.amount, entry.amount);
    score += amountMatch * 0.4;

    // Score date (30%)
    const dateMatch = this.matchDate(new Date(transaction.date), entry.date);
    score += dateMatch * 0.3;

    // Score description (20%)
    const descMatch = this.matchDescription(transaction.description, entry.description);
    score += descMatch * 0.2;

    // Score référence (10%)
    if (transaction.reference && entry.reference) {
      if (transaction.reference === entry.reference) {
        score += 0.1;
      }
    }

    return score;
  }

  /**
   * Matcher les montants avec tolérance
   */
  private matchAmount(bankAmount: number, accountingAmount: number): number {
    const diff = Math.abs(Math.abs(bankAmount) - Math.abs(accountingAmount));
    const maxAmount = Math.max(Math.abs(bankAmount), Math.abs(accountingAmount));

    if (maxAmount === 0) return bankAmount === accountingAmount ? 1 : 0;

    const tolerance = maxAmount * this.config.amountTolerance;

    if (diff <= tolerance) {
      return 1 - (diff / tolerance) * 0.1; // Légère pénalité pour différence
    }

    return Math.max(0, 1 - (diff / maxAmount));
  }

  /**
   * Matcher les dates avec fenêtre
   */
  private matchDate(bankDate: Date, accountingDate: Date): number {
    const days = Math.abs(differenceInDays(bankDate, accountingDate));

    if (days === 0) return 1;
    if (days <= this.config.dateWindow) {
      return 1 - (days / this.config.dateWindow) * 0.5;
    }

    return 0;
  }

  /**
   * Matcher les descriptions
   */
  private matchDescription(bankDesc: string, accountingDesc: string): number {
    const a = bankDesc.toLowerCase();
    const b = accountingDesc.toLowerCase();

    if (a === b) return 1;

    // Similarité par mots communs
    const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
    const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));

    let common = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) common++;
    }

    const total = Math.max(wordsA.size, wordsB.size);
    if (total === 0) return 0;

    return common / total;
  }

  /**
   * Trouver les écritures comptables non rapprochées
   */
  private findUnmatchedAccounting(
    entries: AccountingEntry[],
    matches: MatchResult[]
  ): AccountingEntry[] {
    const matchedIds = new Set(
      matches
        .filter(m => m.accountingEntry)
        .map(m => m.accountingEntry!.id)
    );

    return entries.filter(e => !matchedIds.has(e.id));
  }

  /**
   * Détecter les écarts de solde
   */
  private detectBalanceGaps(transactions: Transaction[]): { transaction: Transaction; expectedBalance: number }[] {
    const gaps: { transaction: Transaction; expectedBalance: number }[] = [];

    for (let i = 1; i < transactions.length; i++) {
      const prev = transactions[i - 1];
      const curr = transactions[i];

      const expectedBalance = prev.balance + curr.amount;
      const diff = Math.abs(expectedBalance - curr.balance);

      if (diff > 1) { // Plus d'1 FCFA d'écart
        gaps.push({ transaction: curr, expectedBalance });
      }
    }

    return gaps;
  }

  /**
   * Détecter les transactions orphelines (sans contexte)
   */
  private detectOrphanTransactions(transactions: Transaction[]): Transaction[] {
    const orphans: Transaction[] = [];

    for (let i = 0; i < transactions.length; i++) {
      const curr = transactions[i];
      const prev = i > 0 ? transactions[i - 1] : null;
      const next = i < transactions.length - 1 ? transactions[i + 1] : null;

      // Une transaction est orpheline si elle a un écart de plus de 30 jours
      // avec ses voisines
      const prevGap = prev ? differenceInDays(new Date(curr.date), new Date(prev.date)) : 0;
      const nextGap = next ? differenceInDays(new Date(next.date), new Date(curr.date)) : 0;

      if (prevGap > 30 && nextGap > 30) {
        orphans.push(curr);
      }
    }

    return orphans;
  }

  /**
   * Créer anomalie pour transactions bancaires non rapprochées
   */
  private createUnmatchedBankAnomaly(matches: MatchResult[]): Anomaly {
    const transactions = matches.map(m => m.bankTransaction);
    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      id: uuidv4(),
      type: AnomalyType.RECONCILIATION_GAP,
      severity: transactions.length > 10 ? Severity.HIGH :
                transactions.length > 5 ? Severity.MEDIUM : Severity.LOW,
      confidence: 0.85,
      amount: totalAmount,
      transactions: transactions.slice(0, 20),
      evidence: [
        {
          type: 'UNMATCHED_COUNT',
          description: 'Transactions non rapprochées',
          value: transactions.length,
        },
        {
          type: 'TOTAL_AMOUNT',
          description: 'Montant total',
          value: `${totalAmount.toLocaleString('fr-FR')} FCFA`,
        },
      ],
      recommendation:
        `${transactions.length} transactions bancaires n'ont pas de correspondance comptable ` +
        `pour un total de ${totalAmount.toLocaleString('fr-FR')} FCFA. ` +
        `Vérifier les écritures comptables manquantes.`,
      status: 'pending',
      detectedAt: new Date(),
    };
  }

  /**
   * Créer anomalie pour écritures comptables non rapprochées
   */
  private createUnmatchedAccountingAnomaly(entries: AccountingEntry[]): Anomaly {
    const totalAmount = entries.reduce((sum, e) => sum + Math.abs(e.amount), 0);

    return {
      id: uuidv4(),
      type: AnomalyType.RECONCILIATION_GAP,
      severity: entries.length > 10 ? Severity.HIGH :
                entries.length > 5 ? Severity.MEDIUM : Severity.LOW,
      confidence: 0.85,
      amount: totalAmount,
      transactions: [],
      evidence: [
        {
          type: 'UNMATCHED_COUNT',
          description: 'Écritures non rapprochées',
          value: entries.length,
        },
        {
          type: 'TOTAL_AMOUNT',
          description: 'Montant total',
          value: `${totalAmount.toLocaleString('fr-FR')} FCFA`,
        },
        ...entries.slice(0, 5).map((e, i) => ({
          type: `ENTRY_${i + 1}`,
          description: e.description,
          value: `${e.amount.toLocaleString('fr-FR')} FCFA (${format(e.date, 'dd/MM/yyyy')})`,
        })),
      ],
      recommendation:
        `${entries.length} écritures comptables sans correspondance bancaire ` +
        `pour un total de ${totalAmount.toLocaleString('fr-FR')} FCFA. ` +
        `Vérifier si ces opérations ont bien été exécutées par la banque.`,
      status: 'pending',
      detectedAt: new Date(),
    };
  }

  /**
   * Créer anomalie pour rapprochement partiel
   */
  private createPartialMatchAnomaly(match: MatchResult): Anomaly {
    const diff = Math.abs(match.bankTransaction.amount) -
                 Math.abs(match.accountingEntry!.amount);

    return {
      id: uuidv4(),
      type: AnomalyType.RECONCILIATION_GAP,
      severity: Math.abs(diff) > 10000 ? Severity.HIGH : Severity.MEDIUM,
      confidence: match.matchScore,
      amount: Math.abs(diff),
      transactions: [match.bankTransaction],
      evidence: [
        {
          type: 'BANK_AMOUNT',
          description: 'Montant banque',
          value: `${Math.abs(match.bankTransaction.amount).toLocaleString('fr-FR')} FCFA`,
        },
        {
          type: 'ACCOUNTING_AMOUNT',
          description: 'Montant comptable',
          value: `${Math.abs(match.accountingEntry!.amount).toLocaleString('fr-FR')} FCFA`,
        },
        {
          type: 'DIFFERENCE',
          description: 'Écart',
          value: `${diff.toLocaleString('fr-FR')} FCFA`,
        },
        {
          type: 'MATCH_SCORE',
          description: 'Score de correspondance',
          value: `${(match.matchScore * 100).toFixed(1)}%`,
        },
      ],
      recommendation:
        `Écart de ${Math.abs(diff).toLocaleString('fr-FR')} FCFA entre la transaction bancaire ` +
        `et l'écriture comptable. Vérifier et régulariser cet écart.`,
      status: 'pending',
      detectedAt: new Date(),
    };
  }

  /**
   * Créer anomalie pour écarts de solde
   */
  private createBalanceGapsAnomaly(
    account: string,
    gaps: { transaction: Transaction; expectedBalance: number }[]
  ): Anomaly {
    const totalGap = gaps.reduce(
      (sum, g) => sum + Math.abs(g.transaction.balance - g.expectedBalance),
      0
    );

    return {
      id: uuidv4(),
      type: AnomalyType.RECONCILIATION_GAP,
      severity: totalGap > 100000 ? Severity.CRITICAL :
                totalGap > 10000 ? Severity.HIGH : Severity.MEDIUM,
      confidence: 0.9,
      amount: totalGap,
      transactions: gaps.map(g => g.transaction).slice(0, 10),
      evidence: [
        {
          type: 'ACCOUNT',
          description: 'Compte',
          value: account,
        },
        {
          type: 'GAP_COUNT',
          description: 'Nombre d\'écarts',
          value: gaps.length,
        },
        {
          type: 'TOTAL_GAP',
          description: 'Écart total',
          value: `${totalGap.toLocaleString('fr-FR')} FCFA`,
        },
      ],
      recommendation:
        `${gaps.length} écarts de solde détectés sur le compte ${account} ` +
        `pour un total de ${totalGap.toLocaleString('fr-FR')} FCFA. ` +
        `Des opérations pourraient être manquantes dans le relevé.`,
      status: 'pending',
      detectedAt: new Date(),
    };
  }

  /**
   * Créer anomalie pour transaction orpheline
   */
  private createOrphanAnomaly(transaction: Transaction): Anomaly {
    return {
      id: uuidv4(),
      type: AnomalyType.RECONCILIATION_GAP,
      severity: Severity.LOW,
      confidence: 0.7,
      amount: Math.abs(transaction.amount),
      transactions: [transaction],
      evidence: [
        {
          type: 'DATE',
          description: 'Date',
          value: format(new Date(transaction.date), 'dd/MM/yyyy'),
        },
        {
          type: 'DESCRIPTION',
          description: 'Libellé',
          value: transaction.description,
        },
        {
          type: 'AMOUNT',
          description: 'Montant',
          value: `${Math.abs(transaction.amount).toLocaleString('fr-FR')} FCFA`,
        },
      ],
      recommendation:
        `Transaction isolée du ${format(new Date(transaction.date), 'dd/MM/yyyy')} ` +
        `sans contexte (écart > 30 jours avec les transactions voisines). ` +
        `Vérifier s'il manque des relevés.`,
      status: 'pending',
      detectedAt: new Date(),
    };
  }
}
