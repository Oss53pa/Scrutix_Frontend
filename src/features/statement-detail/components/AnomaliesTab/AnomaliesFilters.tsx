// ============================================================================
// AnomaliesFilters — bande de filtres + recherche libre
// ============================================================================

import { Search } from 'lucide-react';
import type { AnomalySeverity, AnomalyStatus, AnomalyType } from '../../types/statement.types';

export interface AnomaliesFilterState {
  severity: AnomalySeverity | 'all';
  status: AnomalyStatus | 'all';
  assignedTo: string | 'all' | 'unassigned';
  type: AnomalyType | 'all';
  q: string;
}

export const DEFAULT_FILTERS: AnomaliesFilterState = {
  severity: 'all',
  status: 'all',
  assignedTo: 'all',
  type: 'all',
  q: '',
};

interface AnomaliesFiltersProps {
  filters: AnomaliesFilterState;
  onChange: (next: AnomaliesFilterState) => void;
  /** Liste des assignables, format compact. */
  assignees: Array<{ userId: string; handle: string }>;
}

export function AnomaliesFilters({ filters, onChange, assignees }: AnomaliesFiltersProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select
        value={filters.severity}
        onChange={(v) => onChange({ ...filters, severity: v as AnomalySeverity | 'all' })}
        options={[
          { value: 'all', label: 'Sévérité' },
          { value: 'critical', label: 'Critique' },
          { value: 'high', label: 'Haute' },
          { value: 'medium', label: 'Moyenne' },
          { value: 'low', label: 'Faible' },
        ]}
      />
      <Select
        value={filters.status}
        onChange={(v) => onChange({ ...filters, status: v as AnomalyStatus | 'all' })}
        options={[
          { value: 'all', label: 'Statut' },
          { value: 'detected', label: 'Détectée' },
          { value: 'qualified', label: 'Qualifiée' },
          { value: 'validated', label: 'Validée' },
          { value: 'signed', label: 'Signée' },
          { value: 'closed', label: 'Clôturée' },
          { value: 'false_positive', label: 'Faux positif' },
        ]}
      />
      <Select
        value={filters.assignedTo}
        onChange={(v) => onChange({ ...filters, assignedTo: v })}
        options={[
          { value: 'all', label: 'Assigné à' },
          { value: 'unassigned', label: 'Non assigné' },
          ...assignees.map((u) => ({ value: u.userId, label: '@' + u.handle })),
        ]}
      />
      <Select
        value={filters.type}
        onChange={(v) => onChange({ ...filters, type: v as AnomalyType | 'all' })}
        options={[
          { value: 'all', label: 'Type' },
          { value: 'commission_excessive', label: 'Commission excessive' },
          { value: 'agio_errone', label: 'Agio erroné' },
          { value: 'frais_double', label: 'Frais double' },
          { value: 'convention_violee', label: 'Convention violée' },
          { value: 'date_valeur_abusive', label: 'Date valeur abusive' },
          { value: 'frais_non_justifie', label: 'Frais non justifié' },
          { value: 'lcb_ft', label: 'LCB-FT' },
          { value: 'pays_gafi_risque', label: 'Pays GAFI' },
          { value: 'beneficiaire_inedit', label: 'Bénéficiaire inédit' },
          { value: 'montant_anormal', label: 'Montant anormal' },
          { value: 'doublon_transaction', label: 'Doublon transaction' },
        ]}
      />
      <div className="flex-1 min-w-[200px] relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
        <input
          type="text"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder="Recherche libre…"
          className="w-full pl-7 pr-2 py-1 text-xs border border-canvas-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>
    </div>
  );
}

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}

function Select({ value, onChange, options }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2 py-1 text-xs border border-canvas-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
