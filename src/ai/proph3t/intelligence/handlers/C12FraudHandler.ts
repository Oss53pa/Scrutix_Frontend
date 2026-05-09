// ============================================================================
// ATLASBANX - C12 Handler: Detection patterns frauduleux structurels
// Zone: Orange — tout pattern → presente a l'humain, aucune publication auto
// 5 patterns cibles du CDC PROPH3T v1.0
// ============================================================================

import type { C12Input, C12Output, DetectedFraudPattern, FraudPattern, AnomalySeverity } from '../types';

// ----------------------------------------------------------------------------
// Pattern 1: Plafonnement "juste sous seuil" BCEAO
// Montants systematiquement juste sous un seuil reglementaire
// ----------------------------------------------------------------------------

function detectPlafonnement(
  operations: Array<Record<string, unknown>>,
): DetectedFraudPattern[] {
  const SEUILS = [500000, 1000000, 5000000, 10000000]; // Common BCEAO thresholds
  const MARGIN = 0.05; // 5% below threshold
  const MIN_OCCURRENCES = 3;

  const results: DetectedFraudPattern[] = [];

  for (const seuil of SEUILS) {
    const lowerBound = seuil * (1 - MARGIN);
    const nearThreshold = operations.filter(op => {
      const amount = Math.abs(Number(op.amount ?? 0));
      return amount >= lowerBound && amount < seuil;
    });

    if (nearThreshold.length >= MIN_OCCURRENCES) {
      results.push({
        pattern: 'plafonnement_sous_seuil',
        severity: nearThreshold.length >= 5 ? 'high' : 'medium',
        confidence: Math.min(90, 50 + nearThreshold.length * 8),
        affected_operations: nearThreshold.map(op => String(op.id)),
        description: `${nearThreshold.length} operations juste sous le seuil de ${formatAmount(seuil)} (marge ${MARGIN * 100}%).`,
        evidence: `Montants concentres entre ${formatAmount(lowerBound)} et ${formatAmount(seuil)}.`,
      });
    }
  }

  return results;
}

// ----------------------------------------------------------------------------
// Pattern 2: Date de valeur defavorable systematique
// J+1 ou J+2 sur des operations qui devraient etre J
// ----------------------------------------------------------------------------

function detectDvDefavorable(
  operations: Array<Record<string, unknown>>,
): DetectedFraudPattern[] {
  let dvDelayCount = 0;
  const affectedOps: string[] = [];

  for (const op of operations) {
    const opDate = op.date as string | undefined;
    const valueDate = op.value_date as string | undefined;
    if (!opDate || !valueDate) continue;

    const d1 = new Date(opDate).getTime();
    const d2 = new Date(valueDate).getTime();
    if (isNaN(d1) || isNaN(d2)) continue;

    const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) { // Value date after operation date = defavorable
      dvDelayCount++;
      affectedOps.push(String(op.id));
    }
  }

  const opsWithDates = operations.filter(op => op.date && op.value_date).length;
  if (opsWithDates < 5 || dvDelayCount < 3) return [];

  const ratio = dvDelayCount / opsWithDates;
  if (ratio < 0.3) return []; // Less than 30% — not systematic

  return [{
    pattern: 'dv_defavorable_systematique',
    severity: ratio >= 0.7 ? 'high' : ratio >= 0.5 ? 'medium' : 'low',
    confidence: Math.min(90, Math.round(ratio * 100)),
    affected_operations: affectedOps.slice(0, 20),
    description: `${dvDelayCount}/${opsWithDates} operations (${(ratio * 100).toFixed(0)}%) avec date de valeur defavorable.`,
    evidence: `Ratio de dates de valeur posterieures a la date d'operation: ${(ratio * 100).toFixed(1)}%.`,
  }];
}

// ----------------------------------------------------------------------------
// Pattern 3: Libelles rotatifs (frais recurrents sous noms differents)
// ----------------------------------------------------------------------------

function detectLibellesRotatifs(
  operations: Array<Record<string, unknown>>,
): DetectedFraudPattern[] {
  // Group by amount — same amount, different labels, recurring
  const amountGroups = new Map<number, Array<{ id: string; label: string; date: string }>>();

  for (const op of operations) {
    const amount = Math.abs(Number(op.amount ?? 0));
    if (amount < 500) continue; // Skip tiny amounts

    const rounded = Math.round(amount / 100) * 100; // Round to nearest 100
    const group = amountGroups.get(rounded) ?? [];
    group.push({
      id: String(op.id),
      label: String(op.description ?? op.label ?? ''),
      date: String(op.date ?? ''),
    });
    amountGroups.set(rounded, group);
  }

  const results: DetectedFraudPattern[] = [];

  for (const [amount, group] of amountGroups) {
    if (group.length < 3) continue;

    // Count distinct labels
    const labels = new Set(group.map(g => g.label.toUpperCase().trim()));
    if (labels.size < 2) continue; // All same label — not rotating

    // Ratio of unique labels to occurrences
    const rotationRatio = labels.size / group.length;
    if (rotationRatio > 0.8) continue; // Too many unique labels — probably different fees

    // At least 2 labels, each appearing multiple times → suspicious
    const labelCounts = new Map<string, number>();
    for (const g of group) {
      const l = g.label.toUpperCase().trim();
      labelCounts.set(l, (labelCounts.get(l) ?? 0) + 1);
    }

    const recurringLabels = [...labelCounts.entries()].filter(([, c]) => c >= 2);
    if (recurringLabels.length < 2) continue;

    results.push({
      pattern: 'libelles_rotatifs',
      severity: group.length >= 6 ? 'high' : 'medium',
      confidence: Math.min(85, 40 + group.length * 5),
      affected_operations: group.map(g => g.id),
      description: `${group.length} operations de ~${formatAmount(amount)} sous ${labels.size} libelles differents.`,
      evidence: `Libelles: ${[...labels].slice(0, 5).join(', ')}`,
    });
  }

  return results;
}

// ----------------------------------------------------------------------------
// Pattern 4: Decouvert maintenu artificiellement
// Anomaly: withdrawals timed to maximize overdraft duration
// Simplified V1: detect if balance goes negative repeatedly with regular fees
// ----------------------------------------------------------------------------

function detectDecouvertArtificiel(
  operations: Array<Record<string, unknown>>,
): DetectedFraudPattern[] {
  // Check for agios/interest charges — if present, check frequency
  const agiosOps = operations.filter(op => {
    const label = String(op.description ?? op.label ?? '').toUpperCase();
    return /AGIOS?|INTER[EE]TS?\s*DEB|PENALITE\s*DECOUVERT/i.test(label);
  });

  if (agiosOps.length < 4) return []; // Need pattern

  // Check if agios are charged more frequently than quarterly
  const dates = agiosOps
    .map(op => new Date(String(op.date ?? '')).getTime())
    .filter(d => !isNaN(d))
    .sort();

  if (dates.length < 3) return [];

  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
  }

  const avgInterval = intervals.reduce((s, i) => s + i, 0) / intervals.length;

  // If agios more frequent than monthly — unusual
  if (avgInterval < 25) {
    return [{
      pattern: 'decouvert_artificiel',
      severity: 'medium',
      confidence: Math.min(75, Math.round(60 + (30 - avgInterval))),
      affected_operations: agiosOps.map(op => String(op.id)),
      description: `Agios factures tous les ${Math.round(avgInterval)} jours en moyenne (${agiosOps.length} occurrences) — frequence anormalement elevee.`,
      evidence: `Intervalle moyen: ${Math.round(avgInterval)} jours. Attendu: 90 jours (trimestriel).`,
    }];
  }

  return [];
}

// ----------------------------------------------------------------------------
// Pattern 5: Frais sans contrepartie identifiable
// Fees with vague labels and no associated transaction
// ----------------------------------------------------------------------------

function detectFraisSansContrepartie(
  operations: Array<Record<string, unknown>>,
): DetectedFraudPattern[] {
  const VAGUE_LABELS = [
    /FRAIS?\s*DIVERS/i,
    /COM(MISSION)?\s*DIVERSE?S?/i,
    /FRAIS?\s*(?:NON\s+)?IDENTIFI/i,
    /PRELEVEMENT\s*(?:NON\s+)?IDENTIFI/i,
    /FRAIS?\s*SANS\s*(?:REF|REFERENCE)/i,
    /AUTRES?\s*FRAIS/i,
  ];

  const vagueOps = operations.filter(op => {
    const label = String(op.description ?? op.label ?? '');
    const amount = Number(op.amount ?? 0);
    return amount < 0 && VAGUE_LABELS.some(re => re.test(label));
  });

  if (vagueOps.length < 2) return [];

  const totalAmount = vagueOps.reduce((s, op) => s + Math.abs(Number(op.amount ?? 0)), 0);

  return [{
    pattern: 'frais_sans_contrepartie',
    severity: vagueOps.length >= 5 ? 'high' : vagueOps.length >= 3 ? 'medium' : 'low',
    confidence: Math.min(80, 40 + vagueOps.length * 8),
    affected_operations: vagueOps.map(op => String(op.id)),
    description: `${vagueOps.length} frais a libelle vague totalisant ${formatAmount(totalAmount)}.`,
    evidence: `Libelles: ${vagueOps.map(op => String(op.description ?? op.label ?? '')).slice(0, 5).join(', ')}`,
  }];
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .format(Math.round(amount)).replace(/[\u00A0\u202F]/g, ' ') + ' FCFA';
}

// ----------------------------------------------------------------------------
// Public handler
// ----------------------------------------------------------------------------

export function handleC12(input: C12Input): C12Output {
  const patterns: DetectedFraudPattern[] = [
    ...detectPlafonnement(input.operations),
    ...detectDvDefavorable(input.operations),
    ...detectLibellesRotatifs(input.operations),
    ...detectDecouvertArtificiel(input.operations),
    ...detectFraisSansContrepartie(input.operations),
  ];

  // Sort by severity
  const severityOrder: Record<AnomalySeverity, number> = { high: 3, medium: 2, low: 1 };
  patterns.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity] || b.confidence - a.confidence);

  return { patterns };
}
