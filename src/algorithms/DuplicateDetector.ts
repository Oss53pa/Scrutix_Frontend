import { v4 as uuidv4 } from 'uuid';
import { differenceInDays } from 'date-fns';
import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  Evidence,
  DetectionThresholds,
  BankConditions,
} from '../types';
import { transactionSimilarity, descriptionSimilarity } from './utils/similarity';

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
  detectDuplicates(transactions: Transaction[], bankConditions?: BankConditions): Anomaly[] {
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

        anomalies.push(this.createAnomaly(group, bankConditions));

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
  private createAnomaly(group: DuplicateGroup, bankConditions?: BankConditions): Anomaly {
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
      evidence: this.generateEvidence(group, bankConditions),
      recommendation: this.generateRecommendation(group, totalAmount, bankConditions),
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
   * Generate evidence for the anomaly with source references
   */
  private generateEvidence(group: DuplicateGroup, bankConditions?: BankConditions): Evidence[] {
    const evidence: Evidence[] = [];
    const bankName = bankConditions?.bankName || 'Banque';
    const gridDate = bankConditions?.effectiveDate
      ? new Date(bankConditions.effectiveDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      : '';
    const sourceName = gridDate ? `Grille tarifaire ${bankName} - ${gridDate}` : `Conditions ${bankName}`;

    // Montant dupliqué avec comparaison
    const originalAmount = Math.abs(group.original.amount);
    const totalDuplicated = group.duplicates.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    evidence.push({
      type: 'COMPARISON',
      description: 'Double facturation détectée',
      value: totalDuplicated,
      expectedValue: originalAmount,
      appliedValue: originalAmount + totalDuplicated,
      source: sourceName,
      conditionRef: this.identifyFeeType(group.original.description),
    });

    evidence.push({
      type: 'DUPLICATE_COUNT',
      description: 'Nombre de doublons',
      value: `${group.duplicates.length} transaction(s) en double`,
    });

    evidence.push({
      type: 'SIMILARITY_SCORE',
      description: 'Score de similarité',
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

    // Description comparison
    const descSim = descriptionSimilarity(
      group.original.description,
      group.duplicates[0].description
    );

    evidence.push({
      type: 'DESCRIPTION_MATCH',
      description: 'Libellé identifié',
      value: group.original.description,
      reference: `Similarité: ${Math.round(descSim * 100)}%`,
    });

    return evidence;
  }

  /**
   * Identify fee type from description
   */
  private identifyFeeType(description: string): string {
    const desc = description.toLowerCase();
    if (desc.includes('tenue') || desc.includes('compte')) return 'Frais de tenue de compte';
    if (desc.includes('virement') || desc.includes('vir')) return 'Frais de virement';
    if (desc.includes('carte') || desc.includes('cb')) return 'Frais de carte bancaire';
    if (desc.includes('retrait') || desc.includes('dab')) return 'Frais de retrait';
    if (desc.includes('sms') || desc.includes('alerte')) return 'Frais SMS/Alertes';
    if (desc.includes('commission')) return 'Commission bancaire';
    return 'Frais bancaires';
  }

  /**
   * Generate recommendation text with source reference
   */
  private generateRecommendation(group: DuplicateGroup, totalAmount: number, bankConditions?: BankConditions): string {
    const count = group.duplicates.length;
    const bankName = bankConditions?.bankName || 'la banque';
    const feeType = this.identifyFeeType(group.original.description);

    return (
      `Double facturation de ${feeType} détectée: ${count} transaction${count > 1 ? 's' : ''} en double pour ${Math.round(totalAmount).toLocaleString('fr-FR')} FCFA. ` +
      `Similarité: ${Math.round(group.similarity * 100)}%. ` +
      `Réclamer auprès de ${bankName} le remboursement de ${Math.round(totalAmount).toLocaleString('fr-FR')} FCFA.`
    );
  }
}
