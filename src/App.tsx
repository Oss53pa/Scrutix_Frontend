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
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-primary-200" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-500 border-r-accent-500 animate-spin" />
        </div>
        <span className="text-xs uppercase tracking-[0.18em] text-ink-500 font-semibold">Chargement</span>
      </div>
    </div>
  );
}

// Supabase not configured screen
function SupabaseRequiredScreen() {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-ink-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-ink-900 via-ink-950 to-black" />
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-accent-700/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-ink-700/30 blur-3xl" />
      </div>
      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl text-white tracking-tight">
            Atlas<span className="text-gradient-gold">Banx</span>
          </h1>
          <p className="font-serif italic text-lg text-white/60 mt-2">Audit Bancaire Intelligent</p>
        </div>
        <div className="relative rounded-2xl bg-white/95 backdrop-blur-xl shadow-2xl border border-white/10 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400 to-transparent" />
          <div className="p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-50 to-red-100 border border-red-200 flex items-center justify-center shadow-card">
                <AlertCircle className="w-7 h-7 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-ink-900 tracking-tight">Configuration requise</h2>
              <p className="text-ink-500 text-sm">
                Les variables d'environnement Supabase ne sont pas configurées.
                Contactez votre administrateur pour configurer <code className="bg-canvas-100 border border-primary-200/60 px-1.5 py-0.5 rounded text-xs font-mono text-ink-700">VITE_SUPABASE_URL</code> et <code className="bg-canvas-100 border border-primary-200/60 px-1.5 py-0.5 rounded text-xs font-mono text-ink-700">VITE_SUPABASE_ANON_KEY</code>.
              </p>
            </div>
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
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-ink-950">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-ink-900 via-ink-950 to-black" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-accent-500/10 blur-3xl animate-breathe" />
        </div>
        <div className="relative flex flex-col items-center gap-6 animate-fade-in-up">
          <h1 className="font-display text-4xl text-white tracking-tight">
            Atlas<span className="text-gradient-gold">Banx</span>
          </h1>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-accent-400/60 animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-accent-400/30 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-white/50 text-xs uppercase tracking-[0.2em]">Chargement</span>
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
