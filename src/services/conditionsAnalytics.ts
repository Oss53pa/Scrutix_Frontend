// ============================================================================
// ATLASBANX — Conditions analytics (B1, B2, B6, B7)
// ============================================================================
// Pure stat functions powering the benchmark module:
//   • Distribution stats: quartiles, median, IQR, std-dev, CV
//   • Outlier detection: z-score + Tukey IQR fences
//   • Coverage matrix: which rubrique × bank pairs are documented
//   • Composite indices: aggressiveness, cost baskets per client profile
//   • Migration simulator: switch from bank A to B → annual savings
//   • Trend forecaster: linear extrapolation + seasonality detection
//
// Inputs are taken from useBankStore data — no I/O, fully sync.
// ============================================================================

import type { Bank, ConditionGrid } from '../types';

// ───────────────────────────────────────────────────────────────────────────
// SHARED TYPES
// ───────────────────────────────────────────────────────────────────────────

export interface RubricRef {
  /** Dot path inside ConditionGrid.conditions */
  path: string;
  label: string;
  unit: 'FCFA' | '%' | 'jours';
  category: string;
  /** Lower-is-better (most fees) vs higher-is-better */
  betterWhen: 'lower' | 'higher';
  /** Frequency for cost basket — used when computing annual cost */
  frequency?: 'once' | 'monthly' | 'yearly' | 'per_operation';
}

export interface BankRubricValue {
  bankId: string;
  bankCode: string;
  bankName: string;
  zone: 'CEMAC' | 'UEMOA' | null;
  value: number;
}

// ───────────────────────────────────────────────────────────────────────────
// PATH HELPERS
// ───────────────────────────────────────────────────────────────────────────

export function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object' && k in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

export function getNumericValue(grid: ConditionGrid, path: string): number | null {
  const raw = getByPath(grid.conditions, path);
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return raw;
}

export function getActiveGrid(b: Bank): ConditionGrid | null {
  const grids = b.conditionGrids ?? [];
  return (
    grids.find((g) => g.id === b.activeGridId) ??
    grids.find((g) => g.status === 'active') ??
    grids[0] ??
    null
  );
}

export function getZone(b: Bank): 'CEMAC' | 'UEMOA' | null {
  if (b.zone === 'CEMAC' || b.zone === 'UEMOA') return b.zone;
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// DISTRIBUTION STATS
// ───────────────────────────────────────────────────────────────────────────

export interface Distribution {
  n: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  /** Standard deviation */
  stdDev: number;
  /** Coefficient of variation (std/mean) — useful to compare dispersion across rubriques of different scales */
  cv: number;
  /** Tukey fences for outliers */
  lowerFence: number;
  upperFence: number;
}

export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function computeDistribution(values: number[]): Distribution | null {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return null;
  const n = clean.length;
  const sorted = [...clean].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const mean = clean.reduce((s, v) => s + v, 0) / n;
  const median = quantile(sorted, 0.5);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const variance = clean.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const cv = mean === 0 ? 0 : stdDev / Math.abs(mean);
  // Tukey 1.5×IQR
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  return { n, min, max, mean, median, q1, q3, iqr, stdDev, cv, lowerFence, upperFence };
}

// ───────────────────────────────────────────────────────────────────────────
// OUTLIER DETECTION
// ───────────────────────────────────────────────────────────────────────────

export interface Outlier {
  bankId: string;
  bankCode: string;
  bankName: string;
  value: number;
  zScore: number;
  /** 'high' = above upper fence, 'low' = below lower fence */
  side: 'high' | 'low';
  /** Severity based on z-score magnitude */
  severity: 'extreme' | 'strong' | 'mild';
}

export function detectOutliers(
  samples: BankRubricValue[],
): { outliers: Outlier[]; distribution: Distribution | null } {
  const values = samples.map((s) => s.value);
  const distribution = computeDistribution(values);
  if (!distribution || distribution.iqr === 0) {
    return { outliers: [], distribution };
  }

  const outliers: Outlier[] = [];
  for (const s of samples) {
    const isHigh = s.value > distribution.upperFence;
    const isLow = s.value < distribution.lowerFence;
    if (!isHigh && !isLow) continue;
    const z = distribution.stdDev === 0 ? 0 : (s.value - distribution.mean) / distribution.stdDev;
    const absZ = Math.abs(z);
    const severity: Outlier['severity'] = absZ > 3 ? 'extreme' : absZ > 2 ? 'strong' : 'mild';
    outliers.push({
      bankId: s.bankId,
      bankCode: s.bankCode,
      bankName: s.bankName,
      value: s.value,
      zScore: z,
      side: isHigh ? 'high' : 'low',
      severity,
    });
  }
  return { outliers: outliers.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)), distribution };
}

// ───────────────────────────────────────────────────────────────────────────
// COVERAGE MATRIX
// ───────────────────────────────────────────────────────────────────────────

export interface CoverageCell {
  bankId: string;
  bankCode: string;
  rubricPath: string;
  rubricLabel: string;
  /** 'documented' = active grid has a numeric value, 'missing' = field is 0 or undefined,
   *  'no_grid' = bank has no grid at all */
  status: 'documented' | 'missing' | 'no_grid';
}

export interface CoverageStats {
  totalCells: number;
  documented: number;
  missing: number;
  noGrid: number;
  coverageRate: number;
  /** Per-bank score (% of rubriques documented) */
  byBank: Map<string, { documented: number; total: number; rate: number }>;
  /** Per-rubric score (% of banks documenting it) */
  byRubric: Map<string, { documented: number; total: number; rate: number }>;
}

export function computeCoverage(banks: Bank[], rubrics: RubricRef[]): {
  cells: CoverageCell[];
  stats: CoverageStats;
} {
  const cells: CoverageCell[] = [];
  const byBank = new Map<string, { documented: number; total: number; rate: number }>();
  const byRubric = new Map<string, { documented: number; total: number; rate: number }>();

  let documented = 0;
  let missing = 0;
  let noGrid = 0;

  for (const b of banks) {
    const grid = getActiveGrid(b);
    let bankDoc = 0;
    for (const r of rubrics) {
      let status: CoverageCell['status'];
      if (!grid) {
        status = 'no_grid';
        noGrid++;
      } else {
        const v = getNumericValue(grid, r.path);
        if (v !== null && v > 0) {
          status = 'documented';
          documented++;
          bankDoc++;
        } else {
          status = 'missing';
          missing++;
        }
      }
      cells.push({
        bankId: b.id,
        bankCode: b.code,
        rubricPath: r.path,
        rubricLabel: r.label,
        status,
      });
      const ru = byRubric.get(r.path) ?? { documented: 0, total: 0, rate: 0 };
      ru.total++;
      if (status === 'documented') ru.documented++;
      ru.rate = ru.total > 0 ? ru.documented / ru.total : 0;
      byRubric.set(r.path, ru);
    }
    byBank.set(b.id, {
      documented: bankDoc,
      total: rubrics.length,
      rate: rubrics.length > 0 ? bankDoc / rubrics.length : 0,
    });
  }

  const totalCells = cells.length;
  return {
    cells,
    stats: {
      totalCells,
      documented,
      missing,
      noGrid,
      coverageRate: totalCells > 0 ? documented / totalCells : 0,
      byBank,
      byRubric,
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// CORRELATION MATRIX
// ───────────────────────────────────────────────────────────────────────────

/**
 * Compute Pearson correlation between two parallel arrays.
 */
export function pearson(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

// ───────────────────────────────────────────────────────────────────────────
// B2 — COMPOSITE INDICES
// ───────────────────────────────────────────────────────────────────────────

export interface AggressivenessScore {
  bankId: string;
  bankCode: string;
  bankName: string;
  /** % of rubriques where the bank is at or above the upper quartile (Q3) */
  aboveQ3Pct: number;
  /** % of rubriques where the bank is at or below the lower quartile (Q1) — cheap */
  belowQ1Pct: number;
  /** Aggregate score: positive = aggressive (expensive), negative = competitive */
  score: number;
  /** Number of rubriques considered */
  n: number;
}

/**
 * Compute aggressiveness per bank: for every rubric where the bank has a value,
 * count whether it sits above Q3 or below Q1 of the market distribution.
 */
export function computeAggressiveness(
  banks: Bank[],
  rubrics: RubricRef[],
): AggressivenessScore[] {
  // For each rubric, compute the market distribution
  const distByRubric = new Map<string, Distribution | null>();
  const valuesByRubric = new Map<string, BankRubricValue[]>();

  for (const r of rubrics) {
    const samples: BankRubricValue[] = [];
    for (const b of banks) {
      const grid = getActiveGrid(b);
      if (!grid) continue;
      const v = getNumericValue(grid, r.path);
      if (v == null || v === 0) continue;
      samples.push({
        bankId: b.id,
        bankCode: b.code,
        bankName: b.name,
        zone: getZone(b),
        value: v,
      });
    }
    valuesByRubric.set(r.path, samples);
    distByRubric.set(r.path, computeDistribution(samples.map((s) => s.value)));
  }

  // Score each bank
  const scores: AggressivenessScore[] = [];
  for (const b of banks) {
    let aboveQ3 = 0;
    let belowQ1 = 0;
    let n = 0;
    for (const r of rubrics) {
      const samples = valuesByRubric.get(r.path) ?? [];
      const dist = distByRubric.get(r.path);
      if (!dist || dist.n < 3) continue; // need at least 3 banks for meaningful quartiles
      const mine = samples.find((s) => s.bankId === b.id);
      if (!mine) continue;
      n++;
      // Direction: for "lower is better" rubrics, above Q3 = expensive = aggressive
      const aboveUpper = r.betterWhen === 'lower' ? mine.value >= dist.q3 : mine.value <= dist.q1;
      const belowLower = r.betterWhen === 'lower' ? mine.value <= dist.q1 : mine.value >= dist.q3;
      if (aboveUpper) aboveQ3++;
      if (belowLower) belowQ1++;
    }
    if (n === 0) continue;
    const aboveQ3Pct = aboveQ3 / n;
    const belowQ1Pct = belowQ1 / n;
    scores.push({
      bankId: b.id,
      bankCode: b.code,
      bankName: b.name,
      aboveQ3Pct,
      belowQ1Pct,
      score: aboveQ3Pct - belowQ1Pct, // -1 to +1
      n,
    });
  }

  return scores.sort((a, b) => b.score - a.score);
}

// ───────────────────────────────────────────────────────────────────────────
// COST BASKETS — typical client profiles
// ───────────────────────────────────────────────────────────────────────────

export type ClientProfile = 'particulier_basique' | 'particulier_premium' | 'pme' | 'entreprise';

export interface BasketLine {
  path: string;
  label: string;
  /** How many times this fee is paid per year for this profile */
  occurrences: number;
  /** Multiplier — 1 for absolute amounts, applies to a notional volume for percentages */
  notionalAmount?: number;
}

export const PROFILE_BASKETS: Record<ClientProfile, { label: string; lines: BasketLine[] }> = {
  particulier_basique: {
    label: 'Particulier basique',
    lines: [
      { path: 'accountFees.tenueCompte.particulier', label: 'Tenue de compte', occurrences: 12 },
      { path: 'cardFees.visaClassic',                label: 'Cotisation Visa Classic', occurrences: 1 },
      { path: 'eBankingFees.abonnementMensuel',      label: 'E-banking', occurrences: 12 },
      { path: 'accountFees.releveCompte.mensuel',    label: 'Relevé mensuel', occurrences: 12 },
      { path: 'eBankingFees.smsAlerte',              label: 'SMS alertes (50/an)', occurrences: 50 },
      { path: 'cardFees.retraitDabAutreBanque',      label: 'Retraits DAB autre banque (24/an)', occurrences: 24 },
    ],
  },
  particulier_premium: {
    label: 'Particulier premium',
    lines: [
      { path: 'accountFees.tenueCompte.particulier', label: 'Tenue de compte', occurrences: 12 },
      { path: 'cardFees.visaGold',                   label: 'Cotisation Visa Gold', occurrences: 1 },
      { path: 'eBankingFees.abonnementMensuel',      label: 'E-banking premium', occurrences: 12 },
      { path: 'accountFees.releveCompte.mensuel',    label: 'Relevé mensuel', occurrences: 12 },
      { path: 'eBankingFees.smsAlerte',              label: 'SMS alertes (100/an)', occurrences: 100 },
      { path: 'transferFees.virementInternational.swift', label: 'Frais SWIFT (4/an)', occurrences: 4 },
    ],
  },
  pme: {
    label: 'PME',
    lines: [
      { path: 'accountFees.tenueCompte.professionnel', label: 'Tenue de compte pro', occurrences: 12 },
      { path: 'cardFees.visaGold',                     label: 'Carte Gold dirigeant', occurrences: 1 },
      { path: 'eBankingFees.abonnementMensuel',        label: 'E-banking pro', occurrences: 12 },
      { path: 'accountFees.releveCompte.mensuel',      label: 'Relevé mensuel', occurrences: 12 },
      { path: 'transferFees.virementInternational.swift', label: 'SWIFT (24/an)', occurrences: 24 },
      { path: 'creditFees.fraisDossierCredit',         label: 'Dossier crédit', occurrences: 1 },
      { path: 'checkFees.chequierEmission',            label: 'Chéquiers (4/an)', occurrences: 4 },
    ],
  },
  entreprise: {
    label: 'Entreprise',
    lines: [
      { path: 'accountFees.tenueCompte.entreprise',    label: 'Tenue de compte entreprise', occurrences: 12 },
      { path: 'cardFees.visaPlatinum',                 label: 'Cartes Platinum (3 dirigeants)', occurrences: 3 },
      { path: 'eBankingFees.abonnementMensuel',        label: 'E-banking entreprise', occurrences: 12 },
      { path: 'transferFees.virementInternational.swift', label: 'SWIFT (120/an)', occurrences: 120 },
      { path: 'creditFees.fraisDossierCredit',         label: 'Dossier crédit', occurrences: 2 },
      { path: 'checkFees.chequierEmission',            label: 'Chéquiers (12/an)', occurrences: 12 },
      { path: 'accountFees.attestationSolde',          label: 'Attestations (12/an)', occurrences: 12 },
    ],
  },
};

export interface BasketResult {
  bankId: string;
  bankCode: string;
  bankName: string;
  zone: 'CEMAC' | 'UEMOA' | null;
  totalAnnual: number;
  /** Breakdown by line — values that were applied */
  breakdown: Array<{ path: string; label: string; unitCost: number; occurrences: number; subtotal: number; missing: boolean }>;
  /** % of basket lines actually documented (data quality flag) */
  coverage: number;
}

export function computeCostBasket(
  banks: Bank[],
  profile: ClientProfile,
): BasketResult[] {
  const basket = PROFILE_BASKETS[profile];
  const results: BasketResult[] = [];

  for (const b of banks) {
    const grid = getActiveGrid(b);
    if (!grid) continue;
    let total = 0;
    let covered = 0;
    const breakdown: BasketResult['breakdown'] = [];
    for (const line of basket.lines) {
      const unitCost = getNumericValue(grid, line.path);
      const isFee = !line.path.includes('taux') && !line.path.includes('Taux') && !line.path.includes('commission');
      const missing = unitCost == null;
      const subtotal = unitCost != null && isFee ? unitCost * line.occurrences : 0;
      if (!missing) covered++;
      total += subtotal;
      breakdown.push({
        path: line.path,
        label: line.label,
        unitCost: unitCost ?? 0,
        occurrences: line.occurrences,
        subtotal,
        missing,
      });
    }
    results.push({
      bankId: b.id,
      bankCode: b.code,
      bankName: b.name,
      zone: getZone(b),
      totalAnnual: total,
      breakdown,
      coverage: basket.lines.length === 0 ? 0 : covered / basket.lines.length,
    });
  }
  return results.sort((a, b) => a.totalAnnual - b.totalAnnual);
}

// ───────────────────────────────────────────────────────────────────────────
// B6 — MIGRATION SIMULATOR
// ───────────────────────────────────────────────────────────────────────────

export interface MigrationResult {
  fromBankId: string;
  toBankId: string;
  fromBankName: string;
  toBankName: string;
  profile: ClientProfile;
  fromCost: number;
  toCost: number;
  /** Positive = savings, negative = cost increase */
  annualSavings: number;
  /** % of fromCost */
  savingsPct: number;
  /** Lines where the new bank is cheaper (potential gains) */
  gains: Array<{ label: string; from: number; to: number; delta: number }>;
  /** Lines where the new bank is more expensive (caveats) */
  losses: Array<{ label: string; from: number; to: number; delta: number }>;
}

export function simulateMigration(
  banks: Bank[],
  fromBankId: string,
  toBankId: string,
  profile: ClientProfile,
): MigrationResult | null {
  const allBaskets = computeCostBasket(banks, profile);
  const fromB = allBaskets.find((x) => x.bankId === fromBankId);
  const toB = allBaskets.find((x) => x.bankId === toBankId);
  if (!fromB || !toB) return null;

  const gains: MigrationResult['gains'] = [];
  const losses: MigrationResult['losses'] = [];
  for (let i = 0; i < fromB.breakdown.length; i++) {
    const f = fromB.breakdown[i];
    const t = toB.breakdown[i];
    if (!f || !t) continue;
    const delta = f.subtotal - t.subtotal; // positive = saving
    if (delta > 0) gains.push({ label: f.label, from: f.subtotal, to: t.subtotal, delta });
    else if (delta < 0) losses.push({ label: f.label, from: f.subtotal, to: t.subtotal, delta });
  }
  gains.sort((a, b) => b.delta - a.delta);
  losses.sort((a, b) => a.delta - b.delta);

  return {
    fromBankId,
    toBankId,
    fromBankName: fromB.bankName,
    toBankName: toB.bankName,
    profile,
    fromCost: fromB.totalAnnual,
    toCost: toB.totalAnnual,
    annualSavings: fromB.totalAnnual - toB.totalAnnual,
    savingsPct: fromB.totalAnnual > 0 ? (fromB.totalAnnual - toB.totalAnnual) / fromB.totalAnnual : 0,
    gains,
    losses,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// B7 — TREND FORECASTER
// ───────────────────────────────────────────────────────────────────────────

export interface TrendForecast {
  bankId: string;
  rubricPath: string;
  rubricLabel: string;
  /** Versions used, oldest first */
  history: Array<{ effectiveDate: Date; value: number }>;
  /** Linear slope (units / day). null = not enough data */
  slopePerDay: number | null;
  /** Predicted value 6 months out (180 days) */
  forecast6m: number | null;
  /** Predicted value 12 months out */
  forecast12m: number | null;
  /** Annualized growth rate (geometric, %) */
  cagrPct: number | null;
  /** True when the bank raised this rubric on similar months across years */
  seasonal: boolean;
  /** Risk score 0-100 — based on slope magnitude and consistency */
  riskScore: number;
}

export function forecastTrend(bank: Bank, rubric: RubricRef): TrendForecast {
  const grids = [...(bank.conditionGrids ?? [])].sort(
    (a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime(),
  );
  const history: Array<{ effectiveDate: Date; value: number }> = [];
  for (const g of grids) {
    const v = getNumericValue(g, rubric.path);
    if (v == null) continue;
    history.push({ effectiveDate: new Date(g.effectiveDate), value: v });
  }

  if (history.length < 2) {
    return {
      bankId: bank.id,
      rubricPath: rubric.path,
      rubricLabel: rubric.label,
      history,
      slopePerDay: null,
      forecast6m: null,
      forecast12m: null,
      cagrPct: null,
      seasonal: false,
      riskScore: 0,
    };
  }

  // Linear regression on (days since first, value)
  const t0 = history[0].effectiveDate.getTime();
  const xs = history.map((h) => (h.effectiveDate.getTime() - t0) / (1000 * 60 * 60 * 24));
  const ys = history.map((h) => h.value);
  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    num += dx * (ys[i] - meanY);
    den += dx * dx;
  }
  const slopePerDay = den === 0 ? 0 : num / den;
  const intercept = meanY - slopePerDay * meanX;
  const lastX = xs[xs.length - 1];

  const forecast6m = slopePerDay * (lastX + 180) + intercept;
  const forecast12m = slopePerDay * (lastX + 365) + intercept;

  // CAGR: (end/start)^(1/years) - 1
  const yearsSpan = (history[history.length - 1].effectiveDate.getTime() - t0) / (1000 * 60 * 60 * 24 * 365);
  const start = history[0].value;
  const end = history[history.length - 1].value;
  const cagrPct =
    yearsSpan > 0 && start > 0 && end > 0
      ? ((Math.pow(end / start, 1 / yearsSpan) - 1) * 100)
      : null;

  // Seasonality: same month appears multiple times with similar % moves
  const monthMoves = new Map<number, number[]>();
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1].value;
    const curr = history[i].value;
    if (prev === 0) continue;
    const month = history[i].effectiveDate.getMonth();
    const arr = monthMoves.get(month) ?? [];
    arr.push((curr - prev) / prev);
    monthMoves.set(month, arr);
  }
  let seasonal = false;
  for (const arr of monthMoves.values()) {
    if (arr.length >= 2 && arr.every((d) => d > 0.02)) {
      seasonal = true;
      break;
    }
  }

  // Risk score: combine slope magnitude (relative to current value) and direction
  const lastValue = history[history.length - 1].value;
  let riskScore = 0;
  if (lastValue > 0 && slopePerDay > 0) {
    // % of current value gained per year if trend continues
    const annualPct = ((slopePerDay * 365) / lastValue) * 100;
    riskScore = Math.min(100, Math.max(0, annualPct * 5)); // 20%/yr → 100
  }
  if (seasonal) riskScore = Math.min(100, riskScore + 10);

  return {
    bankId: bank.id,
    rubricPath: rubric.path,
    rubricLabel: rubric.label,
    history,
    slopePerDay,
    forecast6m,
    forecast12m,
    cagrPct,
    seasonal,
    riskScore,
  };
}

/** Forecast all rubriques for a bank in one pass. */
export function forecastBank(bank: Bank, rubrics: RubricRef[]): TrendForecast[] {
  return rubrics.map((r) => forecastTrend(bank, r)).filter((f) => f.history.length >= 2);
}
