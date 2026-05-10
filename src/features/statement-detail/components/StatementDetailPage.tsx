// ============================================================================
// StatementDetailPage — orchestrateur des onglets de la page relevé
// ============================================================================
// Charge les vraies données du relevé via Supabase (avec fallback mock si non
// configuré). Utilise l'utilisateur auth réel + le rôle workspace pour
// alimenter les mutations.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, FileText, BookOpen, FileBadge, AlertTriangle, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useStatement } from '../hooks/useStatement';
import { useAnomalies } from '../hooks/useAnomalies';
import { useReconciliation } from '../hooks/useReconciliation';
import { useReportGeneration } from '../hooks/useReportGeneration';
import { useStatementContext } from '../hooks/useStatementContext';
import { useProphet } from '../../prophet-copilot/hooks/useProphet';
import { AnomaliesTab } from './AnomaliesTab/AnomaliesTab';
import { ReconciliationTab } from './ReconciliationTab/ReconciliationTab';
import { ReportTab } from './ReportTab/ReportTab';
import { SynthesisTab } from './SynthesisTab';
import { TransactionsTab } from './TransactionsTab';
import { ProphetDrawer } from '../../prophet-copilot/components/ProphetDrawer';
import { MOCK_PROPHET_SUGGESTIONS } from '../mock-data';
import { useRole } from '../../../workspace/useWorkspace';
import { AmountFCFA, RoleGuard } from '../../../components/shared';

type TabKey = 'synthesis' | 'transactions' | 'anomalies' | 'reconciliation' | 'report';

export interface StatementDetailPageProps {
  statementId: string;
  /** Onglet initial (par défaut: anomalies). */
  defaultTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
}

export function StatementDetailPage(props: StatementDetailPageProps) {
  const [tab, setTab] = useState<TabKey>(props.defaultTab ?? 'anomalies');

  // Sync URL ?tab= si présent
  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get('tab') as TabKey | null;
    if (t && TAB_KEYS.includes(t)) setTab(t);
  }, []);

  function changeTab(next: TabKey) {
    setTab(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState({}, '', url.toString());
    }
    props.onTabChange?.(next);
  }

  // === Données chargées en réel depuis Supabase ===
  const { meta, loading: metaLoading } = useStatement(props.statementId);
  const { team, convention } = useStatementContext(meta?.accountId);

  const anomaliesH = useAnomalies(props.statementId);
  const reconH = useReconciliation(props.statementId);
  const reportH = useReportGeneration(props.statementId, {
    clientId: meta?.clientId,
    bankCode: meta?.bankCode,
    signerId: useAuthUserId() ?? undefined,
  });

  // === Auth & rôle ===
  const authUser = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const { role } = useRole();

  const userId = authUser?.id ?? '';
  const userHandle = useMemo(() => buildHandle(profile, authUser?.email), [profile, authUser?.email]);
  const userDisplayName = profile?.full_name ?? authUser?.email?.split('@')[0] ?? 'Utilisateur';

  // === PROPH3T ===
  const prophet = useProphet({
    statementId: props.statementId,
    userId,
    contextLabel: meta
      ? `relevé ${meta.bankCode} · ${formatPeriodShort(meta.periodStart, meta.periodEnd)}`
      : 'relevé chargement…',
    transactions: reconH.bankTxs,
    anomalies: anomaliesH.anomalies,
  });

  const conventionByAnomaly = useMemo(() => {
    const map: Record<string, { id: string; label: string; signedDate: string }> = {};
    for (const a of anomaliesH.anomalies) {
      // L'anomalie peut référencer une convention dédiée OU on retombe sur la convention courante du compte
      const fallbackConvId = convention?.id;
      const fallbackLabel = convention ? `Convention compte · ${convention.signedDate}` : null;
      const fallbackSigned = convention?.signedDate ?? '';
      if (a.conventionId || fallbackConvId) {
        map[a.id] = {
          id: a.conventionId ?? fallbackConvId!,
          label: a.conventionLabel ?? fallbackLabel ?? `Convention ${a.conventionId}`,
          signedDate: fallbackSigned,
        };
      }
    }
    return map;
  }, [anomaliesH.anomalies, convention]);

  // ============================================================================
  // Rendu
  // ============================================================================

  if (metaLoading || !meta) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-ink-500">
        Chargement du relevé…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-canvas-50">
      {/* === Header === */}
      <header className="px-6 py-3 bg-white border-b border-canvas-200 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <span>{meta.clientLegalName}</span>
              <span>·</span>
              <span className="font-mono">{meta.accountNumber}</span>
              <span>·</span>
              <span className="font-semibold text-ink-700">{meta.bankCode}</span>
            </div>
            <h1 className="text-base sm:text-lg font-semibold text-ink-900 truncate">
              Relevé · {formatPeriodLong(meta.periodStart, meta.periodEnd)}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="text-right">
              <div className="text-ink-500">Solde fin</div>
              <AmountFCFA value={meta.finalBalanceCentimes} className="font-semibold text-ink-900" />
            </div>
            <div className="text-right">
              <div className="text-ink-500">Transactions</div>
              <span className="font-mono font-semibold">{meta.transactionCount}</span>
            </div>
            <button
              onClick={prophet.toggleDrawer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              PROPH3T
            </button>
          </div>
        </div>
      </header>

      {/* === Tabs bar === */}
      <nav className="px-6 bg-white border-b border-canvas-200 shrink-0">
        <ul className="flex items-center gap-1">
          {TAB_DEFS.map((t) => {
            const isActive = tab === t.key;
            return (
              <li key={t.key}>
                <button
                  onClick={() => changeTab(t.key)}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                    isActive ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900'
                  }`}
                >
                  <t.Icon className="w-3.5 h-3.5" />
                  {t.label}
                  {t.key === 'anomalies' && anomaliesH.anomalies.length > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                      anomaliesH.anomalies.some((a) => a.severity === 'critical')
                        ? 'bg-rose-600 text-white'
                        : 'bg-amber-600 text-white'
                    }`}>
                      {anomaliesH.anomalies.length}
                    </span>
                  )}
                  {isActive && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-amber-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* === Content === */}
      <main className="flex-1 overflow-hidden">
        {tab === 'anomalies' && (
          <AnomaliesTab
            anomalies={anomaliesH.anomalies}
            comments={anomaliesH.comments}
            auditTrail={anomaliesH.auditTrail}
            team={team}
            conventionByAnomaly={conventionByAnomaly}
            onAnomalyAction={async (kind, anomaly, comment) => {
              if (!role || !userId) return;
              await anomaliesH.performAction(kind, anomaly.id, userHandle, userId, role, comment);
            }}
            onSubmitComment={(anomalyId, text, mentions) => {
              if (!role || !userId) return;
              void anomaliesH.addComment(anomalyId, text, mentions, {
                userId,
                handle: userHandle,
                role,
              });
            }}
          />
        )}

        {tab === 'reconciliation' && (
          <ReconciliationTab
            statementLabel={`Relevé ${meta.bankCode}`}
            bankCode={meta.bankCode}
            accountNumber={meta.accountNumber}
            periodStart={meta.periodStart}
            periodEnd={meta.periodEnd}
            bankTxs={reconH.bankTxs}
            ledgerEntries={reconH.ledgerEntries}
            reconciliation={reconH.reconciliation}
            onRecompute={() => void reconH.recompute()}
            onPushDiscrepancyToAtlas={(id) => void reconH.pushDiscrepancyToAtlas(id)}
            onIgnoreDiscrepancy={reconH.ignoreDiscrepancy}
            onImportFromAtlasFinance={() => void reconH.recompute()}
            onImportFromFile={() => void reconH.recompute()}
            onGenerateStatement={() => void reconH.generateStatement()}
          />
        )}

        {tab === 'report' && (
          <ReportTab
            statement={{
              id: meta.id,
              accountNumber: meta.accountNumber,
              bankCode: meta.bankCode,
              bankLegalName: meta.bankLegalName,
              clientLegalName: meta.clientLegalName,
              period: { start: meta.periodStart, end: meta.periodEnd },
              accountId: meta.accountId,
              tenantId: meta.clientId,
              organizationId: meta.clientId,
            }}
            anomalies={anomaliesH.anomalies}
            convention={convention}
            reconciliation={reconH.reconciliation}
            cabinet={{ name: 'CRMC · Atlas Studio', addressLines: ['Abidjan, Cocody', 'BP 1234'] }}
            currentUser={{
              handle: userHandle,
              displayName: userDisplayName,
              role: role ?? 'consultation',
            }}
            generatedReport={reportH.generatedReport}
            onGenerateReport={(t) => void reportH.generateReport(t)}
            onSignAndSend={async (args) => {
              await reportH.signAndSend(args);
            }}
            onGenerateComplaintLetter={(ids) => void reportH.generateComplaintLetter(ids)}
          />
        )}

        {tab === 'synthesis' && (
          <SynthesisTab
            bankTxs={reconH.bankTxs}
            anomalies={anomaliesH.anomalies}
            reconciliation={reconH.reconciliation}
            finalBalanceCentimes={meta.finalBalanceCentimes}
          />
        )}
        {tab === 'transactions' && <TransactionsTab bankTxs={reconH.bankTxs} />}
      </main>

      {/* === PROPH3T Drawer === */}
      <ProphetDrawer
        open={prophet.open}
        onClose={prophet.closeDrawer}
        contextLabel={prophet.contextLabel}
        suggestions={MOCK_PROPHET_SUGGESTIONS}
        messages={prophet.messages}
        onAsk={prophet.ask}
      />
    </div>
  );
}

// ============================================================================
// Tabs config
// ============================================================================

const TAB_DEFS: Array<{ key: TabKey; label: string; Icon: typeof FileText }> = [
  { key: 'synthesis',      label: 'Synthèse',       Icon: BarChart3 },
  { key: 'transactions',   label: 'Transactions',   Icon: BookOpen },
  { key: 'anomalies',      label: 'Anomalies',      Icon: AlertTriangle },
  { key: 'reconciliation', label: 'Rapprochement',  Icon: FileText },
  { key: 'report',         label: 'Rapport',        Icon: FileBadge },
];

const TAB_KEYS: TabKey[] = TAB_DEFS.map((t) => t.key);

// ============================================================================
// Helpers
// ============================================================================


function useAuthUserId(): string | null {
  return useAuthStore((s) => s.user?.id ?? null);
}

function buildHandle(profile: { full_name?: string | null } | null, email?: string | null): string {
  if (profile?.full_name) {
    const parts = profile.full_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return parts[0] + parts[1][0].toUpperCase();
    }
    return parts[0];
  }
  if (email) return email.split('@')[0];
  return 'user';
}

function formatPeriodLong(start: string, end: string): string {
  const ds = new Date(start);
  const de = new Date(end);
  return `du ${formatFr(ds)} au ${formatFr(de)}`;
}

function formatPeriodShort(start: string, end: string): string {
  const months = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  const ds = new Date(start);
  const de = new Date(end);
  return `${months[ds.getMonth()]}-${months[de.getMonth()]} ${de.getFullYear()}`;
}

function formatFr(d: Date): string {
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

void RoleGuard;
