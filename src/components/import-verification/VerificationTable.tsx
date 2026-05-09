// ============================================================================
// ATLASBANX — Verification Table
// ============================================================================
// The right panel of the ImportVerificationModal. Bi-mode (statement /
// conditions). Per-row actions: validate / reject / edit.
//
// Edit policy (mode B = limited):
//   • Statement: description, reference, amount, balance editable.
//                date, valueDate, currency locked (extractor-driven).
//   • Conditions: label, value, rubricKey editable.
//                section locked.
// ============================================================================

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Circle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  type ConditionRow,
  type RowState,
  type StatementRow,
  type VerificationMode,
  getEffective,
  hasEdits,
} from './types';
import { FIELD_DEFINITIONS } from '../../extraction';

type AnyRow = StatementRow | ConditionRow;

interface Props {
  rows: AnyRow[];
  mode: VerificationMode;
  focusedRowId: string | null;
  onFocus: (id: string | null) => void;
  onToggleValidation: (id: string) => void;
  onSetState: (id: string, state: RowState) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
}

const STATE_TONES: Record<RowState, { dot: string; text: string; bg: string }> = {
  pending:   { dot: 'bg-ink-300',     text: 'text-ink-500',     bg: 'bg-canvas-50' },
  validated: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50/40' },
  rejected:  { dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50/40' },
};

const CONFIDENCE_TONES = (c: number) => {
  if (c >= 0.85) return 'text-emerald-600';
  if (c >= 0.65) return 'text-amber-600';
  if (c > 0) return 'text-red-600';
  return 'text-ink-300';
};

export function VerificationTable({
  rows,
  mode,
  focusedRowId,
  onFocus,
  onToggleValidation,
  onSetState,
  onPatch,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'validated' | 'rejected' | 'low'>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === 'pending' && r.state !== 'pending') return false;
      if (filter === 'validated' && r.state !== 'validated') return false;
      if (filter === 'rejected' && r.state !== 'rejected') return false;
      if (filter === 'low' && r.confidence >= 0.65) return false;
      return true;
    });
  }, [rows, filter]);

  return (
    <div className="flex flex-col h-full">
      {/* Filter chips */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-primary-200/60 bg-canvas-50/70 flex-wrap">
        {[
          { v: 'all' as const,       label: `Toutes (${rows.length})` },
          { v: 'pending' as const,   label: `À vérifier (${rows.filter((r) => r.state === 'pending').length})` },
          { v: 'validated' as const, label: `Validées (${rows.filter((r) => r.state === 'validated').length})` },
          { v: 'rejected' as const,  label: `Rejetées (${rows.filter((r) => r.state === 'rejected').length})` },
          { v: 'low' as const,       label: `Confiance faible` },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            className={`px-2.5 py-1 rounded-pill text-[11px] font-medium transition-colors ${
              filter === f.v
                ? 'bg-ink-900 text-white'
                : 'bg-canvas-100 text-ink-600 hover:bg-canvas-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Header */}
      {mode === 'statement' ? (
        <div className="grid grid-cols-[24px_88px_1fr_120px_120px_28px] gap-2 px-3 py-2 text-[10px] font-semibold text-ink-500 uppercase tracking-[0.1em] border-b border-primary-200/60 bg-canvas-50/40">
          <span></span>
          <span>Date</span>
          <span>Libellé</span>
          <span className="text-right">Débit</span>
          <span className="text-right">Crédit</span>
          <span></span>
        </div>
      ) : (
        <div className="grid grid-cols-[24px_1fr_140px_140px_28px] gap-2 px-3 py-2 text-[10px] font-semibold text-ink-500 uppercase tracking-[0.1em] border-b border-primary-200/60 bg-canvas-50/40">
          <span></span>
          <span>Libellé</span>
          <span className="text-right">Valeur</span>
          <span>Rubrique</span>
          <span></span>
        </div>
      )}

      {/* Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-primary-100/40">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">Aucune ligne</p>
            <p className="empty-state-description">
              Change le filtre pour voir d'autres résultats.
            </p>
          </div>
        ) : (
          filtered.map((row) =>
            mode === 'statement' ? (
              <StatementRowView
                key={row.id}
                row={row as StatementRow}
                focused={focusedRowId === row.id}
                expanded={expandedRow === row.id}
                onFocus={() => onFocus(row.id)}
                onToggle={() => onToggleValidation(row.id)}
                onSetState={(s) => onSetState(row.id, s)}
                onExpand={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                onPatch={(p) => onPatch(row.id, p)}
              />
            ) : (
              <ConditionRowView
                key={row.id}
                row={row as ConditionRow}
                focused={focusedRowId === row.id}
                expanded={expandedRow === row.id}
                onFocus={() => onFocus(row.id)}
                onToggle={() => onToggleValidation(row.id)}
                onSetState={(s) => onSetState(row.id, s)}
                onExpand={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                onPatch={(p) => onPatch(row.id, p)}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STATEMENT ROW
// ============================================================================

function StatementRowView({
  row,
  focused,
  expanded,
  onFocus,
  onToggle,
  onSetState,
  onExpand,
  onPatch,
}: {
  row: StatementRow;
  focused: boolean;
  expanded: boolean;
  onFocus: () => void;
  onToggle: () => void;
  onSetState: (s: RowState) => void;
  onExpand: () => void;
  onPatch: (p: Record<string, unknown>) => void;
}) {
  const tone = STATE_TONES[row.state];
  const description = getEffective(row, 'description') as string;
  const amount = getEffective(row, 'amount') as number;
  const date = getEffective(row, 'date') as string;
  const edited = hasEdits(row);

  return (
    <div
      className={`group ${tone.bg} ${focused ? 'ring-2 ring-accent-400/60 ring-inset' : ''} hover:bg-canvas-100/60 transition-colors`}
      onMouseEnter={onFocus}
    >
      <div className="grid grid-cols-[24px_88px_1fr_120px_120px_28px] gap-2 px-3 py-2 items-center text-sm">
        {/* State checkbox */}
        <button
          onClick={onToggle}
          className="flex items-center justify-center text-ink-500"
          aria-label={`État: ${row.state}`}
        >
          {row.state === 'validated' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          {row.state === 'rejected' && <XCircle className="w-5 h-5 text-red-500" />}
          {row.state === 'pending' && <Circle className="w-5 h-5" />}
        </button>

        {/* Date (locked) */}
        <span className="text-xs text-ink-700 tabular-nums truncate">
          {formatDate(date)}
        </span>

        {/* Description (editable) */}
        <input
          type="text"
          value={description}
          onChange={(e) => onPatch({ description: e.target.value })}
          className="bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-accent-400/60 rounded px-1 py-0.5 text-ink-900 truncate w-full"
        />

        {/* Débit */}
        <input
          type="text"
          value={amount < 0 ? formatAmount(Math.abs(amount)) : ''}
          onChange={(e) => {
            const v = parseFr(e.target.value);
            if (v !== null) onPatch({ amount: -Math.abs(v) });
          }}
          placeholder="—"
          className="bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-red-400/60 rounded px-1 py-0.5 text-right text-red-700 font-medium tabular-nums w-full"
        />

        {/* Crédit */}
        <input
          type="text"
          value={amount > 0 ? formatAmount(amount) : ''}
          onChange={(e) => {
            const v = parseFr(e.target.value);
            if (v !== null) onPatch({ amount: Math.abs(v) });
          }}
          placeholder="—"
          className="bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-400/60 rounded px-1 py-0.5 text-right text-emerald-700 font-medium tabular-nums w-full"
        />

        {/* Expand button */}
        <button
          onClick={onExpand}
          className="text-ink-400 hover:text-ink-700 transition-colors"
          aria-label="Détails"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Per-row footer with confidence + edited + warnings */}
      <div className="flex items-center gap-2 px-3 pb-2 -mt-0.5">
        <span className={`text-[10px] ${CONFIDENCE_TONES(row.confidence)}`}>
          {Math.round(row.confidence * 100)}% confiance
        </span>
        {edited && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-amber-50 text-amber-700 border border-amber-200">
            modifié
          </span>
        )}
        {row.warnings.length > 0 && (
          <span className="text-[10px] inline-flex items-center gap-1 text-amber-700">
            <AlertTriangle className="w-3 h-3" /> {row.warnings.length} alerte{row.warnings.length > 1 ? 's' : ''}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onSetState('rejected')}
            className="text-[10px] px-2 py-0.5 rounded-pill border border-red-200 text-red-700 hover:bg-red-50"
          >
            Rejeter
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-3 pb-3 -mt-1 space-y-1.5">
          {row.warnings.length > 0 && (
            <ul className="text-[11px] text-amber-700 space-y-0.5">
              {row.warnings.map((w, i) => (
                <li key={i} className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {w}
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div>
              <p className="text-ink-500">Date de valeur</p>
              <p className="text-ink-800 tabular-nums">{formatDate(row.data.valueDate ?? row.data.date)}</p>
            </div>
            <div>
              <p className="text-ink-500">Solde après op.</p>
              <p className="text-ink-800 tabular-nums">{row.data.balance != null ? formatAmount(row.data.balance) : '—'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CONDITION ROW
// ============================================================================

function ConditionRowView({
  row,
  focused,
  expanded,
  onFocus,
  onToggle,
  onSetState,
  onExpand,
  onPatch,
}: {
  row: ConditionRow;
  focused: boolean;
  expanded: boolean;
  onFocus: () => void;
  onToggle: () => void;
  onSetState: (s: RowState) => void;
  onExpand: () => void;
  onPatch: (p: Record<string, unknown>) => void;
}) {
  const tone = STATE_TONES[row.state];
  const label = getEffective(row, 'label') as string;
  const value = getEffective(row, 'value') as number;
  const unit = getEffective(row, 'unit') as ConditionRow['data']['unit'];
  const rubricKey = (getEffective(row, 'rubricKey') as string | undefined) ?? '';
  const qualitative = (getEffective(row, 'qualitative') as ConditionRow['data']['qualitative']) ?? undefined;
  const edited = hasEdits(row);

  return (
    <div
      className={`group ${tone.bg} ${focused ? 'ring-2 ring-accent-400/60 ring-inset' : ''} hover:bg-canvas-100/60 transition-colors`}
      onMouseEnter={onFocus}
    >
      <div className="grid grid-cols-[24px_1fr_140px_140px_28px] gap-2 px-3 py-2 items-center text-sm">
        {/* State */}
        <button
          onClick={onToggle}
          className="flex items-center justify-center text-ink-500"
        >
          {row.state === 'validated' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          {row.state === 'rejected' && <XCircle className="w-5 h-5 text-red-500" />}
          {row.state === 'pending' && <Circle className="w-5 h-5" />}
        </button>

        {/* Label */}
        <input
          type="text"
          value={label}
          onChange={(e) => onPatch({ label: e.target.value })}
          className="bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-accent-400/60 rounded px-1 py-0.5 text-ink-900 truncate w-full"
        />

        {/* Value (or qualitative phrase) */}
        {qualitative ? (
          <span className="text-right text-amber-700 italic text-xs px-1">
            {qualitativeLabel(qualitative)}
          </span>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <input
              type="text"
              value={formatAmount(value)}
              onChange={(e) => {
                const v = parseFr(e.target.value);
                if (v !== null) onPatch({ value: v });
              }}
              className="bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-accent-400/60 rounded px-1 py-0.5 text-right tabular-nums font-medium text-ink-900 w-full"
            />
            <span className="text-[10px] text-ink-500 shrink-0">{unit ?? ''}</span>
          </div>
        )}

        {/* Rubric mapping (combobox) */}
        <select
          value={rubricKey}
          onChange={(e) => onPatch({ rubricKey: e.target.value || undefined })}
          className="bg-transparent border border-primary-200/40 hover:border-primary-300 focus:outline-none focus:ring-1 focus:ring-accent-400/60 rounded px-1 py-0.5 text-[11px] text-ink-700 w-full truncate"
        >
          <option value="">— Non rattachée —</option>
          {FIELD_DEFINITIONS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>

        {/* Expand */}
        <button
          onClick={onExpand}
          className="text-ink-400 hover:text-ink-700 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-3 pb-2 -mt-0.5">
        {row.data.section && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-canvas-100 text-ink-500 border border-primary-200/60 truncate max-w-[150px]">
            {row.data.section}
          </span>
        )}
        <span className={`text-[10px] ${CONFIDENCE_TONES(row.confidence)}`}>
          {Math.round(row.confidence * 100)}%
        </span>
        {edited && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-amber-50 text-amber-700 border border-amber-200">
            modifié
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onSetState('rejected')}
            className="text-[10px] px-2 py-0.5 rounded-pill border border-red-200 text-red-700 hover:bg-red-50"
          >
            Rejeter
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
}

function formatAmount(v: number): string {
  return Math.abs(v).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function parseFr(s: string): number | null {
  if (!s.trim()) return 0;
  const cleaned = s.replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function qualitativeLabel(q: string): string {
  switch (q) {
    case 'gratuit': return 'Gratuit';
    case 'consulter': return 'Nous consulter';
    case 'neant': return 'Néant';
    case 'franco': return 'Franco';
    case 'souscription': return 'À la souscription';
    default: return 'Variable';
  }
}
