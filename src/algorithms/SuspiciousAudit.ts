import { v4 as uuidv4 } from 'uuid';
import { getDay, getHours, format } from 'date-fns';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  TransactionType,
} from '../types';

/**
 * Configuration pour la détection d'opérations suspectes
 */
interface SuspiciousConfig {
  // Seuil pour montants anormalement élevés (percentile)
  highAmountPercentile: number;
  // Multiplicateur pour détecter les pics
  spikeMultiplier: number;
  // Heures de bureau (début, fin)
  businessHours: { start: number; end: number };
  // Fréquence maximum normale par jour
  maxDailyFrequency: number;
  // Mots-clés suspects dans les libellés
  suspiciousKeywords: string[];
  // Montant seuil pour fractionnement
  structuringThreshold: number;
}

const DEFAULT_CONFIG: SuspiciousConfig = {
  highAmountPercentile: 95,
  spikeMultiplier: 3,
  businessHours: { start: 8, end: 18 },
  maxDailyFrequency: 10,
  suspiciousKeywords: [
    'retrait urgent', 'virement personnel', 'cash', 'especes',
    'pret', 'avance', 'remboursement', 'compensation',
  ],
  structuringThreshold: 5000000, // 5M FCFA (seuil CEMAC)
};

/**
 * Types de patterns suspects détectés
 */
type SuspiciousPattern =
  | 'HIGH_AMOUNT'
  | 'UNUSUAL_TIMING'
  | 'HIGH_FREQUENCY'
  | 'ROUND_AMOUNT'
  | 'STRUCTURING'
  | 'SUSPICIOUS_DESCRIPTION'
  | 'COUNTERPARTY_PATTERN';

/**
 * SuspiciousAudit - Détection d'opérations suspectes
 *
 * Ce module détecte les comportements inhabituels:
 * - Transactions à montants anormaux
 * - Horaires inhabituels
 * - Fréquence anormale
 * - Fractionnement suspect (structuring)
 * - Libellés suspects
 */
export class SuspiciousAudit {
  private config: SuspiciousConfig;
  private transactionStats: {
    mean: number;
    stdDev: number;
    percentile95: number;
  } | null = null;

  constructor(config?: Partial<SuspiciousConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyser les transactions pour détecter les opérations suspectes
   */
  analyze(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Calculer les statistiques de base
    this.calculateStats(transactions);

    // 1. Détecter les montants anormaux
    anomalies.push(...this.detectHighAmounts(transactions));

    // 2. Détecter les horaires inhabituels
    anomalies.push(...this.detectUnusualTiming(transactions));

    // 3. Détecter la fréquence anormale
    anomalies.push(...this.detectHighFrequency(transactions));

    // 4. Détecter le fractionnement (structuring)
    anomalies.push(...this.detectStructuring(transactions));

    // 5. Détecter les montants ronds suspects
    anomalies.push(...this.detectRoundAmounts(transactions));

    // 6. Détecter les libellés suspects
    anomalies.push(...this.detectSuspiciousDescriptions(transactions));

    return anomalies;
  }

  /**
   * Calculer les statistiques sur les transactions
   */
  private calculateStats(transactions: Transaction[]): void {
    const amounts = transactions.map(t => Math.abs(t.amount));

    if (amounts.length === 0) {
      this.transactionStats = null;
      return;
    }

    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    // Calculer le percentile 95
    const sorted = [...amounts].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    const percentile95 = sorted[index] || sorted[sorted.length - 1];

    this.transactionStats = { mean, stdDev, percentile95 };
  }

  /**
   * Détecter les montants anormalement élevés
   */
  private detectHighAmounts(transactions: Transaction[]): Anomaly[] {
    if (!this.transactionStats) return [];

    const anomalies: Anomaly[] = [];
    const threshold = this.transactionStats.percentile95;

    for (const transaction of transactions) {
      const amount = Math.abs(transaction.amount);

      if (amount > threshold * this.config.spikeMultiplier) {
        anomalies.push(this.createAnomaly(
          [transaction],
          'HIGH_AMOUNT',
          Severity.HIGH,
          0.85,
          `Montant exceptionnellement élevé: ${amount.toLocaleString('fr-FR')} FCFA ` +
          `(${(amount / this.transactionStats.mean).toFixed(1)}x la moyenne)`
        ));
      }
    }

    return anomalies;
  }

  /**
   * Détecter les opérations en dehors des heures normales
   */
  private detectUnusualTiming(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const unusualTransactions: Transaction[] = [];

    for (const transaction of transactions) {
      const date = new Date(transaction.date);
      const hour = getHours(date);
      const dayOfWeek = getDay(date);

      // Week-end ou hors heures de bureau
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isOutsideHours = hour < this.config.businessHours.start ||
                             hour >= this.config.businessHours.end;

      if (isWeekend || isOutsideHours) {
        // Seuls les virements et retraits sont suspects hors heures
        if ([TransactionType.TRANSFER, TransactionType.ATM, TransactionType.DEBIT].includes(transaction.type)) {
          unusualTransactions.push(transaction);
        }
      }
    }

    // Grouper si plusieurs transactions inhabituelles
    if (unusualTransactions.length >= 3) {
      anomalies.push(this.createAnomaly(
        unusualTransactions.slice(0, 10),
        'UNUSUAL_TIMING',
        Severity.MEDIUM,
        0.7,
        `${unusualTransactions.length} opérations détectées hors heures de bureau ou le week-end. ` +
        `Vérifier l'origine et la légitimité de ces transactions.`
      ));
    }

    return anomalies;
  }

  /**
   * Détecter une fréquence anormale de transactions
   */
  private detectHighFrequency(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Grouper par jour
    const byDay = new Map<string, Transaction[]>();
    for (const transaction of transactions) {
      const dateKey = format(new Date(transaction.date), 'yyyy-MM-dd');
      if (!byDay.has(dateKey)) {
        byDay.set(dateKey, []);
      }
      byDay.get(dateKey)!.push(transaction);
    }

    // Détecter les jours avec fréquence anormale
    for (const [date, dayTransactions] of byDay) {
      if (dayTransactions.length > this.config.maxDailyFrequency) {
        const totalAmount = dayTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

        anomalies.push(this.createAnomaly(
          dayTransactions.slice(0, 10),
          'HIGH_FREQUENCY',
          dayTransactions.length > this.config.maxDailyFrequency * 2 ? Severity.HIGH : Severity.MEDIUM,
          0.8,
          `${dayTransactions.length} transactions le ${date} pour un total de ` +
          `${totalAmount.toLocaleString('fr-FR')} FCFA. Fréquence anormalement élevée.`
        ));
      }
    }

    return anomalies;
  }

  /**
   * Détecter le fractionnement suspect (structuring)
   * Technique de division des montants pour éviter les seuils de déclaration
   */
  private detectStructuring(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const threshold = this.config.structuringThreshold;

    // Grouper par jour
    const byDay = new Map<string, Transaction[]>();
    for (const transaction of transactions) {
      const dateKey = format(new Date(transaction.date), 'yyyy-MM-dd');
      if (!byDay.has(dateKey)) {
        byDay.set(dateKey, []);
      }
      byDay.get(dateKey)!.push(transaction);
    }

    for (const [, dayTransactions] of byDay) {
      // Chercher des transactions similaires juste sous le seuil
      const nearThreshold = dayTransactions.filter(t => {
        const amount = Math.abs(t.amount);
        return amount >= threshold * 0.5 && amount < threshold;
      });

      if (nearThreshold.length >= 2) {
        const totalAmount = nearThreshold.reduce((sum, t) => sum + Math.abs(t.amount), 0);

        if (totalAmount >= threshold) {
          anomalies.push(this.createAnomaly(
            nearThreshold,
            'STRUCTURING',
            Severity.CRITICAL,
            0.9,
            `Possible fractionnement détecté: ${nearThreshold.length} transactions de montants élevés ` +
            `(${totalAmount.toLocaleString('fr-FR')} FCFA total) juste sous le seuil de déclaration. ` +
            `Signaler à la cellule de conformité.`
          ));
        }
      }
    }

    return anomalies;
  }

  /**
   * Détecter les montants ronds suspects
   */
  private detectRoundAmounts(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const roundTransactions: Transaction[] = [];

    for (const transaction of transactions) {
      const amount = Math.abs(transaction.amount);

      // Montants ronds > 1M FCFA
      if (amount >= 1000000 && amount % 1000000 === 0) {
        roundTransactions.push(transaction);
      }
      // Ou montants ronds > 500k avec beaucoup de zéros
      else if (amount >= 500000 && amount % 100000 === 0) {
        const zeroCount = (amount.toString().match(/0/g) || []).length;
        if (zeroCount >= 4) {
          roundTransactions.push(transaction);
        }
      }
    }

    if (roundTransactions.length >= 3) {
      const totalAmount = roundTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      anomalies.push(this.createAnomaly(
        roundTransactions.slice(0, 10),
        'ROUND_AMOUNT',
        Severity.MEDIUM,
        0.6,
        `${roundTransactions.length} transactions à montants ronds détectées ` +
        `(total: ${totalAmount.toLocaleString('fr-FR')} FCFA). ` +
        `Vérifier la justification de ces montants inhabituellement précis.`
      ));
    }

    return anomalies;
  }

  /**
   * Détecter les libellés suspects
   */
  private detectSuspiciousDescriptions(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    for (const transaction of transactions) {
      const description = transaction.description.toLowerCase();

      for (const keyword of this.config.suspiciousKeywords) {
        if (description.includes(keyword.toLowerCase())) {
          anomalies.push(this.createAnomaly(
            [transaction],
            'SUSPICIOUS_DESCRIPTION',
            Severity.MEDIUM,
            0.7,
            `Libellé suspect détecté: "${transaction.description}". ` +
            `Montant: ${Math.abs(transaction.amount).toLocaleString('fr-FR')} FCFA. ` +
            `Vérifier la nature et la justification de cette opération.`
          ));
          break; // Une seule anomalie par transaction
        }
      }
    }

    return anomalies;
  }

  /**
   * Créer une anomalie
   */
  private createAnomaly(
    transactions: Transaction[],
    pattern: SuspiciousPattern,
    severity: Severity,
    confidence: number,
    recommendation: string
  ): Anomaly {
    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      id: uuidv4(),
      type: AnomalyType.SUSPICIOUS_TRANSACTION,
      severity,
      confidence,
      amount: totalAmount,
      transactions,
      evidence: this.generateEvidence(transactions, pattern),
      recommendation,
      status: 'pending',
      detectedAt: new Date(),
    };
  }

  /**
   * Générer les preuves
   */
  private generateEvidence(transactions: Transaction[], pattern: SuspiciousPattern): Evidence[] {
    const evidence: Evidence[] = [];

    evidence.push({
      type: 'PATTERN_TYPE',
      description: 'Type de pattern suspect',
      value: this.getPatternLabel(pattern),
    });

    evidence.push({
      type: 'TRANSACTION_COUNT',
      description: 'Transactions concernées',
      value: transactions.length,
    });

    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    evidence.push({
      type: 'TOTAL_AMOUNT',
      description: 'Montant total',
      value: `${totalAmount.toLocaleString('fr-FR')} FCFA`,
    });

    if (transactions.length > 0) {
      const dates = transactions.map(t => new Date(t.date));
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

      evidence.push({
        type: 'PERIOD',
        description: 'Période concernée',
        value: `${minDate.toLocaleDateString('fr-FR')} - ${maxDate.toLocaleDateString('fr-FR')}`,
      });
    }

    return evidence;
  }

  /**
   * Obtenir le libellé du pattern
   */
  private getPatternLabel(pattern: SuspiciousPattern): string {
    const labels: Record<SuspiciousPattern, string> = {
      HIGH_AMOUNT: 'Montant anormalement élevé',
      UNUSUAL_TIMING: 'Horaire inhabituel',
      HIGH_FREQUENCY: 'Fréquence anormale',
      ROUND_AMOUNT: 'Montant rond suspect',
      STRUCTURING: 'Fractionnement suspect',
      SUSPICIOUS_DESCRIPTION: 'Libellé suspect',
      COUNTERPARTY_PATTERN: 'Pattern de contrepartie',
    };
    return labels[pattern];
  }
}
