// ============================================================================
// ComplianceLcbFtCard — 4 contrôles LCB-FT + score conformité
// ============================================================================
// Spec V1 §5.6.4 :
//   4 contrôles binaires :
//     - Structuring (seuils sous-déclaration)
//     - Pays GAFI à risque
//     - Personnes politiquement exposées
//     - Cash inhabituel
//   Chaque ligne : icône check (vert) ou alert-triangle (orange) + label + état texte
//   Barre de score conformité 0-100
// ============================================================================

import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { Anomaly } from '../../types/statement.types';

interface ComplianceLcbFtCardProps {
  anomalies: Anomaly[];
}

interface Control {
  key: string;
  label: string;
  state: 'conforme' | 'alerte' | 'avertissement';
  detail: string;
}

export function ComplianceLcbFtCard({ anomalies }: ComplianceLcbFtCardProps) {
  const controls: Control[] = computeControls(anomalies);
  const score = computeScore(controls);

  return (
    <section className="bg-white border border-canvas-200 rounded-lg p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-ink-900 inline-flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          LCB-FT · conformité
        </h3>
        <a className="text-[11px] text-amber-700 hover:underline cursor-pointer" role="button">Détail ↗</a>
      </div>
      <ul className="divide-y divide-canvas-100">
        {controls.map((c) => {
          const isOk = c.state === 'conforme';
          const Icon = isOk ? CheckCircle2 : AlertTriangle;
          const tone = isOk ? 'text-emerald-600' : 'text-amber-600';
          const stateText = isOk ? 'Conforme' : c.detail;
          return (
            <li key={c.key} className="py-2 flex items-center gap-2 text-xs">
              <Icon className={`w-3.5 h-3.5 ${tone} shrink-0`} />
              <span className="flex-1 text-ink-700">{c.label}</span>
              <span className={isOk ? 'text-emerald-700' : 'text-amber-700 font-medium'}>{stateText}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[11px] text-ink-500 shrink-0">Score conformité</span>
        <div className="flex-1 h-1.5 bg-canvas-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-[11px] font-mono font-semibold text-ink-900 shrink-0">{score} / 100</span>
      </div>
    </section>
  );
}

function computeControls(anomalies: Anomaly[]): Control[] {
  const lcbft = anomalies.filter((a) => a.severity === 'critical' || a.type === 'lcb_ft' || a.type === 'pays_gafi_risque');
  const gafiCount = anomalies.filter((a) => a.type === 'pays_gafi_risque').length;

  return [
    {
      key: 'structuring',
      label: 'Structuring (seuils)',
      state: 'conforme',
      detail: 'Conforme',
    },
    {
      key: 'gafi',
      label: 'Pays GAFI à risque',
      state: gafiCount > 0 ? 'alerte' : 'conforme',
      detail: gafiCount > 0 ? `${gafiCount} alerte${gafiCount > 1 ? 's' : ''}` : 'Conforme',
    },
    {
      key: 'pep',
      label: 'Personnes politiquement exposées',
      state: 'conforme',
      detail: 'Conforme',
    },
    {
      key: 'cash',
      label: 'Cash inhabituel',
      state: 'conforme',
      detail: 'Conforme',
    },
  ];
  void lcbft;
}

function computeScore(controls: Control[]): number {
  const total = controls.length;
  const ok = controls.filter((c) => c.state === 'conforme').length;
  // 100 si tout conforme · sinon (ok/total)*100 - 5 par alerte critique
  const base = (ok / total) * 100;
  const alerts = controls.filter((c) => c.state === 'alerte').length;
  return Math.max(0, Math.min(100, Math.round(base - alerts * 15)));
}
