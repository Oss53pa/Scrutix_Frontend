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
    <div className="min-h-screen flex flex-col bg-[#fafafa]">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-8 py-4">
        <p className="text-xs sm:text-sm text-primary-400 truncate">
          {isEnterprise ? 'Votre entreprise' : "Cabinet d'expertise comptable"} — <span className="text-primary-500">AtlasBanx Pro</span>
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-xs sm:text-sm text-primary-600 hover:text-primary-900 transition-colors cursor-pointer shrink-0"
        >
          <span className="hidden sm:inline">Tableau de bord</span>
          <span className="sm:hidden">Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content - Centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
        {/* Hero Title */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl text-primary-900 mb-3">
            AtlasBanx
          </h1>
          <p className="text-base sm:text-lg text-primary-400 italic px-4">
            {isEnterprise
              ? 'Audit bancaire intelligent pour votre entreprise'
              : "Audit bancaire intelligent pour cabinets d'expertise comptable"}
          </p>
        </div>

        {/* Stats Row - Grid on mobile, divided row on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-center lg:justify-center gap-6 lg:gap-0 mb-12 sm:mb-16 w-full max-w-4xl">
          {isEnterprise ? (
            <StatItem value={totalAccounts} label="Comptes bancaires" />
          ) : (
            <StatItem value={clients.length} label="Clients" />
          )}
          <div className="hidden lg:block w-px h-12 bg-primary-200 mx-6 xl:mx-8"></div>
          <StatItem value={transactions.length} label="Transactions" />
          <div className="hidden lg:block w-px h-12 bg-primary-200 mx-6 xl:mx-8"></div>
          <StatItem value={anomalies.length} label="Anomalies" />
          <div className="hidden lg:block w-px h-12 bg-primary-200 mx-6 xl:mx-8"></div>
          <StatItem value={`${completionRate}%`} label="Taux de détection" />
          <div className="hidden lg:block w-px h-12 bg-primary-200 mx-6 xl:mx-8"></div>
          <StatItem
            value={savings > 0 ? `${(savings / 1000).toFixed(0)}K` : '0'}
            label="Économies (FCFA)"
          />
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-4 px-4 sm:px-6 pb-6">
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
      <footer className="text-center pb-4">
        <p className="text-xs text-primary-300">Developed by Atlas Studio</p>
      </footer>
    </div>
  );
}

// Stat Item - Large number + small label
function StatItem({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-bold text-primary-900 tabular-nums">{value}</p>
      <p className="text-xs text-primary-400 mt-1">{label}</p>
    </div>
  );
}

// Bottom Nav Button - Pill style with icon
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
      className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-primary-100 hover:bg-primary-200 rounded-full text-xs sm:text-sm text-primary-700 transition-colors cursor-pointer"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
