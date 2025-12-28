import { v4 as uuidv4 } from 'uuid';
import { format, differenceInDays } from 'date-fns';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  DailyBalance,
} from '../types';

/**
 * Configuration pour l'analyse de trésorerie
 */
interface CashflowConfig {
  // Seuil de solde minimum critique
  criticalBalanceThreshold: number;
  // Nombre de jours consécutifs en négatif pour alerte
  consecutiveNegativeDays: number;
  // Pourcentage de variation pour détecter les pics
  variationThreshold: number;
  // Seuil pour les écarts de solde suspects
  balanceDiscrepancyThreshold: number;
}

const DEFAULT_CONFIG: CashflowConfig = {
  criticalBalanceThreshold: 0,
  consecutiveNegativeDays: 3,
  variationThreshold: 0.5, // 50%
  balanceDiscrepancyThreshold: 1, // 1 FCFA de tolérance
};

/**
 * CashflowAudit - Analyse de trésorerie et détection d'anomalies
 *
 * Ce module analyse les flux de trésorerie:
 * - Détection des soldes négatifs non autorisés
 * - Écarts entre soldes calculés et reportés
 * - Patterns inhabituels de flux
 * - Crises de liquidité
 * - Pics de dépenses ou recettes anormaux
 */
export class CashflowAudit {
  private config: CashflowConfig;

  constructor(config?: Partial<CashflowConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyser les transactions pour détecter les anomalies de trésorerie
   */
  analyze(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    if (transactions.length === 0) return anomalies;

    // Trier par date
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // 1. Calculer les soldes quotidiens
    const dailyBalances = this.calculateDailyBalances(sorted);

    // 2. Détecter les soldes négatifs
    anomalies.push(...this.detectNegativeBalances(sorted, dailyBalances));

    // 3. Détecter les écarts de solde
    anomalies.push(...this.detectBalanceDiscrepancies(sorted));

    // 4. Détecter les patterns inhabituels
    anomalies.push(...this.detectUnusualPatterns(sorted, dailyBalances));

    // 5. Détecter les crises de liquidité
    anomalies.push(...this.detectLiquidityCrisis(dailyBalances));

    // 6. Détecter les pics anormaux
    anomalies.push(...this.detectUnexpectedSpikes(sorted));

    return anomalies;
  }

  /**
   * Calculer les soldes quotidiens
   */
  private calculateDailyBalances(transactions: Transaction[]): Map<string, DailyBalance> {
    const balances = new Map<string, DailyBalance>();

    for (const transaction of transactions) {
      const dateKey = format(new Date(transaction.date), 'yyyy-MM-dd');

      // Utiliser le solde après transaction comme solde du jour
      balances.set(dateKey, {
        date: new Date(transaction.date),
        balance: transaction.balance,
        accountNumber: transaction.accountNumber,
      });
    }

    return balances;
  }

  /**
   * Détecter les périodes de solde négatif
   */
  private detectNegativeBalances(
    transactions: Transaction[],
    dailyBalances: Map<string, DailyBalance>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const negativeRanges: { start: Date; end: Date; minBalance: number; transactions: Transaction[] }[] = [];

    let currentRange: typeof negativeRanges[0] | null = null;

    const sortedDates = Array.from(dailyBalances.keys()).sort();

    for (const dateKey of sortedDates) {
      const balance = dailyBalances.get(dateKey)!;

      if (balance.balance < this.config.criticalBalanceThreshold) {
        if (!currentRange) {
          currentRange = {
            start: balance.date,
            end: balance.date,
            minBalance: balance.balance,
            transactions: [],
          };
        } else {
          currentRange.end = balance.date;
          currentRange.minBalance = Math.min(currentRange.minBalance, balance.balance);
        }

        // Ajouter les transactions de ce jour
        const dayTransactions = transactions.filter(t =>
          format(new Date(t.date), 'yyyy-MM-dd') === dateKey
        );
        currentRange.transactions.push(...dayTransactions);
      } else {
        if (currentRange) {
          negativeRanges.push(currentRange);
          currentRange = null;
        }
      }
    }

    // Fermer la dernière range si nécessaire
    if (currentRange) {
      negativeRanges.push(currentRange);
    }

    // Créer des anomalies pour les périodes significatives
    for (const range of negativeRanges) {
      const days = differenceInDays(range.end, range.start) + 1;

      if (days >= this.config.consecutiveNegativeDays) {
        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.CASHFLOW_ANOMALY,
          severity: Math.abs(range.minBalance) > 1000000 ? Severity.CRITICAL :
                    days > 10 ? Severity.HIGH : Severity.MEDIUM,
          confidence: 0.95,
          amount: Math.abs(range.minBalance),
          transactions: range.transactions.slice(0, 20),
          evidence: [
            {
              type: 'NEGATIVE_PERIOD',
              description: 'Durée en solde négatif',
              value: `${days} jours`,
            },
            {
              type: 'MIN_BALANCE',
              description: 'Solde minimum atteint',
              value: `${range.minBalance.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'PERIOD_START',
              description: 'Début de période',
              value: format(range.start, 'dd/MM/yyyy'),
            },
            {
              type: 'PERIOD_END',
              description: 'Fin de période',
              value: format(range.end, 'dd/MM/yyyy'),
            },
          ],
          recommendation:
            `Solde négatif pendant ${days} jours (du ${format(range.start, 'dd/MM/yyyy')} ` +
            `au ${format(range.end, 'dd/MM/yyyy')}). Solde minimum: ${range.minBalance.toLocaleString('fr-FR')} FCFA. ` +
            `Vérifier l'autorisation de découvert et calculer les agios correspondants.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Détecter les écarts entre solde calculé et solde reporté
   */
  private detectBalanceDiscrepancies(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const discrepancies: { transaction: Transaction; expected: number; actual: number; diff: number }[] = [];

    for (let i = 1; i < transactions.length; i++) {
      const prev = transactions[i - 1];
      const curr = transactions[i];

      // Vérifier si même compte
      if (prev.accountNumber !== curr.accountNumber) continue;

      // Solde attendu = solde précédent + montant courant
      const expectedBalance = prev.balance + curr.amount;
      const actualBalance = curr.balance;
      const diff = Math.abs(expectedBalance - actualBalance);

      if (diff > this.config.balanceDiscrepancyThreshold) {
        discrepancies.push({
          transaction: curr,
          expected: expectedBalance,
          actual: actualBalance,
          diff,
        });
      }
    }

    // Grouper les écarts significatifs
    if (discrepancies.length > 0) {
      const totalDiscrepancy = discrepancies.reduce((sum, d) => sum + d.diff, 0);

      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.CASHFLOW_ANOMALY,
        severity: totalDiscrepancy > 10000 ? Severity.CRITICAL :
                  discrepancies.length > 5 ? Severity.HIGH : Severity.MEDIUM,
        confidence: 0.9,
        amount: totalDiscrepancy,
        transactions: discrepancies.map(d => d.transaction).slice(0, 10),
        evidence: [
          {
            type: 'DISCREPANCY_COUNT',
            description: 'Nombre d\'écarts détectés',
            value: discrepancies.length,
          },
          {
            type: 'TOTAL_DISCREPANCY',
            description: 'Écart total',
            value: `${totalDiscrepancy.toLocaleString('fr-FR')} FCFA`,
          },
          ...discrepancies.slice(0, 3).map((d, i) => ({
            type: `DISCREPANCY_${i + 1}`,
            description: `Écart #${i + 1}`,
            value: `Attendu: ${d.expected.toLocaleString('fr-FR')}, Réel: ${d.actual.toLocaleString('fr-FR')} (${d.diff.toLocaleString('fr-FR')} FCFA)`,
          })),
        ],
        recommendation:
          `${discrepancies.length} écarts de solde détectés pour un total de ` +
          `${totalDiscrepancy.toLocaleString('fr-FR')} FCFA. ` +
          `Des opérations pourraient être manquantes ou mal enregistrées. ` +
          `Demander un relevé détaillé à la banque.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    return anomalies;
  }

  /**
   * Détecter les patterns inhabituels de flux
   */
  private detectUnusualPatterns(
    transactions: Transaction[],
    _dailyBalances: Map<string, DailyBalance>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Analyser les flux mensuels
    const monthlyFlows = new Map<string, { credits: number; debits: number; transactions: Transaction[] }>();

    for (const transaction of transactions) {
      const monthKey = format(new Date(transaction.date), 'yyyy-MM');

      if (!monthlyFlows.has(monthKey)) {
        monthlyFlows.set(monthKey, { credits: 0, debits: 0, transactions: [] });
      }

      const flow = monthlyFlows.get(monthKey)!;
      if (transaction.amount > 0) {
        flow.credits += transaction.amount;
      } else {
        flow.debits += Math.abs(transaction.amount);
      }
      flow.transactions.push(transaction);
    }

    // Calculer les moyennes
    const flows = Array.from(monthlyFlows.values());
    if (flows.length < 3) return anomalies; // Pas assez de données

    const avgCredits = flows.reduce((sum, f) => sum + f.credits, 0) / flows.length;
    const avgDebits = flows.reduce((sum, f) => sum + f.debits, 0) / flows.length;

    // Détecter les mois anormaux
    for (const [month, flow] of monthlyFlows) {
      const creditVariation = Math.abs(flow.credits - avgCredits) / avgCredits;
      const debitVariation = Math.abs(flow.debits - avgDebits) / avgDebits;

      if (creditVariation > this.config.variationThreshold || debitVariation > this.config.variationThreshold) {
        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.CASHFLOW_ANOMALY,
          severity: creditVariation > 1 || debitVariation > 1 ? Severity.HIGH : Severity.MEDIUM,
          confidence: 0.75,
          amount: Math.abs(flow.credits - avgCredits) + Math.abs(flow.debits - avgDebits),
          transactions: flow.transactions.slice(0, 10),
          evidence: [
            {
              type: 'MONTH',
              description: 'Mois concerné',
              value: month,
            },
            {
              type: 'CREDITS',
              description: 'Crédits du mois',
              value: `${flow.credits.toLocaleString('fr-FR')} FCFA (moy: ${avgCredits.toLocaleString('fr-FR')})`,
            },
            {
              type: 'DEBITS',
              description: 'Débits du mois',
              value: `${flow.debits.toLocaleString('fr-FR')} FCFA (moy: ${avgDebits.toLocaleString('fr-FR')})`,
            },
            {
              type: 'CREDIT_VARIATION',
              description: 'Variation crédits',
              value: `${(creditVariation * 100).toFixed(1)}%`,
            },
            {
              type: 'DEBIT_VARIATION',
              description: 'Variation débits',
              value: `${(debitVariation * 100).toFixed(1)}%`,
            },
          ],
          recommendation:
            `Flux inhabituels détectés pour ${month}. ` +
            `Variation des crédits: ${(creditVariation * 100).toFixed(1)}%, ` +
            `variation des débits: ${(debitVariation * 100).toFixed(1)}%. ` +
            `Analyser les opérations exceptionnelles de cette période.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Détecter les crises de liquidité
   */
  private detectLiquidityCrisis(dailyBalances: Map<string, DailyBalance>): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const balances = Array.from(dailyBalances.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    if (balances.length < 10) return anomalies;

    // Calculer la tendance
    const firstHalf = balances.slice(0, Math.floor(balances.length / 2));
    const secondHalf = balances.slice(Math.floor(balances.length / 2));

    const avgFirst = firstHalf.reduce((sum, b) => sum + b.balance, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, b) => sum + b.balance, 0) / secondHalf.length;

    // Si tendance fortement baissière
    if (avgFirst > 0 && avgSecond < avgFirst * 0.5) {
      const decline = avgFirst - avgSecond;

      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.CASHFLOW_ANOMALY,
        severity: avgSecond < 0 ? Severity.CRITICAL : Severity.HIGH,
        confidence: 0.8,
        amount: decline,
        transactions: [], // Pas de transaction spécifique
        evidence: [
          {
            type: 'TREND',
            description: 'Tendance',
            value: 'Fortement baissière',
          },
          {
            type: 'AVG_FIRST_HALF',
            description: 'Solde moyen 1ère période',
            value: `${avgFirst.toLocaleString('fr-FR')} FCFA`,
          },
          {
            type: 'AVG_SECOND_HALF',
            description: 'Solde moyen 2ème période',
            value: `${avgSecond.toLocaleString('fr-FR')} FCFA`,
          },
          {
            type: 'DECLINE',
            description: 'Baisse',
            value: `${decline.toLocaleString('fr-FR')} FCFA (${((decline / avgFirst) * 100).toFixed(1)}%)`,
          },
        ],
        recommendation:
          `Tendance baissière importante de la trésorerie: solde moyen passé de ` +
          `${avgFirst.toLocaleString('fr-FR')} à ${avgSecond.toLocaleString('fr-FR')} FCFA. ` +
          `Analyser les causes et prévoir des mesures correctives.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    return anomalies;
  }

  /**
   * Détecter les pics de transactions anormaux
   */
  private detectUnexpectedSpikes(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Statistiques sur les montants
    const amounts = transactions.map(t => Math.abs(t.amount));
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length
    );

    // Détecter les pics (> 3 écarts-types)
    const threshold = mean + 3 * stdDev;

    for (const transaction of transactions) {
      if (Math.abs(transaction.amount) > threshold) {
        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.CASHFLOW_ANOMALY,
          severity: Math.abs(transaction.amount) > threshold * 2 ? Severity.HIGH : Severity.MEDIUM,
          confidence: 0.85,
          amount: Math.abs(transaction.amount),
          transactions: [transaction],
          evidence: [
            {
              type: 'AMOUNT',
              description: 'Montant',
              value: `${Math.abs(transaction.amount).toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'THRESHOLD',
              description: 'Seuil de détection',
              value: `${threshold.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'MULTIPLIER',
              description: 'Fois la moyenne',
              value: `${(Math.abs(transaction.amount) / mean).toFixed(1)}x`,
            },
            {
              type: 'DESCRIPTION',
              description: 'Libellé',
              value: transaction.description,
            },
          ],
          recommendation:
            `Transaction exceptionnelle de ${Math.abs(transaction.amount).toLocaleString('fr-FR')} FCFA ` +
            `(${(Math.abs(transaction.amount) / mean).toFixed(1)}x la moyenne). ` +
            `Libellé: "${transaction.description}". Vérifier la légitimité de cette opération.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }
}
