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
import { useAuthStore } from '../../../store/authStore';
import { useStatement } from '../hooks/useStatement';
import { useAnomalies } from '../hooks/useAnomalies';
import { useReconciliation } from '../hooks/useReconciliation';
import { useReportGeneration } from '../hooks/useReportGeneration';
import { useStatementContext } from '../hooks/useStatementContext';
import { useProphetChat } from '../hooks/useProphetChat';
import { useStatementAnalysis } from '../hooks/useStatementAnalysis';
import { useWorkspace, useRole } from '../../../workspace/useWorkspace';
import { AnalysisTab } from '../components/AnalysisTab';
import { AnomaliesTab } from '../components/AnomaliesTab/AnomaliesTab';
import { ReconciliationTab } from '../components/ReconciliationTab/ReconciliationTab';
import { ReportTab } from '../components/ReportTab/ReportTab';
import { SynthesisTab } from '../components/SynthesisTab';
import { TransactionsTab } from '../components/TransactionsTab';
import { ProphetDrawer } from '../../prophet-copilot/components/ProphetDrawer';
import { CompareStatementModal } from '../components/CompareStatementModal';
import { MOCK_PROPHET_SUGGESTIONS } from '../mock-data';
import { StatementBreadcrumb } from '../components/StatementBreadcrumb';
import { StatementHeader } from '../components/StatementHeader';
import { StatementStatusBanner } from '../components/StatementStatusBanner';
import { TabsBar, type StatementTabKey, STATEMENT_TAB_KEYS } from '../components/TabsBar';
import { getSupabaseClient, isSupabaseConfigured } from '../../../lib/supabase';
import { BANK_DIRECTORY } from '../data/bankDirectory';

type TabKey = StatementTabKey;

export interface StatementDetailPageProps {
  statementId: string;
  defaultTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
}

export function StatementDetailPage(props: StatementDetailPageProps) {
  const [tab, setTab] = useState<TabKey>(props.defaultTab ?? 'synthesis');
  const [compareOpen, setCompareOpen] = useState(false);

  // Sync URL ?tab=
  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get('tab') as TabKey | null;
    if (t && (STATEMENT_TAB_KEYS as TabKey[]).includes(t)) setTab(t);
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
  const prophet = useProphetChat({
    statementId: props.statementId,
    userId,
    contextLabel: meta
      ? `relevé ${meta.bankCode} · ${formatPeriodShort(meta.periodStart, meta.periodEnd)}`
      : 'relevé chargement…',
    transactions: reconH.bankTxs,
    anomalies: anomaliesH.anomalies,
  });

  // === Analyse ===
  const analysisMeta = useMemo(() => meta ? {
    clientId: meta.clientId,
    accountNumber: meta.accountNumber,
    bankCode: meta.bankCode,
  } : undefined, [meta]);
  const analysis = useStatementAnalysis(props.statementId, analysisMeta);

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
            onPdfSource={() => openPdfSource(meta.id)}
            onCompare={() => setCompareOpen(true)}
            onOpenProphet={prophet.openDrawer}
          />
        </div>
        <div className="mt-3">
          <StatementStatusBanner
            status={meta.status === 'imported' ? 'analyzed' : meta.status}
            anomalies={anomaliesH.anomalies}
            onSeeAnomalies={() => changeTab('anomalies')}
            onRefreshAnalysis={() => void analysis.run(reconH.bankTxs)}
            onRunAnalysis={() => void analysis.run(reconH.bankTxs)}
          />
        </div>
        <div className="mt-3 -mb-px">
          <TabsBar
            active={tab}
            onChange={changeTab}
            badges={{
              transactions: { count: reconH.bankTxs.length, variant: 'neutral' },
              anomalies: {
                count: anomaliesH.anomalies.filter((a) => a.status !== 'closed' && a.status !== 'false_positive').length,
                variant: anomaliesH.anomalies.some((a) => a.severity === 'critical' && a.status !== 'closed')
                  ? 'danger' : 'neutral',
              },
            }}
          />
        </div>
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

        {tab === 'analysis' && (
          <AnalysisTab
            statementId={props.statementId}
            bankTxs={reconH.bankTxs}
            meta={analysisMeta}
            statementStatus={meta.status}
          />
        )}

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
            onImportFromAtlasFinance={() => {
              // Atlas Finance n'est pas encore connecté — toast informatif
              if (typeof window !== 'undefined') {
                const ev = new CustomEvent('atlas-toast', {
                  detail: { message: 'Atlas Finance n\'est pas encore connecté. Utilisez l\'import fichier.', variant: 'info' },
                });
                window.dispatchEvent(ev);
              }
            }}
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
            loading={reportH.loading}
            error={reportH.error}
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

      <CompareStatementModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        currentStatementId={meta.id}
        accountId={meta.accountId}
        bankCode={meta.bankCode}
        onSelect={(id) => {
          // Navigate to the compared statement
          const url = new URL(window.location.href);
          const segments = url.pathname.split('/');
          const releveIdx = segments.findIndex((s) => s === 'releves');
          if (releveIdx >= 0 && releveIdx + 1 < segments.length) {
            segments[releveIdx + 1] = id;
            url.pathname = segments.join('/');
          }
          window.location.href = url.toString();
        }}
      />
    </div>
  );
}

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

async function openPdfSource(statementId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient()!;
    const path = `${statementId}.pdf`;
    const { data, error } = await sb.storage
      .from('atlasbanx-pdfs')
      .createSignedUrl(path, 300); // 5 minutes
    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
      return;
    }
    // Fallback: essai avec le nom alternatif
    const { data: d2 } = await sb.storage
      .from('atlasbanx-pdfs')
      .createSignedUrl(`statements/${path}`, 300);
    if (d2?.signedUrl) {
      window.open(d2.signedUrl, '_blank');
      return;
    }
  }
  // Fallback offline : pas de PDF disponible
  if (typeof window !== 'undefined') {
    const ev = new CustomEvent('atlas-toast', {
      detail: { message: 'PDF source non disponible (Supabase non connecté).', variant: 'warning' },
    });
    window.dispatchEvent(ev);
  }
}

/** Parse ISO date string as UTC to avoid timezone shifts. */
function parseUTC(iso: string): Date {
  // "2026-02-10" → force UTC interpretation (avoid local-time shift)
  const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00Z'));
  return isNaN(d.getTime()) ? new Date(iso) : d;
}

function formatPeriodTitle(start: string, end: string): string {
  // "10 fev → 08 mai 2026"
  const months = ['janv', 'fev', 'mars', 'avr', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'dec'];
  const ds = parseUTC(start);
  const de = parseUTC(end);
  return `${ds.getUTCDate()} ${months[ds.getUTCMonth()]} → ${String(de.getUTCDate()).padStart(2, '0')} ${months[de.getUTCMonth()]} ${de.getUTCFullYear()}`;
}

function formatPeriodShort(start: string, end: string): string {
  const months = ['janv', 'fev', 'mars', 'avr', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'dec'];
  const ds = parseUTC(start);
  const de = parseUTC(end);
  return `${months[ds.getUTCMonth()]} → ${months[de.getUTCMonth()]} ${de.getUTCFullYear()}`;
}
