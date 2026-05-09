// ============================================================================
// CDC — Veille réglementaire trimestrielle
// ============================================================================
// CDC §3.3.4 et §10 :
//   « Cycle trimestriel par défaut [...] mises à jour exceptionnelles
//     déclenchées par publication d'un avenant tarifaire par une banque ;
//     changement de gouvernance ou de statut d'une banque (fusion,
//     acquisition, retrait d'agrément) ; signalement par un client. »
//   « Veille réglementaire automatisée et notifications. »
//
// Module front-end : tracking des sources réglementaires (BCEAO, COBAC,
// OHADA), détection des règles en fin de validité, queue d'alertes
// trimestrielles à présenter à l'équipe Atlas Studio.
//
// Le scheduling effectif s'opère côté serveur (Supabase Edge Function +
// pg_cron). Ce module fournit les calculs déterministes utilisés à la
// fois côté front (UI alertes) et côté Edge Function (job trimestriel).
// ============================================================================

import type { RegulatoryRule, RegulatoryJurisdiction } from '../types';

// ============================================================================
// Sources réglementaires officielles
// ============================================================================

export interface RegulatorySource {
  code: string;
  name: string;
  zone: 'UEMOA' | 'CEMAC' | 'OHADA' | 'NATIONAL';
  /** URL de la page où l'organe publie ses textes. */
  publicUrl: string;
  /** Fréquence usuelle de mise à jour. */
  cadence: 'quarterly' | 'semestrial' | 'annual' | 'event-driven';
  /** Catégorie de règles publiées. */
  ruleCategories: string[];
}

export const OFFICIAL_SOURCES: RegulatorySource[] = [
  {
    code: 'BCEAO',
    name: 'Banque Centrale des États de l\'Afrique de l\'Ouest',
    zone: 'UEMOA',
    publicUrl: 'https://www.bceao.int/fr/publications',
    cadence: 'semestrial',
    ruleCategories: ['taux_usure', 'dates_valeur', 'cpfd', 'commission_mouvement'],
  },
  {
    code: 'COBAC',
    name: 'Commission Bancaire de l\'Afrique Centrale',
    zone: 'CEMAC',
    publicUrl: 'https://www.beac.int/index.php/cobac',
    cadence: 'event-driven',
    ruleCategories: ['agrements', 'normes_prudentielles', 'taux_usure'],
  },
  {
    code: 'OHADA',
    name: 'Organisation pour l\'Harmonisation en Afrique du Droit des Affaires',
    zone: 'OHADA',
    publicUrl: 'https://www.ohada.org/index.php/fr/textes',
    cadence: 'annual',
    ruleCategories: ['suretes', 'syscohada', 'droit_commercial'],
  },
  {
    code: 'CI-USURE',
    name: 'Loi sur l\'usure — Côte d\'Ivoire',
    zone: 'NATIONAL',
    publicUrl: 'https://www.bceao.int/fr/avis/avis-de-fixation-du-taux-usure',
    cadence: 'semestrial',
    ruleCategories: ['taux_usure'],
  },
  {
    code: 'SN-USURE',
    name: 'Loi sur l\'usure — Sénégal',
    zone: 'NATIONAL',
    publicUrl: 'https://www.bceao.int/fr/avis/avis-de-fixation-du-taux-usure',
    cadence: 'semestrial',
    ruleCategories: ['taux_usure'],
  },
];

// ============================================================================
// Calculs de veille
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface RegulatoryAlert {
  id: string;
  severity: AlertSeverity;
  jurisdictionCode: string;
  category: string;
  message: string;
  ruleId?: string;
  /** Date à laquelle agir (avant échéance). */
  actionableUntil: Date;
  recommendation: string;
  source: RegulatorySource | null;
}

/**
 * Génère la liste d'alertes trimestrielles à examiner par l'équipe.
 *
 * Trois familles d'alertes :
 *   1. Règles arrivant à échéance dans 90 jours (warning)
 *   2. Règles déjà expirées non remplacées (critical)
 *   3. Sources sans mise à jour depuis > cadence × 1.5 (info)
 *
 * @param rules    règles L1 actuellement en base
 * @param jurisdictions juridictions actives
 * @param now      date de référence (DI pour tests)
 */
export function computeQuarterlyAlerts(
  rules: RegulatoryRule[],
  jurisdictions: RegulatoryJurisdiction[],
  now: Date = new Date(),
): RegulatoryAlert[] {
  const alerts: RegulatoryAlert[] = [];
  const SOON_DAYS = 90;
  const STALE_FACTOR = 1.5;

  const jurisByCode = new Map(jurisdictions.map((j) => [j.id, j]));
  const sourcesByCode = new Map(OFFICIAL_SOURCES.map((s) => [s.code, s]));

  // 1. Règles arrivant à échéance bientôt
  for (const rule of rules) {
    if (rule.supersededBy) continue;
    if (!rule.validTo) continue;

    const daysToExpiry = Math.floor(
      (rule.validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    const juris = jurisByCode.get(rule.jurisdictionId);
    const source = juris ? sourcesByCode.get(juris.code) ?? null : null;

    if (daysToExpiry < 0) {
      alerts.push({
        id: `rule-expired-${rule.id}`,
        severity: 'critical',
        jurisdictionCode: juris?.code ?? '?',
        category: rule.rubricCode,
        message: `Règle ${rule.rubricCode} expirée le ${rule.validTo.toISOString().slice(0, 10)} — pas de remplacement publié.`,
        ruleId: rule.id,
        actionableUntil: now,
        recommendation: source
          ? `Consulter ${source.publicUrl} pour la version en cours, et mettre à jour L1.`
          : 'Mettre à jour L1 manuellement.',
        source,
      });
    } else if (daysToExpiry <= SOON_DAYS) {
      alerts.push({
        id: `rule-soon-${rule.id}`,
        severity: 'warning',
        jurisdictionCode: juris?.code ?? '?',
        category: rule.rubricCode,
        message: `Règle ${rule.rubricCode} expire dans ${daysToExpiry} jours (${rule.validTo.toISOString().slice(0, 10)}).`,
        ruleId: rule.id,
        actionableUntil: rule.validTo,
        recommendation: source
          ? `Vérifier ${source.publicUrl} pour la prochaine version.`
          : 'Préparer la nouvelle version.',
        source,
      });
    }
  }

  // 2. Détection des juridictions "muettes" — pas de règle récente
  for (const juris of jurisdictions) {
    const jurisRules = rules.filter((r) => r.jurisdictionId === juris.id && !r.supersededBy);
    if (jurisRules.length === 0) {
      alerts.push({
        id: `juris-empty-${juris.id}`,
        severity: 'warning',
        jurisdictionCode: juris.code,
        category: 'all',
        message: `Aucune règle active pour ${juris.code} (${juris.name}).`,
        actionableUntil: now,
        recommendation: 'Initialiser le référentiel L1 pour cette juridiction.',
        source: sourcesByCode.get(juris.code) ?? null,
      });
      continue;
    }
    const mostRecent = jurisRules
      .map((r) => r.recordedAt.getTime())
      .reduce((a, b) => Math.max(a, b), 0);
    const daysSince = Math.floor((now.getTime() - mostRecent) / (1000 * 60 * 60 * 24));
    const source = sourcesByCode.get(juris.code);
    if (source) {
      const expectedMaxDays = cadenceToDays(source.cadence) * STALE_FACTOR;
      if (daysSince > expectedMaxDays) {
        alerts.push({
          id: `juris-stale-${juris.id}`,
          severity: 'info',
          jurisdictionCode: juris.code,
          category: 'all',
          message: `Référentiel ${juris.code} non mis à jour depuis ${daysSince} jours (cadence attendue: ${source.cadence}).`,
          actionableUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          recommendation: `Faire une revue manuelle sur ${source.publicUrl}.`,
          source,
        });
      }
    }
  }

  // Tri : critical > warning > info, puis date d'échéance
  alerts.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    return a.actionableUntil.getTime() - b.actionableUntil.getTime();
  });

  return alerts;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function cadenceToDays(c: RegulatorySource['cadence']): number {
  switch (c) {
    case 'quarterly':   return 90;
    case 'semestrial':  return 182;
    case 'annual':      return 365;
    case 'event-driven': return 365; // 1 an = "long sans nouvelle" warning
  }
}

// ============================================================================
// Plan de revue trimestriel
// ============================================================================

export interface QuarterlyReviewPlan {
  quarter: string;          // 'Q2-2026'
  startDate: Date;
  endDate: Date;
  jurisdictionsToReview: Array<{
    code: string;
    sources: RegulatorySource[];
    knownRules: number;
  }>;
  alerts: RegulatoryAlert[];
  estimatedHours: number;
}

export function buildQuarterlyPlan(
  rules: RegulatoryRule[],
  jurisdictions: RegulatoryJurisdiction[],
  now: Date = new Date(),
): QuarterlyReviewPlan {
  const quarter = `Q${Math.floor(now.getMonth() / 3) + 1}-${now.getFullYear()}`;
  const startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 3, 0);

  const sourcesByJuris = new Map<string, RegulatorySource[]>();
  for (const s of OFFICIAL_SOURCES) {
    const arr = sourcesByJuris.get(s.code) ?? [];
    arr.push(s);
    sourcesByJuris.set(s.code, arr);
  }

  const jurisdictionsToReview = jurisdictions.map((j) => ({
    code: j.code,
    sources: sourcesByJuris.get(j.code) ?? [],
    knownRules: rules.filter((r) => r.jurisdictionId === j.id && !r.supersededBy).length,
  }));

  const alerts = computeQuarterlyAlerts(rules, jurisdictions, now);

  // Estimation grossière : 30 min par juridiction + 15 min par alerte critique
  const estimatedHours =
    jurisdictionsToReview.length * 0.5 +
    alerts.filter((a) => a.severity === 'critical').length * 0.25 +
    alerts.filter((a) => a.severity === 'warning').length * 0.15;

  return {
    quarter,
    startDate,
    endDate,
    jurisdictionsToReview,
    alerts,
    estimatedHours: Math.round(estimatedHours * 10) / 10,
  };
}
