/**
 * @module AtlasBanx
 * @file src/performance/WorkerPoolOptimizer.ts
 * @description Calcule la configuration optimale du pool de Web Workers en
 *              fonction du matériel et du volume à traiter.
 *
 *              Stratégie :
 *                • workerCount = min(navigator.hardwareConcurrency - 1, 4)
 *                • chunkSize adaptatif : min(1000, ceil(transactionCount / workerCount))
 *                • Limites : soft limit 50 000 tx (warning), hard limit 200 000 tx (refus)
 *
 *              Le pool réel (detection.worker.ts + WorkerPool.ts) utilise
 *              déjà ce pattern — cette classe formalise les heuristiques
 *              pour qu'elles soient testables et documentées.
 * @author Atlas Studio
 * @version 1.0.0
 */

import {
  SOFT_LIMIT_TRANSACTIONS,
  HARD_LIMIT_TRANSACTIONS,
  type WorkerPoolConfig,
} from './types';

const DEFAULT_WORKERS = 2;
const MAX_WORKERS = 4;
const MAX_CHUNK_SIZE = 1000;
const MIN_CHUNK_SIZE = 100;

export class WorkerPoolOptimizer {
  /**
   * Calcule la configuration optimale.
   */
  static optimize(transactionCount: number): WorkerPoolConfig {
    const cpuCores = this.detectCpuCores();
    const workerCount = Math.min(Math.max(1, cpuCores - 1), MAX_WORKERS);
    const chunkSize = this.computeChunkSize(transactionCount, workerCount);

    return {
      workerCount,
      chunkSize,
      cpuCores,
    };
  }

  /**
   * Vérifie si le volume est acceptable.
   */
  static checkLimits(transactionCount: number): {
    allowed: boolean;
    warning: boolean;
    message: string | null;
  } {
    if (transactionCount > HARD_LIMIT_TRANSACTIONS) {
      return {
        allowed: false,
        warning: false,
        message: `Volume de ${transactionCount.toLocaleString('fr-FR')} transactions dépasse la limite de ${HARD_LIMIT_TRANSACTIONS.toLocaleString('fr-FR')}. Découpez en plusieurs imports.`,
      };
    }
    if (transactionCount > SOFT_LIMIT_TRANSACTIONS) {
      return {
        allowed: true,
        warning: true,
        message: `Volume important (${transactionCount.toLocaleString('fr-FR')} transactions). L'analyse peut prendre plus de 15 minutes.`,
      };
    }
    return { allowed: true, warning: false, message: null };
  }

  /**
   * Estime la durée d'analyse en ms pour un volume donné.
   * Heuristique : ~0.5 ms/tx pour le pipeline complet (déterministe + ML).
   * Les appels LLM ajoutent un overhead variable non estimable ici.
   */
  static estimateDurationMs(transactionCount: number): number {
    return Math.round(transactionCount * 0.5);
  }

  /**
   * Formate une durée estimée pour affichage.
   */
  static formatEstimate(transactionCount: number): string {
    const ms = this.estimateDurationMs(transactionCount);
    if (ms < 60_000) return `~${Math.ceil(ms / 1000)} secondes`;
    return `~${Math.ceil(ms / 60_000)} minutes`;
  }

  // --------------------------------------------------------------------------

  static detectCpuCores(): number {
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      return navigator.hardwareConcurrency;
    }
    return DEFAULT_WORKERS + 1; // fallback : assume 3 cores
  }

  private static computeChunkSize(transactionCount: number, workerCount: number): number {
    if (transactionCount <= 0) return MAX_CHUNK_SIZE;
    const raw = Math.ceil(transactionCount / workerCount);
    return Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, raw));
  }

  static readonly SOFT_LIMIT = SOFT_LIMIT_TRANSACTIONS;
  static readonly HARD_LIMIT = HARD_LIMIT_TRANSACTIONS;
  static readonly MAX_WORKERS = MAX_WORKERS;
}
