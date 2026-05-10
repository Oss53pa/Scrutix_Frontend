// ============================================================================
// CompareStatementModal — sélection d'un autre relevé du même compte
// ============================================================================

import { useEffect, useState } from 'react';
import { X, ArrowLeftRight } from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../../../lib/supabase';

interface OtherStatement {
  id: string;
  periodStart: string;
  periodEnd: string;
  bankCode: string;
  status: string;
  transactionCount: number;
}

interface CompareStatementModalProps {
  open: boolean;
  onClose: () => void;
  currentStatementId: string;
  accountId: string;
  bankCode: string;
  onSelect: (statementId: string) => void;
}

export function CompareStatementModal(props: CompareStatementModalProps) {
  const [statements, setStatements] = useState<OtherStatement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        if (isSupabaseConfigured()) {
          const sb = getSupabaseClient()!;
          const { data } = await sb
            .schema('atlasbanx' as never)
            .from('bank_statements' as never)
            .select('id, period_start, period_end, bank_code, status, transaction_count')
            .eq('account_id', props.accountId)
            .neq('id', props.currentStatementId)
            .order('period_start', { ascending: false })
            .limit(20);
          if (!cancelled && data) {
            setStatements(
              (data as Record<string, unknown>[]).map((r) => ({
                id: r.id as string,
                periodStart: r.period_start as string,
                periodEnd: r.period_end as string,
                bankCode: r.bank_code as string,
                status: r.status as string,
                transactionCount: (r.transaction_count as number) ?? 0,
              })),
            );
          }
        } else {
          // Mock: pas d'autres relevés disponibles offline
          if (!cancelled) setStatements([]);
        }
      } catch {
        if (!cancelled) setStatements([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [props.open, props.accountId, props.currentStatementId]);

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md mx-4 border border-canvas-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-canvas-200">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-ink-900">Comparer avec un autre relevé</h2>
          </div>
          <button
            onClick={props.onClose}
            className="p-1 rounded hover:bg-canvas-100"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 max-h-80 overflow-y-auto">
          {loading && (
            <p className="text-xs text-ink-500 py-4 text-center">Chargement des relevés...</p>
          )}

          {!loading && statements.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-ink-500">Aucun autre relevé disponible sur ce compte.</p>
              <p className="text-xs text-ink-400 mt-1">
                Importez d'autres relevés pour activer la comparaison.
              </p>
            </div>
          )}

          {!loading && statements.length > 0 && (
            <ul className="space-y-1.5">
              {statements.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      props.onSelect(s.id);
                      props.onClose();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-canvas-200 hover:bg-canvas-50 hover:border-amber-300 transition-colors"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium text-ink-900">
                        {formatPeriod(s.periodStart, s.periodEnd)}
                      </span>
                      <span className="text-[10px] text-ink-500">
                        {s.transactionCount} tx
                      </span>
                    </div>
                    <p className="text-xs text-ink-500 mt-0.5">
                      {s.bankCode} · {s.status === 'imported' || s.status === 'analyzed' ? 'Analysé' : 'Non analysé'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function formatPeriod(start: string, end: string): string {
  const months = ['janv', 'fév', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  const ds = new Date(start);
  const de = new Date(end);
  if (isNaN(ds.getTime()) || isNaN(de.getTime())) return `${start} → ${end}`;
  return `${ds.getDate()} ${months[ds.getMonth()]} → ${de.getDate()} ${months[de.getMonth()]} ${de.getFullYear()}`;
}
