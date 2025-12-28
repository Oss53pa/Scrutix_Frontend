import { useNavigate } from 'react-router-dom';
import {
  Search,
  FileText,
  TrendingUp,
  ArrowRight,
  Landmark,
  Users,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Upload,
} from 'lucide-react';
import { useTransactionStore } from '../../store/transactionStore';
import { useClientStore } from '../../store/clientStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { ScrutixLogo, ScrutixIcon } from '../ui';

export function HomePage() {
  const navigate = useNavigate();
  const { transactions } = useTransactionStore();
  const { clients } = useClientStore();
  const { currentAnalysis, getTotalPotentialSavings } = useAnalysisStore();

  const hasData = clients.length > 0 || transactions.length > 0;
  const anomalies = currentAnalysis?.anomalies || [];

  const stats = {
    clients: clients.length,
    transactions: transactions.length,
    anomalies: anomalies.length,
    savings: getTotalPotentialSavings(),
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-gradient-to-br from-primary-50 to-white">
      {/* Main Content - Full Width */}
      <div className="flex-1 flex flex-col justify-center p-6 lg:p-10 overflow-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <ScrutixLogo size="xl" />
          </div>
          <p className="text-xl text-primary-600">
            Audit bancaire intelligent pour cabinets d'expertise comptable
          </p>
          <div className="flex items-center justify-center gap-6 mt-5">
            <span className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-base text-blue-700 border border-blue-200">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              CEMAC (XAF)
            </span>
            <span className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full text-base text-green-700 border border-green-200">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
              UEMOA (XOF)
            </span>
          </div>
        </div>

        {/* Quick Stats - Only show if has data */}
        {hasData && (
          <div className="grid grid-cols-4 gap-6 mb-12 max-w-4xl mx-auto w-full">
            <StatCard icon={<Users className="w-6 h-6" />} value={stats.clients} label="Clients" color="blue" />
            <StatCard icon={<FileText className="w-6 h-6" />} value={stats.transactions} label="Transactions" color="green" />
            <StatCard icon={<AlertTriangle className="w-6 h-6" />} value={stats.anomalies} label="Anomalies" color="amber" />
            <StatCard icon={<TrendingUp className="w-6 h-6" />} value={`${(stats.savings / 1000).toFixed(0)}K`} label="Économies" color="emerald" />
          </div>
        )}

        {/* Action Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12 max-w-5xl mx-auto w-full">
          <ActionCard icon={<Upload className="w-10 h-10" />} title="Importer" description="Relevés bancaires" onClick={() => navigate('/import')} color="blue" primary={!hasData} />
          <ActionCard icon={<Search className="w-10 h-10" />} title="Analyser" description="Détecter les anomalies" onClick={() => navigate('/analyses')} color="emerald" primary={hasData} />
          <ActionCard icon={<Landmark className="w-10 h-10" />} title="Banques" description="Conditions tarifaires" onClick={() => navigate('/banks')} color="violet" />
          <ActionCard icon={<BarChart3 className="w-10 h-10" />} title="Dashboard" description="Vue d'ensemble" onClick={() => navigate('/dashboard')} color="orange" />
        </div>

        {/* Features Tags */}
        <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto">
          <FeatureTag icon={<CheckCircle2 className="w-5 h-5" />} text="Doublons" />
          <FeatureTag icon={<CheckCircle2 className="w-5 h-5" />} text="Frais fantômes" />
          <FeatureTag icon={<CheckCircle2 className="w-5 h-5" />} text="Surfacturation" />
          <FeatureTag icon={<CheckCircle2 className="w-5 h-5" />} text="Vérification intérêts" />
          <FeatureTag icon={<CheckCircle2 className="w-5 h-5" />} text="Rapports PDF" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 py-4 px-6 border-t border-primary-100 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <ScrutixIcon size={32} />
            <span className="text-lg text-primary-600"><span className="font-display text-xl font-medium">Scrutix</span> v1.1</span>
          </div>
          <p className="text-lg text-primary-600 font-medium">75 banques • 14 pays</p>
          <p className="text-lg text-primary-600"><span className="font-display text-xl font-medium text-primary-800">Atlas Studio</span></p>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: number | string; label: string; color: 'blue' | 'green' | 'amber' | 'emerald' }) {
  const colors = { blue: 'bg-blue-50 text-blue-600 border-blue-200', green: 'bg-green-50 text-green-600 border-green-200', amber: 'bg-amber-50 text-amber-600 border-amber-200', emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
  return (
    <div className={`rounded-xl border p-5 text-center ${colors[color]}`}>
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-base opacity-75">{label}</p>
    </div>
  );
}

// Action Card Component
function ActionCard({ icon, title, description, onClick, color, primary = false }: { icon: React.ReactNode; title: string; description: string; onClick: () => void; color: 'blue' | 'emerald' | 'violet' | 'orange'; primary?: boolean }) {
  const baseColors = {
    blue: { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', light: 'bg-blue-100', text: 'text-blue-600', border: 'hover:border-blue-300' },
    emerald: { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700', light: 'bg-emerald-100', text: 'text-emerald-600', border: 'hover:border-emerald-300' },
    violet: { bg: 'bg-violet-600', hover: 'hover:bg-violet-700', light: 'bg-violet-100', text: 'text-violet-600', border: 'hover:border-violet-300' },
    orange: { bg: 'bg-orange-600', hover: 'hover:bg-orange-700', light: 'bg-orange-100', text: 'text-orange-600', border: 'hover:border-orange-300' },
  };
  const c = baseColors[color];

  if (primary) {
    return (
      <button onClick={onClick} className={`group p-6 ${c.bg} ${c.hover} rounded-xl text-left transition-all text-white shadow-lg`}>
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-white/20 mb-4">{icon}</div>
        <h3 className="text-xl font-semibold flex items-center gap-2">{title}<ArrowRight className="w-5 h-5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /></h3>
        <p className="text-base text-white/80">{description}</p>
      </button>
    );
  }

  return (
    <button onClick={onClick} className={`group p-6 bg-white border border-primary-200 rounded-xl text-left transition-all ${c.border} hover:shadow-lg`}>
      <div className={`inline-flex items-center justify-center w-16 h-16 rounded-xl ${c.light} mb-4`}><span className={c.text}>{icon}</span></div>
      <h3 className="text-xl font-semibold text-primary-900 flex items-center gap-2">{title}<ArrowRight className="w-5 h-5 text-primary-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /></h3>
      <p className="text-base text-primary-500">{description}</p>
    </button>
  );
}

// Feature Tag Component
function FeatureTag({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-2.5 bg-white border border-primary-200 rounded-full text-base text-primary-700 shadow-sm hover:shadow-md transition-shadow">
      <span className="text-green-500">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
