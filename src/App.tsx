import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout';
import { ErrorBoundary } from './components/ui';
import { useBankStore } from './store/bankStore';
import { LoginScreen, isAuthenticated } from './components/auth';

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

function App() {
  const { initializeDefaults } = useBankStore();
  const [authenticated, setAuthenticated] = useState(isAuthenticated());

  // Initialize default banks on first load
  useEffect(() => {
    initializeDefaults();
  }, [initializeDefaults]);

  // Show login screen if not authenticated
  if (!authenticated) {
    return <LoginScreen onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/*" element={
              <MainLayout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="import" element={<ImportPage />} />
                    <Route path="analyses" element={<AnalysesPage />} />
                    <Route path="clients" element={<ClientsPage />} />
                    <Route path="clients/:id" element={<ClientDetailPage />} />
                    <Route path="banks" element={<BanksPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="billing" element={<BillingPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Routes>
                </Suspense>
              </MainLayout>
            } />
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
