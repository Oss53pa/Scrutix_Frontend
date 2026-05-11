// ============================================================================
// StatementStatusBanner — bandeau état avec score + résumé anomalies
// ============================================================================
// Spec V1 §5.4 :
//   - status='pending'   → CTA pleine largeur "Lancer l'analyse PROPH3T"
//   - status='analyzed'  → cercle score + résumé anomalies + bouton "Voir"
// ============================================================================

import { Sparkles, RefreshCw, AlertTriangle, ListChecks } from 'lucide-react';
import type { Anomaly } from '../types/statement.types';
import { computeRiskScore } from '../utils/riskScore';

interface StatementStatusBannerProps {
  status: 'pending' | 'analyzed' | string;
  /** Score 0-100. Calculé en amont selon les anomalies. */
  riskScore?: number | null;
  anomalies: Anomaly[];
  onRunAnalysis?: () => void;
  onSeeAnomalies?: () => void;
  onRefreshAnalysis?: () => void;
}

export function StatementStatusBanner(props: StatementStatusBannerProps) {
  if (props.status === 'pending') {
    return <PendingBanner onRunAnalysis={props.onRunAnalysis} />;
  }
  return (
    <AnalyzedBanner
      riskScore={props.riskScore ?? computeRiskScore(props.anomalies)}
      anomalies={props.anomalies}
      onSeeAnomalies={props.onSeeAnomalies}
      onRefreshAnalysis={props.onRefreshAnalysis}
    />
  );
}

// ============================================================================
// Pending state — CTA "Lancer l'analyse"
// ============================================================================

function PendingBanner({ onRunAnalysis }: { onRunAnalysis?: () => void }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/60 px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-amber-100 inline-flex items-center justify-center text-amber-700 shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-amber-900">Lancer l'analyse PROPH3T</h3>
          <p className="text-xs text-amber-800 mt-0.5">
            19 algorithmes déterministes · OCR + détection anomalies + LCB-FT
          </p>
        </div>
      </div>
      <button
        onClick={onRunAnalysis}
        className="px-3 py-2 rounded-md bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 shrink-0"
      >
        Lancer maintenant
      </button>
    </div>
  );
}

// ============================================================================
// Analyzed state — score + résumé
// ============================================================================

function AnalyzedBanner({
  riskScore,
  anomalies,
  onSeeAnomalies,
  onRefreshAnalysis,
}: {
  riskScore: number;
  anomalies: Anomaly[];
  onSeeAnomalies?: () => void;
  onRefreshAnalysis?: () => void;
}) {
  const tone = riskScore >= 80 ? 'success' : riskScore >= 50 ? 'warning' : 'danger';
  const wrapClass = tone === 'success'
    ? 'border-emerald-300 bg-emerald-50/60'
    : tone === 'warning'
      ? 'border-amber-300 bg-amber-50/60'
      : 'border-rose-300 bg-rose-50/60';

  const scoreColor = tone === 'success'
    ? 'text-emerald-700 ring-emerald-300 bg-emerald-50'
    : tone === 'warning'
      ? 'text-amber-700 ring-amber-300 bg-amber-50'
      : 'text-rose-700 ring-rose-300 bg-rose-50';

  const label = tone === 'success' ? 'risque maîtrisé'
    : tone === 'warning' ? 'vigilance modérée'
    : 'risque élevé';

  // Construit le résumé : "4 anomalies détectées · 1 critique LCB-FT · 2 commissions à régulariser · 1 doublon présumé"
  const summary = buildSummary(anomalies);

  return (
    <div className={`rounded-xl border ${wrapClass} px-4 sm:px-6 py-4 flex items-center justify-between gap-4`}>
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full ring-2 ${scoreColor} inline-flex items-center justify-center font-bold text-xl sm:text-2xl shrink-0`}
          aria-label={`Score de risque ${riskScore}`}
        >
          {riskScore}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink-900 flex items-center gap-1.5">
            Score de risque relevé
            <span className="text-ink-500">·</span>
            <span className="text-ink-700">{label}</span>
          </h3>
          <p className="text-xs text-ink-700 mt-0.5">{summary}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onSeeAnomalies}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-canvas-300 bg-white text-xs font-semibold hover:bg-canvas-50"
        >
          <ListChecks className="w-3.5 h-3.5" />
          Voir les anomalies
        </button>
        <button
          onClick={onRefreshAnalysis}
          className="p-2 rounded-md border border-canvas-300 bg-white hover:bg-canvas-50"
          aria-label="Relancer l'analyse"
          title="Relancer l'analyse"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function buildSummary(anomalies: Anomaly[]): string {
  if (anomalies.length === 0) return 'Aucune anomalie détectée — relevé conforme.';

  const active = anomalies.filter((a) => a.status !== 'false_positive' && a.status !== 'closed');
  const total = active.length;

  const critical = active.filter((a) => a.severity === 'critical').length;
  const tarif = active.filter((a) =>
    a.type === 'commission_excessive' || a.type === 'agio_errone' || a.type === 'frais_non_justifie'
  ).length;
  const doublons = active.filter((a) => a.type === 'frais_double' || a.type === 'doublon_transaction').length;

  const parts: string[] = [`${total} anomalie${total > 1 ? 's' : ''} détectée${total > 1 ? 's' : ''}`];
  if (critical > 0) parts.push(`${critical} critique${critical > 1 ? 's' : ''} LCB-FT`);
  if (tarif > 0)    parts.push(`${tarif} commission${tarif > 1 ? 's' : ''} à régulariser`);
  if (doublons > 0) parts.push(`${doublons} doublon${doublons > 1 ? 's' : ''} présumé${doublons > 1 ? 's' : ''}`);
  return parts.join(' · ');
}
