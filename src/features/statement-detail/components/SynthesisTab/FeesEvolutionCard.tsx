// ============================================================================
// FeesEvolutionCard — bar chart frais par mois + table détail
// ============================================================================

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { AmountFCFA } from '../../../../components/shared';
import type { BankTransaction } from '../../types/statement.types';

interface FeesEvolutionCardProps {
  bankTxs: BankTransaction[];
  /** Si défini, le mois ou un libellé spécifique est mis en warning (à vérifier). */
  agiosWarning?: boolean;
}

interface MonthBucket { label: string; total: number; }

const FEE_BUCKETS = {
  commissions_mouvement: { label: 'Commissions de mouvement', match: /com\s*(de\s*)?mouvement|comm\.\s*mvt/i },
  tenue_compte:          { label: 'Tenue de compte',          match: /tenue.{0,4}compte|frais.{0,4}tenue/i },
  frais_virements:       { label: 'Frais virements émis',     match: /frais.{0,4}vir|comm\s*virement/i },
  agios:                 { label: 'Agios',                    match: /agios|int\.?\s*deb|int\s*debiteurs/i },
} as const;

type BucketKey = keyof typeof FEE_BUCKETS;

export function FeesEvolutionCard({ bankTxs, agiosWarning }: FeesEvolutionCardProps) {
  const { monthly, byBucket } = useMemo(() => buildSeries(bankTxs), [bankTxs]);
  const avgMonthly = monthly.length > 0 ? monthly.reduce((s, m) => s + m.total, 0) / monthly.length : 0;
  const lastIdx = monthly.length - 1;

  return (
    <section className="bg-white border border-canvas-200 rounded-lg p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-ink-900">Évolution des frais</h3>
        <a className="text-[11px] text-amber-700 hover:underline cursor-pointer" role="button">Détail ↗</a>
      </div>
      <div role="img" aria-label="Évolution mensuelle des frais bancaires" style={{ width: '100%', height: 160 }}>
        <ResponsiveContainer>
          <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B6B6B' }} tickLine={false} axisLine={{ stroke: '#E7E6E2' }} />
            <YAxis tick={{ fontSize: 10, fill: '#6B6B6B' }} tickLine={false} axisLine={false} tickFormatter={fmtAxis} width={42} />
            <Tooltip content={<TooltipMonth />} />
            <Bar dataKey="total" radius={[4, 4, 0, 0]} barSize={28}>
              {monthly.map((m, i) => {
                const isLast = i === lastIdx;
                const aboveAvg = m.total > avgMonthly && isLast;
                return (
                  <Cell key={i} fill={aboveAvg ? '#EF9F27' : '#9EC9F0'} />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 divide-y divide-canvas-100 text-xs">
        {(Object.keys(FEE_BUCKETS) as BucketKey[]).map((k) => {
          const total = byBucket[k] ?? 0;
          const isAgios = k === 'agios';
          return (
            <li key={k} className="py-1.5 flex items-center justify-between gap-2">
              <span className="text-ink-700 inline-flex items-center gap-1.5">
                {FEE_BUCKETS[k].label}
                {isAgios && agiosWarning && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-semibold">
                    à vérifier
                  </span>
                )}
              </span>
              <AmountFCFA value={total} units className="text-ink-900" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ============================================================================
// Build series
// ============================================================================

function buildSeries(txs: BankTransaction[]) {
  const byBucket: Record<BucketKey, number> = {
    commissions_mouvement: 0, tenue_compte: 0, frais_virements: 0, agios: 0,
  };
  const months = new Map<string, number>();

  for (const t of txs) {
    const debitUnits = t.debitCentimes / 100;
    if (debitUnits <= 0) continue;
    const ym = t.date.slice(0, 7);
    const label = formatMonth(t.date);
    months.set(ym + '|' + label, (months.get(ym + '|' + label) ?? 0));

    let matched = false;
    for (const [k, b] of Object.entries(FEE_BUCKETS)) {
      if (b.match.test(t.label)) {
        byBucket[k as BucketKey] += debitUnits;
        months.set(ym + '|' + label, (months.get(ym + '|' + label) ?? 0) + debitUnits);
        matched = true;
        break;
      }
    }
    void matched;
  }

  // Trier par YYYY-MM
  const monthly: MonthBucket[] = Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, total]) => ({ label: key.split('|')[1], total }));

  return { monthly, byBucket };
}

function formatMonth(iso: string): string {
  const months = ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
  const d = new Date(iso);
  return months[d.getMonth()];
}

function fmtAxis(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k';
  return String(n);
}

function TooltipMonth({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: MonthBucket }> }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-ink-900 text-white rounded-md px-2.5 py-1.5 text-[11px] shadow-lg">
      <div className="font-semibold">{payload[0].payload.label}</div>
      <div>{payload[0].value.toLocaleString('fr-FR')} FCFA</div>
    </div>
  );
}
