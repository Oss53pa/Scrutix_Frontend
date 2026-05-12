import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FolderOpen,
  Landmark,
  Settings,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  FileBarChart,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Building2,
  Bot,
  ShieldCheck,
} from 'lucide-react';
import { useTransactionStore } from '../../store/transactionStore';
import { useClientStore } from '../../store/clientStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { useBankStore } from '../../store/bankStore';
import { useAuthStore } from '../../store/authStore';
import { useAccountType } from '../../hooks/useAccountType';
import { formatCurrency, formatNumber } from '../../utils';

// ===========================================================================
// AtlasBanx — Cockpit-style home page
// ===========================================================================
// Layout:
//   1. Top bar (org left · period + AI status + Dashboard right)
//   2. Hero (eyebrow · script wordmark · tagline)
//   3. KPI row (4 cards with trend arrows)
//   4. Progress + Proph3t IA (split row)
//   5. ACCÈS RAPIDE (6 quick-action cards)
//   6. Footer
// ===========================================================================

export function HomePage() {
  const navigate = useNavigate();
  const { isEnterprise } = useAccountType();
  const { transactions } = useTransactionStore();
  const { clients, statements } = useClientStore();
  const { banks } = useBankStore();
  const { currentAnalysis, getTotalPotentialSavings } = useAnalysisStore();
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);

  // ─── Identity ───────────────────────────────────────────────────────────
  const orgName = useMemo(() => {
    if (isEnterprise && clients[0]?.name) return clients[0].name;
    if (profile?.full_name) return profile.full_name;
    if (user?.email) return user.email.split('@')[0];
    return 'AtlasBanx';
  }, [isEnterprise, clients, profile, user]);

  const orgSubtitle = isEnterprise ? 'Trésorerie' : 'Cabinet d\'audit';

  // ─── Period ─────────────────────────────────────────────────────────────
  const now = new Date();
  const periodLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const yearLabel = now.getFullYear().toString();

  // ─── KPIs ───────────────────────────────────────────────────────────────
  const totalAccounts = clients.reduce((sum, c) => sum + c.accounts.length, 0);
  const anomalies = currentAnalysis?.anomalies ?? [];
  const criticalAnomalies = anomalies.filter((a) => a.severity === 'CRITICAL').length;
  const savings = getTotalPotentialSavings();
  const auditedBanks = useMemo(() => {
    const codes = new Set<string>();
    for (const c of clients) for (const a of c.accounts) codes.add(a.bankCode);
    return codes.size;
  }, [clients]);
  const transactionVolume = transactions.reduce((s, t) => s + Math.abs(t.amount), 0);

  // ─── Audit coverage (= % of imported statements that have been analyzed) ─
  const totalStatements = statements.length;
  const analyzedStatements = statements.filter((s) => s.status === 'analyzed').length;
  const pendingStatements = statements.filter((s) => s.status === 'imported').length;
  const auditCoverage = totalStatements === 0
    ? 0
    : Math.round((analyzedStatements / totalStatements) * 100);

  // ─── Period status indicator ────────────────────────────────────────────
  const auditStatus: 'idle' | 'in-progress' | 'done' =
    currentAnalysis?.status === 'RUNNING' ? 'in-progress'
    : anomalies.length > 0 ? 'done'
    : 'idle';

  return (
    <div className="relative min-h-screen flex flex-col bg-canvas-100 overflow-hidden">
      {/* Ambient background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-24 h-[520px] w-[520px] rounded-full bg-accent-200/30 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-[480px] w-[480px] rounded-full bg-ink-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-[420px] w-[420px] rounded-full bg-accent-100/40 blur-3xl" />
      </div>

      {/* ─── TOP BAR ─── */}
      <header className="flex items-center justify-between gap-3 px-6 sm:px-10 lg:px-14 pt-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-ink-900 flex items-center justify-center text-accent-300 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-ink-900 font-semibold uppercase tracking-[0.16em] truncate">
              {orgName}
            </p>
            <p className="text-[10px] text-ink-500 truncate">{orgSubtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <Chip>
            <Calendar className="w-3 h-3 text-ink-500" />
            <span className="text-[11px] text-ink-600">Exercice</span>
            <span className="text-[11px] font-bold text-ink-900 tabular-nums">{yearLabel}</span>
          </Chip>
          <Chip>
            <span className={`w-1.5 h-1.5 rounded-full ${
              auditStatus === 'in-progress' ? 'bg-amber-500 animate-pulse'
              : auditStatus === 'done' ? 'bg-emerald-500'
              : 'bg-ink-300'
            }`} />
            <span className="text-[11px] text-ink-700 font-medium">Proph3t</span>
          </Chip>
          <button
            onClick={() => navigate('/landing')}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white/70 backdrop-blur border border-primary-200/60 hover:border-accent-400/60 hover:bg-white text-[11px] text-ink-700 hover:text-ink-900 transition-all"
          >
            <Compass className="w-3 h-3" />
            Découvrir
            <ArrowUpRight className="w-3 h-3" />
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-pill bg-ink-900 text-white hover:bg-ink-800 text-xs font-semibold shadow-card hover:shadow-card-hover transition-all"
          >
            Dashboard
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <div className="flex flex-col items-center text-center px-4 sm:px-6 pt-12 sm:pt-16">
        <div className="flex items-center gap-2 mb-3 animate-fade-in-up">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
          <p className="text-[11px] text-ink-600 uppercase tracking-[0.22em]">
            Bienvenue · {periodLabel}
          </p>
        </div>

        <h1
          className="font-display font-normal text-5xl sm:text-6xl md:text-[6rem] leading-[0.95] tracking-tight mb-3 animate-fade-in-up"
          style={{
            animationDelay: '60ms',
            animationFillMode: 'backwards',
            fontSynthesis: 'none', // Grand Hotel has no bold — block fake-bolding
          }}
        >
          <span className="text-gradient-ink">Atlas</span>
          <span className="text-gradient-gold">Banx</span>
        </h1>

        <p
          className="max-w-2xl text-sm sm:text-base text-ink-600 leading-relaxed animate-fade-in-up"
          style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}
        >
          Audit bancaire intelligent <strong className="text-ink-900">CEMAC · UEMOA</strong>.
          Détection des anomalies tarifaires, calcul des agios, contrôle des dates de valeur,
          réconciliation par grille en temps réel.
        </p>
      </div>

      {/* ─── KPI ROW ─── */}
      <div className="px-6 sm:px-10 lg:px-14 mt-12 sm:mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          eyebrow="Récupérable estimé"
          value={savings > 0 ? formatCurrency(savings, 'XAF') : '—'}
          subline={savings > 0
            ? `Sur ${anomalies.length} anomalie${anomalies.length > 1 ? 's' : ''} (hors LCB-FT)`
            : 'Lance une analyse pour voir les écarts'}
          accent
          delay={140}
          // Drill-down vers la liste clients : l'analyse vit dans la page
          // relevé (Client → Banque → Compte → Relevé → onglet Analyse).
          onClick={() => navigate('/clients')}
        />
        <KpiCard
          eyebrow="Anomalies"
          value={formatNumber(anomalies.length)}
          subline={criticalAnomalies > 0
            ? `${criticalAnomalies} critique${criticalAnomalies > 1 ? 's' : ''}`
            : anomalies.length > 0 ? 'Aucune critique' : 'Conformité totale'}
          tone={criticalAnomalies > 0 ? 'warn' : 'ok'}
          delay={180}
          onClick={() => navigate('/clients')}
        />
        <KpiCard
          eyebrow="Banques auditées"
          value={auditedBanks.toString()}
          subline={`${totalAccounts} compte${totalAccounts > 1 ? 's' : ''} sous surveillance`}
          delay={220}
          onClick={() => navigate('/banks')}
        />
        <KpiCard
          eyebrow="Transactions analysées"
          value={formatNumber(transactions.length)}
          subline={transactionVolume > 0
            ? `${formatCurrency(transactionVolume, 'XAF')} volume`
            : 'Aucun relevé importé'}
          delay={260}
          onClick={() => navigate('/import')}
        />
      </div>

      {/* ─── PROGRESS + AI ─── */}
      <div className="px-6 sm:px-10 lg:px-14 mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Audit coverage card — % of imported statements analyzed */}
        <div className="lg:col-span-2 rounded-2xl border border-primary-200/60 bg-white/70 backdrop-blur-xl shadow-card p-6">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-500 font-semibold">
                Couverture d'audit
              </p>
              <p className="text-2xl font-bold text-ink-900 mt-1">
                {analyzedStatements} <span className="text-ink-400">/</span> {totalStatements}{' '}
                <span className="text-base text-ink-500 font-medium">relevé{totalStatements > 1 ? 's' : ''} analysé{analyzedStatements > 1 ? 's' : ''}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-ink-900 tabular-nums">
                {auditCoverage}<span className="text-base text-ink-400 ml-0.5">%</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-ink-500 mt-0.5">Couverts</p>
            </div>
          </div>

          <div className="h-2 bg-canvas-200/70 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-ink-900 via-accent-500 to-accent-300 transition-all duration-1000"
              style={{ width: `${auditCoverage}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-4 text-[11px] text-ink-500">
            <span>
              {pendingStatements > 0 ? (
                <>
                  <span className="text-amber-700 font-medium">{pendingStatements}</span> relevé{pendingStatements > 1 ? 's' : ''} en attente
                </>
              ) : totalStatements > 0 ? (
                <span className="text-emerald-700 font-medium">Tous les relevés ont été analysés</span>
              ) : (
                'Aucun relevé importé pour le moment'
              )}
              {totalAccounts > 0 && (
                <>
                  {' · '}
                  <span className="text-ink-700 font-medium">
                    {totalAccounts} compte{totalAccounts > 1 ? 's' : ''} sous surveillance
                  </span>
                </>
              )}
            </span>
            <button
              onClick={() => navigate('/clients')}
              className="font-medium text-ink-700 hover:text-accent-700 inline-flex items-center gap-1"
              disabled={pendingStatements === 0}
            >
              {pendingStatements > 0 ? 'Lancer une analyse' : 'Voir les analyses'}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Proph3t AI card */}
        <button
          onClick={() => navigate('/intelligence')}
          className="group rounded-2xl border border-primary-200/60 bg-gradient-to-br from-ink-900 to-ink-800 text-white shadow-card p-6 text-left hover:shadow-card-hover transition-all relative overflow-hidden"
        >
          <div aria-hidden="true" className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-accent-500/20 blur-2xl group-hover:bg-accent-500/30 transition-all" />
          <div className="flex items-start justify-between gap-3 mb-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-accent-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-accent-300" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-white/60 group-hover:text-accent-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-accent-300 font-semibold relative z-10">
            Proph3t · Assistant IA
          </p>
          <p className="!text-white text-base font-semibold mt-1 relative z-10">
            Analyse, commente et anticipe vos écarts.
          </p>
          <p className="text-xs text-white/70 mt-1.5 relative z-10">
            Multi-agents Claude · BCEAO · COBAC
          </p>
        </button>
      </div>

      {/* ─── ACCÈS RAPIDE ─── */}
      <div className="px-6 sm:px-10 lg:px-14 mt-10">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-500 font-semibold mb-3">
          Accès rapide
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Workflow order: 1) Banques · 2) Clients · 3) Import · 4) Analyses · 5) Rapports · 6) Paramètres */}
          <QuickCard
            icon={<Landmark className="w-4 h-4" />}
            iconBg="bg-blue-50 text-blue-700"
            title="Banques"
            subtitle="Conditions tarifaires"
            onClick={() => navigate('/banks')}
          />
          <QuickCard
            icon={<Building2 className="w-4 h-4" />}
            iconBg="bg-violet-50 text-violet-700"
            title={isEnterprise ? 'Comptes' : 'Clients'}
            subtitle={
              isEnterprise
                ? `${totalAccounts} compte${totalAccounts > 1 ? 's' : ''}`
                : `${clients.length} dossier${clients.length > 1 ? 's' : ''}`
            }
            onClick={() => navigate('/clients')}
          />
          <QuickCard
            icon={<Upload className="w-4 h-4" />}
            iconBg="bg-amber-50 text-amber-700"
            title="Imports"
            subtitle="Relevés · GL · Tiers"
            onClick={() => navigate('/import')}
          />
          <QuickCard
            icon={<FolderOpen className="w-4 h-4" />}
            iconBg="bg-emerald-50 text-emerald-700"
            title="Analyses"
            subtitle="Via Clients → Relevé"
            onClick={() => navigate('/clients')}
          />
          <QuickCard
            icon={<FileBarChart className="w-4 h-4" />}
            iconBg="bg-rose-50 text-rose-700"
            title="Rapports"
            subtitle="PDF & Excel"
            onClick={() => navigate('/reports')}
          />
          <QuickCard
            icon={<Settings className="w-4 h-4" />}
            iconBg="bg-canvas-200 text-ink-700"
            title="Paramètres"
            subtitle="Cabinet · IA · Sécurité"
            onClick={() => navigate('/settings')}
          />
        </div>
      </div>

      {/* ─── FOOTER ─── */}
      <footer className="mt-12 pb-6 px-6 sm:px-10 lg:px-14">
        <div className="flex flex-col items-center gap-2">
          <div className="gold-rule max-w-[140px]" />
          <p className="text-[10px] text-ink-500 uppercase tracking-[0.2em]">
            AtlasBanx · CEMAC · UEMOA · {yearLabel}
          </p>
          <p className="text-[10px] text-ink-400">
            Une application <span className="text-ink-700 font-semibold">Atlas Studio</span>
          </p>
        </div>
      </footer>

      {/* Floating AI button (matches the screenshot's pill at the bottom) */}
      <button
        onClick={() => navigate('/intelligence')}
        aria-label="Ouvrir l'assistant IA"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-ink-900 text-white shadow-elevation-3 hover:scale-105 hover:shadow-elevation-4 transition-all flex items-center justify-center group"
      >
        <Bot className="w-5 h-5 group-hover:text-accent-300 transition-colors" />
      </button>
    </div>
  );
}

// ===========================================================================
// SUB-COMPONENTS
// ===========================================================================

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white/70 backdrop-blur border border-primary-200/60">
      {children}
    </div>
  );
}

interface KpiCardProps {
  eyebrow: string;
  value: string;
  subline: string;
  accent?: boolean;
  tone?: 'ok' | 'warn';
  delay?: number;
  onClick: () => void;
}

function KpiCard({ eyebrow, value, subline, accent, tone, delay = 0, onClick }: KpiCardProps) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
      className="group text-left rounded-2xl border border-primary-200/60 bg-white/70 backdrop-blur-xl shadow-card hover:shadow-card-hover hover:border-accent-300 transition-all p-5 animate-fade-in-up relative overflow-hidden"
    >
      {/* Accent stripe */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${
        accent ? 'bg-gradient-to-r from-accent-500 via-accent-300 to-transparent'
        : tone === 'warn' ? 'bg-gradient-to-r from-red-500 via-amber-400 to-transparent'
        : tone === 'ok' ? 'bg-gradient-to-r from-emerald-500 via-emerald-300 to-transparent'
        : 'bg-gradient-to-r from-ink-700 via-ink-400 to-transparent'
      }`} />

      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-ink-500 font-semibold leading-tight">
          {eyebrow}
        </p>
        <ArrowUpRight className="w-4 h-4 text-ink-300 group-hover:text-accent-600 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
      </div>

      <p className={`text-2xl sm:text-3xl font-bold tabular-nums tracking-tight leading-none ${
        accent ? 'text-gradient-gold' : 'text-ink-900'
      }`}>
        {value}
      </p>

      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-ink-500">
        {tone === 'warn' && <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
        {tone === 'ok' && <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
        <span className="truncate">{subline}</span>
      </div>
    </button>
  );
}

interface QuickCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}

function QuickCard({ icon, iconBg, title, subtitle, onClick }: QuickCardProps) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl border border-primary-200/60 bg-white/70 backdrop-blur hover:bg-white hover:border-accent-300 hover:shadow-card transition-all p-4"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${iconBg}`}>
        {icon}
      </div>
      <p className="text-sm font-semibold text-ink-900 leading-tight">{title}</p>
      <p className="text-[11px] text-ink-500 mt-0.5 truncate">{subtitle}</p>
    </button>
  );
}
