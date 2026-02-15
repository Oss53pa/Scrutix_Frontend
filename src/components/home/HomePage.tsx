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

export function HomePage() {
  const navigate = useNavigate();
  const { transactions } = useTransactionStore();
  const { clients } = useClientStore();
  const { currentAnalysis, getTotalPotentialSavings } = useAnalysisStore();

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
      <header className="flex items-center justify-between px-8 py-4">
        <p className="text-sm text-primary-400">
          Cabinet d'expertise comptable — <span className="text-primary-500">Scrutix Pro</span>
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-900 transition-colors cursor-pointer"
        >
          Tableau de bord <ArrowRight className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content - Centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Hero Title */}
        <div className="text-center mb-12">
          <h1 className="font-display text-7xl text-primary-900 mb-3">
            Scrutix
          </h1>
          <p className="text-lg text-primary-400 italic">
            Audit bancaire intelligent pour cabinets d'expertise comptable
          </p>
        </div>

        {/* Stats Row with Dividers */}
        <div className="flex items-center justify-center mb-16">
          <StatItem value={clients.length} label="Clients" />
          <div className="w-px h-12 bg-primary-200 mx-8"></div>
          <StatItem value={transactions.length} label="Transactions" />
          <div className="w-px h-12 bg-primary-200 mx-8"></div>
          <StatItem value={anomalies.length} label="Anomalies" />
          <div className="w-px h-12 bg-primary-200 mx-8"></div>
          <StatItem value={`${completionRate}%`} label="Taux de détection" />
          <div className="w-px h-12 bg-primary-200 mx-8"></div>
          <StatItem
            value={savings > 0 ? `${(savings / 1000).toFixed(0)}K` : '0'}
            label="Économies (FCFA)"
          />
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-center gap-4 px-6 pb-6">
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
      className="flex items-center gap-2 px-5 py-2.5 bg-primary-100 hover:bg-primary-200 rounded-full text-sm text-primary-700 transition-colors cursor-pointer"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
