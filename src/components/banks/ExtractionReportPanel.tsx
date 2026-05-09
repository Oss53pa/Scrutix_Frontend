// ============================================================================
// ATLASBANX — ExtractionReportPanel
// Premium UI showing exactly what the DocumentIntelligenceEngine extracted
// from a tariff document, with per-field confidence, strategy badge, and
// raw evidence snippet for manual verification.
// ============================================================================

import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  XCircle,
  Sparkles,
  Search,
  Wand2,
  ChevronDown,
  ChevronRight,
  FileText,
  Banknote,
  Clock,
} from 'lucide-react';
import { Card } from '../ui';
import type { ExtractionReport, FieldExtraction, ExtractionStrategy } from '../../extraction';
import { FIELD_BY_KEY } from '../../extraction';
import { formatNumber } from '../../utils';

interface Props {
  report: ExtractionReport;
  /** Optional callback when user clicks "Apply" to write the values into the form */
  onApply?: (values: Record<string, number | string | boolean | null>) => void;
}

const STRATEGY_META: Record<
  ExtractionStrategy,
  { label: string; icon: typeof Sparkles; cls: string }
> = {
  template: { label: 'Template', icon: Sparkles, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pattern:  { label: 'Pattern',  icon: Wand2,    cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  tabular:  { label: 'Table',    icon: FileText, cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  semantic: { label: 'Sémantique', icon: Search, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ai:       { label: 'IA',       icon: Sparkles, cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  default:  { label: 'Défaut',   icon: HelpCircle, cls: 'bg-canvas-100 text-ink-500 border-primary-200' },
};

function confidenceTone(c: number): string {
  if (c >= 0.85) return 'text-emerald-600';
  if (c >= 0.65) return 'text-amber-600';
  if (c > 0) return 'text-orange-600';
  return 'text-ink-300';
}

function confidenceLabel(c: number): string {
  if (c >= 0.85) return 'Élevée';
  if (c >= 0.65) return 'Moyenne';
  if (c > 0) return 'Faible';
  return 'Aucune';
}

function formatValue(ex: FieldExtraction): string {
  if (ex.value === null) return '—';
  if (ex.kind === 'percentage') return `${ex.value} %`;
  if (ex.kind === 'amount') {
    return `${formatNumber(Number(ex.value))} FCFA`;
  }
  return String(ex.value);
}

export function ExtractionReportPanel({ report, onApply }: Props) {
  const [filter, setFilter] = useState<'all' | 'extracted' | 'default' | 'high' | 'low'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const groups: Record<string, FieldExtraction[]> = {};
    for (const [key, ex] of Object.entries(report.fields)) {
      // Filter
      if (filter === 'extracted' && ex.strategy === 'default') continue;
      if (filter === 'default' && ex.strategy !== 'default') continue;
      if (filter === 'high' && ex.confidence < 0.85) continue;
      if (filter === 'low' && (ex.confidence === 0 || ex.confidence >= 0.65)) continue;

      const group = key.split('.')[0];
      if (!groups[group]) groups[group] = [];
      groups[group].push(ex);
    }
    return groups;
  }, [report, filter]);

  const groupLabels: Record<string, string> = {
    accountFees: 'Tenue de compte',
    cardFees: 'Cartes bancaires',
    transferFees: 'Virements',
    checkFees: 'Chèques',
    creditFees: 'Crédits & Agios',
    eBankingFees: 'E-Banking',
    miscFees: 'Divers',
    penalties: 'Pénalités',
  };

  const handleApply = () => {
    if (!onApply) return;
    const values: Record<string, number | string | boolean | null> = {};
    for (const [key, ex] of Object.entries(report.fields)) {
      if (ex.strategy !== 'default' && ex.value !== null) {
        values[key] = ex.value;
      }
    }
    onApply(values);
  };

  const stats = report.stats;
  const conf = Math.round(report.overallConfidence * 100);

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 text-white p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400/70 to-transparent" />
        <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-400/15 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold text-accent-300 uppercase tracking-[0.18em]">
                Rapport d'extraction
              </p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight">
                {report.bankDetected ? report.bankDetected.name : 'Document analysé'}
                <span className="ml-3 px-2 py-0.5 rounded-pill bg-white/10 border border-white/20 text-xs font-medium tracking-wider uppercase">
                  {report.format}
                </span>
              </h3>
              {report.warnings.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {report.warnings.map((w, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-amber-200">
                      <AlertTriangle className="w-3 h-3" /> {w}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {onApply && (
              <button
                onClick={handleApply}
                className="btn btn-accent btn-sm"
                disabled={stats.extracted === 0}
              >
                <CheckCircle2 className="w-4 h-4" /> Appliquer ({stats.extracted})
              </button>
            )}
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBlock
              label="Confiance"
              value={`${conf} %`}
              tone={conf >= 70 ? 'good' : conf >= 40 ? 'warn' : 'bad'}
            />
            <StatBlock label="Extraits" value={`${stats.extracted}/${stats.total}`} icon={CheckCircle2} />
            <StatBlock label="Défauts" value={`${stats.defaulted}`} icon={HelpCircle} muted />
            <StatBlock
              label="Temps"
              value={`${(report.processingTimeMs / 1000).toFixed(1)} s`}
              icon={Clock}
              muted
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-primary-100/70 flex items-center gap-2 flex-wrap">
        {[
          { v: 'all' as const,       label: 'Tous' },
          { v: 'extracted' as const, label: 'Extraits' },
          { v: 'high' as const,      label: 'Haute confiance' },
          { v: 'low' as const,       label: 'Faible confiance' },
          { v: 'default' as const,   label: 'Défauts uniquement' },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`px-3 py-1 rounded-pill text-xs font-medium transition-colors ${
              filter === f.v
                ? 'bg-ink-900 text-white'
                : 'bg-canvas-100 text-ink-600 hover:bg-canvas-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="divide-y divide-primary-100/70">
        {Object.keys(grouped).length === 0 ? (
          <div className="empty-state">
            <XCircle className="empty-state-icon" />
            <p className="empty-state-title">Aucun champ correspondant</p>
            <p className="empty-state-description">
              Change le filtre pour voir d'autres résultats.
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="px-6 py-3 bg-canvas-50/50 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-accent-600" />
                <span className="text-sm font-semibold text-ink-900 tracking-tight">
                  {groupLabels[group] ?? group}
                </span>
                <span className="text-xs text-ink-400">({items.length})</span>
              </div>
              <ul>
                {items.map((ex) => (
                  <FieldRow
                    key={ex.key}
                    ex={ex}
                    expanded={expanded.has(ex.key)}
                    onToggle={() => {
                      setExpanded((s) => {
                        const next = new Set(s);
                        if (next.has(ex.key)) next.delete(ex.key);
                        else next.add(ex.key);
                        return next;
                      });
                    }}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Pairs detected in the document but not mapped to a known rubric */}
      {report.unmatchedPairs && report.unmatchedPairs.length > 0 && (
        <UnmatchedPairsSection pairs={report.unmatchedPairs} />
      )}
    </Card>
  );
}

// ============================================================================
// Unmatched pairs — extracted from the doc but no rubric match
// ============================================================================

function UnmatchedPairsSection({
  pairs,
}: {
  pairs: NonNullable<ExtractionReport['unmatchedPairs']>;
}) {
  const [open, setOpen] = useState(false);

  // Group by section for readability
  const grouped: Record<string, typeof pairs> = {};
  for (const p of pairs) {
    const k = p.section ?? '(sans section)';
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(p);
  }
  const groupKeys = Object.keys(grouped).sort();

  return (
    <div className="border-t border-primary-200/60 bg-canvas-50/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-6 py-3 hover:bg-canvas-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-semibold text-ink-900 tracking-tight">
            Conditions extraites non rattachées
          </span>
          <span className="text-xs text-ink-400">({pairs.length})</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-primary-100/70">
          <p className="px-6 py-3 text-xs text-ink-500 leading-relaxed border-b border-primary-100/50">
            Ces lignes ont été détectées comme des paires « libellé → valeur »
            mais ne correspondent à aucune rubrique du référentiel actuel.
            Vous pouvez les utiliser comme repères ou demander leur ajout
            au référentiel.
          </p>
          {groupKeys.map((sec) => (
            <div key={sec}>
              <div className="px-6 py-2 bg-canvas-100/40">
                <span className="text-[10px] font-semibold text-accent-700 uppercase tracking-[0.14em]">
                  {sec}
                </span>
              </div>
              <ul className="divide-y divide-primary-100/40">
                {grouped[sec].map((p, i) => (
                  <li
                    key={`${sec}-${i}`}
                    className="px-6 py-2 flex items-center gap-3 text-sm hover:bg-canvas-50"
                  >
                    <span className="text-[10px] text-ink-400 w-10 tabular-nums">
                      p.{p.page}
                    </span>
                    <span className="flex-1 min-w-0 text-ink-800 truncate">{p.label}</span>
                    <span className="font-semibold text-ink-900 tabular-nums shrink-0">
                      {p.qualitative ? (
                        <span className="text-amber-700 italic">
                          {p.qualitative === 'gratuit' && 'Gratuit'}
                          {p.qualitative === 'consulter' && 'Nous consulter'}
                          {p.qualitative === 'neant' && 'Néant'}
                          {p.qualitative === 'franco' && 'Franco'}
                          {p.qualitative === 'souscription' && 'À la souscription'}
                          {p.qualitative === 'other' && 'Variable'}
                        </span>
                      ) : (
                        <>
                          {p.unit === '%' ? `${p.value} %` :
                           p.unit ? `${formatNumber(p.value)} ${p.unit === 'XAF' || p.unit === 'XOF' ? p.unit : p.unit === 'FCFA' ? 'FCFA' : p.unit}` :
                           formatNumber(p.value)}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================

function StatBlock({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  muted = false,
}: {
  label: string;
  value: string;
  icon?: typeof CheckCircle2;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
  muted?: boolean;
}) {
  const toneCls =
    tone === 'good' ? 'text-emerald-300' :
    tone === 'warn' ? 'text-amber-300' :
    tone === 'bad' ? 'text-red-300' :
    'text-white';
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 backdrop-blur p-3">
      <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${muted ? 'text-white/50' : 'text-accent-300'}`}>
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold tabular-nums tracking-tight ${toneCls} flex items-center gap-1.5`}>
        {Icon && <Icon className="w-4 h-4 opacity-60" />}
        {value}
      </p>
    </div>
  );
}

function FieldRow({
  ex,
  expanded,
  onToggle,
}: {
  ex: FieldExtraction;
  expanded: boolean;
  onToggle: () => void;
}) {
  const fdef = FIELD_BY_KEY.get(ex.key);
  const meta = STRATEGY_META[ex.strategy];
  const Icon = meta.icon;

  return (
    <li className="border-b border-primary-100/40 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full px-6 py-3 flex items-center gap-3 hover:bg-canvas-50/60 transition-colors text-left"
      >
        <span className="shrink-0 w-5 h-5 text-ink-400">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink-900 tracking-tight truncate">
            {fdef?.label ?? ex.key}
          </p>
          <p className="text-[11px] text-ink-500 truncate">{ex.key}</p>
        </div>
        <div className="text-right tabular-nums">
          <p className="text-sm font-bold text-ink-900">{formatValue(ex)}</p>
          <p className={`text-[11px] ${confidenceTone(ex.confidence)}`}>
            {confidenceLabel(ex.confidence)}
            {ex.confidence > 0 && ` · ${Math.round(ex.confidence * 100)}%`}
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-semibold border ${meta.cls}`}
        >
          <Icon className="w-3 h-3" />
          {meta.label}
        </span>
      </button>

      {expanded && (
        <div className="px-6 pb-4 -mt-1 ml-8">
          {ex.evidence ? (
            <div className="rounded-lg bg-canvas-50 border border-primary-200/60 p-3">
              <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider mb-1">
                Preuve textuelle
              </p>
              <p className="text-xs text-ink-800 font-mono leading-relaxed">
                « {ex.evidence} »
              </p>
            </div>
          ) : (
            <p className="text-xs text-ink-400 italic">
              {ex.strategy === 'default'
                ? 'Aucune valeur trouvée dans le document — valeur par défaut appliquée.'
                : 'Aucune preuve textuelle disponible.'}
            </p>
          )}

          {ex.alternatives && ex.alternatives.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider mb-1.5">
                Autres candidats
              </p>
              <ul className="space-y-1">
                {ex.alternatives.map((alt, i) => (
                  <li key={i} className="text-xs text-ink-600 flex items-center gap-2">
                    <span className="font-bold tabular-nums">{alt.value}</span>
                    <span className="text-ink-400">
                      · {alt.strategy} · {Math.round(alt.confidence * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
