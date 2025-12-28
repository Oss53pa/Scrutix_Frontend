import { Building2, RotateCcw, Save } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Button,
  Select,
} from '../ui';
import { useSettingsStore } from '../../store';

interface PreferencesSettingsProps {
  onSave?: () => void;
}

export function PreferencesSettings({ onSave }: PreferencesSettingsProps) {
  const { preferences, updatePreferences, resetPreferences } = useSettingsStore();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary-500" />
          <CardTitle>Preferences</CardTitle>
        </div>
        <CardDescription>
          Personnalisez l'affichage et le comportement de l'application
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Devise"
            value={preferences.currency}
            onChange={(e) => updatePreferences({ currency: e.target.value })}
            options={[
              { value: 'XAF', label: 'FCFA (XAF)' },
              { value: 'XOF', label: 'FCFA (XOF)' },
              { value: 'EUR', label: 'Euro (EUR)' },
              { value: 'USD', label: 'Dollar (USD)' },
            ]}
          />
          <Select
            label="Format de date"
            value={preferences.dateFormat}
            onChange={(e) => updatePreferences({ dateFormat: e.target.value })}
            options={[
              { value: 'dd/MM/yyyy', label: 'JJ/MM/AAAA' },
              { value: 'MM/dd/yyyy', label: 'MM/JJ/AAAA' },
              { value: 'yyyy-MM-dd', label: 'AAAA-MM-JJ' },
            ]}
          />
          <Select
            label="Elements par page"
            value={String(preferences.pageSize)}
            onChange={(e) => updatePreferences({ pageSize: Number(e.target.value) })}
            options={[
              { value: '10', label: '10' },
              { value: '25', label: '25' },
              { value: '50', label: '50' },
              { value: '100', label: '100' },
            ]}
          />
          <div className="flex items-end">
            <label className="flex items-center gap-3 p-3 border border-primary-200 rounded-md w-full">
              <input
                type="checkbox"
                checked={preferences.showConfidenceScores}
                onChange={(e) => updatePreferences({ showConfidenceScores: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm">Afficher les scores de confiance</span>
            </label>
          </div>
        </div>
      </CardBody>
      <CardFooter>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={resetPreferences}>
            <RotateCcw className="w-4 h-4" />
            Reinitialiser
          </Button>
          <Button variant="primary" onClick={onSave}>
            <Save className="w-4 h-4" />
            Enregistrer
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
