// ============================================================================
// AnalysisTab — onglet Analyse dans la page releve
// ============================================================================
// Embarque le moteur d'analyse (19 detecteurs + WorkerPool) directement
// dans la page releve. Affiche la progression, les resultats et permet
// de relancer l'analyse.
// ============================================================================

import { useState } from 'react';
import {
  Sparkles,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Cpu,
} from 'lucide-react';
import type { BankTransaction } from '../types/statement.types';
import { useStatementAnalysis } from '../hooks/useStatementAnalysis';

interface AnalysisTabProps {
  statementId: string;
  bankTxs: BankTransaction[];
  meta?: { clientId: string; accountNumber: string; bankCode: string };
  statementStatus: string;
}

export function AnalysisTab({ statementId, bankTxs, meta, statementStatus }: AnalysisTabProps) {
  const analysis = useStatementAnalysis(statementId, meta);
  const [hasRun, setHasRun] = useState(statementStatus === 'analyzed' || statementStatus === 'imported');

  const handleRun = async () => {
    await analysis.run(bankTxs);
    setHasRun(true);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Analyse du releve</h2>
          <p className="text-xs text-ink-500 mt-0.5">
            19 algorithmes deterministes + detection IA optionnelle
          </p>
        </div>
        {analysis.lastRunAt && (
          <span className="text-[11px] text-ink-400">
            Derniere execution : {new Date(analysis.lastRunAt).toLocaleString('fr-FR')}
          </span>
        )}
      </div>

      {/* Status card */}
      <div className="bg-white border border-canvas-200 rounded-xl p-5">
        {/* Not yet run */}
        {!analysis.running && !hasRun && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 border border-amber-200 mb-4">
              <Sparkles className="w-7 h-7 text-amber-600" />
            </div>
            <h3 className="text-sm font-semibold text-ink-900">Lancer l'analyse PROPH3T</h3>
            <p className="text-xs text-ink-500 mt-1 max-w-md mx-auto">
              {bankTxs.length} transactions seront analysees par 19 algorithmes deterministes :
              doublons, frais fantomes, surfacturations, dates de valeur, LCB-FT, conformite OHADA, et plus.
            </p>
            <button
              onClick={handleRun}
              disabled={bankTxs.length === 0}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              <Play className="w-4 h-4" />
              Lancer maintenant
            </button>
          </div>
        )}

        {/* Running */}
        {analysis.running && (
          <div className="py-6">
            <div className="flex items-center gap-3 mb-4">
              <Cpu className="w-5 h-5 text-amber-600 animate-pulse" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-ink-900">Analyse en cours...</span>
                  <span className="text-xs text-ink-500 font-mono">{analysis.progress}%</span>
                </div>
                <div className="w-full h-2 bg-canvas-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${analysis.progress}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-ink-500 ml-8">{analysis.progressStep}</p>
          </div>
        )}

        {/* Completed */}
        {!analysis.running && hasRun && (
          <div className="py-4">
            <div className="flex items-center gap-3 mb-4">
              {analysis.error ? (
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              )}
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  {analysis.error ? 'Analyse terminee avec erreurs' : 'Analyse terminee'}
                </p>
                {analysis.error && (
                  <p className="text-xs text-rose-600 mt-0.5">{analysis.error}</p>
                )}
                {analysis.lastRunAt && (
                  <p className="text-xs text-ink-500 mt-0.5">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(analysis.lastRunAt).toLocaleString('fr-FR')}
                  </p>
                )}
              </div>
            </div>

            {/* Summary card */}
            {analysis.summary && (
              <div className="bg-canvas-50 border border-canvas-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    analysis.summary.status === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                    analysis.summary.status === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>{analysis.summary.status}</span>
                  <span className="text-sm font-medium text-ink-900">
                    {analysis.summary.totalAnomalies} anomalie{analysis.summary.totalAnomalies > 1 ? 's' : ''} detectee{analysis.summary.totalAnomalies > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-ink-600">{analysis.summary.message}</p>
                {analysis.summary.keyFindings.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {analysis.summary.keyFindings.map((f, i) => (
                      <li key={i} className="text-xs text-ink-500">• {f}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button
              onClick={handleRun}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-canvas-300 text-sm font-medium hover:bg-canvas-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Relancer l'analyse
            </button>
          </div>
        )}
      </div>

      {/* Detectors info */}
      <div className="bg-white border border-canvas-200 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-ink-700 uppercase tracking-wider mb-3">Detecteurs actifs</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DETECTORS.map((d) => (
            <div key={d} className="flex items-center gap-2 text-xs text-ink-600 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              {d}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const DETECTORS = [
  'Doublons',
  'Frais fantomes',
  'Surfacturations',
  'Erreurs interets',
  'Dates de valeur',
  'Operations suspectes',
  'Conformite contractuelle',
  'Tresorerie',
  'Rapprochement',
  'Conformite OHADA',
  'LCB-FT (AML)',
  'Frais tenue compte',
  'Frais cartes',
  'Moyens de paiement',
  'Operations internationales',
  'Services annexes',
  'Packages & assurances',
  'Multi-banques',
  'Categorisation IA',
];
