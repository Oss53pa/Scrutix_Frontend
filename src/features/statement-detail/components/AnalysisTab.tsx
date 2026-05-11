// ============================================================================
// AnalysisTab — onglet Analyse dans la page releve
// ============================================================================
// Embarque le moteur d'analyse (19 detecteurs + WorkerPool) directement
// dans la page releve. Affiche la progression, les resultats et permet
// de relancer l'analyse.
//
// ⚠ INVARIANT : le compteur user-facing affiché ici est TOUJOURS le nombre
//   d'anomalies persistees dans Supabase (= identique a l'onglet Anomalies
//   et au header de la page). Les detecteurs client-side produisent des
//   signaux bruts (souvent plus nombreux) qui ne sont pas exposes a l'audit
//   tant qu'ils n'ont pas ete qualifies / persistes. Le nombre brut est
//   affiche uniquement comme info diagnostique « X signaux bruts ».
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
  Info,
} from 'lucide-react';
import type { BankTransaction, Anomaly } from '../types/statement.types';
import { useStatementAnalysis } from '../hooks/useStatementAnalysis';
import { computeRiskScore } from '../utils/riskScore';

interface AnalysisTabProps {
  statementId: string;
  bankTxs: BankTransaction[];
  meta?: { clientId: string; accountNumber: string; bankCode: string };
  statementStatus: string;
  /** Anomalies réellement persistees (source de vérité pour les chiffres user-facing). */
  persistedAnomalies?: Anomaly[];
  /** Permet de rafraichir la liste persistee après une relance. */
  onRefreshPersisted?: () => Promise<void> | void;
}

export function AnalysisTab({
  statementId,
  bankTxs,
  meta,
  statementStatus,
  persistedAnomalies = [],
  onRefreshPersisted,
}: AnalysisTabProps) {
  const analysis = useStatementAnalysis(statementId, meta);
  const [hasRun, setHasRun] = useState(statementStatus === 'analyzed' || statementStatus === 'imported');

  const handleRun = async () => {
    await analysis.run(bankTxs);
    setHasRun(true);
    // Recharge la liste persistee pour synchroniser les compteurs partout.
    if (onRefreshPersisted) await onRefreshPersisted();
  };

  // ── Compteurs user-facing : TOUJOURS les anomalies persistees ──────────────
  // Garantit que ce panneau, le header (score) et l'onglet Anomalies
  // affichent le MEME chiffre.
  const persistedActive = persistedAnomalies.filter(
    (a) => a.status !== 'closed' && a.status !== 'false_positive',
  );
  const persistedBySev = {
    critical: persistedActive.filter((a) => a.severity === 'critical').length,
    high:     persistedActive.filter((a) => a.severity === 'high').length,
    medium:   persistedActive.filter((a) => a.severity === 'medium').length,
    low:      persistedActive.filter((a) => a.severity === 'low').length,
  };
  const persistedScore = computeRiskScore(persistedAnomalies);

  // Le nombre brut detecte (avant deduplication / qualification) sert
  // uniquement à l'auditeur curieux. Pas un chiffre operationnel.
  const rawDetectedCount = analysis.summary?.totalAnomalies ?? null;

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

            {/* ── Summary card — ANOMALIES PERSISTEES (chiffre officiel) ──── */}
            <div className={`border rounded-lg p-3 mb-4 ${
              persistedBySev.critical > 0 ? 'bg-rose-50/60 border-rose-200' :
              persistedActive.length > 0   ? 'bg-amber-50/60 border-amber-200' :
                                              'bg-emerald-50/60 border-emerald-200'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    persistedBySev.critical > 0 ? 'bg-rose-100 text-rose-700' :
                    persistedActive.length > 0  ? 'bg-amber-100 text-amber-700' :
                                                   'bg-emerald-100 text-emerald-700'
                  }`}>
                    {persistedBySev.critical > 0 ? 'CRITICAL' :
                     persistedActive.length > 0  ? 'WARNING' : 'OK'}
                  </span>
                  <span className="text-sm font-medium text-ink-900">
                    {persistedActive.length} anomalie{persistedActive.length > 1 ? 's' : ''} detectee{persistedActive.length > 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-ink-500">· score {persistedScore}/100</span>
                </div>
              </div>
              {persistedActive.length > 0 && (
                <ul className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-0.5">
                  {persistedBySev.critical > 0 && (
                    <li className="text-xs text-rose-700">
                      <strong>{persistedBySev.critical}</strong> critique{persistedBySev.critical > 1 ? 's' : ''}
                    </li>
                  )}
                  {persistedBySev.high > 0 && (
                    <li className="text-xs text-amber-700">
                      <strong>{persistedBySev.high}</strong> haute{persistedBySev.high > 1 ? 's' : ''}
                    </li>
                  )}
                  {persistedBySev.medium > 0 && (
                    <li className="text-xs text-amber-600">
                      <strong>{persistedBySev.medium}</strong> moyenne{persistedBySev.medium > 1 ? 's' : ''}
                    </li>
                  )}
                  {persistedBySev.low > 0 && (
                    <li className="text-xs text-ink-500">
                      <strong>{persistedBySev.low}</strong> faible{persistedBySev.low > 1 ? 's' : ''}
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* ── Note diagnostique — signaux bruts (info uniquement) ──────── */}
            {rawDetectedCount !== null && rawDetectedCount !== persistedActive.length && (
              <div className="bg-canvas-50 border border-canvas-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                <Info className="w-4 h-4 text-ink-500 shrink-0 mt-0.5" />
                <div className="text-xs text-ink-600">
                  <p>
                    <strong>{rawDetectedCount} signaux bruts</strong> ont ete leves par les 19 detecteurs,
                    dont <strong>{persistedActive.length}</strong> ont ete consolides comme anomalies actionnables
                    (apres deduplication, seuils de severite et qualification).
                  </p>
                  <p className="mt-1 text-ink-500">
                    Les signaux non consolides restent visibles dans la trace audit mais ne pesent
                    pas sur le score de risque.
                  </p>
                </div>
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
