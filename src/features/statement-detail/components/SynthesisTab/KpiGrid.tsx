// ============================================================================
// KpiGrid — 4 KPIs en grille
// ============================================================================

import { TrendingUp, TrendingDown, Banknote, ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react';
import { AmountFCFA } from '../../../../components/shared';

interface KpiGridProps {
  finalBalanceCentimes: number;
  startBalanceCentimes: number;
  totalCreditCentimes: number;
  totalDebitCentimes: number;
  feesCentimes: number;
  creditCount: number;
  debitCount: number;
  feesDeltaPct: number | null;          // ex. +23 → +23%
  finalBalanceDeltaPct: number | null;  // ex. +18.2
}

export function KpiGrid(props: KpiGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Kpi
        icon={Banknote}
        label="Solde fin de période"
        value={<AmountFCFA value={props.finalBalanceCentimes} units />}
        delta={props.finalBalanceDeltaPct}
        deltaSuffix="vs début"
      />
      <Kpi
        icon={ArrowDownLeft}
        label="Encaissements"
        value={<AmountFCFA value={props.totalCreditCentimes} units />}
        sub={`${props.creditCount} transactions`}
        valueColor="text-ink-900"
      />
      <Kpi
        icon={ArrowUpRight}
        label="Décaissements"
        value={<AmountFCFA value={props.totalDebitCentimes} units />}
        sub={`${props.debitCount} transactions`}
        valueColor="text-ink-900"
      />
      <Kpi
        icon={Receipt}
        label="Frais bancaires"
        value={<AmountFCFA value={props.feesCentimes} units />}
        delta={props.feesDeltaPct}
        deltaSuffix="vs trim. préc."
        deltaInverse
        valueColor="text-amber-700"
      />
    </div>
  );
}

interface KpiProps {
  icon: typeof Banknote;
  label: string;
  value: React.ReactNode;
  sub?: string;
  delta?: number | null;
  deltaSuffix?: string;
  /** Si true, un delta positif est mauvais (ex. frais qui augmentent). */
  deltaInverse?: boolean;
  valueColor?: string;
}

function Kpi(props: KpiProps) {
  const Icon = props.icon;
  const showDelta = props.delta !== undefined && props.delta !== null;
  const negativeIsRed = props.deltaInverse ?? false;
  const isUp = (props.delta ?? 0) >= 0;
  const tone = !showDelta
    ? 'text-ink-500'
    : negativeIsRed
      ? (isUp ? 'text-amber-700' : 'text-emerald-700')
      : (isUp ? 'text-emerald-700' : 'text-rose-700');
  const TrendIcon = isUp ? TrendingUp : TrendingDown;

  return (
    <div className="bg-white border border-canvas-200 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-500">
        <Icon className="w-3 h-3" />
        {props.label}
      </div>
      <div className={`mt-1 text-base sm:text-lg font-semibold ${props.valueColor ?? 'text-ink-900'}`}>
        {props.value}
      </div>
      {showDelta && (
        <div className={`mt-0.5 inline-flex items-center gap-1 text-[11px] ${tone}`}>
          <TrendIcon className="w-3 h-3" />
          {(props.delta! >= 0 ? '+' : '')}
          {(props.delta!).toFixed(1).replace('.', ',')}%
          <span className="text-ink-500">{props.deltaSuffix}</span>
        </div>
      )}
      {props.sub && !showDelta && (
        <div className="mt-0.5 text-[11px] text-ink-500">{props.sub}</div>
      )}
    </div>
  );
}
