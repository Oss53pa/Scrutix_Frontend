import { v4 as uuidv4 } from 'uuid';
import { format, differenceInDays } from 'date-fns';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  TransactionType,
} from '../types';

/**
 * Configuration pour l'audit de conformité OHADA
 */
interface OhadaConfig {
  // Montant à partir duquel un justificatif est requis
  documentThreshold: number;
  // Durée maximale de conservation des pièces (années)
  retentionPeriod: number;
  // Seuil pour les transactions en espèces
  cashThreshold: number;
  // Catégories de comptes à vérifier
  accountCategories: string[];
}

const DEFAULT_CONFIG: OhadaConfig = {
  documentThreshold: 100000, // 100k FCFA
  retentionPeriod: 10,       // 10 ans OHADA
  cashThreshold: 500000,     // 500k FCFA pour espèces
  accountCategories: ['6', '7'], // Charges et produits
};

/**
 * OhadaAudit - Audit de conformité OHADA/SYSCOHADA
 *
 * Ce module vérifie la conformité aux normes comptables OHADA:
 * - Vérification des justificatifs
 * - Respect des plafonds de paiement en espèces
 * - Classification correcte des opérations
 * - Respect des délais d'enregistrement
 * - Piste d'audit
 */
export class OhadaAudit {
  private config: OhadaConfig;

  constructor(config?: Partial<OhadaConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyser la conformité OHADA
   */
  analyze(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // 1. Vérifier les transactions nécessitant un justificatif
    anomalies.push(...this.checkDocumentRequirements(transactions));

    // 2. Vérifier les plafonds de paiement en espèces
    anomalies.push(...this.checkCashLimits(transactions));

    // 3. Vérifier la classification des opérations
    anomalies.push(...this.checkClassification(transactions));

    // 4. Vérifier les délais d'enregistrement
    anomalies.push(...this.checkTimingCompliance(transactions));

    // 5. Vérifier la piste d'audit
    anomalies.push(...this.checkAuditTrail(transactions));

    // 6. Vérifier les exercices comptables
    anomalies.push(...this.checkFiscalYearCompliance(transactions));

    return anomalies;
  }

  /**
   * Vérifier les transactions nécessitant un justificatif
   */
  private checkDocumentRequirements(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const largeTransactions: Transaction[] = [];

    for (const t of transactions) {
      if (Math.abs(t.amount) >= this.config.documentThreshold) {
        // Vérifier si un justificatif est mentionné
        const hasReference = t.reference && t.reference.length > 3;
        const hasDetailedDescription = t.description.length > 20;

        if (!hasReference && !hasDetailedDescription) {
          largeTransactions.push(t);
        }
      }
    }

    if (largeTransactions.length > 0) {
      const totalAmount = largeTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.OHADA_NON_COMPLIANCE,
        severity: largeTransactions.length > 10 ? Severity.HIGH : Severity.MEDIUM,
        confidence: 0.75,
        amount: totalAmount,
        transactions: largeTransactions.slice(0, 20),
        evidence: [
          {
            type: 'TRANSACTION_COUNT',
            description: 'Transactions sans justificatif apparent',
            value: largeTransactions.length,
          },
          {
            type: 'TOTAL_AMOUNT',
            description: 'Montant total',
            value: `${totalAmount.toLocaleString('fr-FR')} FCFA`,
          },
          {
            type: 'THRESHOLD',
            description: 'Seuil de justification',
            value: `${this.config.documentThreshold.toLocaleString('fr-FR')} FCFA`,
          },
          {
            type: 'OHADA_REFERENCE',
            description: 'Référence OHADA',
            value: 'Art. 17 - Acte uniforme relatif au droit comptable',
          },
        ],
        recommendation:
          `${largeTransactions.length} transactions de plus de ` +
          `${this.config.documentThreshold.toLocaleString('fr-FR')} FCFA ` +
          `sans justificatif apparent. Conformément à l'OHADA (Art. 17), ` +
          `toute écriture doit être appuyée par une pièce justificative. ` +
          `Vérifier et archiver les justificatifs correspondants.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    return anomalies;
  }

  /**
   * Vérifier les plafonds de paiement en espèces
   */
  private checkCashLimits(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Identifier les transactions en espèces
    const cashTransactions = transactions.filter(t =>
      t.type === TransactionType.ATM ||
      t.description.toLowerCase().includes('especes') ||
      t.description.toLowerCase().includes('espèces') ||
      t.description.toLowerCase().includes('cash') ||
      t.description.toLowerCase().includes('retrait') ||
      t.description.toLowerCase().includes('versement')
    );

    // Vérifier les transactions individuelles > seuil
    const overLimitTransactions = cashTransactions.filter(
      t => Math.abs(t.amount) > this.config.cashThreshold
    );

    if (overLimitTransactions.length > 0) {
      const totalAmount = overLimitTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.OHADA_NON_COMPLIANCE,
        severity: Severity.HIGH,
        confidence: 0.9,
        amount: totalAmount,
        transactions: overLimitTransactions.slice(0, 10),
        evidence: [
          {
            type: 'VIOLATION_COUNT',
            description: 'Nombre de violations',
            value: overLimitTransactions.length,
          },
          {
            type: 'TOTAL_AMOUNT',
            description: 'Montant total',
            value: `${totalAmount.toLocaleString('fr-FR')} FCFA`,
          },
          {
            type: 'THRESHOLD',
            description: 'Plafond espèces',
            value: `${this.config.cashThreshold.toLocaleString('fr-FR')} FCFA`,
          },
          {
            type: 'REGULATION',
            description: 'Réglementation',
            value: 'Règlement CEMAC/UEMOA sur les paiements en espèces',
          },
        ],
        recommendation:
          `${overLimitTransactions.length} transactions en espèces dépassant le plafond de ` +
          `${this.config.cashThreshold.toLocaleString('fr-FR')} FCFA. ` +
          `Les règlements supérieurs à ce montant doivent être effectués par virement bancaire ` +
          `ou chèque pour des raisons de conformité et de traçabilité.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    // Vérifier le fractionnement potentiel
    const cashByDay = new Map<string, Transaction[]>();
    for (const t of cashTransactions) {
      const dateKey = format(new Date(t.date), 'yyyy-MM-dd');
      if (!cashByDay.has(dateKey)) {
        cashByDay.set(dateKey, []);
      }
      cashByDay.get(dateKey)!.push(t);
    }

    for (const [date, dayTransactions] of cashByDay) {
      const dailyTotal = dayTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      if (dailyTotal > this.config.cashThreshold && dayTransactions.length > 1) {
        const maxSingle = Math.max(...dayTransactions.map(t => Math.abs(t.amount)));

        if (maxSingle <= this.config.cashThreshold) {
          // Fractionnement potentiel
          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.OHADA_NON_COMPLIANCE,
            severity: Severity.HIGH,
            confidence: 0.8,
            amount: dailyTotal,
            transactions: dayTransactions,
            evidence: [
              {
                type: 'DATE',
                description: 'Date',
                value: date,
              },
              {
                type: 'TRANSACTION_COUNT',
                description: 'Nombre d\'opérations',
                value: dayTransactions.length,
              },
              {
                type: 'DAILY_TOTAL',
                description: 'Total journalier',
                value: `${dailyTotal.toLocaleString('fr-FR')} FCFA`,
              },
              {
                type: 'MAX_SINGLE',
                description: 'Plus grande transaction',
                value: `${maxSingle.toLocaleString('fr-FR')} FCFA`,
              },
            ],
            recommendation:
              `Possible fractionnement d'opérations en espèces le ${date}: ` +
              `${dayTransactions.length} transactions totalisant ${dailyTotal.toLocaleString('fr-FR')} FCFA, ` +
              `chacune restant sous le plafond. Cette pratique peut être considérée comme ` +
              `un contournement de la réglementation.`,
            status: 'pending',
            detectedAt: new Date(),
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Vérifier la classification des opérations
   */
  private checkClassification(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Chercher les transactions mal classifiées
    const misclassified: { transaction: Transaction; issue: string }[] = [];

    for (const t of transactions) {
      const description = t.description.toLowerCase();

      // Vérifier les incohérences type/description
      if (t.type === TransactionType.FEE && t.amount > 0) {
        misclassified.push({
          transaction: t,
          issue: 'Frais avec montant positif',
        });
      }

      if (t.type === TransactionType.INTEREST && Math.abs(t.amount) > 1000000) {
        misclassified.push({
          transaction: t,
          issue: 'Montant d\'intérêts inhabituellement élevé',
        });
      }

      // Vérifier les libellés vagues
      if (description.length < 5 && Math.abs(t.amount) > this.config.documentThreshold) {
        misclassified.push({
          transaction: t,
          issue: 'Libellé insuffisamment détaillé',
        });
      }
    }

    if (misclassified.length > 0) {
      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.OHADA_NON_COMPLIANCE,
        severity: Severity.MEDIUM,
        confidence: 0.7,
        amount: misclassified.reduce((sum, m) => sum + Math.abs(m.transaction.amount), 0),
        transactions: misclassified.map(m => m.transaction).slice(0, 10),
        evidence: [
          {
            type: 'ISSUE_COUNT',
            description: 'Problèmes de classification',
            value: misclassified.length,
          },
          ...misclassified.slice(0, 5).map((m, i) => ({
            type: `ISSUE_${i + 1}`,
            description: m.issue,
            value: `${m.transaction.description} (${m.transaction.amount.toLocaleString('fr-FR')} FCFA)`,
          })),
        ],
        recommendation:
          `${misclassified.length} transactions présentent des problèmes de classification. ` +
          `L'OHADA exige une classification correcte des opérations. ` +
          `Réviser la catégorisation de ces écritures.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    return anomalies;
  }

  /**
   * Vérifier le respect des délais d'enregistrement
   */
  private checkTimingCompliance(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Grouper par mois d'opération vs mois d'enregistrement
    const lateRegistrations: Transaction[] = [];

    for (const t of transactions) {
      const operationDate = new Date(t.date);
      const recordDate = new Date(t.createdAt || t.date);

      const delay = differenceInDays(recordDate, operationDate);

      // Plus de 30 jours de retard
      if (delay > 30) {
        lateRegistrations.push(t);
      }
    }

    if (lateRegistrations.length > 0) {
      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.OHADA_NON_COMPLIANCE,
        severity: Severity.MEDIUM,
        confidence: 0.65,
        amount: lateRegistrations.reduce((sum, t) => sum + Math.abs(t.amount), 0),
        transactions: lateRegistrations.slice(0, 10),
        evidence: [
          {
            type: 'LATE_COUNT',
            description: 'Enregistrements tardifs',
            value: lateRegistrations.length,
          },
          {
            type: 'OHADA_RULE',
            description: 'Règle OHADA',
            value: 'Enregistrement chronologique au jour le jour',
          },
        ],
        recommendation:
          `${lateRegistrations.length} transactions enregistrées avec un retard de plus de 30 jours. ` +
          `L'OHADA impose un enregistrement chronologique des opérations. ` +
          `Mettre en place des procédures pour garantir l'enregistrement quotidien.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    return anomalies;
  }

  /**
   * Vérifier la piste d'audit
   */
  private checkAuditTrail(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Vérifier les transactions sans référence unique
    const noReference = transactions.filter(t => !t.reference || t.reference.trim() === '');

    if (noReference.length > transactions.length * 0.1) { // Plus de 10%
      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.OHADA_NON_COMPLIANCE,
        severity: Severity.MEDIUM,
        confidence: 0.7,
        amount: noReference.reduce((sum, t) => sum + Math.abs(t.amount), 0),
        transactions: noReference.slice(0, 10),
        evidence: [
          {
            type: 'NO_REF_COUNT',
            description: 'Transactions sans référence',
            value: noReference.length,
          },
          {
            type: 'PERCENTAGE',
            description: 'Pourcentage du total',
            value: `${((noReference.length / transactions.length) * 100).toFixed(1)}%`,
          },
          {
            type: 'AUDIT_REQUIREMENT',
            description: 'Exigence d\'audit',
            value: 'Traçabilité complète des opérations',
          },
        ],
        recommendation:
          `${noReference.length} transactions (${((noReference.length / transactions.length) * 100).toFixed(1)}%) ` +
          `n'ont pas de référence unique. La piste d'audit doit permettre de remonter ` +
          `de chaque écriture à sa pièce justificative.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    // Vérifier les séquences manquantes dans les références
    const refs = transactions
      .filter(t => t.reference && /^\d+$/.test(t.reference))
      .map(t => parseInt(t.reference!, 10))
      .sort((a, b) => a - b);

    const gaps: number[] = [];
    for (let i = 1; i < refs.length; i++) {
      if (refs[i] - refs[i - 1] > 1) {
        for (let j = refs[i - 1] + 1; j < refs[i]; j++) {
          gaps.push(j);
        }
      }
    }

    if (gaps.length > 0) {
      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.OHADA_NON_COMPLIANCE,
        severity: Severity.HIGH,
        confidence: 0.9,
        amount: 0,
        transactions: [],
        evidence: [
          {
            type: 'GAP_COUNT',
            description: 'Numéros manquants',
            value: gaps.length,
          },
          {
            type: 'GAPS_SAMPLE',
            description: 'Exemples',
            value: gaps.slice(0, 10).join(', ') + (gaps.length > 10 ? '...' : ''),
          },
          {
            type: 'SEQUENCE_REQUIREMENT',
            description: 'Exigence',
            value: 'Numérotation continue et sans rupture',
          },
        ],
        recommendation:
          `${gaps.length} numéros de référence manquants dans la séquence. ` +
          `L'OHADA exige une numérotation continue. ` +
          `Rechercher les pièces correspondantes ou justifier les ruptures.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    return anomalies;
  }

  /**
   * Vérifier la conformité des exercices comptables
   */
  private checkFiscalYearCompliance(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Grouper par exercice fiscal
    const byYear = new Map<number, Transaction[]>();
    for (const t of transactions) {
      const year = new Date(t.date).getFullYear();
      if (!byYear.has(year)) {
        byYear.set(year, []);
      }
      byYear.get(year)!.push(t);
    }

    // Vérifier les transactions sur plusieurs exercices
    if (byYear.size > 1) {
      const years = Array.from(byYear.keys()).sort();

      for (let i = 0; i < years.length - 1; i++) {
        const currentYear = years[i];
        const nextYear = years[i + 1];

        const currentYearTrans = byYear.get(currentYear)!;
        const lateDec = currentYearTrans.filter(t => {
          const date = new Date(t.date);
          return date.getMonth() === 11 && date.getDate() >= 28;
        });

        const nextYearTrans = byYear.get(nextYear)!;
        const earlyJan = nextYearTrans.filter(t => {
          const date = new Date(t.date);
          return date.getMonth() === 0 && date.getDate() <= 3;
        });

        // Vérifier la cohérence de clôture
        if (lateDec.length > 0 && earlyJan.length > 0) {
          const lastBalance = lateDec.reduce((max, t) =>
            new Date(t.date) > new Date(max.date) ? t : max
          ).balance;

          const firstBalance = earlyJan.reduce((min, t) =>
            new Date(t.date) < new Date(min.date) ? t : min
          );

          // Vérifier si le solde de clôture = solde d'ouverture + première transaction
          const expectedOpening = firstBalance.balance - firstBalance.amount;
          const diff = Math.abs(lastBalance - expectedOpening);

          if (diff > 1) {
            anomalies.push({
              id: uuidv4(),
              type: AnomalyType.OHADA_NON_COMPLIANCE,
              severity: Severity.CRITICAL,
              confidence: 0.85,
              amount: diff,
              transactions: [...lateDec.slice(-5), ...earlyJan.slice(0, 5)],
              evidence: [
                {
                  type: 'YEAR_TRANSITION',
                  description: 'Transition d\'exercice',
                  value: `${currentYear} → ${nextYear}`,
                },
                {
                  type: 'CLOSING_BALANCE',
                  description: 'Solde de clôture',
                  value: `${lastBalance.toLocaleString('fr-FR')} FCFA`,
                },
                {
                  type: 'OPENING_BALANCE',
                  description: 'Solde d\'ouverture calculé',
                  value: `${expectedOpening.toLocaleString('fr-FR')} FCFA`,
                },
                {
                  type: 'DIFFERENCE',
                  description: 'Écart',
                  value: `${diff.toLocaleString('fr-FR')} FCFA`,
                },
              ],
              recommendation:
                `Écart de ${diff.toLocaleString('fr-FR')} FCFA entre le solde de clôture ${currentYear} ` +
                `et le solde d'ouverture ${nextYear}. L'OHADA impose la continuité des exercices. ` +
                `Identifier et corriger les écritures manquantes.`,
              status: 'pending',
              detectedAt: new Date(),
            });
          }
        }
      }
    }

    return anomalies;
  }
}
