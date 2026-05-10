// ============================================================================
// FlowsCategorizationCard — DoughnutChart catégorisation des flux
// ============================================================================

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { BankTransaction } from '../../types/statement.types';

interface FlowsCategorizationCardProps {
  bankTxs: BankTransaction[];
}

interface FlowCategory { key: string; label: string; color: string; match: RegExp; }

const CATEGORIES: FlowCategory[] = [
  { key: 'salaires',    label: 'Salaires',     color: '#7C5BD9', match: /salaire|paie|virement.{0,10}salaire|atokouna|employe/i },
  { key: 'fournisseurs',label: 'Fournisseurs', color: '#5BBE8C', match: /vir.{0,4}emis|fournis|fournisseur|sci\s|crmc/i },
  { key: 'fiscal',      label: 'Fiscal',       color: '#D4A33C', match: /dgi|impot|tva|irpp|cnps|css|cgrae/i },
  { key: 'frais',       label: 'Frais',        color: '#E24B4A', match: /comm|frais|agios|tenue|sms|rejet/i },
  { key: 'autres',      label: 'Autres',       color: '#8C8C8C', match: /.*/ },
];

export function FlowsCategorizationCard({ bankTxs }: FlowsCategorizationCardProps) {
  const data = useMemo(() => buildPie(bankTxs), [bankTxs]);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <section className="bg-white border border-canvas-200 rounded-lg p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-ink-900">Catégorisation des flux</h3>
        <a className="text-[11px] text-amber-700 hover:underline cursor-pointer" role="button">Détail ↗</a>
      </div>
      <div role="img" aria-label="Répartition des décaissements par catégorie" style={{ width: '100%', height: 160 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={42}
              outerRadius={70}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => <Cell key={d.key} fill={d.color} />)}
            </Pie>
            <Tooltip content={<PieTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {data.map((d) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <li key={d.key} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
              <span className="text-ink-700">{d.label}</span>
              <span className="text-ink-500 font-mono ml-auto">{pct.toFixed(0)}%</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function buildPie(txs: BankTransaction[]) {
  const totals: Record<string, number> = {};
  for (const c of CATEGORIES) totals[c.key] = 0;
  for (const t of txs) {
    if (t.debitCentimes <= 0) continue;
    const cat = CATEGORIES.find((c) => c.key !== 'autres' && c.match.test(t.label)) ?? CATEGORIES.find((c) => c.key === 'autres')!;
    totals[cat.key] += t.debitCentimes / 100;
  }
  return CATEGORIES.map((c) => ({ key: c.key, label: c.label, color: c.color, value: Math.round(totals[c.key]) })).filter((d) => d.value > 0);
}

function PieTooltip({ active, payload, total }: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; value: number; color: string } }>;
  total: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : '0';
  return (
    <div className="bg-ink-900 text-white rounded-md px-2.5 py-1.5 text-[11px] shadow-lg">
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
        <span className="font-semibold">{p.label}</span>
      </div>
      <div className="font-mono">{p.value.toLocaleString('fr-FR')} FCFA · {pct}%</div>
    </div>
  );
}
