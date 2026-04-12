/**
 * @module AtlasBanx
 * @file src/components/performance/AnalysisProgressTracker.tsx
 * @description Barre de progression multi-étapes pour le suivi d'analyse.
 *              6 étapes séquentielles avec temps écoulé, estimation restante,
 *              et bouton d'annulation.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Clock, Loader2 } from 'lucide-react';
import { Button, Progress } from '../ui';
import {
  type AnalysisStep,
  STEP_LABELS,
  STEP_WEIGHT,
} from '../../performance';
import { getPerformanceMonitor } from '../../performance';

interface AnalysisProgressTrackerProps {
  /** Étape courante */
  currentStep: AnalysisStep | null;
  /** Nombre de transactions à traiter */
  transactionCount: number;
  /** Callback d'annulation */
  onCancel?: () => void;
  /** Analyse terminée ou en erreur */
  finished?: boolean;
  error?: string | null;
}

const STEPS: AnalysisStep[] = ['import', 'ocr', 'deterministic', 'ml', 'ai_llm', 'risk_score'];

export function AnalysisProgressTracker({
  currentStep,
  transactionCount,
  onCancel,
  finished = false,
  error = null,
}: AnalysisProgressTrackerProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (finished && intervalRef.current) clearInterval(intervalRef.current);
  }, [finished]);

  const currentIndex = currentStep ? STEPS.indexOf(currentStep) : -1;
  const percentage = useMemo(() => {
    if (finished) return 100;
    if (currentIndex < 0) return 0;
    const [start, end] = STEP_WEIGHT[STEPS[currentIndex]];
    return Math.round((start + end) / 2);
  }, [currentIndex, finished]);

  const estimatedTotalMs = getPerformanceMonitor().estimateDuration(transactionCount);
  const remainingMs = estimatedTotalMs ? Math.max(0, estimatedTotalMs - elapsedMs) : null;

  return (
    <div className="bg-white border border-primary-200 rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-primary-900">
          {finished
            ? error
              ? 'Analyse échouée'
              : 'Analyse terminée'
            : 'Analyse en cours…'}
        </h3>
        <div className="flex items-center gap-3 text-xs text-primary-500">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Écoulé : {formatMs(elapsedMs)}</span>
          </div>
          {!finished && remainingMs !== null && (
            <span>Restant estimé : {formatMs(remainingMs)}</span>
          )}
          {!finished && onCancel && (
            <Button variant="danger" size="sm" onClick={onCancel}>
              <X className="w-4 h-4 mr-1" />
              Annuler
            </Button>
          )}
        </div>
      </div>

      <Progress value={percentage} max={100} />

      {error && (
        <div className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">{error}</div>
      )}

      <div className="grid grid-cols-6 gap-1">
        {STEPS.map((step, idx) => {
          const isCurrent = idx === currentIndex;
          const isDone = idx < currentIndex || finished;
          const isFuture = idx > currentIndex && !finished;

          return (
            <div
              key={step}
              className={`text-center py-2 px-1 rounded-lg text-xs transition-colors ${
                isCurrent
                  ? 'bg-primary-900 text-white'
                  : isDone
                  ? 'bg-primary-100 text-primary-800'
                  : isFuture
                  ? 'bg-primary-50 text-primary-400'
                  : 'bg-primary-50 text-primary-400'
              }`}
            >
              <div className="flex items-center justify-center gap-1 mb-0.5">
                {isCurrent && <Loader2 className="w-3 h-3 animate-spin" />}
                <span className="font-medium">
                  {STEP_WEIGHT[step][0]}–{STEP_WEIGHT[step][1]}%
                </span>
              </div>
              <div className="truncate">{STEP_LABELS[step]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min}m${sec.toString().padStart(2, '0')}s`;
}
