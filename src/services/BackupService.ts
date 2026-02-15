import { useTransactionStore } from '../store/transactionStore';
import { useAnalysisStore } from '../store/analysisStore';
import { useSettingsStore } from '../store/settingsStore';
import { useClientStore } from '../store/clientStore';
import { useBankStore } from '../store/bankStore';
import { useBillingStore } from '../store/billingStore';
import { useReportStore } from '../store/reportStore';

// Version actuelle de l'application
export const APP_VERSION = '1.0.0';

// Structure du backup
export interface BackupData {
  version: string;
  exportDate: string;
  appVersion: string;
  data: {
    settings: ReturnType<typeof useSettingsStore.getState>;
    transactions: ReturnType<typeof useTransactionStore.getState>;
    analysis: ReturnType<typeof useAnalysisStore.getState>;
    clients: ReturnType<typeof useClientStore.getState>;
    banks: ReturnType<typeof useBankStore.getState>;
    billing: ReturnType<typeof useBillingStore.getState>;
    reports: ReturnType<typeof useReportStore.getState>;
  };
}

// Structure allégée pour export rapide (paramètres uniquement)
export interface SettingsBackupData {
  version: string;
  exportDate: string;
  appVersion: string;
  type: 'settings';
  data: {
    settings: ReturnType<typeof useSettingsStore.getState>;
    banks: ReturnType<typeof useBankStore.getState>;
  };
}

// Structure complète pour export total
export interface FullBackupData {
  version: string;
  exportDate: string;
  appVersion: string;
  type: 'full';
  data: BackupData['data'];
}

export type AnyBackupData = SettingsBackupData | FullBackupData;

/**
 * Service de sauvegarde et restauration locale
 */
export class BackupService {
  /**
   * Exporter uniquement les paramètres (léger)
   */
  static exportSettings(): SettingsBackupData {
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      appVersion: APP_VERSION,
      type: 'settings',
      data: {
        settings: useSettingsStore.getState(),
        banks: useBankStore.getState(),
      },
    };
  }

  /**
   * Exporter toutes les données (complet)
   */
  static exportAll(): FullBackupData {
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      appVersion: APP_VERSION,
      type: 'full',
      data: {
        settings: useSettingsStore.getState(),
        transactions: useTransactionStore.getState(),
        analysis: useAnalysisStore.getState(),
        clients: useClientStore.getState(),
        banks: useBankStore.getState(),
        billing: useBillingStore.getState(),
        reports: useReportStore.getState(),
      },
    };
  }

  /**
   * Télécharger le backup en fichier JSON
   */
  static downloadBackup(data: AnyBackupData, filename?: string): void {
    const defaultFilename = data.type === 'settings'
      ? `scrutix-settings-${new Date().toISOString().slice(0, 10)}.json`
      : `scrutix-backup-${new Date().toISOString().slice(0, 10)}.json`;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Lire un fichier backup
   */
  static async readBackupFile(file: File): Promise<AnyBackupData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content) as AnyBackupData;

          // Validation basique
          if (!data.version || !data.exportDate || !data.data) {
            throw new Error('Format de fichier invalide');
          }

          resolve(data);
        } catch (_error) {
          reject(new Error('Fichier de sauvegarde invalide ou corrompu'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Erreur de lecture du fichier'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Restaurer les paramètres uniquement
   */
  static restoreSettings(data: SettingsBackupData | FullBackupData): void {
    const settingsData = data.data.settings;
    const banksData = 'banks' in data.data ? data.data.banks : null;

    // Restaurer settings (sauf certaines données sensibles)
    if (settingsData) {
      const {
        organization,
        thresholds,
        bankConditions,
        preferences,
        regulatorySources,
        // Ne pas restaurer: claudeApi (contient la clé API), cloudBackup
      } = settingsData;

      useSettingsStore.setState({
        organization,
        thresholds,
        bankConditions,
        preferences,
        regulatorySources,
      });
    }

    // Restaurer banks
    if (banksData) {
      useBankStore.setState({
        banks: banksData.banks,
      });
    }
  }

  /**
   * Restaurer toutes les données
   */
  static restoreAll(data: FullBackupData): void {
    // Restaurer settings
    this.restoreSettings(data);

    // Restaurer transactions
    if (data.data.transactions) {
      useTransactionStore.setState({
        transactions: data.data.transactions.transactions,
        clients: data.data.transactions.clients,
        accounts: data.data.transactions.accounts,
      });
    }

    // Restaurer analysis
    if (data.data.analysis) {
      useAnalysisStore.setState({
        currentAnalysis: data.data.analysis.currentAnalysis,
        analysisHistory: data.data.analysis.analysisHistory,
      });
    }

    // Restaurer clients
    if (data.data.clients) {
      useClientStore.setState({
        clients: data.data.clients.clients,
        statements: data.data.clients.statements,
      });
    }

    // Restaurer billing
    if (data.data.billing) {
      useBillingStore.setState({
        invoices: data.data.billing.invoices,
        payments: data.data.billing.payments,
        pricingPlans: data.data.billing.pricingPlans,
      });
    }

    // Restaurer reports
    if (data.data.reports) {
      useReportStore.setState({
        currentDraft: data.data.reports.currentDraft,
        generatedReports: data.data.reports.generatedReports,
      });
    }
  }

  /**
   * Réinitialiser toutes les données
   */
  static resetAll(): void {
    // Clear localStorage items related to Zustand stores
    const storeKeys = [
      'scrutix-transactions',
      'scrutix-analysis',
      'scrutix-settings',
      'scrutix-clients',
      'scrutix-banks',
      'scrutix-billing',
      'scrutix-reports',
      'scrutix-app',
    ];

    storeKeys.forEach(key => localStorage.removeItem(key));

    // Recharger la page pour réinitialiser les stores
    window.location.reload();
  }

  /**
   * Vérifier et migrer les données si nécessaire
   */
  static checkAndMigrate(): { migrated: boolean; fromVersion: string | null; toVersion: string } {
    const storedVersion = localStorage.getItem('scrutix-app-version');

    if (!storedVersion) {
      // Première utilisation
      localStorage.setItem('scrutix-app-version', APP_VERSION);
      return { migrated: false, fromVersion: null, toVersion: APP_VERSION };
    }

    if (storedVersion !== APP_VERSION) {
      // Migration nécessaire
      this.migrateData(storedVersion, APP_VERSION);
      localStorage.setItem('scrutix-app-version', APP_VERSION);
      return { migrated: true, fromVersion: storedVersion, toVersion: APP_VERSION };
    }

    return { migrated: false, fromVersion: storedVersion, toVersion: APP_VERSION };
  }

  /**
   * Migrer les données entre versions
   */
  private static migrateData(fromVersion: string, toVersion: string): void {
    console.log(`Migration des données: ${fromVersion} -> ${toVersion}`);

    // Migrations spécifiques selon les versions
    // Exemple: if (fromVersion === '1.0.0' && toVersion === '1.1.0') { ... }

    // Pour l'instant, pas de migrations nécessaires
    // Les migrations futures seront ajoutées ici
  }

  /**
   * Obtenir la version actuelle de l'app
   */
  static getAppVersion(): string {
    return APP_VERSION;
  }

  /**
   * Obtenir la version stockée
   */
  static getStoredVersion(): string | null {
    return localStorage.getItem('scrutix-app-version');
  }

  /**
   * Obtenir des statistiques sur les données
   */
  static getDataStats(): {
    transactionsCount: number;
    anomaliesCount: number;
    clientsCount: number;
    invoicesCount: number;
    lastBackupDate: string | null;
  } {
    const transactions = useTransactionStore.getState().transactions;
    const analysis = useAnalysisStore.getState();
    const clients = useClientStore.getState().clients;
    const invoices = useBillingStore.getState().invoices;
    const cloudBackup = useSettingsStore.getState().cloudBackup;

    return {
      transactionsCount: transactions.length,
      anomaliesCount: analysis.currentAnalysis?.anomalies.length || 0,
      clientsCount: clients.length,
      invoicesCount: invoices.length,
      lastBackupDate: cloudBackup.lastBackupAt,
    };
  }
}
