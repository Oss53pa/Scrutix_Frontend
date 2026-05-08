import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  FolderOpen,
  Landmark,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { useTransactionStore } from '../../store/transactionStore';
import { useClientStore } from '../../store/clientStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { useAccountType } from '../../hooks/useAccountType';

export function HomePage() {
  const navigate = useNavigate();
  const { isEnterprise } = useAccountType();
  const { transactions } = useTransactionStore();
  const { clients } = useClientStore();
  const { currentAnalysis, getTotalPotentialSavings } = useAnalysisStore();

  // Enterprise mode: count bank accounts across the self client
  const totalAccounts = clients.reduce((sum, c) => sum + c.accounts.length, 0);

  const anomalies = currentAnalysis?.anomalies || [];
  const totalAnalyses = clients.length + transactions.length;
  const completedAnalyses = anomalies.length;
  const completionRate = totalAnalyses > 0
    ? ((completedAnalyses / totalAnalyses) * 100).toFixed(1)
    : '0';
  const savings = getTotalPotentialSavings();

  return (
    <div className="relative min-h-screen flex flex-col bg-canvas-100 overflow-hidden">
      {/* Ambient background — premium banking ambience */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-24 h-[520px] w-[520px] rounded-full bg-accent-200/40 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-[480px] w-[480px] rounded-full bg-ink-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-[420px] w-[420px] rounded-full bg-accent-100/50 blur-3xl" />
      </div>

      {/* Top Bar */}
      <header className="flex items-center justify-between gap-3 px-6 sm:px-10 lg:px-14 pt-6">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-500 shrink-0" />
          <p className="text-[11px] sm:text-xs text-ink-500 uppercase tracking-[0.18em] truncate">
            {isEnterprise ? 'Votre entreprise' : "Cabinet d'expertise comptable"}
            <span className="mx-2 text-ink-300">•</span>
            <span className="text-ink-700 font-semibold">AtlasBanx Pro</span>
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="group flex items-center gap-2 px-4 py-2 rounded-pill bg-white/70 backdrop-blur border border-primary-200/60 hover:border-accent-400/60 hover:bg-white transition-all duration-300 ease-premium shadow-card hover:shadow-card-hover shrink-0"
        >
          <span className="hidden sm:inline text-xs font-medium text-ink-700 group-hover:text-ink-900">
            Tableau de bord
          </span>
          <span className="sm:hidden text-xs font-medium text-ink-700">Dashboard</span>
          <ArrowRight className="w-3.5 h-3.5 text-ink-500 group-hover:text-accent-600 group-hover:translate-x-0.5 transition-all" />
        </button>
      </header>

      {/* Main Content - Centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
        {/* Hero Title */}
        <div className="text-center mb-12 sm:mb-16 animate-fade-in-up">
          <p className="page-eyebrow mb-5 sm:mb-6">Audit bancaire intelligent</p>
          <h1 className="font-display text-6xl sm:text-7xl md:text-[7.5rem] text-ink-900 mb-4 sm:mb-5 leading-[0.95] tracking-tight">
            <span className="text-gradient-ink">Atlas</span><span className="text-gradient-gold">Banx</span>
          </h1>
          <div className="flex items-center justify-center gap-4 mb-5">
            <span className="h-px w-10 sm:w-16 bg-gradient-to-r from-transparent to-accent-400/60" />
            <p className="font-serif italic text-base sm:text-lg text-ink-600 px-2 tracking-tight">
              {isEnterprise
                ? 'L\'excellence au service de votre trésorerie'
                : "L'excellence au service de l'expertise comptable"}
            </p>
            <span className="h-px w-10 sm:w-16 bg-gradient-to-l from-transparent to-accent-400/60" />
          </div>
          <p className="text-xs sm:text-sm text-ink-400 tracking-wide">
            CEMAC <span className="mx-2">·</span> UEMOA <span className="mx-2">·</span> XAF
          </p>
        </div>

        {/* Stats Row — premium glass card */}
        <div
          className="w-full max-w-5xl rounded-2xl border border-primary-200/60 bg-white/60 backdrop-blur-xl shadow-elevated px-6 sm:px-10 py-6 sm:py-8 mb-12 sm:mb-16 animate-fade-in-up"
          style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 lg:gap-0 lg:flex lg:items-center lg:justify-between">
            {isEnterprise ? (
              <StatItem value={totalAccounts} label="Comptes bancaires" />
            ) : (
              <StatItem value={clients.length} label="Clients" />
            )}
            <Divider />
            <StatItem value={transactions.length} label="Transactions" />
            <Divider />
            <StatItem value={anomalies.length} label="Anomalies" highlight={anomalies.length > 0} />
            <Divider />
            <StatItem value={`${completionRate}%`} label="Taux de détection" />
            <Divider />
            <StatItem
              value={savings > 0 ? `${(savings / 1000).toFixed(0)}K` : '0'}
              label="Économies (FCFA)"
              accent
            />
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-3 px-4 sm:px-6 pb-8">
        <NavButton
          icon={<LayoutDashboard className="w-4 h-4" />}
          label="Tableau de bord"
          onClick={() => navigate('/dashboard')}
        />
        <NavButton
          icon={<Upload className="w-4 h-4" />}
          label="Importer"
          onClick={() => navigate('/import')}
        />
        <NavButton
          icon={<FolderOpen className="w-4 h-4" />}
          label="Analyses"
          onClick={() => navigate('/analyses')}
        />
        <NavButton
          icon={<Landmark className="w-4 h-4" />}
          label="Banques"
          onClick={() => navigate('/banks')}
        />
        <NavButton
          icon={<Settings className="w-4 h-4" />}
          label="Paramètres"
          onClick={() => navigate('/settings')}
        />
      </div>

      {/* Footer */}
      <footer className="text-center pb-5">
        <div className="gold-rule max-w-[120px] mx-auto mb-3" />
        <p className="text-[10px] text-ink-400 uppercase tracking-[0.2em]">
          Developed by <span className="text-ink-600 font-semibold">Atlas Studio</span>
        </p>
      </footer>
    </div>
  );
}

function Divider() {
  return (
    <div
      aria-hidden="true"
      className="hidden lg:block w-px h-12 bg-gradient-to-b from-transparent via-primary-300/60 to-transparent"
    />
  );
}

function StatItem({
  value,
  label,
  accent = false,
  highlight = false,
}: {
  value: number | string;
  label: string;
  accent?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <p
        className={`text-3xl sm:text-4xl font-bold tabular-nums tracking-tight ${
          accent ? 'text-gradient-gold' : highlight ? 'text-ink-900' : 'text-ink-900'
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-[10px] sm:text-[11px] font-semibold text-ink-500 uppercase tracking-[0.14em]">
        {label}
      </p>
    </div>
  );
}

function NavButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-white/60 hover:bg-white backdrop-blur border border-primary-200/60 hover:border-accent-400/50 rounded-pill text-xs sm:text-sm text-ink-700 hover:text-ink-900 transition-all duration-300 ease-premium shadow-[0_1px_2px_rgb(15_14_10/0.04)] hover:shadow-card cursor-pointer"
    >
      <span className="text-ink-500 group-hover:text-accent-600 transition-colors">{icon}</span>
      <span className="font-medium tracking-tight">{label}</span>
    </button>
  );
}
