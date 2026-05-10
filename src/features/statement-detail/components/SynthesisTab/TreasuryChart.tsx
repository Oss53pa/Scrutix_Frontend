// ============================================================================
// TreasuryChart — solde quotidien sur la période
// ============================================================================
// Spec V1 §5.6.2 :
//   - LineChart Recharts
//   - Ligne bleue (info), area sous la ligne opacité 0.08
//   - Points rouges sur jours en solde négatif
//   - Ligne pointillée horizontale au seuil de découvert autorisé
//   - Tooltip date + montant + nb transactions ce jour
//   - Légende custom HTML sous le graphe
// ============================================================================

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceDot,
} from 'recharts';
import type { BankTransaction } from '../../types/statement.types';

interface TreasuryChartProps {
  bankTxs: BankTransaction[];
  /** Seuil de découvert autorisé en unités (négatif). Optionnel. */
  overdraftThresholdUnits?: number | null;
  height?: number;
}

interface DailyPoint {
  date: string;          // YYYY-MM-DD
  dateLabel: string;     // 02-10
  balance: number;       // unités
  txCount: number;
}

export function TreasuryChart({ bankTxs, overdraftThresholdUnits = null, height = 280 }: TreasuryChartProps) {
  const data = useMemo(() => buildDailySeries(bankTxs), [bankTxs]);
  const negativePoints = data.filter((d) => d.balance < 0);
  const negativeDays = negativePoints.length;

  return (
    <section className="bg-white border border-canvas-200 rounded-lg p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-ink-900">
          Trésorerie quotidienne · solde au jour le jour
        </h3>
        <a className="text-[11px] text-amber-700 hover:underline cursor-pointer" role="button">Détail ↗</a>
      </div>
      <div role="img" aria-label="Évolution quotidienne du solde bancaire" style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="treasuryFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#378ADD" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#378ADD" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E7E6E2" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10, fill: '#6B6B6B' }}
              tickLine={false}
              axisLine={{ stroke: '#E7E6E2' }}
              interval={Math.max(0, Math.floor(data.length / 12))}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#6B6B6B' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmtCompact}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#378ADD"
              strokeWidth={1.6}
              fill="url(#treasuryFill)"
              dot={false}
              activeDot={{ r: 4, fill: '#378ADD' }}
            />
            {overdraftThresholdUnits !== null && overdraftThresholdUnits !== undefined && (
              <ReferenceLine
                y={overdraftThresholdUnits}
                stroke="#6B6B6B"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            {negativePoints.map((p) => (
              <ReferenceDot key={p.date} x={p.dateLabel} y={p.balance} r={3.5} fill="#E24B4A" stroke="none" />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 flex-wrap text-[11px] text-ink-600 mt-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500" />
          Solde quotidien (FCFA)
        </span>
        {negativeDays > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500" />
            {negativeDays} jour{negativeDays > 1 ? 's' : ''} en solde négatif
          </span>
        )}
        {overdraftThresholdUnits !== null && overdraftThresholdUnits !== undefined && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-px bg-ink-400" style={{ borderTop: '1px dashed #6B6B6B' }} />
            Seuil de découvert autorisé
          </span>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function buildDailySeries(txs: BankTransaction[]): DailyPoint[] {
  if (txs.length === 0) return [];
  // Trier par date
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  const map = new Map<string, { balance: number; count: number }>();
  let last: number | null = null;
  for (const t of sorted) {
    last = t.runningBalanceCentimes / 100;
    const cur = map.get(t.date) ?? { balance: last, count: 0 };
    cur.balance = last;
    cur.count += 1;
    map.set(t.date, cur);
  }
  // Construit la série jour par jour entre la première et la dernière date
  const start = new Date(sorted[0].date);
  const end = new Date(sorted[sorted.length - 1].date);
  const out: DailyPoint[] = [];
  let bal = sorted[0].runningBalanceCentimes / 100;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const day = map.get(iso);
    if (day) bal = day.balance;
    out.push({
      date: iso,
      dateLabel: iso.slice(5),
      balance: Math.round(bal),
      txCount: day?.count ?? 0,
    });
  }
  return out;
}

function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + 'k';
  return String(n);
}

function fmtFull(n: number): string {
  const s = String(Math.abs(Math.round(n)));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
    out += s[i];
  }
  return (n < 0 ? '−' : '') + out + ' FCFA';
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ payload: DailyPoint }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  const fullDate = new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <div className="bg-ink-900 text-white rounded-md px-2.5 py-1.5 text-[11px] shadow-lg">
      <div className="font-semibold">{fullDate}</div>
      <div className={p.balance < 0 ? 'text-rose-300' : ''}>{fmtFull(p.balance)}</div>
      {p.txCount > 0 && <div className="text-ink-400">{p.txCount} transaction{p.txCount > 1 ? 's' : ''} ce jour</div>}
    </div>
  );
}
