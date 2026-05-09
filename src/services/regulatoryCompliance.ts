// ============================================================================
// ATLASBANX — Regulatory compliance service (B5)
// ============================================================================
// Confronts each bank's tariff grid against the L1 regulatory framework:
//   - BCEAO (UEMOA) — Banque Centrale des États de l'Afrique de l'Ouest
//   - COBAC (CEMAC) — Commission Bancaire de l'Afrique Centrale
//   - OHADA cross-zone rules
//
// Limits are seeded inline (so the module is self-contained) but can be
// overridden by the CDC L1 seed data (migration 014_cdc_v1_seed_data.sql)
// when running on the live Supabase project.
//
// Output:
//   - List of violations per bank (rubric, expected, observed, severity)
//   - Compliance score 0-100 per bank
//   - Aggregate compliance index for the audited cohort
// ============================================================================

import type { Bank, ConditionGrid } from '../types';
import { getActiveGrid, getNumericValue, getZone } from './conditionsAnalytics';

// ───────────────────────────────────────────────────────────────────────────
// REGULATORY LIMITS (BCEAO + COBAC)
// ───────────────────────────────────────────────────────────────────────────

export type Regulator = 'BCEAO' | 'COBAC' | 'OHADA';

export interface RegulatoryLimit {
  /** Regulator that issues this rule */
  regulator: Regulator;
  /** Applies to which monetary zone */
  zone: 'CEMAC' | 'UEMOA' | 'BOTH';
  /** Field path inside ConditionGrid.conditions */
  rubricPath: string;
  /** Human label */
  rubricLabel: string;
  /** Display unit */
  unit: '%' | 'FCFA' | 'jours';
  /** Type of comparison */
  comparison: 'max' | 'min' | 'cap_pct';
  /** The threshold value */
  limit: number;
  /** Reference to the regulation text */
  reference: string;
  /** Severity of a violation */
  severity: 'critical' | 'high' | 'medium';
  /** Brief rationale shown in the report */
  rationale: string;
}

export const REGULATORY_LIMITS: RegulatoryLimit[] = [
  // ─── Taux d'usure ─────────────────────────────────────────────────────
  {
    regulator: 'BCEAO',
    zone: 'UEMOA',
    rubricPath: 'creditFees.tauxUsureLegal',
    rubricLabel: 'Taux d\'usure légal',
    unit: '%',
    comparison: 'max',
    limit: 15,
    reference: 'BCEAO — Avis n°2/AC/2014',
    severity: 'critical',
    rationale: 'Le taux d\'usure plafonné à 15 % en UEMOA est d\'ordre public. Toute pratique au-delà constitue un délit usuraire.',
  },
  {
    regulator: 'COBAC',
    zone: 'CEMAC',
    rubricPath: 'creditFees.tauxUsureLegal',
    rubricLabel: 'Taux d\'usure légal',
    unit: '%',
    comparison: 'max',
    limit: 19,
    reference: 'BEAC — Règlement COBAC R-2009/02',
    severity: 'critical',
    rationale: 'Le taux d\'usure en zone CEMAC est plafonné à 19 % par la BEAC.',
  },

  // ─── Découvert non autorisé ──────────────────────────────────────────
  {
    regulator: 'BCEAO',
    zone: 'UEMOA',
    rubricPath: 'creditFees.tauxDecouvertNonAutorise',
    rubricLabel: 'Taux découvert non autorisé',
    unit: '%',
    comparison: 'max',
    limit: 15,
    reference: 'BCEAO — Avis n°2/AC/2014',
    severity: 'critical',
    rationale: 'Le taux d\'intérêt sur découvert non autorisé ne peut excéder le taux d\'usure (15 % UEMOA).',
  },
  {
    regulator: 'COBAC',
    zone: 'CEMAC',
    rubricPath: 'creditFees.tauxDecouvertNonAutorise',
    rubricLabel: 'Taux découvert non autorisé',
    unit: '%',
    comparison: 'max',
    limit: 19,
    reference: 'COBAC R-2009/02',
    severity: 'critical',
    rationale: 'Plafonné au taux d\'usure CEMAC (19 %).',
  },

  // ─── Commission de mouvement (CCM) ──────────────────────────────────
  {
    regulator: 'BCEAO',
    zone: 'UEMOA',
    rubricPath: 'creditFees.commissionMouvement',
    rubricLabel: 'Commission de mouvement',
    unit: '%',
    comparison: 'cap_pct',
    limit: 0.025, // 0.025 % du débit
    reference: 'BCEAO — Décision n°397/12/2010',
    severity: 'high',
    rationale: 'La commission de mouvement est plafonnée à 0,025 % des écritures débitrices en UEMOA.',
  },
  {
    regulator: 'COBAC',
    zone: 'CEMAC',
    rubricPath: 'creditFees.commissionMouvement',
    rubricLabel: 'Commission de mouvement',
    unit: '%',
    comparison: 'cap_pct',
    limit: 0.05,
    reference: 'COBAC — Règlement R-2009/01',
    severity: 'high',
    rationale: 'CCM plafonnée à 0,05 % des mouvements débiteurs en CEMAC.',
  },

  // ─── Commission plus forte découverte ─────────────────────────────
  {
    regulator: 'BCEAO',
    zone: 'UEMOA',
    rubricPath: 'creditFees.commissionPlusForteDecouverte',
    rubricLabel: 'Commission plus forte découverte',
    unit: '%',
    comparison: 'cap_pct',
    limit: 0.05,
    reference: 'BCEAO — Décision n°397/12/2010',
    severity: 'high',
    rationale: 'CPFD plafonnée à 0,05 % du plus fort découvert mensuel en UEMOA.',
  },

  // ─── Tenue de compte ─────────────────────────────────────────────
  {
    regulator: 'BCEAO',
    zone: 'UEMOA',
    rubricPath: 'accountFees.tenueCompte.particulier',
    rubricLabel: 'Tenue de compte particulier',
    unit: 'FCFA',
    comparison: 'max',
    limit: 5000,
    reference: 'BCEAO — Recommandation 2018 service bancaire de base',
    severity: 'medium',
    rationale: 'Au-delà de 5 000 XOF/mois, la tenue de compte particulier sort du cadre du « service bancaire minimal » recommandé par la BCEAO.',
  },

  // ─── Frais d'inactivité ─────────────────────────────────────────
  {
    regulator: 'BCEAO',
    zone: 'UEMOA',
    rubricPath: 'accountFees.fraisInactivite',
    rubricLabel: 'Frais d\'inactivité',
    unit: 'FCFA',
    comparison: 'max',
    limit: 30000,
    reference: 'BCEAO — Décision n°026/2019',
    severity: 'medium',
    rationale: 'Les frais annuels d\'inactivité ne peuvent excéder 30 000 XOF en UEMOA.',
  },

  // ─── Frais d'opposition chèque ─────────────────────────────────
  {
    regulator: 'BCEAO',
    zone: 'UEMOA',
    rubricPath: 'checkFees.oppositionCheque',
    rubricLabel: 'Frais opposition chèque',
    unit: 'FCFA',
    comparison: 'max',
    limit: 12000,
    reference: 'BCEAO — Décision n°397/12/2010',
    severity: 'medium',
    rationale: 'Plafonnés à 12 000 XOF pour une opposition de chèque par le porteur en UEMOA.',
  },

  // ─── Frais chèque sans provision ──────────────────────────────
  {
    regulator: 'BCEAO',
    zone: 'UEMOA',
    rubricPath: 'checkFees.chequeSansProvision',
    rubricLabel: 'Frais chèque sans provision',
    unit: 'FCFA',
    comparison: 'max',
    limit: 25000,
    reference: 'BCEAO — Loi uniforme sur les instruments de paiement',
    severity: 'medium',
    rationale: 'Plafonnés à 25 000 XOF par incident de paiement.',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// VIOLATION DETECTION
// ───────────────────────────────────────────────────────────────────────────

export interface Violation {
  bankId: string;
  bankCode: string;
  bankName: string;
  zone: 'CEMAC' | 'UEMOA' | null;
  limit: RegulatoryLimit;
  observed: number;
  /** Magnitude of the breach in % above the cap (or below the floor) */
  breachPct: number;
}

export interface ComplianceReport {
  bankId: string;
  bankCode: string;
  bankName: string;
  zone: 'CEMAC' | 'UEMOA' | null;
  /** 0-100, where 100 = no violation */
  score: number;
  applicable: number;
  violationsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  violations: Violation[];
}

function applies(limit: RegulatoryLimit, zone: 'CEMAC' | 'UEMOA' | null): boolean {
  if (limit.zone === 'BOTH') return zone !== null;
  return zone === limit.zone;
}

function checkLimit(observed: number, limit: RegulatoryLimit): { breached: boolean; breachPct: number } {
  if (limit.comparison === 'max' || limit.comparison === 'cap_pct') {
    if (observed <= limit.limit) return { breached: false, breachPct: 0 };
    return { breached: true, breachPct: ((observed - limit.limit) / limit.limit) * 100 };
  }
  // min
  if (observed >= limit.limit) return { breached: false, breachPct: 0 };
  return { breached: true, breachPct: ((limit.limit - observed) / limit.limit) * 100 };
}

export function checkBankCompliance(bank: Bank, grid?: ConditionGrid | null): ComplianceReport {
  const useGrid = grid ?? getActiveGrid(bank);
  const zone = getZone(bank);
  const violations: Violation[] = [];
  let applicable = 0;
  let critical = 0;
  let high = 0;
  let medium = 0;

  for (const limit of REGULATORY_LIMITS) {
    if (!applies(limit, zone)) continue;
    if (!useGrid) continue;
    const observed = getNumericValue(useGrid, limit.rubricPath);
    if (observed == null) continue;
    applicable++;
    const { breached, breachPct } = checkLimit(observed, limit);
    if (breached) {
      violations.push({
        bankId: bank.id,
        bankCode: bank.code,
        bankName: bank.name,
        zone,
        limit,
        observed,
        breachPct,
      });
      if (limit.severity === 'critical') critical++;
      else if (limit.severity === 'high') high++;
      else medium++;
    }
  }

  // Compliance score: 100 - weighted violations
  // critical = -25, high = -10, medium = -3
  const penalty = critical * 25 + high * 10 + medium * 3;
  const score = Math.max(0, 100 - penalty);

  return {
    bankId: bank.id,
    bankCode: bank.code,
    bankName: bank.name,
    zone,
    score,
    applicable,
    violationsCount: violations.length,
    criticalCount: critical,
    highCount: high,
    mediumCount: medium,
    violations: violations.sort((a, b) => {
      const sevRank = { critical: 0, high: 1, medium: 2 };
      return sevRank[a.limit.severity] - sevRank[b.limit.severity];
    }),
  };
}

export function checkCohortCompliance(banks: Bank[]): ComplianceReport[] {
  return banks
    .map((b) => checkBankCompliance(b))
    .filter((r) => r.applicable > 0)
    .sort((a, b) => a.score - b.score); // worst first
}
