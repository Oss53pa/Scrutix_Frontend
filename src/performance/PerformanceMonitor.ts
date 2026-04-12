/**
 * @module AtlasBanx
 * @file src/performance/PerformanceMonitor.ts
 * @description Collecte les métriques de performance d'une analyse complète.
 *              Utilise `performance.mark()` / `performance.measure()` pour
 *              les durées d'étapes et agrège le tout dans un PerformanceMetrics.
 *
 *              Les 30 derniers rapports sont conservés en mémoire pour
 *              alimenter le PerformanceDashboard.
 * @author Atlas Studio
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  PerformanceMetrics,
  StepMetrics,
  AnalysisStep,
} from './types';
import { STEP_LABELS } from './types';

const HISTORY_MAX = 30;

class PerformanceMonitorImpl {
  private currentId: string | null = null;
  private history: PerformanceMetrics[] = [];
  private currentTransactionCount = 0;

  /**
   * Démarre le suivi d'une nouvelle analyse.
   * Retourne un analysisId à passer dans les marks suivants.
   */
  start(transactionCount: number): string {
    const id = uuidv4();
    this.currentId = id;
    this.currentTransactionCount = transactionCount;
    if (typeof performance !== 'undefined') {
      performance.mark(`analysis-${id}-start`);
    }
    return id;
  }

  /**
   * Marque le début d'une étape.
   */
  markStepStart(step: AnalysisStep): void {
    if (!this.currentId || typeof performance === 'undefined') return;
    performance.mark(`analysis-${this.currentId}-${step}-start`);
  }

  /**
   * Marque la fin d'une étape.
   */
  markStepEnd(step: AnalysisStep): void {
    if (!this.currentId || typeof performance === 'undefined') return;
    performance.mark(`analysis-${this.currentId}-${step}-end`);
  }

  /**
   * Termine le suivi et retourne le rapport de métriques.
   */
  finish(success = true): PerformanceMetrics | null {
    if (!this.currentId) return null;
    const id = this.currentId;
    this.currentId = null;

    if (typeof performance === 'undefined') {
      return this.buildFallbackMetrics(id, success);
    }

    performance.mark(`analysis-${id}-end`);

    let totalMs = 0;
    try {
      const total = performance.measure(`analysis-${id}`, `analysis-${id}-start`, `analysis-${id}-end`);
      totalMs = total.duration;
    } catch {
      totalMs = 0;
    }

    const steps: StepMetrics[] = [];
    const stepNames: AnalysisStep[] = ['import', 'ocr', 'deterministic', 'ml', 'ai_llm', 'risk_score'];
    for (const step of stepNames) {
      try {
        const m = performance.measure(
          `analysis-${id}-${step}`,
          `analysis-${id}-${step}-start`,
          `analysis-${id}-${step}-end`,
        );
        steps.push({
          name: step,
          label: STEP_LABELS[step],
          durationMs: m.duration,
          percentage: totalMs > 0 ? Math.round((m.duration / totalMs) * 100) : 0,
        });
      } catch {
        // Étape non mesurée — skip
      }
    }

    // Cleanup
    performance.clearMarks();
    performance.clearMeasures();

    const metrics: PerformanceMetrics = {
      analysisId: id,
      transactionCount: this.currentTransactionCount,
      totalMs,
      steps,
      throughput: totalMs > 0 ? (this.currentTransactionCount / totalMs) * 1000 : 0,
      peakMemoryMb: this.estimateMemory(),
      success,
      timestamp: new Date(),
    };

    this.history.unshift(metrics);
    if (this.history.length > HISTORY_MAX) this.history.pop();

    return metrics;
  }

  /**
   * Retourne les N derniers rapports pour le dashboard.
   */
  getHistory(limit = HISTORY_MAX): readonly PerformanceMetrics[] {
    return this.history.slice(0, limit);
  }

  /**
   * Estime la durée d'une analyse basée sur les runs précédents.
   */
  estimateDuration(transactionCount: number): number | null {
    if (this.history.length === 0) return null;
    const avgThroughput =
      this.history.reduce((s, m) => s + m.throughput, 0) / this.history.length;
    if (avgThroughput <= 0) return null;
    return Math.round((transactionCount / avgThroughput) * 1000); // ms
  }

  // --------------------------------------------------------------------------

  private estimateMemory(): number | null {
    if (typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
      // navigator.deviceMemory est en GiB, on retourne en MB
      return (navigator as { deviceMemory?: number }).deviceMemory
        ? ((navigator as { deviceMemory: number }).deviceMemory * 1024) / 4
        : null;
    }
    return null;
  }

  private buildFallbackMetrics(id: string, success: boolean): PerformanceMetrics {
    return {
      analysisId: id,
      transactionCount: this.currentTransactionCount,
      totalMs: 0,
      steps: [],
      throughput: 0,
      peakMemoryMb: null,
      success,
      timestamp: new Date(),
    };
  }
}

// Singleton
let instance: PerformanceMonitorImpl | null = null;
export function getPerformanceMonitor(): PerformanceMonitorImpl {
  if (!instance) instance = new PerformanceMonitorImpl();
  return instance;
}

export { PerformanceMonitorImpl as PerformanceMonitor };
