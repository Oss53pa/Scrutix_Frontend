import { useState, useEffect } from 'react';
import {
  Brain,
  Sliders,
  Info,
  Briefcase,
  Settings2,
  Shield,
  ScrollText,
} from 'lucide-react';
import { Alert } from '../ui';
import { IASettings } from './IASettings';
import { AIProviderSettings } from './AIProviderSettings';
import { DetectionSettings } from './DetectionSettings';
import { PreferencesSettings } from './PreferencesSettings';
import { OrganizationSettings } from './OrganizationSettings';
import { AboutSettings } from './AboutSettings';
import { Proph3tSettingsPanel } from './Proph3tSettingsPanel';
import { SecuritySettings } from './SecuritySettings';
import { AuditTrailPanel } from './AuditTrailPanel';
import { useSettingsStore } from '../../store/settingsStore';

type SettingsTab =
  | 'organization'
  | 'ai'
  | 'detection'
  | 'preferences'
  | 'security'
  | 'audit-trail'
  | 'about';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: TabConfig[] = [
  { id: 'organization', label: 'Organisation',       icon: <Briefcase className="w-4 h-4" />, description: 'Cabinet, logo, contact, SMTP' },
  { id: 'ai',           label: 'Intelligence',       icon: <Brain      className="w-4 h-4" />, description: 'Provider, clé API, IA locale' },
  { id: 'detection',    label: 'Détection',          icon: <Sliders    className="w-4 h-4" />, description: 'Modules, seuils, algorithmes' },
  { id: 'preferences',  label: 'Préférences',        icon: <Settings2  className="w-4 h-4" />, description: 'Devise, format, affichage' },
  { id: 'security',     label: 'Sécurité',           icon: <Shield     className="w-4 h-4" />, description: 'MFA, allowlist IP' },
  { id: 'audit-trail',  label: "Journal d'activité", icon: <ScrollText className="w-4 h-4" />, description: 'Historique des actions' },
  { id: 'about',        label: 'À propos',           icon: <Info       className="w-4 h-4" />, description: 'Version, licence, crédits' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('organization');
  const [saved, setSaved] = useState(false);
  const aiProviders = useSettingsStore((s) => s.aiProviders);
  const isOllama = aiProviders.activeProvider === 'ollama';

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [saved]);

  const handleSave = () => setSaved(true);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'organization':
        return <OrganizationSettings onSave={handleSave} />;
      case 'ai':
        return (
          <div className="space-y-6">
            <AIProviderSettings onSave={handleSave} />
            {isOllama && <Proph3tSettingsPanel onSave={handleSave} />}
            <IASettings onSave={handleSave} />
          </div>
        );
      case 'detection':
        return <DetectionSettings onSave={handleSave} initialTab="modules" />;
      case 'preferences':
        return <PreferencesSettings onSave={handleSave} />;
      case 'security':
        return <SecuritySettings />;
      case 'audit-trail':
        return <AuditTrailPanel />;
      case 'about':
        return <AboutSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <p className="page-eyebrow mb-2">Configuration</p>
        <h1 className="page-title">Paramètres</h1>
        <p className="page-description">
          Configurez votre cabinet, l'intelligence artificielle et la détection des anomalies.
        </p>
      </div>

      {saved && (
        <Alert variant="success" title="Paramètres enregistrés">
          Vos modifications ont été sauvegardées.
        </Alert>
      )}

      {/* Tabs Navigation */}
      <div className="flex gap-6">
        {/* Sidebar — premium */}
        <div className="w-72 flex-shrink-0">
          <nav className="space-y-1 sticky top-4">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ease-premium ${
                    isActive
                      ? 'bg-gradient-to-r from-ink-900 to-ink-800 text-white shadow-[0_4px_16px_-4px_rgb(7_11_31/0.35)]'
                      : 'text-ink-600 hover:bg-canvas-200/70 hover:text-ink-900'
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-accent-400"
                    />
                  )}
                  <span className={isActive ? 'text-accent-300' : 'text-ink-400'}>{tab.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold tracking-tight truncate">{tab.label}</p>
                    <p
                      className={`text-[11px] truncate ${
                        isActive ? 'text-white/60' : 'text-ink-400'
                      }`}
                    >
                      {tab.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">{renderTabContent()}</div>
      </div>
    </div>
  );
}
