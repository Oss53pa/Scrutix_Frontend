// ============================================================================
// StatementsListPage — liste des releves importes
// ============================================================================
// Point d'entree principal vers la page releve detail.
// Charge depuis Supabase (atlasbanx.bank_statements) ou affiche le mock.
// ============================================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';

interface StatementRow {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  clientName: string;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
  status: string;
  importedAt: string;
}

const MOCK_STATEMENTS: StatementRow[] = [
  {
    id: 'stmt-mock',
    bankCode: 'NSIA',
    bankName: 'NSIA Banque Cote d\'Ivoire',
    accountNumber: '86315802001',
    clientName: 'Pamela ATOKOUNA',
    periodStart: '2026-02-10',
    periodEnd: '2026-05-08',
    transactionCount: 94,
    status: 'imported',
    importedAt: '2026-05-09T18:00:00Z',
  },
];

export function StatementsListPage() {
  const navigate = useNavigate();
  const [statements, setStatements] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (isSupabaseConfigured()) {
          const sb = getSupabaseClient()!;
          const { data } = await sb
            .schema('atlasbanx' as never)
            .from('bank_statements' as never)
            .select('id, bank_code, bank_name, account_number, client_name, period_start, period_end, transaction_count, status, imported_at')
            .order('imported_at', { ascending: false })
            .limit(50);

          if (!cancelled && data && (data as unknown[]).length > 0) {
            setStatements(
              (data as Record<string, unknown>[]).map((r) => ({
                id: r.id as string,
                bankCode: (r.bank_code as string) ?? '',
                bankName: (r.bank_name as string) ?? '',
                accountNumber: (r.account_number as string) ?? '',
                clientName: (r.client_name as string) ?? '',
                periodStart: (r.period_start as string) ?? '',
                periodEnd: (r.period_end as string) ?? '',
                transactionCount: (r.transaction_count as number) ?? 0,
                status: (r.status as string) ?? 'pending',
                importedAt: (r.imported_at as string) ?? '',
              })),
            );
          } else if (!cancelled) {
            setStatements(MOCK_STATEMENTS);
          }
        } else {
          if (!cancelled) setStatements(MOCK_STATEMENTS);
        }
      } catch {
        if (!cancelled) setStatements(MOCK_STATEMENTS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Releves</h1>
          <p className="text-xs text-ink-500 mt-0.5">
            {statements.length} releve{statements.length > 1 ? 's' : ''} importe{statements.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <Clock className="w-4 h-4 animate-spin" />
            Chargement...
          </div>
        </div>
      )}

      {!loading && statements.length === 0 && (
        <div className="text-center py-20">
          <FileText className="w-10 h-10 text-ink-300 mx-auto mb-3" />
          <p className="text-sm text-ink-500">Aucun releve importe</p>
          <p className="text-xs text-ink-400 mt-1">
            Importez un releve bancaire PDF depuis la page Import.
          </p>
        </div>
      )}

      {!loading && statements.length > 0 && (
        <div className="space-y-2">
          {statements.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/statements/${s.id}`)}
              className="w-full text-left bg-white border border-canvas-200 rounded-xl px-4 py-3.5 hover:border-amber-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-amber-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink-900 truncate">
                        {s.bankCode} · {formatPeriod(s.periodStart, s.periodEnd)}
                      </span>
                      <StatusIcon status={s.status} />
                    </div>
                    <p className="text-xs text-ink-500 mt-0.5 truncate">
                      {s.clientName && <span>{s.clientName} · </span>}
                      <span className="font-mono">{s.accountNumber}</span>
                      <span> · {s.transactionCount} transactions</span>
                      {s.importedAt && <span> · importe le {formatDate(s.importedAt)}</span>}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-400 group-hover:text-amber-600 shrink-0 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'analyzed' || status === 'imported') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
        <CheckCircle2 className="w-3 h-3" /> Analyse
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-canvas-100 text-ink-500 border border-canvas-300 text-[10px] font-medium">
        <Clock className="w-3 h-3" /> En attente
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-medium">
        <AlertTriangle className="w-3 h-3" /> Erreur
      </span>
    );
  }
  return null;
}

function formatPeriod(start: string, end: string): string {
  const months = ['janv', 'fev', 'mars', 'avr', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'dec'];
  const ds = new Date(start);
  const de = new Date(end);
  if (isNaN(ds.getTime()) || isNaN(de.getTime())) return `${start} - ${end}`;
  return `${ds.getDate()} ${months[ds.getMonth()]} - ${de.getDate()} ${months[de.getMonth()]} ${de.getFullYear()}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
