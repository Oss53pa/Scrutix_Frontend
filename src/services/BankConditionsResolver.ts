// ============================================================================
// ATLASBANX — BankConditionsResolver
// ============================================================================
// Bi-temporal lookup: given a bank + a date (or a statement period), return
// the ConditionGrid that was contractually in force during that window.
//
// Why this exists
// ---------------
// Before this resolver, analyses applied the FIRST grid in the store to ALL
// statements regardless of bank or period. Multi-bank or multi-period audits
// produced silently-wrong results — a 2025 NSIA-CI statement could be audited
// against an active SGBC 2026 grid.
//
// Resolution rules (in order)
// ---------------------------
//   1. If a grid exactly covers [period.start, period.end], use it
//   2. If multiple grids cover the period, prefer the one with the latest
//      effectiveDate (= the most recent one in force)
//   3. If no grid covers the full period but at least one covers the END of
//      the period, use that one (the latest tariff applied to the closing
//      transactions)
//   4. If still nothing, fall back to the active grid for the bank
//   5. If the bank has no grid at all, return null and let the caller decide
// ============================================================================

import type {
  Bank,
  BankConditions,
  BankStatement,
  ConditionGrid,
  AnalysisResult,
  AnalysisStatistics,
  AnalysisSummary,
  AnomalyType,
  Severity,
} from '../types';

export interface ResolutionInput {
  bankCode: string;
  /** Period being audited (typically statement.periodStart and periodEnd) */
  start: Date;
  end: Date;
}

export interface ResolutionResult {
  grid: ConditionGrid | null;
  /** How the grid was selected — surfaced in the analysis report */
  strategy:
    | 'exact_coverage'   // grid covers [start, end] entirely
    | 'latest_in_period' // multiple grids cover the period, picked most recent effectiveDate
    | 'covers_end'       // grid covers period.end only (period straddles a tariff change)
    | 'active_fallback'  // no temporal match — used the bank's active grid
    | 'none';            // bank has no grid at all
  /** Free-text explanation suitable for the audit report */
  explanation: string;
  /** True when the analysis should be flagged: the grid doesn't cover the full period */
  partial: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ───────────────────────────────────────────────────────────────────────────

export class BankConditionsResolver {
  constructor(private readonly banks: Bank[]) {}

  /**
   * Resolve the condition grid that was in force for a bank during a period.
   */
  resolve(input: ResolutionInput): ResolutionResult {
    const bank = this.banks.find((b) => b.code === input.bankCode);
    if (!bank) {
      return {
        grid: null,
        strategy: 'none',
        explanation: `Aucune banque enregistrée pour le code ${input.bankCode}.`,
        partial: true,
      };
    }

    const grids = (bank.conditionGrids ?? []).filter((g) => g.status !== 'draft');
    if (grids.length === 0) {
      return {
        grid: null,
        strategy: 'none',
        explanation: `${bank.name} n'a aucune grille tarifaire enregistrée.`,
        partial: true,
      };
    }

    const startMs = input.start.getTime();
    const endMs = input.end.getTime();

    // Helper — does grid g cover the date d?
    const covers = (g: ConditionGrid, dMs: number): boolean => {
      const eff = new Date(g.effectiveDate).getTime();
      const exp = g.expirationDate ? new Date(g.expirationDate).getTime() : Infinity;
      return eff <= dMs && dMs <= exp;
    };

    // 1. Exact coverage — covers both start and end
    const exact = grids
      .filter((g) => covers(g, startMs) && covers(g, endMs))
      .sort(
        (a, b) =>
          new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime(),
      );
    if (exact.length > 0) {
      return {
        grid: exact[0],
        strategy: 'exact_coverage',
        explanation: `${bank.name} — grille « ${exact[0].name} » (effective au ${formatFr(exact[0].effectiveDate)}) couvre la totalité de la période ${formatFr(input.start)} → ${formatFr(input.end)}.`,
        partial: false,
      };
    }

    // 2. Period straddles a tariff change — multiple grids, pick latest covering end
    const coveringEnd = grids
      .filter((g) => covers(g, endMs))
      .sort(
        (a, b) =>
          new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime(),
      );
    if (coveringEnd.length > 0) {
      return {
        grid: coveringEnd[0],
        strategy: 'covers_end',
        explanation: `Période chevauchant un changement tarifaire — application de la grille « ${coveringEnd[0]
          .name} » (effective au ${formatFr(coveringEnd[0].effectiveDate)}). Les écritures antérieures à cette date sont auditées avec une réserve.`,
        partial: true,
      };
    }

    // 3. Bank's active grid as last-resort fallback
    const active = grids.find((g) => g.id === bank.activeGridId)
      ?? grids.find((g) => g.status === 'active')
      ?? grids[0];
    return {
      grid: active,
      strategy: 'active_fallback',
      explanation: `Aucune grille n'est en vigueur sur la période demandée. Audit conduit avec la grille active « ${active.name} » à titre indicatif — résultats à valider.`,
      partial: true,
    };
  }

  /**
   * Convenience wrapper for a BankStatement.
   */
  resolveForStatement(statement: BankStatement): ResolutionResult {
    return this.resolve({
      bankCode: statement.bankCode,
      start: new Date(statement.periodStart),
      end: new Date(statement.periodEnd),
    });
  }

  /**
   * Group statements by their resolved grid so the analysis service can run
   * once per (grid, bucket of statements) instead of merging everything.
   */
  groupStatementsByGrid(statements: BankStatement[]): Array<{
    grid: ConditionGrid | null;
    statements: BankStatement[];
    bankCode: string;
    resolution: ResolutionResult;
  }> {
    const buckets = new Map<string, {
      grid: ConditionGrid | null;
      statements: BankStatement[];
      bankCode: string;
      resolution: ResolutionResult;
    }>();
    for (const stmt of statements) {
      const res = this.resolveForStatement(stmt);
      const key = `${stmt.bankCode}::${res.grid?.id ?? 'none'}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.statements.push(stmt);
      } else {
        buckets.set(key, {
          grid: res.grid,
          statements: [stmt],
          bankCode: stmt.bankCode,
          resolution: res,
        });
      }
    }
    return [...buckets.values()];
  }

  /**
   * Split transactions by the grid that was in force on their date.
   * Returns one bucket per (bankCode, grid) combination. Each transaction
   * is assigned to the grid that covers its date; if no grid covers a
   * transaction, it falls into the bank's active grid (or a null bucket).
   */
  splitTransactionsByGrid<T extends { date: Date | string; bankCode?: string }>(
    transactions: T[],
    fallbackBankCode?: string,
  ): Array<{
    grid: ConditionGrid | null;
    transactions: T[];
    bankCode: string;
    resolution: ResolutionResult;
  }> {
    const buckets = new Map<string, {
      grid: ConditionGrid | null;
      transactions: T[];
      bankCode: string;
      resolution: ResolutionResult;
    }>();

    for (const tx of transactions) {
      const code = (tx.bankCode || fallbackBankCode || 'UNKNOWN');
      const txDate = typeof tx.date === 'string' ? new Date(tx.date) : tx.date;

      // Resolve with a single-day period so the grid is matched to this tx's date
      const res = this.resolve({
        bankCode: code,
        start: txDate,
        end: txDate,
      });

      const key = `${code}::${res.grid?.id ?? 'none'}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.transactions.push(tx);
      } else {
        buckets.set(key, {
          grid: res.grid,
          transactions: [tx],
          bankCode: code,
          resolution: res,
        });
      }
    }

    return [...buckets.values()];
  }
}

/**
 * Lift the legacy flat BankConditions out of a grid for the analysis service.
 * Returns a guaranteed-defined BankConditions, falling back to a sensible
 * minimal default when the grid is null.
 */
export function gridToBankConditions(
  grid: ConditionGrid | null,
  bank: { code: string; name: string; country: string },
  zone: 'CEMAC' | 'UEMOA' | null,
): BankConditions {
  const currency = zone === 'UEMOA' ? 'XOF' : 'XAF';
  if (grid) {
    return {
      ...grid.conditions,
      bankCode: bank.code,
      bankName: bank.name,
      country: bank.country,
      currency,
    };
  }
  return {
    id: `placeholder-${bank.code}`,
    bankCode: bank.code,
    bankName: bank.name,
    country: bank.country,
    currency,
    effectiveDate: new Date(),
    fees: [],
    interestRates: [],
    isActive: false,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────────────────────

function formatFr(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Merge multiple AnalysisResult objects (one per grid bucket) into a single
 * unified result. Anomalies are concatenated, statistics are summed/recomputed.
 */
export function mergeAnalysisResults(results: AnalysisResult[]): AnalysisResult {
  if (results.length === 0) {
    throw new Error('mergeAnalysisResults: at least one result required');
  }
  if (results.length === 1) return results[0];

  const allAnomalies = results.flatMap((r) => r.anomalies);

  // Merge statistics
  const mergedStats: AnalysisStatistics = {
    totalTransactions: results.reduce((s, r) => s + r.statistics.totalTransactions, 0),
    totalAmount: results.reduce((s, r) => s + r.statistics.totalAmount, 0),
    totalAnomalies: allAnomalies.length,
    totalAnomalyAmount: results.reduce((s, r) => s + r.statistics.totalAnomalyAmount, 0),
    anomaliesByType: {} as Record<AnomalyType, number>,
    anomaliesBySeverity: {} as Record<Severity, number>,
    anomalyRate: 0,
    potentialSavings: results.reduce((s, r) => s + r.statistics.potentialSavings, 0),
  };

  // Sum anomaliesByType across all results
  for (const r of results) {
    for (const [type, count] of Object.entries(r.statistics.anomaliesByType)) {
      const key = type as AnomalyType;
      mergedStats.anomaliesByType[key] = (mergedStats.anomaliesByType[key] ?? 0) + count;
    }
    for (const [sev, count] of Object.entries(r.statistics.anomaliesBySeverity)) {
      const key = sev as Severity;
      mergedStats.anomaliesBySeverity[key] = (mergedStats.anomaliesBySeverity[key] ?? 0) + count;
    }
  }
  mergedStats.anomalyRate = mergedStats.totalTransactions > 0
    ? (mergedStats.totalAnomalies / mergedStats.totalTransactions) * 100
    : 0;

  // Merge summary — pick worst status, concat findings
  const statusOrder: Record<string, number> = { OK: 0, WARNING: 1, CRITICAL: 2 };
  const worstStatus = results.reduce<'OK' | 'WARNING' | 'CRITICAL'>((worst, r) => {
    return (statusOrder[r.summary.status] ?? 0) > (statusOrder[worst] ?? 0)
      ? r.summary.status
      : worst;
  }, 'OK');

  const mergedSummary: AnalysisSummary = {
    status: worstStatus,
    message: results.length > 1
      ? `Audit multi-grille (${results.length} grilles tarifaires) — ${allAnomalies.length} anomalie(s) détectée(s).`
      : results[0].summary.message,
    keyFindings: [...new Set(results.flatMap((r) => r.summary.keyFindings))],
    recommendations: [...new Set(results.flatMap((r) => r.summary.recommendations))],
  };

  return {
    ...results[0],
    anomalies: allAnomalies,
    statistics: mergedStats,
    summary: mergedSummary,
    completedAt: new Date(),
  };
}
