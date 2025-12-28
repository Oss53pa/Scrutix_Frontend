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
import { Button, ScrutixLogo } from '../ui';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigation = [
  { name: 'Accueil', href: '/', icon: Home },
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Import', href: '/import', icon: Upload },
  { name: 'Analyses', href: '/analyses', icon: Search },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Banques & Conditions', href: '/banks', icon: Landmark },
  { name: 'Rapports', href: '/reports', icon: FileBarChart },
  { name: 'Facturation', href: '/billing', icon: Receipt },
  { name: 'Paramètres', href: '/settings', icon: Settings },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-primary-950/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-primary-200
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-primary-200">
            <NavLink to="/" className="flex items-center">
              <ScrutixLogo size="sm" />
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
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${
                    isActive
                      ? 'bg-primary-900 text-white'
                      : 'text-primary-600 hover:bg-primary-100 hover:text-primary-900'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-primary-200">
            <div className="px-3 py-2 rounded-lg bg-primary-50">
              <p className="text-xs text-primary-500">Plateforme d'Audit</p>
              <p className="text-sm font-medium text-primary-900 truncate">
                CEMAC / UEMOA
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
