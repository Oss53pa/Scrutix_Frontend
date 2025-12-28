import { useState, useRef } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle,
  FileJson,
  Database,
  Settings,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  Alert,
} from '../ui';
import { ConfirmDialog } from '../ui/Modal';
import { BackupService, APP_VERSION, AnyBackupData } from '../../services/BackupService';

export function LocalBackupSettings() {
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [previewData, setPreviewData] = useState<AnyBackupData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = BackupService.getDataStats();
  const storedVersion = BackupService.getStoredVersion();

  const clearMessages = () => {
    setSuccess(null);
    setError(null);
  };

  // Export parametres uniquement
  const handleExportSettings = () => {
    clearMessages();
    try {
      const data = BackupService.exportSettings();
      BackupService.downloadBackup(data);
      setSuccess('Parametres exportes avec succes');
    } catch (err) {
      setError('Erreur lors de l\'export des parametres');
    }
  };

  // Export complet
  const handleExportAll = () => {
    clearMessages();
    try {
      const data = BackupService.exportAll();
      BackupService.downloadBackup(data);
      setSuccess('Sauvegarde complete exportee avec succes');
    } catch (err) {
      setError('Erreur lors de l\'export complet');
    }
  };

  // Ouvrir le selecteur de fichier
  const handleImportClick = () => {
    clearMessages();
    fileInputRef.current?.click();
  };

  // Lire le fichier selectionne
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    clearMessages();

    try {
      const data = await BackupService.readBackupFile(file);
      setPreviewData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de lecture du fichier');
    } finally {
      setImporting(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Confirmer l'import
  const handleConfirmImport = () => {
    if (!previewData) return;

    try {
      if (previewData.type === 'full') {
        BackupService.restoreAll(previewData);
        setSuccess('Toutes les donnees ont ete restaurees. Rechargement...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        BackupService.restoreSettings(previewData);
        setSuccess('Parametres restaures avec succes. Rechargement...');
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      setError('Erreur lors de la restauration');
    } finally {
      setPreviewData(null);
    }
  };

  // Annuler l'import
  const handleCancelImport = () => {
    setPreviewData(null);
  };

  // Reinitialiser l'application
  const handleReset = () => {
    BackupService.resetAll();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Sauvegarde Locale */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-primary-700" />
            <CardTitle>Sauvegarde Locale</CardTitle>
          </div>
          <CardDescription>
            Exportez et importez vos donnees en fichier JSON
          </CardDescription>
        </CardHeader>

        <CardBody className="space-y-6">
          {error && (
            <Alert variant="error" title="Erreur">
              {error}
            </Alert>
          )}

          {success && (
            <Alert variant="success" title="Succes">
              {success}
            </Alert>
          )}

          {/* Version Info */}
          <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg">
            <Info className="w-5 h-5 text-primary-500" />
            <div className="text-sm">
              <span className="text-primary-600">Version de l'application: </span>
              <span className="font-mono font-medium">{APP_VERSION}</span>
              {storedVersion && storedVersion !== APP_VERSION && (
                <span className="ml-2 text-amber-600">
                  (mise a jour depuis {storedVersion})
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-primary-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary-900">{stats.transactionsCount}</p>
              <p className="text-xs text-primary-500">Transactions</p>
            </div>
            <div className="p-3 bg-primary-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary-900">{stats.anomaliesCount}</p>
              <p className="text-xs text-primary-500">Anomalies</p>
            </div>
            <div className="p-3 bg-primary-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary-900">{stats.clientsCount}</p>
              <p className="text-xs text-primary-500">Clients</p>
            </div>
            <div className="p-3 bg-primary-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary-900">{stats.invoicesCount}</p>
              <p className="text-xs text-primary-500">Factures</p>
            </div>
          </div>

          {/* Export Options */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-primary-700 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exporter
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleExportSettings}
                className="flex items-center gap-3 p-4 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-primary-900">Parametres uniquement</p>
                  <p className="text-xs text-primary-500">
                    Configuration, banques, seuils
                  </p>
                </div>
              </button>

              <button
                onClick={handleExportAll}
                className="flex items-center gap-3 p-4 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Database className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-primary-900">Sauvegarde complete</p>
                  <p className="text-xs text-primary-500">
                    Toutes les donnees de l'application
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Import */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-primary-700 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Importer
            </h4>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />

            <Button
              variant="secondary"
              onClick={handleImportClick}
              disabled={importing}
              className="w-full"
            >
              {importing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileJson className="w-4 h-4" />
              )}
              Selectionner un fichier de sauvegarde
            </Button>

            <p className="text-xs text-primary-400 text-center">
              Formats acceptes: scrutix-backup-*.json, scrutix-settings-*.json
            </p>
          </div>

          {/* Preview Import */}
          {previewData && (
            <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Confirmer l'importation</span>
              </div>

              <div className="text-sm text-amber-700 space-y-1">
                <p>
                  <strong>Type:</strong>{' '}
                  {previewData.type === 'full' ? 'Sauvegarde complete' : 'Parametres'}
                </p>
                <p>
                  <strong>Date d'export:</strong> {formatDate(previewData.exportDate)}
                </p>
                <p>
                  <strong>Version:</strong> {previewData.appVersion || 'Non specifiee'}
                </p>
              </div>

              <div className="flex gap-3">
                <Button variant="primary" onClick={handleConfirmImport} className="flex-1">
                  <CheckCircle className="w-4 h-4" />
                  Restaurer
                </Button>
                <Button variant="secondary" onClick={handleCancelImport} className="flex-1">
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {/* Reset */}
          <div className="pt-4 border-t border-primary-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-600">Reinitialiser l'application</p>
                <p className="text-xs text-primary-500">
                  Supprimer toutes les donnees et revenir a l'etat initial
                </p>
              </div>
              <Button variant="danger" size="sm" onClick={() => setShowResetConfirm(true)}>
                <Trash2 className="w-4 h-4" />
                Reinitialiser
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Instructions de mise a jour */}
      <Card>
        <CardHeader>
          <CardTitle>Procedure de mise a jour</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="space-y-4 text-sm">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-medium text-primary-900">Avant la mise a jour</p>
                <p className="text-primary-500">
                  Cliquez sur "Sauvegarde complete" pour exporter vos donnees
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-medium text-primary-900">Mise a jour</p>
                <p className="text-primary-500">
                  Remplacez l'ancien fichier par la nouvelle version
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-medium text-primary-900">Apres la mise a jour</p>
                <p className="text-primary-500">
                  Cliquez sur "Importer" et selectionnez votre fichier de sauvegarde
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Confirm Reset Dialog */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleReset}
        title="Reinitialiser l'application"
        message="Cette action supprimera TOUTES vos donnees: transactions, clients, factures, parametres. Cette action est irreversible. Etes-vous sur de vouloir continuer?"
        confirmLabel="Oui, tout supprimer"
        cancelLabel="Annuler"
        variant="danger"
      />
    </div>
  );
}
