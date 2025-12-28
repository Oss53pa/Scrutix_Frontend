import { v4 as uuidv4 } from 'uuid';
import { isWeekend } from 'date-fns';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  BankConditions,
} from '../types';

/**
 * Configuration pour l'audit des dates de valeur
 */
interface ValueDateConfig {
  // Jours maximum autorisés entre date d'opération et date de valeur (crédits)
  maxCreditValueDays: number;
  // Jours maximum autorisés entre date d'opération et date de valeur (débits)
  maxDebitValueDays: number;
  // Taux d'intérêt annuel pour calculer l'impact (en décimal, ex: 0.12 = 12%)
  interestRate: number;
  // Conventions de calcul des jours
  dayCountConvention: 'ACT/360' | 'ACT/365' | '30/360';
}

const DEFAULT_CONFIG: ValueDateConfig = {
  maxCreditValueDays: 2, // J+2 pour les crédits
  maxDebitValueDays: 1,  // J+1 pour les débits
  interestRate: 0.12,    // 12% taux standard découvert
  dayCountConvention: 'ACT/360',
};

/**
 * ValueDateAudit - Contrôle des dates de valeur
 *
 * Ce module analyse les écarts entre dates d'opération et dates de valeur
 * pour détecter les retards abusifs qui impactent le calcul des intérêts.
 */
export class ValueDateAudit {
  private config: ValueDateConfig;
  private bankConditions?: BankConditions;

  constructor(config?: Partial<ValueDateConfig>, bankConditions?: BankConditions) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bankConditions = bankConditions;

    // Utiliser le taux de la banque si disponible
    if (bankConditions?.creditFees?.decouvertAutorise?.tauxAnnuel) {
      this.config.interestRate = bankConditions.creditFees.decouvertAutorise.tauxAnnuel / 100;
    }
  }

  /**
   * Analyser les transactions pour détecter les anomalies de dates de valeur
   */
  analyze(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    for (const transaction of transactions) {
      const operationDate = new Date(transaction.date);
      const valueDate = new Date(transaction.valueDate);

      // Calculer l'écart en jours ouvrés
      const daysDiff = this.calculateBusinessDays(operationDate, valueDate);

      // Vérifier selon le type de transaction
      const isCredit = transaction.amount > 0;
      const maxDays = isCredit ? this.config.maxCreditValueDays : this.config.maxDebitValueDays;

      // Détecter les anomalies
      if (daysDiff > maxDays) {
        const impact = this.calculateFinancialImpact(transaction, daysDiff - maxDays);

        if (impact > 0) {
          anomalies.push(this.createAnomaly(transaction, daysDiff, maxDays, impact, isCredit));
        }
      }

      // Cas spécial: date de valeur antérieure à la date d'opération (avantageux pour débit)
      if (!isCredit && valueDate < operationDate) {
        const retroDays = Math.abs(daysDiff);
        const impact = this.calculateFinancialImpact(transaction, retroDays);
        if (impact > 0) {
          anomalies.push(this.createRetroactiveAnomaly(transaction, retroDays, impact));
        }
      }
    }

    return this.consolidateAnomalies(anomalies);
  }

  /**
   * Calculer les jours ouvrés entre deux dates
   */
  private calculateBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    const end = new Date(endDate);

    // Normaliser les dates
    current.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (end >= current) {
      while (current < end) {
        current.setDate(current.getDate() + 1);
        if (!isWeekend(current)) {
          count++;
        }
      }
    } else {
      while (current > end) {
        if (!isWeekend(current)) {
          count--;
        }
        current.setDate(current.getDate() - 1);
      }
    }

    return count;
  }

  /**
   * Calculer l'impact financier du retard de date de valeur
   */
  private calculateFinancialImpact(transaction: Transaction, excessDays: number): number {
    const amount = Math.abs(transaction.amount);

    // Calcul des intérêts perdus selon la convention
    let daysInYear: number;
    switch (this.config.dayCountConvention) {
      case 'ACT/365':
        daysInYear = 365;
        break;
      case '30/360':
        daysInYear = 360;
        break;
      case 'ACT/360':
      default:
        daysInYear = 360;
    }

    // Impact = Montant × Taux × (Jours excédentaires / Jours par an)
    const impact = amount * this.config.interestRate * (excessDays / daysInYear);

    return Math.round(impact * 100) / 100; // Arrondir à 2 décimales
  }

  /**
   * Créer une anomalie pour retard de date de valeur
   */
  private createAnomaly(
    transaction: Transaction,
    actualDays: number,
    maxDays: number,
    impact: number,
    isCredit: boolean
  ): Anomaly {
    const excessDays = actualDays - maxDays;

    return {
      id: uuidv4(),
      type: AnomalyType.VALUE_DATE_ERROR,
      severity: this.calculateSeverity(impact, excessDays),
      confidence: 0.95,
      amount: impact,
      transactions: [transaction],
      evidence: this.generateEvidence(transaction, actualDays, maxDays, impact, isCredit),
      recommendation: this.generateRecommendation(transaction, excessDays, impact, isCredit),
      status: 'pending',
      detectedAt: new Date(),
    };
  }

  /**
   * Créer une anomalie pour date de valeur rétroactive (débit antidaté)
   */
  private createRetroactiveAnomaly(
    transaction: Transaction,
    retroDays: number,
    impact: number
  ): Anomaly {
    return {
      id: uuidv4(),
      type: AnomalyType.VALUE_DATE_ERROR,
      severity: Severity.HIGH,
      confidence: 0.98,
      amount: impact,
      transactions: [transaction],
      evidence: [
        {
          type: 'RETROACTIVE_VALUE_DATE',
          description: 'Date de valeur antérieure à l\'opération',
          value: `${retroDays} jours avant l'opération`,
        },
        {
          type: 'FINANCIAL_IMPACT',
          description: 'Impact financier estimé',
          value: `${impact.toLocaleString('fr-FR')} FCFA`,
        },
        {
          type: 'OPERATION_DATE',
          description: 'Date d\'opération',
          value: new Date(transaction.date).toLocaleDateString('fr-FR'),
        },
        {
          type: 'VALUE_DATE',
          description: 'Date de valeur',
          value: new Date(transaction.valueDate).toLocaleDateString('fr-FR'),
        },
      ],
      recommendation:
        `Date de valeur rétroactive de ${retroDays} jours détectée sur un débit de ${Math.abs(transaction.amount).toLocaleString('fr-FR')} FCFA. ` +
        `Cette pratique génère des intérêts supplémentaires estimés à ${impact.toLocaleString('fr-FR')} FCFA. ` +
        `Contester cette date de valeur conformément à la réglementation CEMAC/UEMOA.`,
      status: 'pending',
      detectedAt: new Date(),
    };
  }

  /**
   * Calculer la sévérité
   */
  private calculateSeverity(impact: number, excessDays: number): Severity {
    if (impact > 10000 || excessDays > 10) return Severity.CRITICAL;
    if (impact > 5000 || excessDays > 5) return Severity.HIGH;
    if (impact > 1000 || excessDays > 3) return Severity.MEDIUM;
    return Severity.LOW;
  }

  /**
   * Générer les preuves
   */
  private generateEvidence(
    transaction: Transaction,
    actualDays: number,
    maxDays: number,
    impact: number,
    isCredit: boolean
  ): Evidence[] {
    return [
      {
        type: 'VALUE_DATE_DELAY',
        description: 'Retard date de valeur',
        value: `${actualDays} jours (max autorisé: ${maxDays})`,
      },
      {
        type: 'TRANSACTION_TYPE',
        description: 'Type d\'opération',
        value: isCredit ? 'Crédit' : 'Débit',
      },
      {
        type: 'TRANSACTION_AMOUNT',
        description: 'Montant de l\'opération',
        value: `${Math.abs(transaction.amount).toLocaleString('fr-FR')} FCFA`,
      },
      {
        type: 'FINANCIAL_IMPACT',
        description: 'Impact financier',
        value: `${impact.toLocaleString('fr-FR')} FCFA`,
      },
      {
        type: 'OPERATION_DATE',
        description: 'Date d\'opération',
        value: new Date(transaction.date).toLocaleDateString('fr-FR'),
      },
      {
        type: 'VALUE_DATE',
        description: 'Date de valeur',
        value: new Date(transaction.valueDate).toLocaleDateString('fr-FR'),
      },
      {
        type: 'INTEREST_RATE',
        description: 'Taux appliqué',
        value: `${(this.config.interestRate * 100).toFixed(2)}%`,
      },
    ];
  }

  /**
   * Générer la recommandation
   */
  private generateRecommendation(
    transaction: Transaction,
    excessDays: number,
    impact: number,
    isCredit: boolean
  ): string {
    const type = isCredit ? 'crédit' : 'débit';
    const action = isCredit ? 'retardée' : 'anticipée';

    return (
      `Date de valeur ${action} de ${excessDays} jour${excessDays > 1 ? 's' : ''} sur un ${type} de ` +
      `${Math.abs(transaction.amount).toLocaleString('fr-FR')} FCFA. ` +
      `Impact financier: ${impact.toLocaleString('fr-FR')} FCFA. ` +
      `Demander la régularisation et le remboursement des intérêts indûment perçus.`
    );
  }

  /**
   * Consolider les anomalies similaires
   */
  private consolidateAnomalies(anomalies: Anomaly[]): Anomaly[] {
    // Grouper par période mensuelle pour un reporting plus clair
    if (anomalies.length <= 5) {
      return anomalies;
    }

    // Si beaucoup d'anomalies, créer un résumé
    const totalImpact = anomalies.reduce((sum, a) => sum + a.amount, 0);
    const allTransactions = anomalies.flatMap(a => a.transactions);

    const consolidated: Anomaly = {
      id: uuidv4(),
      type: AnomalyType.VALUE_DATE_ERROR,
      severity: totalImpact > 50000 ? Severity.CRITICAL :
                totalImpact > 20000 ? Severity.HIGH :
                totalImpact > 5000 ? Severity.MEDIUM : Severity.LOW,
      confidence: 0.95,
      amount: totalImpact,
      transactions: allTransactions.slice(0, 10), // Limiter aux 10 premières
      evidence: [
        {
          type: 'TOTAL_ANOMALIES',
          description: 'Nombre total d\'anomalies',
          value: anomalies.length,
        },
        {
          type: 'TOTAL_IMPACT',
          description: 'Impact financier total',
          value: `${totalImpact.toLocaleString('fr-FR')} FCFA`,
        },
        {
          type: 'TRANSACTIONS_COUNT',
          description: 'Transactions concernées',
          value: allTransactions.length,
        },
      ],
      recommendation:
        `${anomalies.length} anomalies de dates de valeur détectées pour un impact total de ` +
        `${totalImpact.toLocaleString('fr-FR')} FCFA. ` +
        `Réviser la politique de dates de valeur avec la banque et demander un remboursement global.`,
      status: 'pending',
      detectedAt: new Date(),
    };

    return [consolidated, ...anomalies.slice(0, 4)]; // Garder le résumé + 4 exemples
  }
}
