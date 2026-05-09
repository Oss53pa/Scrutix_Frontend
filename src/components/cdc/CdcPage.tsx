import { useState } from 'react';
import { Building2, FileText, Users, Shield, BarChart3 } from 'lucide-react';
import { ReferentielTab } from './ReferentielTab';
import { OrganisationsTab } from './OrganisationsTab';
import { ConventionsTab } from './ConventionsTab';
import { AuditCdcTab } from './AuditCdcTab';
import { ReglementaireTab } from './ReglementaireTab';

type CdcTab = 'referentiel' | 'organisations' | 'conventions' | 'audit' | 'reglementaire';

const TABS: Array<{ id: CdcTab; label: string; icon: typeof Building2 }> = [
  { id: 'referentiel', label: 'Référentiel Banques', icon: Building2 },
  { id: 'organisations', label: 'Organisations', icon: Users },
  { id: 'conventions', label: 'Conventions', icon: FileText },
  { id: 'audit', label: 'Audit CDC', icon: BarChart3 },
  { id: 'reglementaire', label: 'Réglementaire', icon: Shield },
];

export function CdcPage() {
  const [activeTab, setActiveTab] = useState<CdcTab>('referentiel');

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">
          Conditions de Compte (CDC)
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Moteur de résolution 5 couches — Référentiel, conventions et audit
        </p>
      </div>

      <div className="border-b border-gray-200 bg-white px-6">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        {activeTab === 'referentiel' && <ReferentielTab />}
        {activeTab === 'organisations' && <OrganisationsTab />}
        {activeTab === 'conventions' && <ConventionsTab />}
        {activeTab === 'audit' && <AuditCdcTab />}
        {activeTab === 'reglementaire' && <ReglementaireTab />}
      </div>
    </div>
  );
}
