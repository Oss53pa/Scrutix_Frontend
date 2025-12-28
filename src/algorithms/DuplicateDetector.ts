import { v4 as uuidv4 } from 'uuid';
import { differenceInDays } from 'date-fns';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  Evidence,
  DetectionThresholds,
} from '../types';
import { transactionSimilarity, descriptionSimilarity, amountSimilarity } from './utils/similarity';

interface DuplicateGroup {
  original: Transaction;
  duplicates: Transaction[];
  similarity: number;
}

export class DuplicateDetector {
  private thresholds: DetectionThresholds['duplicateDetection'];

  constructor(thresholds?: DetectionThresholds['duplicateDetection']) {
    this.thresholds = thresholds || {
      similarityThreshold: 0.85,
      timeWindowDays: 5,
      amountTolerance: 0.01,
    };
  }

  /**
   * Detect duplicate transactions in a list
   */
  detectDuplicates(transactions: Transaction[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const processed = new Set<string>();

    // Sort by date for efficient window-based comparison
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Filter to fee-type transactions (most commonly duplicated)
    const feeTransactions = sorted.filter(
      (t) => t.amount < 0 // Only consider debits
    );

    for (let i = 0; i < feeTransactions.length; i++) {
      const trans = feeTransactions[i];

      if (processed.has(trans.id)) continue;

      // Find duplicates within time window
      const duplicates = this.findDuplicates(trans, feeTransactions, i + 1, processed);

      if (duplicates.length > 0) {
        const group: DuplicateGroup = {
          original: trans,
          duplicates,
          similarity: this.calculateGroupSimilarity(trans, duplicates),
        };

        anomalies.push(this.createAnomaly(group));

        // Mark all as processed
        processed.add(trans.id);
        duplicates.forEach((d) => processed.add(d.id));
      }
    }

    return anomalies;
  }

  /**
   * Find duplicates for a given transaction
   */
  private findDuplicates(
    reference: Transaction,
    candidates: Transaction[],
    startIndex: number,
    processed: Set<string>
  ): Transaction[] {
    const duplicates: Transaction[] = [];
    const refDate = new Date(reference.date);

    for (let i = startIndex; i < candidates.length; i++) {
      const candidate = candidates[i];
      const candDate = new Date(candidate.date);

      // Check time window
      const daysDiff = differenceInDays(candDate, refDate);
      if (daysDiff > this.thresholds.timeWindowDays) break;

      if (processed.has(candidate.id)) continue;
      if (candidate.id === reference.id) continue;

      // Calculate similarity
      const similarity = transactionSimilarity(
        { amount: reference.amount, description: reference.description, date: refDate },
        { amount: candidate.amount, description: candidate.description, date: candDate },
        { amount: 0.4, description: 0.4, time: 0.2 },
        this.thresholds.amountTolerance,
        this.thresholds.timeWindowDays
      );

      if (similarity >= this.thresholds.similarityThreshold) {
        duplicates.push(candidate);
      }
    }

    return duplicates;
  }

  /**
   * Calculate average similarity within a duplicate group
   */
  private calculateGroupSimilarity(
    original: Transaction,
    duplicates: Transaction[]
  ): number {
    if (duplicates.length === 0) return 0;

    const similarities = duplicates.map((dup) =>
      transactionSimilarity(
        { amount: original.amount, description: original.description, date: new Date(original.date) },
        { amount: dup.amount, description: dup.description, date: new Date(dup.date) },
        { amount: 0.4, description: 0.4, time: 0.2 },
        this.thresholds.amountTolerance,
        this.thresholds.timeWindowDays
      )
    );

    return similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
  }

  /**
   * Create anomaly from duplicate group
   */
  private createAnomaly(group: DuplicateGroup): Anomaly {
    const totalAmount = group.duplicates.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    );

    return {
      id: uuidv4(),
      type: AnomalyType.DUPLICATE_FEE,
      severity: this.calculateSeverity(totalAmount, group.duplicates.length),
      confidence: group.similarity,
      amount: totalAmount,
      transactions: [group.original, ...group.duplicates],
      evidence: this.generateEvidence(group),
      recommendation: this.generateRecommendation(group, totalAmount),
      status: 'pending',
      detectedAt: new Date(),
    };
  }

  /**
   * Calculate severity based on amount and count
   */
  private calculateSeverity(amount: number, count: number): Severity {
    if (amount > 50000 || count >= 5) return Severity.CRITICAL;
    if (amount > 20000 || count >= 3) return Severity.HIGH;
    if (amount > 5000 || count >= 2) return Severity.MEDIUM;
    return Severity.LOW;
  }

  /**
   * Generate evidence for the anomaly
   */
  private generateEvidence(group: DuplicateGroup): Evidence[] {
    const evidence: Evidence[] = [];

    evidence.push({
      type: 'DUPLICATE_COUNT',
      description: 'Nombre de transactions dupliquées',
      value: group.duplicates.length,
    });

    evidence.push({
      type: 'SIMILARITY_SCORE',
      description: 'Score de similarité moyen',
      value: `${Math.round(group.similarity * 100)}%`,
    });

    // Date range
    const dates = [group.original, ...group.duplicates].map((t) => new Date(t.date));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    evidence.push({
      type: 'DATE_RANGE',
      description: 'Période concernée',
      value: `${minDate.toLocaleDateString('fr-FR')} - ${maxDate.toLocaleDateString('fr-FR')}`,
    });

    // Amount comparison
    const amounts = [group.original, ...group.duplicates].map((t) => t.amount);
    const amountSim = amountSimilarity(amounts[0], amounts[1], 0.01);

    if (amountSim === 1) {
      evidence.push({
        type: 'EXACT_AMOUNT_MATCH',
        description: 'Montants identiques',
        value: `${Math.abs(group.original.amount)} FCFA`,
      });
    }

    // Description comparison
    const descSim = descriptionSimilarity(
      group.original.description,
      group.duplicates[0].description
    );

    evidence.push({
      type: 'DESCRIPTION_SIMILARITY',
      description: 'Similarité des libellés',
      value: `${Math.round(descSim * 100)}%`,
      reference: group.original.description,
    });

    return evidence;
  }

  /**
   * Generate recommendation text
   */
  private generateRecommendation(group: DuplicateGroup, totalAmount: number): string {
    const count = group.duplicates.length;

    return (
      `Contester ${count} transaction${count > 1 ? 's' : ''} en double pour un montant total de ${Math.round(totalAmount).toLocaleString('fr-FR')} FCFA. ` +
      `Ces frais présentent une similarité de ${Math.round(group.similarity * 100)}% avec la transaction originale. ` +
      `Demander le remboursement et la correction du système de facturation pour éviter les futurs doublons.`
    );
  }
}
