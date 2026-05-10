// ============================================================================
// AnomaliesStatsBar — mini-stats cliquables qui filtrent la liste
// ============================================================================

import type { Anomaly } from '../../types/statement.types';
import type { AnomaliesFilterState } from './AnomaliesFilters';

interface AnomaliesStatsBarProps {
  anomalies: Anomaly[];
  filters: AnomaliesFilterState;
  onApplyFilter: (patch: Partial<AnomaliesFilterState>) => void;
}

interface StatChip {
  key: string;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

export function AnomaliesStatsBar({ anomalies, filters, onApplyFilter }: AnomaliesStatsBarProps) {
  const total = anomalies.length;
  const critiques = anomalies.filter((a) => a.severity === 'critical').length;
  const hautes    = anomalies.filter((a) => a.severity === 'high').length;
  const moyennes  = anomalies.filter((a) => a.severity === 'medium').length;
  const aValider  = anomalies.filter((a) => a.status === 'qualified').length;
  const enAttDg   = anomalies.filter((a) => a.status === 'validated' && a.severity === 'critical').length;

  const chips: StatChip[] = [
    {
      key: 'total',
      label: 'Total',
      count: total,
      active: filters.severity === 'all' && filters.status === 'all',
      onClick: () => onApplyFilter({ severity: 'all', status: 'all' }),
    },
    {
      key: 'crit',
      label: 'Critiques',
      count: critiques,
      active: filters.severity === 'critical',
      onClick: () => onApplyFilter({ severity: filters.severity === 'critical' ? 'all' : 'critical' }),
    },
    {
      key: 'high',
      label: 'Hautes',
      count: hautes,
      active: filters.severity === 'high',
      onClick: () => onApplyFilter({ severity: filters.severity === 'high' ? 'all' : 'high' }),
    },
    {
      key: 'med',
      label: 'Moyennes',
      count: moyennes,
      active: filters.severity === 'medium',
      onClick: () => onApplyFilter({ severity: filters.severity === 'medium' ? 'all' : 'medium' }),
    },
    {
      key: 'avalider',
      label: 'À valider',
      count: aValider,
      active: filters.status === 'qualified',
      onClick: () => onApplyFilter({ status: filters.status === 'qualified' ? 'all' : 'qualified' }),
    },
    {
      key: 'attentedg',
      label: 'En attente DG',
      count: enAttDg,
      active: filters.status === 'validated' && filters.severity === 'critical',
      onClick: () =>
        onApplyFilter(
          filters.status === 'validated' && filters.severity === 'critical'
            ? { status: 'all', severity: 'all' }
            : { status: 'validated', severity: 'critical' },
        ),
    },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
      {chips.map((c, i) => (
        <button
          key={c.key}
          onClick={c.onClick}
          className={`px-2 py-1 rounded-md border font-medium transition-colors ${
            c.active
              ? 'bg-amber-50 border-amber-400 text-amber-900'
              : 'bg-white border-canvas-200 text-ink-700 hover:bg-canvas-50'
          } ${i === 0 ? 'mr-1' : ''}`}
        >
          <span className="text-ink-500 mr-1">{c.label}:</span>
          <span className="font-mono">{c.count}</span>
        </button>
      ))}
    </div>
  );
}
