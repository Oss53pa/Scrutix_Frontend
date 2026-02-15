import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings, LogOut, Building2, ChevronDown,
  HelpCircle, FileText, Moon, Sun, Shield
} from 'lucide-react';
import { useSettingsStore } from '../../store';

export function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { organization } = useSettingsStore();

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
    setDarkMode(!darkMode);
    // TODO: Implementer le mode sombre
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
      onClick: () => window.open('https://docs.scrutix.com', '_blank'),
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
        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-primary-100 transition-colors"
      >
        {organization.logo ? (
          <img
            src={organization.logo}
            alt="Logo"
            className="w-8 h-8 rounded-full object-cover border border-primary-200"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary-800 flex items-center justify-center text-white text-sm font-medium">
            {initials}
          </div>
        )}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-primary-900 max-w-[120px] truncate">
            {displayName}
          </p>
          <p className="text-xs text-primary-500">{displayRole}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-primary-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-primary-200 overflow-hidden z-50">
          {/* Header avec infos utilisateur */}
          <div className="px-4 py-4 bg-gradient-to-r from-primary-800 to-primary-900 text-white">
            <div className="flex items-center gap-3">
              {organization.logo ? (
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

          {/* Menu items */}
          <div className="py-2">
            {menuItems.map((item, index) => {
              if ('divider' in item && item.divider) {
                return <div key={index} className="my-2 border-t border-primary-100" />;
              }

              return (
                <button
                  key={index}
                  onClick={item.onClick}
                  className="w-full px-4 py-2.5 flex items-center gap-3 text-primary-700 hover:bg-primary-50 transition-colors"
                >
                  <span className="text-primary-400">{item.icon}</span>
                  <span className="flex-1 text-left text-sm">{item.label}</span>
                  {item.toggle && (
                    <div className={`w-8 h-4 rounded-full transition-colors ${
                      darkMode ? 'bg-primary-600' : 'bg-primary-200'
                    }`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        darkMode ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer - Deconnexion */}
          <div className="border-t border-primary-100 py-2">
            <button
              onClick={() => {
                // TODO: Deconnexion
                setIsOpen(false);
              }}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Se deconnecter</span>
            </button>
          </div>

          {/* Credits Atlas Studio */}
          <div className="px-4 py-3 bg-primary-50 border-t border-primary-100">
            <p className="text-xs text-primary-400 text-center">
              <span className="font-display text-sm">Scrutix</span> v1.0 - Developpe par <span className="font-display text-sm text-primary-600">{organization.developedBy || 'Atlas Studio'}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
