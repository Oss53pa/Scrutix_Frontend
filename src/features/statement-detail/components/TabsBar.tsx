// ============================================================================
// TabsBar — barre d'onglets internes de la page relevé
// ============================================================================
// Spec §5.5 : 5 onglets avec icônes Lucide + badges chiffrés sur Transactions
// et Anomalies (rouge si > 0 critique sur Anomalies).
// ============================================================================

import { LayoutDashboard, List, AlertTriangle, Scale, FileCheck, type LucideIcon } from 'lucide-react';

export type StatementTabKey = 'synthesis' | 'transactions' | 'anomalies' | 'reconciliation' | 'report';

export interface TabBadge {
  count: number;
  variant: 'neutral' | 'danger';
}

interface TabsBarProps {
  active: StatementTabKey;
  onChange: (k: StatementTabKey) => void;
  badges?: Partial<Record<StatementTabKey, TabBadge>>;
}

interface TabDef {
  key: StatementTabKey;
  label: string;
  Icon: LucideIcon;
}

const TABS: TabDef[] = [
  { key: 'synthesis',      label: 'Synthèse',       Icon: LayoutDashboard },
  { key: 'transactions',   label: 'Transactions',   Icon: List },
  { key: 'anomalies',      label: 'Anomalies',      Icon: AlertTriangle },
  { key: 'reconciliation', label: 'Rapprochement',  Icon: Scale },
  { key: 'report',         label: 'Rapport',        Icon: FileCheck },
];

export function TabsBar({ active, onChange, badges }: TabsBarProps) {
  return (
    <nav role="tablist" aria-label="Onglets du relevé">
      <ul className="flex items-center gap-1 overflow-x-auto -mb-px">
        {TABS.map((t) => {
          const isActive = active === t.key;
          const badge = badges?.[t.key];
          return (
            <li key={t.key}>
              <button
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(t.key)}
                className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors ${
                  isActive ? 'text-ink-900 font-semibold' : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                <t.Icon className="w-4 h-4" />
                {t.label}
                {badge && badge.count > 0 && (
                  <span className={`px-1.5 py-0 rounded-full text-[10px] font-bold ${
                    badge.variant === 'danger'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-canvas-100 text-ink-600 border border-canvas-200'
                  }`}>
                    {badge.count}
                  </span>
                )}
                {isActive && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-amber-600" />}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export const STATEMENT_TAB_KEYS = TABS.map((t) => t.key);
