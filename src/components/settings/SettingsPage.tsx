import { useState, useEffect } from 'react';
import { Brain, Sliders, Cloud, FileText, Info, Briefcase, Settings2, HardDrive, Cpu, Shield, Code2 } from 'lucide-react';
import { Alert } from '../ui';
import { IASettings } from './IASettings';
import { AIProviderSettings } from './AIProviderSettings';
import { DetectionSettings } from './DetectionSettings';
import { AlgorithmsInfo } from './AlgorithmsInfo';
import { PreferencesSettings } from './PreferencesSettings';
import { CloudBackupSettings } from './CloudBackupSettings';
import { LocalBackupSettings } from './LocalBackupSettings';
import { RegulatorySourcesSettings } from './RegulatorySourcesSettings';
import { OrganizationSettings } from './OrganizationSettings';
import { AboutSettings } from './AboutSettings';
import { BackupService } from '../../services/BackupService';

type SettingsTab = 'organization' | 'ai-providers' | 'ia' | 'detection-modules' | 'detection-thresholds' | 'detection-algorithms' | 'preferences' | 'local-backup' | 'cloud-backup' | 'regulatory' | 'about';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
  indent?: boolean;
}

const TABS: TabConfig[] = [
  { id: 'organization', label: 'Organisation', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'ai-providers', label: 'Providers IA', icon: <Cpu className="w-4 h-4" /> },
  { id: 'ia', label: 'Claude AI (avance)', icon: <Brain className="w-4 h-4" /> },
  { id: 'detection-modules', label: 'Modules de detection', icon: <Shield className="w-4 h-4" /> },
  { id: 'detection-thresholds', label: 'Seuils de detection', icon: <Sliders className="w-4 h-4" />, indent: true },
  { id: 'detection-algorithms', label: 'Algorithmes', icon: <Code2 className="w-4 h-4" />, indent: true },
  { id: 'preferences', label: 'Preferences', icon: <Settings2 className="w-4 h-4" /> },
  { id: 'local-backup', label: 'Sauvegarde Locale', icon: <HardDrive className="w-4 h-4" /> },
  { id: 'cloud-backup', label: 'Sauvegarde Cloud', icon: <Cloud className="w-4 h-4" /> },
  { id: 'regulatory', label: 'Sources reglementaires', icon: <FileText className="w-4 h-4" /> },
  { id: 'about', label: 'A propos', icon: <Info className="w-4 h-4" /> },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('organization');
  const [saved, setSaved] = useState(false);
  const [migrationInfo, setMigrationInfo] = useState<{ migrated: boolean; fromVersion: string | null } | null>(null);

  // Verifier et migrer les donnees au chargement
  useEffect(() => {
    const result = BackupService.checkAndMigrate();
    if (result.migrated) {
      setMigrationInfo({ migrated: true, fromVersion: result.fromVersion });
    }
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'organization':
        return <OrganizationSettings onSave={handleSave} />;
      case 'ai-providers':
        return <AIProviderSettings onSave={handleSave} />;
      case 'ia':
        return <IASettings onSave={handleSave} />;
      case 'detection-modules':
      case 'detection-thresholds':
        return <DetectionSettings onSave={handleSave} initialTab={activeTab === 'detection-modules' ? 'modules' : 'thresholds'} />;
      case 'detection-algorithms':
        return <AlgorithmsInfo />;
      case 'preferences':
        return <PreferencesSettings onSave={handleSave} />;
      case 'local-backup':
        return <LocalBackupSettings />;
      case 'cloud-backup':
        return <CloudBackupSettings />;
      case 'regulatory':
        return <RegulatorySourcesSettings />;
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
        <h1 className="page-title">Parametres</h1>
        <p className="page-description">
          Configurez les seuils de detection et les preferences
        </p>
      </div>

      {migrationInfo?.migrated && (
        <Alert variant="info" title="Donnees migrees">
          Vos donnees ont ete migrees de la version {migrationInfo.fromVersion} vers la version actuelle.
        </Alert>
      )}

      {saved && (
        <Alert variant="success" title="Parametres enregistres">
          Vos modifications ont ete sauvegardees.
        </Alert>
      )}

      {/* Tabs Navigation */}
      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1 sticky top-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 py-3 rounded-lg text-left transition-colors ${
                  tab.indent ? 'px-6' : 'px-4'
                } ${
                  activeTab === tab.id
                    ? 'bg-primary-900 text-white'
                    : 'text-primary-600 hover:bg-primary-100'
                }`}
              >
                {tab.icon}
                <span className={`text-sm font-medium ${tab.indent ? 'text-xs' : ''}`}>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1">{renderTabContent()}</div>
      </div>
    </div>
  );
}
