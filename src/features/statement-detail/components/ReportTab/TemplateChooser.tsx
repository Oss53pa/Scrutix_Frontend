// ============================================================================
// TemplateChooser — choix entre 3 templates de rapport
// ============================================================================

import { FileText, FileBadge, FileSpreadsheet } from 'lucide-react';
import type { ReportTemplate } from '../../types/statement.types';

interface TemplateChooserProps {
  chosen: ReportTemplate | null;
  onChoose: (t: ReportTemplate) => void;
}

const TEMPLATE_DEFS: Array<{
  key: ReportTemplate;
  Icon: typeof FileText;
  title: string;
  subtitle: string;
  features: Array<{ ok: boolean; label: string }>;
  plan: string;
  recommended?: boolean;
}> = [
  {
    key: 'synthese',
    Icon: FileText,
    title: 'Rapport synthèse',
    subtitle: 'Pour usage interne ou échange courant. A4, 3-5 pages.',
    features: [
      { ok: true,  label: 'Score de risque + KPI' },
      { ok: true,  label: 'Liste anomalies résumée' },
      { ok: false, label: 'Pas de signature électronique' },
    ],
    plan: 'Standard et au-delà',
  },
  {
    key: 'valeur_probante',
    Icon: FileBadge,
    title: 'Rapport valeur probante',
    subtitle: 'Recommandé · Pour CAC, juridiction, due diligence. A4, 12-18 pages.',
    features: [
      { ok: true, label: 'Tout du synthèse' },
      { ok: true, label: 'État de rapprochement SYSCOHADA' },
      { ok: true, label: 'Workflow de validation détaillé' },
      { ok: true, label: 'Signature électronique ADVIST légalement opposable' },
      { ok: true, label: 'Hash SHA-256 + horodatage RFC 3161' },
    ],
    plan: 'Pro et au-delà',
    recommended: true,
  },
  {
    key: 'export',
    Icon: FileSpreadsheet,
    title: 'Export comptable',
    subtitle: 'Pour intégration directe à Atlas Finance ou autre logiciel. Excel + JSON.',
    features: [
      { ok: true, label: 'Transactions catégorisées' },
      { ok: true, label: 'Écritures de redressement proposées' },
      { ok: true, label: 'Mapping plan comptable SYSCOHADA' },
    ],
    plan: 'Tous',
  },
];

export function TemplateChooser({ chosen, onChoose }: TemplateChooserProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {TEMPLATE_DEFS.map((t) => {
        const isChosen = chosen === t.key;
        return (
          <div
            key={t.key}
            className={`relative bg-white rounded-lg p-4 border transition-all ${
              isChosen
                ? 'border-amber-500 ring-2 ring-amber-300'
                : t.recommended
                  ? 'border-amber-400 border-2'
                  : 'border-canvas-200 hover:border-canvas-400'
            }`}
          >
            {t.recommended && (
              <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider">
                Recommandé
              </span>
            )}
            <t.Icon className="w-6 h-6 text-amber-700 mb-2" />
            <h3 className="text-sm font-semibold text-ink-900">{t.title}</h3>
            <p className="text-xs text-ink-600 mt-1">{t.subtitle}</p>
            <ul className="mt-3 space-y-1">
              {t.features.map((f, i) => (
                <li key={i} className={`text-[11px] flex items-start gap-1 ${f.ok ? 'text-ink-700' : 'text-ink-400'}`}>
                  <span>{f.ok ? '✓' : '✗'}</span>
                  <span>{f.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 text-[10px] uppercase tracking-wider text-ink-500">Plan : {t.plan}</div>
            <button
              onClick={() => onChoose(t.key)}
              className={`mt-3 w-full px-3 py-1.5 text-xs font-semibold rounded ${
                isChosen
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              {isChosen ? 'Généré ✓' : 'Générer'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
