// ============================================================================
// StatementDetailPage — orchestrateur de la page relevé V1 spec
// ============================================================================
// Layout :
//   1. Breadcrumb + UserPill
//   2. StatementHeader (titre + actions globales)
//   3. StatementStatusBanner (cercle score + résumé anomalies)
//   4. TabsBar
//   5. Contenu de l'onglet actif
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { FileText, BookOpen, FileBadge, AlertTriangle, BarChart3, Scale } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useStatement } from '../hooks/useStatement';
import { useAnomalies } from '../hooks/useAnomalies';
import { useReconciliation } from '../hooks/useReconciliation';
import { useReportGeneration } from '../hooks/useReportGeneration';
import { useStatementContext } from '../hooks/useStatementContext';
import { useProphet } from '../../prophet-copilot/hooks/useProphet';
import { useWorkspace } from '../../../workspace/useWorkspace';
import { AnomaliesTab } from './AnomaliesTab/AnomaliesTab';
import { ReconciliationTab } from './ReconciliationTab/ReconciliationTab';
import { ReportTab } from './ReportTab/ReportTab';
import { SynthesisTab } from './SynthesisTab';
import { TransactionsTab } from './TransactionsTab';
import { ProphetDrawer } from '../../prophet-copilot/components/ProphetDrawer';
import { MOCK_PROPHET_SUGGESTIONS } from '../mock-data';
import { useRole } from '../../../workspace/useWorkspace';
import { StatementBreadcrumb } from './StatementBreadcrumb';
import { StatementHeader } from './StatementHeader';
import { StatementStatusBanner } from './StatementStatusBanner';

type TabKey = 'synthesis' | 'transactions' | 'anomalies' | 'reconciliation' | 'report';

export interface StatementDetailPageProps {
  statementId: string;
  defaultTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
}

export function StatementDetailPage(props: StatementDetailPageProps) {
  const [tab, setTab] = useState<TabKey>(props.defaultTab ?? 'synthesis');

  // Sync URL ?tab=
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

  // === Données ===
  const { meta, loading: metaLoading } = useStatement(props.statementId);
  const { team, convention } = useStatementContext(meta?.accountId);
  const { workspace, type: workspaceType } = useWorkspace();

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

  if (metaLoading || !meta) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-ink-500">
        Chargement du relevé…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-canvas-50 overflow-hidden">
      {/* === Header sticky : breadcrumb + titre + actions + status banner + tabs === */}
      <header className="bg-white border-b border-canvas-200 px-4 sm:px-6 pt-3 pb-0 shrink-0">
        <StatementBreadcrumb
          workspaceType={workspaceType ?? 'cabinet'}
          cabinetName={workspace?.name ?? 'Cabinet'}
          clientName={meta.clientLegalName}
          accountLabel={`${meta.bankCode} pro FCFA`}
          accountNumber={meta.accountNumber}
          periodLabel={formatPeriodShort(meta.periodStart, meta.periodEnd)}
          currentUser={{
            handle: userHandle,
            displayName: userDisplayName,
            role: role ?? 'consultation',
          }}
        />
        <div className="mt-3">
          <StatementHeader
            bankCode={meta.bankCode}
            periodLabel={formatPeriodTitle(meta.periodStart, meta.periodEnd)}
            status={meta.status}
            transactionCount={meta.transactionCount}
            importedAt={meta.importedAt}
            importedBy={null}
            fileName={null}
            onPdfSource={() => window.open(`https://vgtmljfayiysuvrcmunt.supabase.co/storage/v1/object/sign/atlasbanx-pdfs/${meta.id}.pdf`, '_blank')}
            onCompare={() => alert('Comparaison de relevés à implémenter')}
            onOpenProphet={prophet.openDrawer}
          />
        </div>
        <div className="mt-3">
          <StatementStatusBanner
            status={meta.status === 'imported' ? 'analyzed' : meta.status}
            anomalies={anomaliesH.anomalies}
            onSeeAnomalies={() => changeTab('anomalies')}
            onRefreshAnalysis={() => alert('Relancer l\'analyse à implémenter')}
            onRunAnalysis={() => alert('Lancer l\'analyse à implémenter')}
          />
        </div>
        <nav className="mt-3 -mb-px">
          <ul className="flex items-center gap-1 overflow-x-auto">
            {TAB_DEFS.map((t) => {
              const isActive = tab === t.key;
              const badgeCount = t.key === 'transactions'
                ? reconH.bankTxs.length
                : t.key === 'anomalies'
                  ? anomaliesH.anomalies.filter((a) => a.status !== 'closed' && a.status !== 'false_positive').length
                  : 0;
              return (
                <li key={t.key}>
                  <button
                    onClick={() => changeTab(t.key)}
                    className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors ${
                      isActive ? 'text-ink-900 font-semibold' : 'text-ink-500 hover:text-ink-900'
                    }`}
                  >
                    <t.Icon className="w-4 h-4" />
                    {t.label}
                    {badgeCount > 0 && (
                      <span className={`px-1.5 py-0 rounded-full text-[10px] font-bold ${
                        t.key === 'anomalies' && anomaliesH.anomalies.some((a) => a.severity === 'critical' && a.status !== 'closed')
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-canvas-100 text-ink-600 border border-canvas-200'
                      }`}>
                        {badgeCount}
                      </span>
                    )}
                    {isActive && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-amber-600" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      {/* === Content === */}
      <main className="flex-1 overflow-y-auto bg-canvas-50">
        {tab === 'synthesis' && (
          <SynthesisTab
            bankTxs={reconH.bankTxs}
            anomalies={anomaliesH.anomalies}
            finalBalanceCentimes={meta.finalBalanceCentimes}
            overdraftThresholdUnits={null}
            onSeeAllCounterparties={() => changeTab('transactions')}
            prophetActions={[
              { label: 'Préparer lettre réclamation', onClick: () => changeTab('report') },
              { label: 'Comparer Ecobank', onClick: () => alert('Comparaison à implémenter') },
            ]}
          />
        )}

        {tab === 'transactions' && <TransactionsTab bankTxs={reconH.bankTxs} />}

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
                userId, handle: userHandle, role,
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
            onSignAndSend={async (args) => { await reportH.signAndSend(args); }}
            onGenerateComplaintLetter={(ids) => void reportH.generateComplaintLetter(ids)}
          />
        )}
      </main>

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
  { key: 'reconciliation', label: 'Rapprochement',  Icon: Scale },
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
    if (parts.length >= 2) return parts[0] + parts[1][0].toUpperCase();
    return parts[0];
  }
  if (email) return email.split('@')[0];
  return 'user';
}

function formatPeriodTitle(start: string, end: string): string {
  // "10 fév → 08 mai 2026"
  const months = ['janv', 'fév', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  const ds = new Date(start);
  const de = new Date(end);
  return `${ds.getDate()} ${months[ds.getMonth()]} → ${String(de.getDate()).padStart(2, '0')} ${months[de.getMonth()]} ${de.getFullYear()}`;
}

function formatPeriodShort(start: string, end: string): string {
  const months = ['janv', 'fév', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  const ds = new Date(start);
  const de = new Date(end);
  return `${months[ds.getMonth()]} → ${months[de.getMonth()]} ${de.getFullYear()}`;
}
