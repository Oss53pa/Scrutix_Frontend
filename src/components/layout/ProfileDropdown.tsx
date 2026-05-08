import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings, LogOut, Building2, ChevronDown,
  HelpCircle, FileText, Moon, Sun, Shield, Briefcase,
} from 'lucide-react';
import { useSettingsStore } from '../../store';
import { useAuthStore } from '../../store/authStore';
import { useClientStore } from '../../store/clientStore';
import { useAccountType } from '../../hooks/useAccountType';

export function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('atlasbanx-dark-mode') === 'true'; } catch { return false; }
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { organization } = useSettingsStore();
  const { signOut, profile, setAccountType } = useAuthStore();
  const ensureSelfClient = useClientStore((s) => s.ensureSelfClient);
  const { isEnterprise } = useAccountType();
  const [isSwitchingAccountType, setIsSwitchingAccountType] = useState(false);

  const handleToggleAccountType = async () => {
    if (isSwitchingAccountType) return;
    setIsSwitchingAccountType(true);
    const next = isEnterprise ? 'cabinet' : 'enterprise';
    const ok = await setAccountType(next);
    if (ok && next === 'enterprise') {
      ensureSelfClient(profile?.full_name ?? undefined);
    }
    setIsSwitchingAccountType(false);
  };

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('atlasbanx-dark-mode', String(next)); } catch { /* ignore */ }
  };

  const menuItems = [
    {
      icon: <Building2 className="w-4 h-4" />,
      label: 'Mon organisation',
      onClick: () => handleNavigate('/settings'),
    },
    {
      icon: <Settings className="w-4 h-4" />,
      label: 'Parametres',
      onClick: () => handleNavigate('/settings'),
    },
    {
      icon: <Shield className="w-4 h-4" />,
      label: 'Securite',
      onClick: () => handleNavigate('/settings'),
    },
    { divider: true },
    {
      icon: <FileText className="w-4 h-4" />,
      label: 'Documentation',
      onClick: () => window.open('https://docs.atlasbanx.com', '_blank'),
    },
    {
      icon: <HelpCircle className="w-4 h-4" />,
      label: 'Aide & Support',
      onClick: () => window.open('mailto:support@atlasstudio.com', '_blank'),
    },
    { divider: true },
    {
      icon: darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />,
      label: darkMode ? 'Mode clair' : 'Mode sombre',
      onClick: toggleDarkMode,
      toggle: true,
    },
  ];

  const displayName = organization.name || 'Mon Cabinet';
  const displayRole = 'Administrateur';
  const initials = displayName
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AD';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton Profil */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-2.5 py-1.5 rounded-lg hover:bg-canvas-200/70 transition-all duration-200 ease-premium"
      >
        {organization.logo && (organization.logo.startsWith('data:image/') || organization.logo.startsWith('https://')) ? (
          <img
            src={organization.logo}
            alt="Logo"
            className="w-9 h-9 rounded-full object-cover border-2 border-accent-300/40 shadow-card"
          />
        ) : (
          <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-ink-700 to-ink-950 flex items-center justify-center text-white text-sm font-bold tracking-tight shadow-card border border-ink-700">
            {initials}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-canvas-50" />
          </div>
        )}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-semibold text-ink-900 max-w-[140px] truncate tracking-tight">
            {displayName}
          </p>
          <p className="text-[11px] text-ink-500">{displayRole}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-ink-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-dropdown border border-primary-200/60 overflow-hidden z-50 animate-slide-down">
          {/* Header avec infos utilisateur — premium ink */}
          <div className="relative px-5 py-5 bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 text-white overflow-hidden">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-400/70 to-transparent" />
            <div aria-hidden="true" className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent-400/15 blur-2xl" />
            <div className="flex items-center gap-3">
              {organization.logo && (organization.logo.startsWith('data:image/') || organization.logo.startsWith('https://')) ? (
                <img
                  src={organization.logo}
                  alt="Logo"
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/20"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-semibold">
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{displayName}</p>
                <p className="text-sm text-white/70 truncate">
                  {organization.senderEmail || 'Non configure'}
                </p>
              </div>
            </div>
            {organization.city && (
              <p className="text-xs text-white/60 mt-2">
                {organization.city}, {organization.country}
              </p>
            )}
          </div>

          {/* Account type switch (Entreprise / Cabinet) */}
          <div className="px-4 py-3 border-b border-primary-100/70 bg-canvas-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-[0.14em]">
                Type de compte
              </span>
              {isSwitchingAccountType && (
                <div className="w-3 h-3 border-2 border-primary-300 border-t-accent-500 rounded-full animate-spin" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-1 p-1 bg-canvas-100 rounded-lg border border-primary-200/60">
              <button
                onClick={() => { if (!isEnterprise) handleToggleAccountType(); }}
                disabled={isSwitchingAccountType || isEnterprise}
                className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ease-premium ${
                  isEnterprise
                    ? 'bg-gradient-to-b from-ink-800 to-ink-950 text-white shadow-card'
                    : 'text-ink-600 hover:bg-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Entreprise
              </button>
              <button
                onClick={() => { if (isEnterprise) handleToggleAccountType(); }}
                disabled={isSwitchingAccountType || !isEnterprise}
                className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ease-premium ${
                  !isEnterprise
                    ? 'bg-gradient-to-b from-ink-800 to-ink-950 text-white shadow-card'
                    : 'text-ink-600 hover:bg-white'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                Cabinet
              </button>
            </div>
            <p className="text-[10px] text-ink-400 mt-1.5 leading-snug">
              {isEnterprise
                ? "J'audite les transactions de ma société"
                : "J'audite plusieurs sociétés clientes"}
            </p>
          </div>

          {/* Menu items */}
          <div className="py-2">
            {menuItems.map((item, index) => {
              if ('divider' in item && item.divider) {
                return <div key={index} className="my-2 border-t border-primary-100/70" />;
              }

              return (
                <button
                  key={index}
                  onClick={item.onClick}
                  className="w-full px-4 py-2.5 flex items-center gap-3 text-ink-700 hover:bg-canvas-100/70 hover:text-ink-900 transition-colors"
                >
                  <span className="text-ink-400">{item.icon}</span>
                  <span className="flex-1 text-left text-sm font-medium tracking-tight">{item.label}</span>
                  {item.toggle && (
                    <div className={`relative w-9 h-5 rounded-full transition-colors ${
                      darkMode ? 'bg-gradient-to-r from-accent-400 to-accent-600' : 'bg-canvas-300'
                    }`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ease-premium ${
                        darkMode ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer - Deconnexion */}
          <div className="border-t border-primary-100/70 py-2">
            <button
              onClick={async () => {
                setIsOpen(false);
                await signOut();
                window.location.reload();
              }}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium tracking-tight">Se déconnecter</span>
            </button>
          </div>

          {/* Credits Atlas Studio */}
          <div className="px-4 py-3 bg-canvas-100/70 border-t border-primary-100/70">
            <p className="text-[11px] text-ink-400 text-center tracking-tight">
              <span className="font-display text-sm text-ink-700">AtlasBanx</span> v1.0 — by <span className="font-display text-sm text-accent-700">{organization.developedBy || 'Atlas Studio'}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
