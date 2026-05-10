// ============================================================================
// RegulatoryWatchPage — page admin pour la veille réglementaire trimestrielle
// ============================================================================
// CDC §3.3.4 + §10 : présente les 5 sources officielles (BCEAO/COBAC/OHADA),
// les alertes (règles expirées, à renouveler, juridictions muettes), le plan
// trimestriel courant. Chargement des règles via Supabase atlasbanx.regulatory_rules
// + atlasbanx.regulatory_jurisdictions.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Calendar, ExternalLink, Globe, Info, ShieldCheck, Loader2,
} from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabase';
import {
  buildQuarterlyPlan,
  computeQuarterlyAlerts,
  OFFICIAL_SOURCES,
  type QuarterlyReviewPlan,
  type RegulatoryAlert,
  type RegulatorySource,
  type AlertSeverity,
} from '../../cdc/compliance/RegulatoryWatch';
import type { RegulatoryRule, RegulatoryJurisdiction } from '../../cdc/types';

export default function RegulatoryWatchPage() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<RegulatoryRule[]>([]);
  const [jurisdictions, setJurisdictions] = useState<RegulatoryJurisdiction[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const sb = getSupabaseClient();
        if (!sb) {
          setError('Supabase non configuré');
          return;
        }
        const [{ data: rulesData }, { data: jurData }] = await Promise.all([
          sb.schema('atlasbanx' as never)
            .from('regulatory_rules' as never)
            .select('*')
            .is('superseded_by', null),
          sb.schema('atlasbanx' as never)
            .from('regulatory_jurisdictions' as never)
            .select('*'),
        ]);
        if (cancelled) return;
        setRules((rulesData ?? []).map(mapRule));
        setJurisdictions((jurData ?? []).map(mapJur));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const plan: QuarterlyReviewPlan | null = useMemo(() => {
    if (rules.length === 0 && jurisdictions.length === 0) return null;
    return buildQuarterlyPlan(rules, jurisdictions);
  }, [rules, jurisdictions]);

  const alerts: RegulatoryAlert[] = useMemo(() => {
    if (rules.length === 0 && jurisdictions.length === 0) return [];
    return computeQuarterlyAlerts(rules, jurisdictions);
  }, [rules, jurisdictions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-ink-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Chargement de la veille réglementaire…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-2 text-xs text-ink-500">
          <ShieldCheck className="w-3.5 h-3.5" />
          Console interne · CDC §3.3.4
        </div>
        <h1 className="text-xl font-bold text-ink-900 mt-1">Veille réglementaire</h1>
        <p className="text-sm text-ink-600 mt-1">
          Sources officielles BCEAO / COBAC / OHADA, état des règles L1, alertes
          d'échéance et plan trimestriel courant.
        </p>
      </header>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-800">
          ⚠ {error}
        </div>
      )}

      {/* Plan trimestriel */}
      {plan && (
        <section className="bg-white border border-canvas-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-ink-900 inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4" /> Plan {plan.quarter}
          </h2>
          <p className="text-xs text-ink-500 mt-1 font-mono">
            {plan.startDate.toISOString().slice(0, 10)} → {plan.endDate.toISOString().slice(0, 10)}
            {' · '}{plan.estimatedHours}h estimées
          </p>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Juridictions" value={plan.jurisdictionsToReview.length} />
            <Stat label="Règles actives" value={plan.jurisdictionsToReview.reduce((s, j) => s + j.knownRules, 0)} />
            <Stat label="Alertes" value={plan.alerts.length} />
            <Stat label="Critiques" value={plan.alerts.filter((a) => a.severity === 'critical').length} tone="rose" />
          </div>
        </section>
      )}

      {/* Alertes */}
      <section className="bg-white border border-canvas-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-ink-900">Alertes ({alerts.length})</h2>
        {alerts.length === 0 ? (
          <p className="mt-2 text-xs text-ink-500">Aucune alerte — référentiel à jour.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {alerts.map((a) => <AlertRow key={a.id} a={a} />)}
          </div>
        )}
      </section>

      {/* Sources officielles */}
      <section className="bg-white border border-canvas-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-ink-900 inline-flex items-center gap-1.5">
          <Globe className="w-4 h-4" /> Sources officielles ({OFFICIAL_SOURCES.length})
        </h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {OFFICIAL_SOURCES.map((s) => <SourceCard key={s.code} s={s} />)}
        </div>
      </section>

      {/* État du référentiel */}
      <section className="bg-white border border-canvas-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-ink-900">
          Référentiel L1 ({rules.length} règles, {jurisdictions.length} juridictions)
        </h2>
        <div className="mt-3 overflow-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-ink-500 border-b border-canvas-200">
              <tr>
                <th className="text-left py-1.5 px-2">Juridiction</th>
                <th className="text-left py-1.5 px-2">Rubrique</th>
                <th className="text-left py-1.5 px-2">Type</th>
                <th className="text-right py-1.5 px-2">Valeur</th>
                <th className="text-left py-1.5 px-2">Validité</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const j = jurisdictions.find((x) => x.id === r.jurisdictionId);
                return (
                  <tr key={r.id} className="border-b border-canvas-100">
                    <td className="py-1 px-2 font-mono text-ink-700">{j?.code ?? '?'}</td>
                    <td className="py-1 px-2">{r.rubricCode}</td>
                    <td className="py-1 px-2 text-ink-500">{r.ruleType}</td>
                    <td className="py-1 px-2 text-right font-mono">
                      {r.valueNumeric ?? '—'} {r.unit}
                    </td>
                    <td className="py-1 px-2 text-[10px] text-ink-500">
                      {r.validFrom.toISOString().slice(0, 10)} →{' '}
                      {r.validTo ? r.validTo.toISOString().slice(0, 10) : 'illimité'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function Stat({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'rose' }) {
  const toneClass = tone === 'rose' ? 'text-rose-700' : 'text-ink-900';
  return (
    <div className="bg-canvas-50 rounded p-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className={`text-lg font-bold font-mono ${toneClass}`}>{value}</div>
    </div>
  );
}

const SEV_TONE: Record<AlertSeverity, string> = {
  critical: 'bg-rose-50 border-rose-300 text-rose-900',
  warning: 'bg-amber-50 border-amber-300 text-amber-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
};

const SEV_ICON: Record<AlertSeverity, typeof AlertTriangle> = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

function AlertRow({ a }: { a: RegulatoryAlert }) {
  const Icon = SEV_ICON[a.severity];
  return (
    <div className={`border rounded p-2 ${SEV_TONE[a.severity]}`}>
      <div className="flex items-start gap-2">
        <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold">{a.message}</div>
          <div className="text-[11px] mt-0.5">{a.recommendation}</div>
          <div className="text-[10px] mt-1 font-mono opacity-80">
            {a.jurisdictionCode} · {a.category} · à traiter avant {a.actionableUntil.toISOString().slice(0, 10)}
          </div>
          {a.source && (
            <a
              href={a.source.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[10px] underline"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              {a.source.name}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceCard({ s }: { s: RegulatorySource }) {
  return (
    <a
      href={s.publicUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-canvas-50 border border-canvas-200 rounded p-2 hover:bg-canvas-100"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-ink-900">{s.code}</div>
          <div className="text-[11px] text-ink-700">{s.name}</div>
          <div className="text-[10px] text-ink-500 mt-0.5">
            Zone {s.zone} · {s.cadence}
          </div>
        </div>
        <ExternalLink className="w-3 h-3 text-ink-400 mt-0.5" />
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {s.ruleCategories.map((c) => (
          <span key={c} className="px-1.5 py-0.5 rounded text-[9px] bg-canvas-200 text-ink-600">{c}</span>
        ))}
      </div>
    </a>
  );
}

// ============================================================================
// Mappers
// ============================================================================

function mapRule(row: unknown): RegulatoryRule {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    jurisdictionId: r.jurisdiction_id as string,
    rubricCode: r.rubric_code as string,
    productCategory: (r.product_category as string) ?? null,
    ruleType: r.rule_type as RegulatoryRule['ruleType'],
    valueNumeric: r.value_numeric !== null && r.value_numeric !== undefined ? Number(r.value_numeric) : null,
    valueFormula: r.value_formula as RegulatoryRule['valueFormula'],
    unit: r.unit as RegulatoryRule['unit'],
    validFrom: new Date(r.valid_from as string),
    validTo: r.valid_to ? new Date(r.valid_to as string) : null,
    sourceReference: (r.source_reference as string) ?? null,
    sourceDocument: (r.source_document as string) ?? null,
    recordedAt: new Date(r.recorded_at as string),
    recordedBy: (r.recorded_by as string) ?? null,
    supersededBy: (r.superseded_by as string) ?? null,
  };
}

function mapJur(row: unknown): RegulatoryJurisdiction {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    scopeCountries: (r.scope_countries as string[]) ?? [],
    parentId: (r.parent_id as string) ?? null,
    createdAt: new Date(r.created_at as string),
  };
}
