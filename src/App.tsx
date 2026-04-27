import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MainLayout } from './components/layout';
import { ErrorBoundary } from './components/ui';
import { useBankStore } from './store/bankStore';
import { useClientStore } from './store/clientStore';
import { useTransactionStore } from './store/transactionStore';
import { LoginScreen } from './components/auth';
import { SessionTimeoutModal } from './components/auth/SessionTimeoutModal';
import { useAuthStore } from './store/authStore';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { useAccountType } from './hooks/useAccountType';
import { isSupabaseConfigured } from './lib/supabase';
import { migrateLocalToSupabase } from './lib/migrateLocalToSupabase';
import { AlertCircle } from 'lucide-react';

const ExternalAuthPage = lazy(() => import('./pages/auth/ExternalAuthPage'));

// Lazy load all pages for code splitting
const HomePage = lazy(() => import('./components/home').then(m => ({ default: m.HomePage })));
const DashboardPage = lazy(() => import('./components/dashboard').then(m => ({ default: m.DashboardPage })));
const ImportPage = lazy(() => import('./components/import').then(m => ({ default: m.ImportPage })));
const AnalysesPage = lazy(() => import('./components/analyses').then(m => ({ default: m.AnalysesPage })));
const ClientsPage = lazy(() => import('./components/clients').then(m => ({ default: m.ClientsPage })));
const ClientDetailPage = lazy(() => import('./components/clients').then(m => ({ default: m.ClientDetailPage })));
const BanksPage = lazy(() => import('./components/banks').then(m => ({ default: m.BanksPage })));
const ReportsPage = lazy(() => import('./components/reports').then(m => ({ default: m.ReportsPage })));
const BillingPage = lazy(() => import('./components/billing').then(m => ({ default: m.BillingPage })));
const SettingsPage = lazy(() => import('./components/settings').then(m => ({ default: m.SettingsPage })));
const NotFoundPage = lazy(() => import('./components/notfound').then(m => ({ default: m.NotFoundPage })));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-900 rounded-full animate-spin" />
        <span className="text-sm text-primary-500">Chargement...</span>
      </div>
    </div>
  );
}

// Supabase not configured screen
function SupabaseRequiredScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-white">AtlasBanx</h1>
          <p className="font-display text-xl text-primary-200 mt-2">Audit Bancaire Intelligent</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Configuration requise</h2>
            <p className="text-gray-500 text-sm">
              Les variables d'environnement Supabase ne sont pas configurées.
              Contactez votre administrateur pour configurer <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">VITE_SUPABASE_URL</code> et <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">VITE_SUPABASE_ANON_KEY</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Cabinet-only route guard — redirects enterprise accounts away
function CabinetOnly({ children }: { children: React.ReactNode }) {
  const { isEnterprise } = useAccountType();
  if (isEnterprise) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Session timeout wrapper (only active when authenticated)
function SessionTimeoutGuard({ children }: { children: React.ReactNode }) {
  const { showWarning, remainingMs, extendSession } = useSessionTimeout(30 * 60 * 1000);

  return (
    <>
      {children}
      {showWarning && (
        <SessionTimeoutModal
          remainingMs={remainingMs}
          onExtend={extendSession}
        />
      )}
    </>
  );
}

function App() {
  const { initializeDefaults } = useBankStore();
  const { isInitialized, isAuthenticated, isDemoMode, initialize, profile, user } = useAuthStore();
  const ensureSelfClient = useClientStore((s) => s.ensureSelfClient);
  const hydrateClients = useClientStore((s) => s.hydrateFromSupabase);
  const resetClients = useClientStore((s) => s.resetState);
  const hydrateTransactions = useTransactionStore((s) => s.hydrateFromSupabase);
  const resetTransactions = useTransactionStore((s) => s.resetState);
  const [authReady, setAuthReady] = useState(false);

  // Initialize auth on mount
  useEffect(() => {
    initialize().then(() => setAuthReady(true));
  }, [initialize]);

  // Initialize default banks on first load
  useEffect(() => {
    initializeDefaults();
  }, [initializeDefaults]);

  // Hydrate Supabase-backed stores whenever the authenticated user changes.
  // On first authenticated boot, attempt a one-shot localStorage → Supabase
  // migration before hydrating (so newly-pushed data is visible immediately).
  useEffect(() => {
    if (!isAuthenticated || !user?.id || isDemoMode) {
      // Signed out or demo — clear local store state
      resetClients();
      resetTransactions();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await migrateLocalToSupabase(user.id);
      } catch (err) {
        console.error('[App] migrateLocalToSupabase failed:', err);
      }
      if (cancelled) return;
      await Promise.all([hydrateClients(), hydrateTransactions()]);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    isDemoMode,
    user?.id,
    hydrateClients,
    hydrateTransactions,
    resetClients,
    resetTransactions,
  ]);

  // Enterprise mode: ensure an implicit "self" client exists and is selected.
  // Runs once profile is loaded after auth. No-op for cabinet accounts.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (profile?.account_type !== 'enterprise') return;
    ensureSelfClient(profile?.full_name ?? undefined);
  }, [isAuthenticated, profile, ensureSelfClient]);

  // Show loading while auth initializes
  if (!authReady || !isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="text-white/70 text-sm">Chargement de AtlasBanx...</span>
        </div>
      </div>
    );
  }

  // If Supabase is not configured and not demo mode, show error
  if (!isSupabaseConfigured() && !isDemoMode) {
    return <SupabaseRequiredScreen />;
  }

  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

function AppRoutes() {
  const location = useLocation();
  const { isAuthenticated, isDemoMode } = useAuthStore();

  // Always allow /auth route (Atlas Studio SSO) regardless of auth state
  if (location.pathname === '/auth') {
    return (
      <Suspense fallback={<PageLoader />}>
        <ExternalAuthPage />
      </Suspense>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated && !isDemoMode) {
    return <LoginScreen onSuccess={() => {}} />;
  }

  return (
    <ErrorBoundary>
      <SessionTimeoutGuard>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/*" element={
              <MainLayout>
                <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="import" element={<ImportPage />} />
                    <Route path="analyses" element={<AnalysesPage />} />
                    <Route path="clients" element={<CabinetOnly><ClientsPage /></CabinetOnly>} />
                    <Route path="clients/:id" element={<CabinetOnly><ClientDetailPage /></CabinetOnly>} />
                    <Route path="banks" element={<BanksPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="billing" element={<CabinetOnly><BillingPage /></CabinetOnly>} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
                </ErrorBoundary>
              </MainLayout>
            } />
          </Routes>
        </Suspense>
      </SessionTimeoutGuard>
    </ErrorBoundary>
  );
}

export default App;
