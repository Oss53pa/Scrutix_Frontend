// ============================================================================
// SCRUTIX - Detection Worker Pool Manager
// Gestion du pool de Web Workers pour execution parallele
// ============================================================================

import type { Transaction, Anomaly, BankConditions, DailyBalance, DetectionThresholds } from '../types';
import type { WorkerMessage, WorkerResponse } from './detection.worker';

interface PendingTask {
  resolve: (anomalies: Anomaly[]) => void;
  reject: (error: Error) => void;
  detectorType: string;
}

/**
 * Pool de Web Workers pour la detection parallele
 * Auto-dimensionne selon navigator.hardwareConcurrency
 */
export class DetectionWorkerPool {
  private workers: Worker[] = [];
  private pendingTasks = new Map<string, PendingTask>();
  private nextWorkerIndex = 0;
  private initialized = false;
  private taskCounter = 0;

  /**
   * Initialise le pool de workers
   * @returns true si les workers sont disponibles, false sinon
   */
  initialize(): boolean {
    if (this.initialized) return true;

    try {
      const poolSize = Math.min(navigator.hardwareConcurrency || 4, 6);

      for (let i = 0; i < poolSize; i++) {
        const worker = new Worker(
          new URL('./detection.worker.ts', import.meta.url),
          { type: 'module' }
        );

        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          this.handleWorkerMessage(event.data);
        };

        worker.onerror = (event) => {
          console.error(`Worker ${i} error:`, event.message);
        };

        this.workers.push(worker);
      }

      this.initialized = true;
      return true;
    } catch (err) {
      console.warn('Web Workers non disponibles, mode sequentiel:', err);
      return false;
    }
  }

  /**
   * Execute un seul detecteur dans un worker
   */
  runDetection(
    detectorType: string,
    transactions: Transaction[],
    options?: {
      bankConditions?: BankConditions;
      thresholds?: DetectionThresholds;
      accountBalances?: DailyBalance[];
    }
  ): Promise<Anomaly[]> {
    if (!this.initialized || this.workers.length === 0) {
      return Promise.reject(new Error('Worker pool non initialise'));
    }

    const id = `task-${++this.taskCounter}`;

    return new Promise<Anomaly[]>((resolve, reject) => {
      this.pendingTasks.set(id, { resolve, reject, detectorType });

      const worker = this.workers[this.nextWorkerIndex % this.workers.length];
      this.nextWorkerIndex++;

      const message: WorkerMessage = {
        type: 'RUN_DETECTION',
        id,
        detectorType,
        transactions,
        bankConditions: options?.bankConditions,
        thresholds: options?.thresholds,
        accountBalances: options?.accountBalances,
      };

      worker.postMessage(message);
    });
  }

  /**
   * Execute plusieurs detecteurs en parallele
   * @param detectorTypes Liste des types de detecteurs a executer
   * @param onProgress Callback de progression
   * @returns Toutes les anomalies detectees
   */
  async runParallel(
    detectorTypes: string[],
    transactions: Transaction[],
    options?: {
      bankConditions?: BankConditions;
      thresholds?: DetectionThresholds;
      accountBalances?: DailyBalance[];
      onProgress?: (completed: number, total: number, currentType: string) => void;
    }
  ): Promise<Anomaly[]> {
    if (!this.initialized) {
      throw new Error('Worker pool non initialise');
    }

    const total = detectorTypes.length;
    let completed = 0;
    const allAnomalies: Anomaly[] = [];

    const promises = detectorTypes.map(async (type) => {
      try {
        const anomalies = await this.runDetection(type, transactions, {
          bankConditions: options?.bankConditions,
          thresholds: options?.thresholds,
          accountBalances: options?.accountBalances,
        });
        allAnomalies.push(...anomalies);
      } catch (err) {
        console.error(`Erreur detection ${type}:`, err);
      } finally {
        completed++;
        options?.onProgress?.(completed, total, type);
      }
    });

    await Promise.all(promises);
    return allAnomalies;
  }

  /**
   * Termine tous les workers et libere les ressources
   */
  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.pendingTasks.clear();
    this.initialized = false;
    this.nextWorkerIndex = 0;
  }

  /**
   * Nombre de workers actifs
   */
  get poolSize(): number {
    return this.workers.length;
  }

  /**
   * Le pool est-il initialise?
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  // ============================================================================
  // Private
  // ============================================================================

  private handleWorkerMessage(response: WorkerResponse): void {
    const pending = this.pendingTasks.get(response.id);
    if (!pending) return;

    this.pendingTasks.delete(response.id);

    if (response.type === 'ERROR') {
      pending.reject(new Error(response.error || 'Erreur worker'));
    } else {
      pending.resolve(response.anomalies || []);
    }
  }
}
