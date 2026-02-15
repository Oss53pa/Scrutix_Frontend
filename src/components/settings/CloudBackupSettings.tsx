import { useState } from 'react';
import { Cloud, CloudOff, Upload, Download, Trash2, RefreshCw, Loader2, CheckCircle, XCircle, HardDrive } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  Select,
  Alert,
} from '../ui';
import { useSettingsStore } from '../../store';
import { GoogleDriveService, BackupFile } from '../../services/GoogleDriveService';

export function CloudBackupSettings() {
  const {
    cloudBackup,
    updateCloudBackup,
    disconnectCloud,
  } = useSettingsStore();

  const [connecting, setConnecting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      await GoogleDriveService.initialize();
      const status = await GoogleDriveService.connect();

      if (status.isConnected) {
        updateCloudBackup({
          provider: 'google_drive',
          isConnected: true,
          userEmail: status.userEmail || null,
          userName: status.userName || null,
        });
        setSuccess('Connecte a Google Drive');
        await loadBackups();
      } else {
        setError('Echec de la connexion a Google Drive');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    GoogleDriveService.disconnect();
    disconnectCloud();
    setBackups([]);
    setSuccess('Deconnecte de Google Drive');
  };

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const files = await GoogleDriveService.listBackups();
      setBackups(files);
    } catch (err) {
      console.error('Erreur chargement backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    setError(null);

    try {
      // Collecter les donnees a sauvegarder
      const dataToBackup = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        settings: useSettingsStore.getState(),
        // Ajouter d'autres stores si necessaire
      };

      const fileName = `scrutix-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const result = await GoogleDriveService.backup(dataToBackup, fileName);

      if (result.success) {
        updateCloudBackup({
          lastBackupAt: new Date().toISOString(),
          lastBackupStatus: 'success',
        });
        setSuccess(`Backup cree: ${result.fileName}`);
        await loadBackups();
      } else {
        updateCloudBackup({ lastBackupStatus: 'failed' });
        setError(result.error || 'Echec du backup');
      }
    } catch (err) {
      updateCloudBackup({ lastBackupStatus: 'failed' });
      setError(err instanceof Error ? err.message : 'Erreur de backup');
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async (fileId: string) => {
    setError(null);

    try {
      const result = await GoogleDriveService.restore(fileId);

      if (result.success && result.data) {
        // Restaurer les parametres
        const backup = result.data as any;
        if (backup.settings) {
          // Restaurer uniquement certaines parties
          useSettingsStore.setState({
            thresholds: backup.settings.thresholds,
            preferences: backup.settings.preferences,
            bankConditions: backup.settings.bankConditions,
          });
        }
        setSuccess('Donnees restaurees avec succes');
      } else {
        setError(result.error || 'Echec de la restauration');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de restauration');
    }
  };

  const handleDeleteBackup = async (fileId: string) => {
    if (!confirm('Supprimer ce backup ?')) return;

    const success = await GoogleDriveService.deleteBackup(fileId);
    if (success) {
      setBackups(backups.filter(b => b.id !== fileId));
      setSuccess('Backup supprime');
    } else {
      setError('Echec de la suppression');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isConfigured = GoogleDriveService.isConfigured();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-primary-500" />
          <CardTitle>Sauvegarde Cloud</CardTitle>
        </div>
        <CardDescription>
          Sauvegardez vos donnees sur Google Drive
        </CardDescription>
      </CardHeader>

      <CardBody className="space-y-6">
        {!isConfigured ? (
          <Alert variant="warning" title="Configuration requise">
            <p>Configurez les variables d'environnement VITE_GOOGLE_CLIENT_ID et VITE_GOOGLE_API_KEY pour activer Google Drive.</p>
          </Alert>
        ) : (
          <>
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

            {/* Connection Status */}
            <div className="flex items-center justify-between p-4 border border-primary-200 rounded-lg">
              <div className="flex items-center gap-3">
                {cloudBackup.isConnected ? (
                  <CheckCircle className="w-5 h-5 text-primary-500" />
                ) : (
                  <CloudOff className="w-5 h-5 text-primary-400" />
                )}
                <div>
                  <p className="font-medium text-primary-900">
                    {cloudBackup.isConnected ? 'Connecte' : 'Non connecte'}
                  </p>
                  {cloudBackup.isConnected && cloudBackup.userEmail && (
                    <p className="text-sm text-primary-500">{cloudBackup.userEmail}</p>
                  )}
                </div>
              </div>

              {cloudBackup.isConnected ? (
                <Button variant="secondary" onClick={handleDisconnect}>
                  <CloudOff className="w-4 h-4" />
                  Deconnecter
                </Button>
              ) : (
                <Button variant="primary" onClick={handleConnect} disabled={connecting}>
                  {connecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                  Connecter Google Drive
                </Button>
              )}
            </div>

            {cloudBackup.isConnected && (
              <>
                {/* Backup Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 border border-primary-200 rounded-md">
                    <input
                      type="checkbox"
                      checked={cloudBackup.autoBackup}
                      onChange={(e) => updateCloudBackup({ autoBackup: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Backup automatique</span>
                  </div>

                  <Select
                    label="Frequence"
                    value={cloudBackup.backupFrequency}
                    onChange={(e) => updateCloudBackup({ backupFrequency: e.target.value as any })}
                    options={[
                      { value: 'daily', label: 'Quotidien' },
                      { value: 'weekly', label: 'Hebdomadaire' },
                      { value: 'manual', label: 'Manuel uniquement' },
                    ]}
                    disabled={!cloudBackup.autoBackup}
                  />
                </div>

                {/* Last Backup Info */}
                {cloudBackup.lastBackupAt && (
                  <div className="p-3 bg-primary-50 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      {cloudBackup.lastBackupStatus === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-primary-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-primary-500" />
                      )}
                      <span>
                        Dernier backup: {new Date(cloudBackup.lastBackupAt).toLocaleString('fr-FR')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Backup Now Button */}
                <Button variant="primary" onClick={handleBackup} disabled={backingUp} className="w-full">
                  {backingUp ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Sauvegarder maintenant
                </Button>

                {/* Backup List */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-primary-700 flex items-center gap-2">
                      <HardDrive className="w-4 h-4" />
                      Sauvegardes disponibles
                    </h4>
                    <Button variant="ghost" size="sm" onClick={loadBackups} disabled={loadingBackups}>
                      <RefreshCw className={`w-4 h-4 ${loadingBackups ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>

                  {backups.length === 0 ? (
                    <p className="text-sm text-primary-400 text-center py-4">Aucune sauvegarde</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {backups.map((backup) => (
                        <div
                          key={backup.id}
                          className="flex items-center justify-between p-3 border border-primary-200 rounded-lg hover:bg-primary-50"
                        >
                          <div>
                            <p className="text-sm font-medium text-primary-900">{backup.name}</p>
                            <p className="text-xs text-primary-400">
                              {formatSize(backup.size)} - {new Date(backup.modifiedAt).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRestore(backup.id)}
                              title="Restaurer"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteBackup(backup.id)}
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4 text-primary-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
