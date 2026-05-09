// ============================================================================
// ATLASBANX - C11 Handler: Detection anomalies statistiques
// Zone: Orange
// Baseline V1: TypeScript-based Z-score + Benford + duplicate detection
// Production: Python FastAPI microservice (Isolation Forest, full Benford, etc.)
// ============================================================================

import type { C11Input, C11Output, StatisticalAnomaly, AnomalyType, AnomalySeverity } from '../types';

// ----------------------------------------------------------------------------
// Z-score outlier detection
// ----------------------------------------------------------------------------

function zScoreOutliers(
  operations: Array<Record<string, unknown>>,
  threshold: number = 2.5,
): StatisticalAnomaly[] {
  const amounts = operations
    .map(op => ({ id: op.id as string, amount: Math.abs(Number(op.amount ?? 0)) }))
    .filter(a => a.amount > 0);

  if (amounts.length < 5) return []; // Need enough data points

  const mean = amounts.reduce((s, a) => s + a.amount, 0) / amounts.length;
  const stdDev = Math.sqrt(
    amounts.reduce((s, a) => s + Math.pow(a.amount - mean, 2), 0) / amounts.length
  );

  if (stdDev === 0) return [];

  const anomalies: StatisticalAnomaly[] = [];
  for (const a of amounts) {
    const zScore = Math.abs(a.amount - mean) / stdDev;
    if (zScore >= threshold) {
      anomalies.push({
        operation_id: a.id,
        anomaly_type: 'amount_outlier',
        severity: zScore >= 4 ? 'high' : zScore >= 3 ? 'medium' : 'low',
        confidence: Math.min(95, Math.round(50 + zScore * 10)),
        explanation: `Montant ${formatAmount(a.amount)} s'ecarte de ${zScore.toFixed(1)} ecarts-types de la moyenne (${formatAmount(mean)}).`,
        suggested_investigation: 'Verifier la justification de ce montant inhabituel.',
      });
    }
  }

  return anomalies;
}

// ----------------------------------------------------------------------------
// Benford's Law (first digit distribution)
// ----------------------------------------------------------------------------

const BENFORD_EXPECTED = [0, 0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];

function benfordAnalysis(
  operations: Array<Record<string, unknown>>,
): StatisticalAnomaly[] {
  const amounts = operations
    .map(op => Math.abs(Number(op.amount ?? 0)))
    .filter(a => a >= 10); // Need at least 2-digit numbers

  if (amounts.length < 50) return []; // Benford needs sufficient sample

  // Count first digits
  const digitCounts = new Array(10).fill(0);
  for (const a of amounts) {
    const firstDigit = parseInt(String(a).replace(/^0+/, '')[0], 10);
    if (firstDigit >= 1 && firstDigit <= 9) digitCounts[firstDigit]++;
  }

  const total = digitCounts.slice(1).reduce((s, c) => s + c, 0);
  if (total === 0) return [];

  // Chi-squared test
  let chiSquared = 0;
  const deviations: Array<{ digit: number; observed: number; expected: number; deviation: number }> = [];

  for (let d = 1; d <= 9; d++) {
    const observed = digitCounts[d] / total;
    const expected = BENFORD_EXPECTED[d];
    const dev = Math.abs(observed - expected);
    chiSquared += Math.pow(observed - expected, 2) / expected;
    if (dev > 0.05) { // 5% deviation threshold
      deviations.push({ digit: d, observed, expected, deviation: dev });
    }
  }

  // Chi-squared critical value for 8 df at 0.05 = 15.507
  if (chiSquared <= 15.507) return []; // Distribution is normal

  const severity: AnomalySeverity = chiSquared > 30 ? 'high' : chiSquared > 20 ? 'medium' : 'low';
  const anomalies: StatisticalAnomaly[] = [];

  if (deviations.length > 0) {
    const worstDev = deviations.sort((a, b) => b.deviation - a.deviation)[0];
    anomalies.push({
      operation_id: 'BENFORD_GLOBAL',
      anomaly_type: 'benford_deviation',
      severity,
      confidence: Math.min(90, Math.round(50 + chiSquared)),
      explanation: `Distribution de Benford anormale (chi2=${chiSquared.toFixed(1)}). Le chiffre ${worstDev.digit} apparait a ${(worstDev.observed * 100).toFixed(1)}% vs ${(worstDev.expected * 100).toFixed(1)}% attendu.`,
      suggested_investigation: 'Verifier si les montants des frais ne suivent pas un schema de manipulation (arrondis, montants fixes repetes).',
    });
  }

  return anomalies;
}

// ----------------------------------------------------------------------------
// Semantic duplicates (same-day, similar amounts)
// ----------------------------------------------------------------------------

function semanticDuplicates(
  operations: Array<Record<string, unknown>>,
): StatisticalAnomaly[] {
  const anomalies: StatisticalAnomaly[] = [];
  const ops = operations.map(op => ({
    id: op.id as string,
    date: String(op.date ?? ''),
    amount: Number(op.amount ?? 0),
    label: String(op.description ?? op.label ?? ''),
  }));

  for (let i = 0; i < ops.length; i++) {
    for (let j = i + 1; j < ops.length; j++) {
      const a = ops[i], b = ops[j];
      if (a.date !== b.date) continue;
      if (Math.abs(a.amount) !== Math.abs(b.amount)) continue;
      if (Math.abs(a.amount) < 100) continue; // Skip tiny amounts

      // Same date, same amount — check label similarity
      const labelSim = jaccardSimilarity(a.label, b.label);
      if (labelSim >= 0.5) {
        anomalies.push({
          operation_id: a.id,
          anomaly_type: 'semantic_duplicate',
          severity: labelSim >= 0.8 ? 'high' : 'medium',
          confidence: Math.round(labelSim * 100),
          explanation: `Doublon potentiel: "${a.label}" et "${b.label}" — meme date, meme montant (${formatAmount(Math.abs(a.amount))}).`,
          suggested_investigation: `Verifier si l'operation ${b.id} est un doublon de ${a.id}.`,
        });
      }
    }
  }

  return anomalies;
}

// ----------------------------------------------------------------------------
// Temporal regularity check (missing expected recurring fees)
// ----------------------------------------------------------------------------

function temporalIrregularities(
  operations: Array<Record<string, unknown>>,
): StatisticalAnomaly[] {
  const anomalies: StatisticalAnomaly[] = [];

  // Group by label + amount to find recurring patterns
  const groups = new Map<string, string[]>();
  for (const op of operations) {
    const label = String(op.description ?? op.label ?? '').toUpperCase().slice(0, 30);
    const amount = Math.abs(Number(op.amount ?? 0));
    const key = `${label}|${amount}`;
    const date = String(op.date ?? '');

    const dates = groups.get(key) ?? [];
    dates.push(date);
    groups.set(key, dates);
  }

  // Check for groups with irregular frequency
  for (const [key, dates] of groups) {
    if (dates.length < 3) continue; // Need at least 3 occurrences

    const sorted = dates.sort();
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1]).getTime();
      const d2 = new Date(sorted[i]).getTime();
      if (!isNaN(d1) && !isNaN(d2)) {
        intervals.push((d2 - d1) / (1000 * 60 * 60 * 24)); // days
      }
    }

    if (intervals.length < 2) continue;

    const avgInterval = intervals.reduce((s, i) => s + i, 0) / intervals.length;
    const maxDeviation = Math.max(...intervals.map(i => Math.abs(i - avgInterval)));

    // If usually monthly (~30 days) but one gap is > 2x normal
    if (avgInterval > 20 && avgInterval < 40 && maxDeviation > avgInterval * 2) {
      const [label] = key.split('|');
      anomalies.push({
        operation_id: 'TEMPORAL_' + label.replace(/\s+/g, '_').slice(0, 20),
        anomaly_type: 'temporal_irregularity',
        severity: 'low',
        confidence: 60,
        explanation: `Frequence irreguliere pour "${label}" (intervalle moyen: ${Math.round(avgInterval)}j, ecart max: ${Math.round(maxDeviation)}j).`,
        suggested_investigation: 'Verifier si des frais recurrents sont manquants ou en double sur certaines periodes.',
      });
    }
  }

  return anomalies;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .format(Math.round(amount)).replace(/[\u00A0\u202F]/g, ' ') + ' FCFA';
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toUpperCase().split(/\s+/));
  const setB = new Set(b.toUpperCase().split(/\s+/));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

// ----------------------------------------------------------------------------
// Public handler
// ----------------------------------------------------------------------------

export function handleC11(input: C11Input): C11Output {
  const allOps = [...input.operations, ...(input.historical_operations ?? [])];

  const anomalies: StatisticalAnomaly[] = [
    ...zScoreOutliers(input.operations),
    ...benfordAnalysis(allOps),
    ...semanticDuplicates(input.operations),
    ...temporalIrregularities(allOps),
  ];

  // Deduplicate by operation_id + type
  const seen = new Set<string>();
  const unique = anomalies.filter(a => {
    const key = `${a.operation_id}|${a.anomaly_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by severity then confidence
  const severityOrder: Record<AnomalySeverity, number> = { high: 3, medium: 2, low: 1 };
  unique.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity] || b.confidence - a.confidence);

  return { anomalies: unique };
}
