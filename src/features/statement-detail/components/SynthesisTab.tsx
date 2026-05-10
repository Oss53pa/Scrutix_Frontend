// ============================================================================
// SynthesisTab — onglet Synthèse (KPIs + cards)
// ============================================================================
// Vue de tête sur le relevé : KPIs principaux + récap anomalies par sévérité
// + récap rapprochement + suggestion PROPH3T (placeholder).
// ============================================================================

import { useMemo } from 'react';
import {
  Banknote, AlertTriangle, ShieldCheck, FileSearch, TrendingDown, TrendingUp,
} from 'lucide-react';
import { AmountFCFA, SeverityPill } from '../../../components/shared';
import type {
  Anomaly, BankTransaction, BankReconciliation,
} from '../types/statement.types';

interface SynthesisTabProps {
  bankTxs: BankTransaction[];
  anomalies: Anomaly[];
  reconciliation: BankReconciliation | null;
  finalBalanceCentimes: number;
}

export function SynthesisTab({ bankTxs, anomalies, reconciliation, finalBalanceCentimes }: SynthesisTabProps) {
  const stats = useMemo(() => {
    const totalDebit = bankTxs.reduce((s, t) => s + t.debitCentimes, 0);
    const totalCredit = bankTxs.reduce((s, t) => s + t.creditCentimes, 0);
    const totalRecovery = anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0);
    const bySev = {
      critical: anomalies.filter((a) => a.severity === 'critical').length,
      high:     anomalies.filter((a) => a.severity === 'high').length,
      medium:   anomalies.filter((a) => a.severity === 'medium').length,
      low:      anomalies.filter((a) => a.severity === 'low').length,
    };
    return { totalDebit, totalCredit, totalRecovery, bySev };
  }, [bankTxs, anomalies]);

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      {/* === KPIs en grille === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          icon={Banknote}
          label="Solde fin de période"
          value={<AmountFCFA value={finalBalanceCentimes} />}
          tone={finalBalanceCentimes >= 0 ? 'positive' : 'negative'}
        />
        <Kpi
          icon={TrendingUp}
          label="Total crédits"
          value={<AmountFCFA value={stats.totalCredit} />}
          tone="positive"
        />
        <Kpi
          icon={TrendingDown}
          label="Total débits"
          value={<AmountFCFA value={stats.totalDebit} />}
          tone="neutral"
        />
        <Kpi
          icon={ShieldCheck}
          label="Récupération potentielle"
          value={<AmountFCFA value={stats.totalRecovery} />}
          tone="accent"
        />
      </div>

      {/* === Anomalies par sévérité === */}
      <Card title="Anomalies par sévérité" icon={AlertTriangle}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['critical', 'high', 'medium', 'low'] as const).map((sev) => (
            <div key={sev} className="border border-canvas-200 rounded p-3 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <SeverityPill severity={sev} compact />
                <span className="text-[11px] text-ink-500 capitalize">{sev}</span>
              </div>
              <div className="text-2xl font-bold font-mono">{stats.bySev[sev]}</div>
            </div>
          ))}
        </div>
        {anomalies.length === 0 && (
          <p className="mt-3 text-xs text-ink-500">
            Aucune anomalie détectée — relevé conforme.
          </p>
        )}
      </Card>

      {/* === Rapprochement === */}
      {reconciliation && (
        <Card title="Rapprochement SYSCOHADA" icon={FileSearch}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
            <Kpi label="Match rate" value={`${reconciliation.matchRate}%`}
              tone={reconciliation.matchRate >= 95 ? 'positive' : reconciliation.matchRate >= 70 ? 'warning' : 'negative'} />
            <Kpi label="Transactions appariées" value={String(reconciliation.matchedPairs.length)} />
            <Kpi label="Écarts" value={String(reconciliation.discrepancies.length)} />
            <Kpi label="Gap" value={<AmountFCFA value={reconciliation.gapCentimes} colorize />} />
          </div>
        </Card>
      )}

      {/* === Top anomalies === */}
      {anomalies.length > 0 && (
        <Card title="Anomalies prioritaires">
          <div className="space-y-2">
            {anomalies
              .sort((a, b) => sevWeight(b.severity) - sevWeight(a.severity))
              .slice(0, 5)
              .map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-xs border-b border-canvas-100 pb-1.5">
                  <SeverityPill severity={a.severity} compact />
                  <span className="font-semibold flex-1 truncate">{a.title}</span>
                  {a.potentialRecoveryCentimes ? (
                    <AmountFCFA value={a.potentialRecoveryCentimes} className="text-emerald-700" />
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function sevWeight(s: Anomaly['severity']): number {
  return ({ critical: 4, high: 3, medium: 2, low: 1 } as const)[s];
}

interface KpiProps {
  icon?: typeof Banknote;
  label: string;
  value: React.ReactNode;
  tone?: 'positive' | 'negative' | 'neutral' | 'warning' | 'accent';
}

function Kpi({ icon: Icon, label, value, tone = 'neutral' }: KpiProps) {
  const toneClass = {
    positive: 'text-emerald-700',
    negative: 'text-rose-700',
    neutral: 'text-ink-900',
    warning: 'text-amber-700',
    accent: 'text-amber-700',
  }[tone];
  return (
    <div className="bg-white border border-canvas-200 rounded p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-500">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className={`mt-1 text-base font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon?: typeof Banknote; children: React.ReactNode }) {
  return (
    <section className="bg-canvas-50 border border-canvas-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-ink-900 inline-flex items-center gap-1.5 mb-2">
        {Icon && <Icon className="w-4 h-4" />}
        {title}
      </h3>
      {children}
    </section>
  );
}
