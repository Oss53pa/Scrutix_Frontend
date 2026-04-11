/**
 * @module AtlasBanx
 * @file src/scoring/RiskScoreBenchmark.ts
 * @description Benchmarks sectoriels UEMOA / CEMAC pour le calcul du Risk
 *              Score. Source de référence : Rapport annuel BCEAO 2023 sur
 *              les commissions bancaires (taux de commission moyen par
 *              type de client).
 *
 *              Les valeurs ci-dessous sont des estimations indicatives —
 *              à raffiner avec des sources sectorielles si disponibles.
 *              Le ratio représente : frais bancaires / volume de
 *              transactions sur la période, attendu pour un client moyen
 *              du secteur.
 * @author Atlas Studio
 * @version 1.0.0
 */

export type CompanySize = 'pme' | 'eti' | 'grande_entreprise' | 'holding';

export interface BenchmarkEntry {
  /** Code secteur (ex: "commerce", "industrie", "services", "btp") */
  sectorCode: string;
  /** Libellé affiché */
  label: string;
  /** Taille d'entreprise associée (peut être commune à plusieurs) */
  size: CompanySize;
  /** Ratio attendu : frais / volume (ex: 0.012 = 1.2%) */
  expectedFeeRatio: number;
  /** Marge tolérée (ex: 0.005 → entre 0.7% et 1.7% acceptable) */
  tolerance: number;
}

/**
 * Tableau de référence — couvre les principaux secteurs en zone UEMOA.
 * Les chiffres sont indicatifs (ordre de grandeur), pas des références
 * réglementaires.
 */
export const SECTOR_BENCHMARKS: readonly BenchmarkEntry[] = [
  // Commerce
  { sectorCode: 'commerce_pme',     label: 'Commerce — PME',         size: 'pme',               expectedFeeRatio: 0.012, tolerance: 0.005 },
  { sectorCode: 'commerce_eti',     label: 'Commerce — ETI',         size: 'eti',               expectedFeeRatio: 0.009, tolerance: 0.004 },
  { sectorCode: 'commerce_grande',  label: 'Commerce — Grand groupe', size: 'grande_entreprise', expectedFeeRatio: 0.006, tolerance: 0.003 },
  // Industrie
  { sectorCode: 'industrie_pme',    label: 'Industrie — PME',        size: 'pme',               expectedFeeRatio: 0.010, tolerance: 0.004 },
  { sectorCode: 'industrie_eti',    label: 'Industrie — ETI',        size: 'eti',               expectedFeeRatio: 0.008, tolerance: 0.003 },
  { sectorCode: 'industrie_grande', label: 'Industrie — Grand groupe', size: 'grande_entreprise', expectedFeeRatio: 0.005, tolerance: 0.002 },
  // Services
  { sectorCode: 'services_pme',     label: 'Services — PME',         size: 'pme',               expectedFeeRatio: 0.011, tolerance: 0.004 },
  { sectorCode: 'services_eti',     label: 'Services — ETI',         size: 'eti',               expectedFeeRatio: 0.009, tolerance: 0.003 },
  { sectorCode: 'services_grande',  label: 'Services — Grand groupe', size: 'grande_entreprise', expectedFeeRatio: 0.006, tolerance: 0.002 },
  // BTP
  { sectorCode: 'btp_pme',          label: 'BTP — PME',              size: 'pme',               expectedFeeRatio: 0.013, tolerance: 0.005 },
  { sectorCode: 'btp_eti',          label: 'BTP — ETI',              size: 'eti',               expectedFeeRatio: 0.010, tolerance: 0.004 },
  // Holding (haut niveau)
  { sectorCode: 'holding',          label: 'Holding',                size: 'holding',           expectedFeeRatio: 0.004, tolerance: 0.002 },
  // Default
  { sectorCode: 'default',          label: 'Référence générique',    size: 'pme',               expectedFeeRatio: 0.010, tolerance: 0.005 },
];

export class RiskScoreBenchmark {
  /**
   * Récupère le benchmark pour un secteur donné.
   * Fallback sur 'default' si le code n'est pas reconnu.
   */
  static getBenchmark(sectorCode?: string): BenchmarkEntry {
    if (!sectorCode) return SECTOR_BENCHMARKS[SECTOR_BENCHMARKS.length - 1];
    const found = SECTOR_BENCHMARKS.find((b) => b.sectorCode === sectorCode);
    return found ?? SECTOR_BENCHMARKS[SECTOR_BENCHMARKS.length - 1];
  }

  /**
   * Liste tous les secteurs disponibles pour les Select.
   */
  static listSectors(): readonly BenchmarkEntry[] {
    return SECTOR_BENCHMARKS;
  }

  /**
   * Calcule le ratio d'écart au benchmark.
   *   ratio < 1   → meilleur que le benchmark
   *   ratio = 1   → conforme au benchmark
   *   ratio > 1.5 → 50% au-dessus, alerte
   */
  static computeOverrun(actualRatio: number, benchmark: BenchmarkEntry): number {
    if (benchmark.expectedFeeRatio === 0) return 1;
    return actualRatio / benchmark.expectedFeeRatio;
  }
}
