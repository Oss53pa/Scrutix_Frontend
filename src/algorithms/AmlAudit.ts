import { v4 as uuidv4 } from 'uuid';
import { format, differenceInDays, differenceInHours, subDays } from 'date-fns';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  TransactionType,
} from '../types';

/**
 * Configuration pour l'audit anti-blanchiment (LCB-FT)
 */
interface AmlConfig {
  // Seuil de déclaration de soupçon (CEMAC/UEMOA)
  declarationThreshold: number;
  // Seuil pour les transactions en espèces
  cashReportingThreshold: number;
  // Fenêtre de temps pour détecter le structuring (jours)
  structuringWindow: number;
  // Nombre maximum de transactions pour structuring
  structuringMaxCount: number;
  // Pays à risque (liste GAFI)
  highRiskCountries: string[];
  // Mots-clés suspects dans les libellés
  suspiciousKeywords: string[];
  // Seuil de répétition pour pattern suspect
  patternThreshold: number;
}

const DEFAULT_CONFIG: AmlConfig = {
  declarationThreshold: 5000000,     // 5M FCFA (seuil CEMAC/UEMOA)
  cashReportingThreshold: 5000000,   // 5M FCFA
  structuringWindow: 7,               // 7 jours
  structuringMaxCount: 5,            // 5 transactions
  highRiskCountries: [
    'IRAN', 'COREE DU NORD', 'AFGHANISTAN', 'PAKISTAN',
    'YEMEN', 'SYRIE', 'IRAK', 'LIBYE', 'SOUDAN',
  ],
  suspiciousKeywords: [
    'casino', 'jeux', 'gaming', 'crypto', 'bitcoin',
    'offshore', 'shell', 'nominee', 'bearer',
    'hawala', 'change manuel', 'bureau de change',
  ],
  patternThreshold: 5,
};

/**
 * AmlAudit - Audit Anti-blanchiment (LCB-FT)
 *
 * Ce module détecte les indicateurs de blanchiment d'argent:
 * - Structuration (smurfing)
 * - Transactions avec pays à risque
 * - Patterns inhabituels
 * - Mouvements rapides de fonds
 * - Réactivation de comptes dormants
 * - Allers-retours suspects (round-tripping)
 */
export class AmlAudit {
  private config: AmlConfig;

  constructor(config?: Partial<AmlConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyser les transactions pour détecter les indicateurs de blanchiment
   */
  analyze(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // 1. Détecter le structuring (fractionnement)
    anomalies.push(...this.detectStructuring(transactions));

    // 2. Détecter les transactions avec pays à risque
    anomalies.push(...this.detectHighRiskCountries(transactions));

    // 3. Détecter les patterns inhabituels
    anomalies.push(...this.detectUnusualPatterns(transactions));

    // 4. Détecter l'activité intensive en espèces
    anomalies.push(...this.detectCashIntensive(transactions));

    // 5. Détecter les allers-retours (round-tripping)
    anomalies.push(...this.detectRoundTripping(transactions));

    // 6. Détecter les mouvements rapides
    anomalies.push(...this.detectRapidMovement(transactions));

    // 7. Détecter la réactivation de comptes dormants
    anomalies.push(...this.detectDormantReactivation(transactions));

    // 8. Détecter les descriptions suspectes
    anomalies.push(...this.detectSuspiciousDescriptions(transactions));

    // 9. Détecter les dépassements de seuil de déclaration
    anomalies.push(...this.detectThresholdBreaches(transactions));

    return anomalies;
  }

  /**
   * Détecter le structuring (fractionnement pour éviter les seuils)
   */
  private detectStructuring(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const threshold = this.config.declarationThreshold;

    // Grouper par fenêtre de temps
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      const windowStart = new Date(sorted[i].date);
      const windowEnd = subDays(windowStart, -this.config.structuringWindow);

      // Transactions dans la fenêtre
      const windowTransactions = sorted.filter(t => {
        const date = new Date(t.date);
        return date >= windowStart && date <= windowEnd;
      });

      // Chercher les transactions juste sous le seuil
      const nearThreshold = windowTransactions.filter(t => {
        const amount = Math.abs(t.amount);
        return amount >= threshold * 0.6 && amount < threshold;
      });

      if (nearThreshold.length >= this.config.structuringMaxCount) {
        const totalAmount = nearThreshold.reduce((sum, t) => sum + Math.abs(t.amount), 0);

        if (totalAmount >= threshold) {
          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.AML_ALERT,
            severity: Severity.CRITICAL,
            confidence: 0.9,
            amount: totalAmount,
            transactions: nearThreshold,
            evidence: [
              {
                type: 'ALERT_TYPE',
                description: 'Type d\'alerte',
                value: 'STRUCTURING (Fractionnement)',
              },
              {
                type: 'TRANSACTION_COUNT',
                description: 'Nombre de transactions',
                value: nearThreshold.length,
              },
              {
                type: 'TOTAL_AMOUNT',
                description: 'Montant total',
                value: `${totalAmount.toLocaleString('fr-FR')} FCFA`,
              },
              {
                type: 'THRESHOLD',
                description: 'Seuil de déclaration',
                value: `${threshold.toLocaleString('fr-FR')} FCFA`,
              },
              {
                type: 'PERIOD',
                description: 'Période',
                value: `${format(windowStart, 'dd/MM/yyyy')} - ${format(windowEnd, 'dd/MM/yyyy')}`,
              },
              {
                type: 'GAFI_INDICATOR',
                description: 'Indicateur GAFI',
                value: 'Fractionnement de transactions (smurfing)',
              },
            ],
            recommendation:
              `ALERTE CRITIQUE: Possible structuring détecté. ` +
              `${nearThreshold.length} transactions totalisant ${totalAmount.toLocaleString('fr-FR')} FCFA ` +
              `sur ${this.config.structuringWindow} jours, chacune juste sous le seuil de déclaration. ` +
              `SIGNALER à la cellule LCB-FT pour déclaration de soupçon si confirmé.`,
            status: 'pending',
            detectedAt: new Date(),
          });

          // Sauter les transactions déjà traitées
          i += nearThreshold.length - 1;
        }
      }
    }

    return anomalies;
  }

  /**
   * Détecter les transactions avec pays à risque
   */
  private detectHighRiskCountries(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const highRiskTransactions: Transaction[] = [];

    for (const t of transactions) {
      const description = t.description.toUpperCase();

      for (const country of this.config.highRiskCountries) {
        if (description.includes(country)) {
          highRiskTransactions.push(t);
          break;
        }
      }
    }

    if (highRiskTransactions.length > 0) {
      const totalAmount = highRiskTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.AML_ALERT,
        severity: Severity.CRITICAL,
        confidence: 0.85,
        amount: totalAmount,
        transactions: highRiskTransactions,
        evidence: [
          {
            type: 'ALERT_TYPE',
            description: 'Type d\'alerte',
            value: 'HIGH_RISK_COUNTRY',
          },
          {
            type: 'TRANSACTION_COUNT',
            description: 'Nombre de transactions',
            value: highRiskTransactions.length,
          },
          {
            type: 'TOTAL_AMOUNT',
            description: 'Montant total',
            value: `${totalAmount.toLocaleString('fr-FR')} FCFA`,
          },
          {
            type: 'COUNTRIES_DETECTED',
            description: 'Pays à risque détectés',
            value: this.config.highRiskCountries.filter(c =>
              highRiskTransactions.some(t => t.description.toUpperCase().includes(c))
            ).join(', '),
          },
          {
            type: 'GAFI_REFERENCE',
            description: 'Référence GAFI',
            value: 'Juridictions à haut risque et sous surveillance',
          },
        ],
        recommendation:
          `ALERTE: ${highRiskTransactions.length} transactions avec des pays à risque ` +
          `(liste GAFI) pour ${totalAmount.toLocaleString('fr-FR')} FCFA. ` +
          `Renforcer la vigilance et documenter l'origine et la destination des fonds.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    return anomalies;
  }

  /**
   * Détecter les patterns inhabituels
   */
  private detectUnusualPatterns(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Pattern 1: Séries de transactions identiques
    const byAmount = new Map<number, Transaction[]>();
    for (const t of transactions) {
      const amount = Math.abs(t.amount);
      if (!byAmount.has(amount)) {
        byAmount.set(amount, []);
      }
      byAmount.get(amount)!.push(t);
    }

    for (const [amount, amountTransactions] of byAmount) {
      if (amountTransactions.length >= this.config.patternThreshold && amount >= 100000) {
        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.AML_ALERT,
          severity: Severity.HIGH,
          confidence: 0.8,
          amount: amount * amountTransactions.length,
          transactions: amountTransactions.slice(0, 10),
          evidence: [
            {
              type: 'ALERT_TYPE',
              description: 'Type d\'alerte',
              value: 'UNUSUAL_PATTERN (Répétition)',
            },
            {
              type: 'REPEATED_AMOUNT',
              description: 'Montant répété',
              value: `${amount.toLocaleString('fr-FR')} FCFA`,
            },
            {
              type: 'OCCURRENCE_COUNT',
              description: 'Nombre d\'occurrences',
              value: amountTransactions.length,
            },
          ],
          recommendation:
            `Pattern inhabituel: ${amountTransactions.length} transactions identiques ` +
            `de ${amount.toLocaleString('fr-FR')} FCFA. ` +
            `Vérifier la justification économique de cette répétition.`,
          status: 'pending',
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Détecter l'activité intensive en espèces
   */
  private detectCashIntensive(transactions: Transaction[]): Anomaly[] {
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

    const totalCash = cashTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalAll = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Si plus de 60% du volume est en espèces
    if (totalAll > 0 && (totalCash / totalAll) > 0.6) {
      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.AML_ALERT,
        severity: Severity.HIGH,
        confidence: 0.85,
        amount: totalCash,
        transactions: cashTransactions.slice(0, 20),
        evidence: [
          {
            type: 'ALERT_TYPE',
            description: 'Type d\'alerte',
            value: 'CASH_INTENSIVE',
          },
          {
            type: 'CASH_VOLUME',
            description: 'Volume espèces',
            value: `${totalCash.toLocaleString('fr-FR')} FCFA`,
          },
          {
            type: 'CASH_PERCENTAGE',
            description: 'Pourcentage espèces',
            value: `${((totalCash / totalAll) * 100).toFixed(1)}%`,
          },
          {
            type: 'TRANSACTION_COUNT',
            description: 'Nombre d\'opérations espèces',
            value: cashTransactions.length,
          },
          {
            type: 'INDICATOR',
            description: 'Indicateur',
            value: 'Utilisation intensive d\'espèces (> 60%)',
          },
        ],
        recommendation:
          `Activité intensive en espèces: ${((totalCash / totalAll) * 100).toFixed(1)}% du volume ` +
          `(${totalCash.toLocaleString('fr-FR')} FCFA). ` +
          `L'utilisation excessive d'espèces est un indicateur de blanchiment. ` +
          `Vérifier la cohérence avec l'activité déclarée.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    // Gros dépôts en espèces
    const largeCashDeposits = cashTransactions.filter(
      t => t.amount > 0 && t.amount >= this.config.cashReportingThreshold
    );

    if (largeCashDeposits.length > 0) {
      const totalDeposits = largeCashDeposits.reduce((sum, t) => sum + t.amount, 0);

      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.AML_ALERT,
        severity: Severity.CRITICAL,
        confidence: 0.95,
        amount: totalDeposits,
        transactions: largeCashDeposits,
        evidence: [
          {
            type: 'ALERT_TYPE',
            description: 'Type d\'alerte',
            value: 'LARGE_CASH_DEPOSIT',
          },
          {
            type: 'DEPOSIT_COUNT',
            description: 'Nombre de dépôts',
            value: largeCashDeposits.length,
          },
          {
            type: 'TOTAL_DEPOSITS',
            description: 'Total des dépôts',
            value: `${totalDeposits.toLocaleString('fr-FR')} FCFA`,
          },
          {
            type: 'THRESHOLD',
            description: 'Seuil de déclaration',
            value: `${this.config.cashReportingThreshold.toLocaleString('fr-FR')} FCFA`,
          },
        ],
        recommendation:
          `${largeCashDeposits.length} dépôts en espèces ≥ ${this.config.cashReportingThreshold.toLocaleString('fr-FR')} FCFA ` +
          `pour un total de ${totalDeposits.toLocaleString('fr-FR')} FCFA. ` +
          `Ces opérations sont soumises à déclaration obligatoire (DOS/CTOS).`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    return anomalies;
  }

  /**
   * Détecter les allers-retours (round-tripping)
   */
  private detectRoundTripping(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const roundTrips: { credit: Transaction; debit: Transaction }[] = [];

    // Chercher les paires crédit/débit rapprochées
    const credits = transactions.filter(t => t.amount > 0);
    const debits = transactions.filter(t => t.amount < 0);

    for (const credit of credits) {
      for (const debit of debits) {
        const amountDiff = Math.abs(credit.amount + debit.amount);
        const tolerance = Math.abs(credit.amount) * 0.05; // 5% de tolérance

        if (amountDiff <= tolerance) {
          const timeDiff = Math.abs(
            differenceInHours(new Date(credit.date), new Date(debit.date))
          );

          if (timeDiff <= 72) { // 3 jours
            roundTrips.push({ credit, debit });
          }
        }
      }
    }

    if (roundTrips.length >= 3) { // Pattern significatif
      const totalAmount = roundTrips.reduce((sum, rt) => sum + Math.abs(rt.credit.amount), 0);

      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.AML_ALERT,
        severity: Severity.HIGH,
        confidence: 0.85,
        amount: totalAmount,
        transactions: roundTrips.flatMap(rt => [rt.credit, rt.debit]).slice(0, 20),
        evidence: [
          {
            type: 'ALERT_TYPE',
            description: 'Type d\'alerte',
            value: 'ROUND_TRIPPING (Allers-retours)',
          },
          {
            type: 'PAIR_COUNT',
            description: 'Nombre de paires',
            value: roundTrips.length,
          },
          {
            type: 'TOTAL_AMOUNT',
            description: 'Montant total',
            value: `${totalAmount.toLocaleString('fr-FR')} FCFA`,
          },
          {
            type: 'INDICATOR',
            description: 'Indicateur GAFI',
            value: 'Mouvements de fonds circulaires',
          },
        ],
        recommendation:
          `${roundTrips.length} paires d'allers-retours détectées ` +
          `(${totalAmount.toLocaleString('fr-FR')} FCFA). ` +
          `Les mouvements circulaires peuvent indiquer du layering (empilement). ` +
          `Vérifier la justification économique.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    return anomalies;
  }

  /**
   * Détecter les mouvements rapides de fonds
   */
  private detectRapidMovement(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Chercher les entrées suivies rapidement de sorties
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];

      if (current.amount <= 0) continue; // Chercher les crédits

      // Chercher un débit significatif rapidement après
      for (let j = i + 1; j < sorted.length; j++) {
        const next = sorted[j];
        const hours = differenceInHours(new Date(next.date), new Date(current.date));

        if (hours > 24) break; // Plus de 24h, arrêter

        if (next.amount < 0) {
          const outAmount = Math.abs(next.amount);
          const inAmount = current.amount;

          // Si sortie ≥ 80% de l'entrée
          if (outAmount >= inAmount * 0.8 && inAmount >= 1000000) {
            anomalies.push({
              id: uuidv4(),
              type: AnomalyType.AML_ALERT,
              severity: Severity.HIGH,
              confidence: 0.8,
              amount: inAmount,
              transactions: [current, next],
              evidence: [
                {
                  type: 'ALERT_TYPE',
                  description: 'Type d\'alerte',
                  value: 'RAPID_MOVEMENT',
                },
                {
                  type: 'CREDIT_AMOUNT',
                  description: 'Entrée',
                  value: `${inAmount.toLocaleString('fr-FR')} FCFA`,
                },
                {
                  type: 'DEBIT_AMOUNT',
                  description: 'Sortie',
                  value: `${outAmount.toLocaleString('fr-FR')} FCFA`,
                },
                {
                  type: 'TIME_GAP',
                  description: 'Délai',
                  value: `${hours} heures`,
                },
                {
                  type: 'INDICATOR',
                  description: 'Indicateur',
                  value: 'Pass-through rapide de fonds',
                },
              ],
              recommendation:
                `Mouvement rapide: ${inAmount.toLocaleString('fr-FR')} FCFA entré puis ` +
                `${outAmount.toLocaleString('fr-FR')} FCFA sorti en ${hours} heures. ` +
                `Ce pattern de "pass-through" est suspect. Vérifier la destination des fonds.`,
              status: 'pending',
              detectedAt: new Date(),
            });

            break; // Une seule alerte par crédit
          }
        }
      }
    }

    return anomalies;
  }

  /**
   * Détecter la réactivation de comptes dormants
   */
  private detectDormantReactivation(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (sorted.length < 2) return anomalies;

    // Chercher les gaps de plus de 90 jours suivis d'activité importante
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      const gap = differenceInDays(new Date(curr.date), new Date(prev.date));

      if (gap >= 90) { // Compte dormant depuis plus de 3 mois
        // Regarder l'activité après réactivation (30 jours suivants)
        const reactivationDate = new Date(curr.date);
        const windowEnd = subDays(reactivationDate, -30);

        const reactivationTransactions = sorted.filter(t => {
          const date = new Date(t.date);
          return date >= reactivationDate && date <= windowEnd;
        });

        const reactivationVolume = reactivationTransactions.reduce(
          (sum, t) => sum + Math.abs(t.amount),
          0
        );

        if (reactivationVolume >= 5000000) { // Plus de 5M FCFA
          anomalies.push({
            id: uuidv4(),
            type: AnomalyType.AML_ALERT,
            severity: Severity.HIGH,
            confidence: 0.8,
            amount: reactivationVolume,
            transactions: reactivationTransactions.slice(0, 10),
            evidence: [
              {
                type: 'ALERT_TYPE',
                description: 'Type d\'alerte',
                value: 'DORMANT_REACTIVATION',
              },
              {
                type: 'DORMANT_PERIOD',
                description: 'Période d\'inactivité',
                value: `${gap} jours`,
              },
              {
                type: 'REACTIVATION_DATE',
                description: 'Date de réactivation',
                value: format(reactivationDate, 'dd/MM/yyyy'),
              },
              {
                type: 'POST_REACTIVATION_VOLUME',
                description: 'Volume post-réactivation (30j)',
                value: `${reactivationVolume.toLocaleString('fr-FR')} FCFA`,
              },
              {
                type: 'INDICATOR',
                description: 'Indicateur GAFI',
                value: 'Réactivation soudaine avec forte activité',
              },
            ],
            recommendation:
              `Compte dormant (${gap} jours) réactivé le ${format(reactivationDate, 'dd/MM/yyyy')} ` +
              `avec ${reactivationVolume.toLocaleString('fr-FR')} FCFA de volume en 30 jours. ` +
              `Ce pattern peut indiquer l'utilisation d'un compte dormant pour blanchiment.`,
            status: 'pending',
            detectedAt: new Date(),
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Détecter les descriptions suspectes
   */
  private detectSuspiciousDescriptions(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const suspiciousTransactions: { transaction: Transaction; keyword: string }[] = [];

    for (const t of transactions) {
      const description = t.description.toLowerCase();

      for (const keyword of this.config.suspiciousKeywords) {
        if (description.includes(keyword.toLowerCase())) {
          suspiciousTransactions.push({ transaction: t, keyword });
          break;
        }
      }
    }

    if (suspiciousTransactions.length > 0) {
      const totalAmount = suspiciousTransactions.reduce(
        (sum, st) => sum + Math.abs(st.transaction.amount),
        0
      );

      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.AML_ALERT,
        severity: Severity.HIGH,
        confidence: 0.75,
        amount: totalAmount,
        transactions: suspiciousTransactions.map(st => st.transaction).slice(0, 10),
        evidence: [
          {
            type: 'ALERT_TYPE',
            description: 'Type d\'alerte',
            value: 'SUSPICIOUS_DESCRIPTION',
          },
          {
            type: 'TRANSACTION_COUNT',
            description: 'Nombre de transactions',
            value: suspiciousTransactions.length,
          },
          {
            type: 'KEYWORDS_DETECTED',
            description: 'Mots-clés détectés',
            value: [...new Set(suspiciousTransactions.map(st => st.keyword))].join(', '),
          },
          {
            type: 'TOTAL_AMOUNT',
            description: 'Montant total',
            value: `${totalAmount.toLocaleString('fr-FR')} FCFA`,
          },
        ],
        recommendation:
          `${suspiciousTransactions.length} transactions avec des libellés suspects détectées ` +
          `(${totalAmount.toLocaleString('fr-FR')} FCFA). ` +
          `Mots-clés: ${[...new Set(suspiciousTransactions.map(st => st.keyword))].join(', ')}. ` +
          `Vérifier la nature de ces opérations.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    return anomalies;
  }

  /**
   * Détecter les dépassements de seuil de déclaration
   */
  private detectThresholdBreaches(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Transactions individuelles au-dessus du seuil
    const overThreshold = transactions.filter(
      t => Math.abs(t.amount) >= this.config.declarationThreshold
    );

    if (overThreshold.length > 0) {
      const totalAmount = overThreshold.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      anomalies.push({
        id: uuidv4(),
        type: AnomalyType.AML_ALERT,
        severity: Severity.MEDIUM, // Pas forcément suspect, mais à vérifier
        confidence: 1.0, // Factuel
        amount: totalAmount,
        transactions: overThreshold,
        evidence: [
          {
            type: 'ALERT_TYPE',
            description: 'Type d\'alerte',
            value: 'THRESHOLD_BREACH',
          },
          {
            type: 'TRANSACTION_COUNT',
            description: 'Transactions concernées',
            value: overThreshold.length,
          },
          {
            type: 'TOTAL_AMOUNT',
            description: 'Montant total',
            value: `${totalAmount.toLocaleString('fr-FR')} FCFA`,
          },
          {
            type: 'THRESHOLD',
            description: 'Seuil de déclaration',
            value: `${this.config.declarationThreshold.toLocaleString('fr-FR')} FCFA`,
          },
          {
            type: 'REGULATION',
            description: 'Réglementation',
            value: 'Règlement CEMAC/UEMOA sur la LCB-FT',
          },
        ],
        recommendation:
          `${overThreshold.length} transactions ≥ ${this.config.declarationThreshold.toLocaleString('fr-FR')} FCFA ` +
          `(seuil de déclaration). Vérifier que les déclarations obligatoires ont été effectuées ` +
          `et que les justificatifs économiques sont disponibles.`,
        status: 'pending',
        detectedAt: new Date(),
      });
    }

    return anomalies;
  }
}
