import { Sliders, RotateCcw, Save, Shield, AlertTriangle, FileSearch, Wallet, Scale } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Button,
  Input,
  InfoTooltip,
} from '../ui';
import { useSettingsStore } from '../../store';

interface DetectionSettingsProps {
  onSave?: () => void;
  initialTab?: 'modules' | 'thresholds';
}

export function DetectionSettings({ onSave, initialTab = 'modules' }: DetectionSettingsProps) {
  const {
    thresholds,
    updateThresholds,
    resetThresholds,
    detectionModules,
    updateDetectionModules,
    resetDetectionModules,
  } = useSettingsStore();

  // Detection modules configuration
  const coreModules = [
    { key: 'duplicateFee', label: 'Doublons', emoji: '🔄', description: 'Détection des frais prélevés en double' },
    { key: 'ghostFee', label: 'Frais fantômes', emoji: '👻', description: 'Frais sans service associé identifiable' },
    { key: 'overcharge', label: 'Surfacturation', emoji: '📈', description: 'Frais supérieurs aux conditions contractuelles' },
    { key: 'interestError', label: 'Erreurs agios', emoji: '💰', description: 'Calcul incorrect des intérêts débiteurs' },
  ];

  const extendedModules = [
    { key: 'valueDateError', label: 'Dates de valeur', emoji: '📅', description: 'Dates de valeur non conformes' },
    { key: 'suspiciousTransaction', label: 'Opérations suspectes', emoji: '🔍', description: 'Transactions inhabituelles ou atypiques' },
    { key: 'complianceViolation', label: 'Non-conformités', emoji: '⚠️', description: 'Violations des conditions contractuelles' },
    { key: 'cashflowAnomaly', label: 'Trésorerie', emoji: '💵', description: 'Anomalies dans les flux de trésorerie' },
    { key: 'reconciliationGap', label: 'Rapprochement', emoji: '🔗', description: 'Écarts dans le rapprochement bancaire' },
    { key: 'multiBankIssue', label: 'Multi-banques', emoji: '🏦', description: 'Incohérences entre comptes bancaires' },
  ];

  const complianceModules = [
    { key: 'ohadaCompliance', label: 'Conformité OHADA', emoji: '📋', description: 'Respect des normes comptables OHADA' },
    { key: 'amlAlert', label: 'Anti-blanchiment', emoji: '🚨', description: 'Alertes LCB-FT (obligation légale)' },
  ];

  const feeModules = [
    { key: 'feeAnomaly', label: 'Audit des frais', emoji: '🧾', description: 'Analyse complète par catégorie de frais' },
  ];

  const renderModuleToggle = (module: { key: string; label: string; emoji: string; description: string }) => (
    <label
      key={module.key}
      className="flex items-start gap-3 p-3 border border-primary-200 rounded-lg cursor-pointer hover:bg-primary-50 transition-colors"
    >
      <input
        type="checkbox"
        checked={detectionModules[module.key as keyof typeof detectionModules]}
        onChange={(e) => updateDetectionModules({ [module.key]: e.target.checked })}
        className="w-4 h-4 mt-0.5"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{module.emoji}</span>
          <span className="text-sm font-medium text-primary-900">{module.label}</span>
        </div>
        <p className="text-xs text-primary-500 mt-0.5">{module.description}</p>
      </div>
    </label>
  );

  return (
    <div className="space-y-6">
      {/* Detection Modules */}
      {initialTab === 'modules' && (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-500" />
            <CardTitle>Modules de detection</CardTitle>
          </div>
          <CardDescription>
            Activez ou desactivez les algorithmes de detection (fonctionne sans IA)
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-6">
          {/* Core modules */}
          <div>
            <h4 className="text-sm font-medium text-primary-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Detection de base
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {coreModules.map(renderModuleToggle)}
            </div>
          </div>

          {/* Extended modules */}
          <div>
            <h4 className="text-sm font-medium text-primary-700 mb-3 flex items-center gap-2">
              <FileSearch className="w-4 h-4" />
              Detection etendue
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {extendedModules.map(renderModuleToggle)}
            </div>
          </div>

          {/* Compliance modules */}
          <div>
            <h4 className="text-sm font-medium text-primary-700 mb-3 flex items-center gap-2">
              <Scale className="w-4 h-4" />
              Conformite reglementaire
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {complianceModules.map(renderModuleToggle)}
            </div>
          </div>

          {/* Fee audit modules */}
          <div>
            <h4 className="text-sm font-medium text-primary-700 mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Audit des frais par categorie
              <InfoTooltip content="Analyse detaillee: tenue de compte, cartes, virements, international, services annexes, packages" />
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {feeModules.map(renderModuleToggle)}
            </div>
          </div>
        </CardBody>
        <CardFooter>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={resetDetectionModules}>
              <RotateCcw className="w-4 h-4" />
              Reinitialiser modules
            </Button>
            <Button variant="primary" onClick={onSave}>
              <Save className="w-4 h-4" />
              Enregistrer
            </Button>
          </div>
        </CardFooter>
      </Card>
      )}

      {/* Thresholds */}
      {initialTab === 'thresholds' && (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary-500" />
            <CardTitle>Seuils de detection</CardTitle>
          </div>
          <CardDescription>
            Ajustez la sensibilite des algorithmes de detection
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-6">
        {/* Duplicate detection */}
        <div>
          <h4 className="text-sm font-medium text-primary-700 mb-4 flex items-center gap-2">
            Detection des doublons
            <InfoTooltip content="Parametres pour identifier les transactions en double" />
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              type="number"
              label="Seuil de similarite"
              value={thresholds.duplicateDetection.similarityThreshold * 100}
              onChange={(e) =>
                updateThresholds({
                  duplicateDetection: {
                    ...thresholds.duplicateDetection,
                    similarityThreshold: Number(e.target.value) / 100,
                  },
                })
              }
              helperText="% de similarite minimum"
              min={50}
              max={100}
            />
            <Input
              type="number"
              label="Fenetre temporelle"
              value={thresholds.duplicateDetection.timeWindowDays}
              onChange={(e) =>
                updateThresholds({
                  duplicateDetection: {
                    ...thresholds.duplicateDetection,
                    timeWindowDays: Number(e.target.value),
                  },
                })
              }
              helperText="Jours de recherche"
              min={1}
              max={30}
            />
            <Input
              type="number"
              label="Tolerance montant"
              value={thresholds.duplicateDetection.amountTolerance * 100}
              onChange={(e) =>
                updateThresholds({
                  duplicateDetection: {
                    ...thresholds.duplicateDetection,
                    amountTolerance: Number(e.target.value) / 100,
                  },
                })
              }
              helperText="% de difference acceptee"
              min={0}
              max={10}
            />
          </div>
        </div>

        {/* Ghost fee detection */}
        <div>
          <h4 className="text-sm font-medium text-primary-700 mb-4 flex items-center gap-2">
            Detection des frais fantomes
            <InfoTooltip content="Parametres pour identifier les frais sans service associe" />
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              type="number"
              label="Seuil d'entropie"
              value={thresholds.ghostFeeDetection.entropyThreshold}
              onChange={(e) =>
                updateThresholds({
                  ghostFeeDetection: {
                    ...thresholds.ghostFeeDetection,
                    entropyThreshold: Number(e.target.value),
                  },
                })
              }
              helperText="Complexite de description"
              min={1}
              max={5}
              step={0.5}
            />
            <Input
              type="number"
              label="Fenetre service"
              value={thresholds.ghostFeeDetection.orphanWindowDays}
              onChange={(e) =>
                updateThresholds({
                  ghostFeeDetection: {
                    ...thresholds.ghostFeeDetection,
                    orphanWindowDays: Number(e.target.value),
                  },
                })
              }
              helperText="Jours de recherche service"
              min={1}
              max={7}
            />
            <Input
              type="number"
              label="Confiance minimum"
              value={thresholds.ghostFeeDetection.minConfidence * 100}
              onChange={(e) =>
                updateThresholds({
                  ghostFeeDetection: {
                    ...thresholds.ghostFeeDetection,
                    minConfidence: Number(e.target.value) / 100,
                  },
                })
              }
              helperText="% de confiance"
              min={50}
              max={100}
            />
          </div>
        </div>

        {/* Overcharge detection */}
        <div>
          <h4 className="text-sm font-medium text-primary-700 mb-4 flex items-center gap-2">
            Detection des surfacturations
            <InfoTooltip content="Parametres pour comparer aux tarifs officiels" />
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Tolerance"
              value={thresholds.overchargeDetection.tolerancePercentage * 100}
              onChange={(e) =>
                updateThresholds({
                  overchargeDetection: {
                    ...thresholds.overchargeDetection,
                    tolerancePercentage: Number(e.target.value) / 100,
                  },
                })
              }
              helperText="% de depassement accepte"
              min={0}
              max={20}
            />
            <div className="flex items-end">
              <label className="flex items-center gap-3 p-3 border border-primary-200 rounded-md w-full">
                <input
                  type="checkbox"
                  checked={thresholds.overchargeDetection.useHistoricalBaseline}
                  onChange={(e) =>
                    updateThresholds({
                      overchargeDetection: {
                        ...thresholds.overchargeDetection,
                        useHistoricalBaseline: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm">Utiliser l'historique comme reference</span>
              </label>
            </div>
          </div>
        </div>
      </CardBody>
      <CardFooter>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={resetThresholds}>
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
      )}
    </div>
  );
}
