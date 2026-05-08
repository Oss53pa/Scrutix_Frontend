import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  Search,
  Users,
  Landmark,
  FileBarChart,
  Receipt,
  Settings,
  Home,
  X,
} from 'lucide-react';
import { Button } from '../ui';
import { useAccountType } from '../../hooks/useAccountType';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type NavItem = {
  name: string;
  href: string;
  icon: typeof Home;
  cabinetOnly?: boolean;
};

const navigation: NavItem[] = [
  { name: 'Accueil', href: '/', icon: Home },
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Import', href: '/import', icon: Upload },
  { name: 'Analyses', href: '/analyses', icon: Search },
  { name: 'Clients', href: '/clients', icon: Users, cabinetOnly: true },
  { name: 'Banques & Conditions', href: '/banks', icon: Landmark },
  { name: 'Rapports', href: '/reports', icon: FileBarChart },
  { name: 'Facturation', href: '/billing', icon: Receipt, cabinetOnly: true },
  { name: 'Paramètres', href: '/settings', icon: Settings },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { isEnterprise } = useAccountType();
  const visibleNavigation = navigation.filter((item) => !(isEnterprise && item.cabinetOnly));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64
          bg-canvas-50/80 dark:bg-ink-950/80 backdrop-blur-xl
          border-r border-primary-200/60 dark:border-ink-700/60
          transform transition-transform duration-300 ease-premium
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full relative">
          {/* Vertical gold hairline accent */}
          <div
            aria-hidden="true"
            className="absolute right-0 top-12 bottom-12 w-px bg-gradient-to-b from-transparent via-accent-300/30 to-transparent"
          />

          {/* Brand */}
          <div className="flex items-center justify-between h-20 px-6 border-b border-primary-200/50 dark:border-ink-700/50">
            <NavLink to="/" className="flex items-center group">
              <span className="font-display text-3xl font-bold text-ink-900 dark:text-ink-50 tracking-tight transition-colors group-hover:text-accent-700 dark:group-hover:text-accent-300">
                AtlasBanx
              </span>
              <span className="ml-1 mt-2 inline-block h-1.5 w-1.5 rounded-full bg-accent-500" />
            </NavLink>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="lg:hidden"
              aria-label="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-6 space-y-0.5 overflow-y-auto">
            <p className="px-3 mb-3 text-[10px] font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-[0.14em]">
              Navigation
            </p>
            {visibleNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                   transition-all duration-200 ease-premium
                  ${
                    isActive
                      ? 'bg-gradient-to-r from-ink-900 to-ink-800 text-white shadow-[0_4px_16px_-4px_rgb(7_11_31/0.35)]'
                      : 'text-ink-600 dark:text-ink-300 hover:bg-canvas-200/70 dark:hover:bg-ink-700/50 hover:text-ink-900 dark:hover:text-ink-50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-accent-400"
                      />
                    )}
                    <item.icon
                      className={`w-[18px] h-[18px] transition-transform duration-200 ${
                        isActive ? 'scale-105' : 'group-hover:scale-105'
                      }`}
                    />
                    <span className="tracking-tight">{item.name}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Footer card */}
          <div className="p-3">
            <div className="relative overflow-hidden rounded-xl border border-primary-200/60 dark:border-ink-700/60 bg-gradient-to-br from-canvas-50 to-canvas-200/60 dark:from-ink-800 dark:to-ink-900 px-4 py-3">
              <div
                aria-hidden="true"
                className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-accent-300/30 blur-2xl"
              />
              <p className="text-[10px] font-semibold text-accent-700 dark:text-accent-300 uppercase tracking-[0.14em]">
                Plateforme d'audit
              </p>
              <p className="mt-1 text-sm font-semibold text-ink-900 dark:text-ink-50">
                CEMAC / UEMOA
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[11px] text-ink-500 dark:text-ink-400">Système opérationnel</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
