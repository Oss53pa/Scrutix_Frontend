/**
 * Service Google Drive pour le backup cloud des archives Scrutix
 * Utilise Google Drive API via OAuth2
 */

// Configuration Google API
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCRUTIX_FOLDER_NAME = 'Scrutix_Backups';

export interface BackupFile {
  id: string;
  name: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  mimeType: string;
}

export interface BackupResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  error?: string;
}

export interface DriveStatus {
  isConnected: boolean;
  userEmail?: string;
  userName?: string;
  userPhoto?: string;
  quotaUsed?: number;
  quotaTotal?: number;
}

// Declare global gapi type
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

class GoogleDriveServiceClass {
  private tokenClient: any = null;
  private gapiInited = false;
  private gisInited = false;
  private accessToken: string | null = null;
  private scrutixFolderId: string | null = null;

  /**
   * Initialise le service Google Drive
   */
  async initialize(): Promise<boolean> {
    try {
      // Charger les scripts Google si pas deja fait
      await this.loadGoogleScripts();

      // Initialiser GAPI
      await this.initializeGapi();

      // Initialiser GIS (Google Identity Services)
      await this.initializeGis();

      return true;
    } catch (error) {
      console.error('Erreur initialisation Google Drive:', error);
      return false;
    }
  }

  /**
   * Charge les scripts Google API
   */
  private async loadGoogleScripts(): Promise<void> {
    // Charger GAPI
    if (!window.gapi) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Echec chargement GAPI'));
        document.body.appendChild(script);
      });
    }

    // Charger GIS
    if (!window.google?.accounts) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Echec chargement GIS'));
        document.body.appendChild(script);
      });
    }
  }

  /**
   * Initialise Google API
   */
  private async initializeGapi(): Promise<void> {
    await new Promise<void>((resolve) => {
      window.gapi.load('client', resolve);
    });

    await window.gapi.client.init({
      apiKey: GOOGLE_API_KEY,
      discoveryDocs: [DISCOVERY_DOC],
    });

    this.gapiInited = true;
  }

  /**
   * Initialise Google Identity Services
   */
  private async initializeGis(): Promise<void> {
    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: '', // Defini lors de la demande de token
    });

    this.gisInited = true;
  }

  /**
   * Connecte l'utilisateur a Google Drive
   */
  async connect(): Promise<DriveStatus> {
    if (!this.gapiInited || !this.gisInited) {
      await this.initialize();
    }

    return new Promise((resolve) => {
      this.tokenClient.callback = async (response: any) => {
        if (response.error) {
          resolve({ isConnected: false });
          return;
        }

        this.accessToken = response.access_token;

        // Obtenir les infos utilisateur
        const status = await this.getStatus();

        // Creer/trouver le dossier Scrutix
        await this.getOrCreateScrutixFolder();

        resolve(status);
      };

      if (this.accessToken === null) {
        // Demander un nouveau token
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        // Utiliser le token existant
        this.tokenClient.requestAccessToken({ prompt: '' });
      }
    });
  }

  /**
   * Deconnecte l'utilisateur
   */
  disconnect(): void {
    if (this.accessToken) {
      window.google.accounts.oauth2.revoke(this.accessToken);
      this.accessToken = null;
      this.scrutixFolderId = null;
    }
  }

  /**
   * Obtient le statut de connexion
   */
  async getStatus(): Promise<DriveStatus> {
    if (!this.accessToken) {
      return { isConnected: false };
    }

    try {
      // Obtenir les infos utilisateur
      const response = await window.gapi.client.drive.about.get({
        fields: 'user,storageQuota',
      });

      const user = response.result.user;
      const quota = response.result.storageQuota;

      return {
        isConnected: true,
        userEmail: user.emailAddress,
        userName: user.displayName,
        userPhoto: user.photoLink,
        quotaUsed: parseInt(quota.usage || '0'),
        quotaTotal: parseInt(quota.limit || '0'),
      };
    } catch (error) {
      console.error('Erreur statut Drive:', error);
      return { isConnected: false };
    }
  }

  /**
   * Trouve ou cree le dossier Scrutix_Backups
   */
  private async getOrCreateScrutixFolder(): Promise<string> {
    if (this.scrutixFolderId) {
      return this.scrutixFolderId;
    }

    try {
      // Chercher le dossier existant
      const response = await window.gapi.client.drive.files.list({
        q: `name='${SCRUTIX_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
      });

      if (response.result.files && response.result.files.length > 0) {
        this.scrutixFolderId = response.result.files[0].id;
        return this.scrutixFolderId;
      }

      // Creer le dossier
      const createResponse = await window.gapi.client.drive.files.create({
        resource: {
          name: SCRUTIX_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });

      this.scrutixFolderId = createResponse.result.id;
      return this.scrutixFolderId;
    } catch (error) {
      console.error('Erreur creation dossier:', error);
      throw error;
    }
  }

  /**
   * Sauvegarde des donnees dans Google Drive
   */
  async backup(data: object, fileName: string): Promise<BackupResult> {
    if (!this.accessToken) {
      return { success: false, error: 'Non connecte a Google Drive' };
    }

    try {
      const folderId = await this.getOrCreateScrutixFolder();
      const content = JSON.stringify(data, null, 2);
      const blob = new Blob([content], { type: 'application/json' });

      // Verifier si le fichier existe deja
      const existingFile = await this.findFile(fileName);

      if (existingFile) {
        // Mettre a jour le fichier existant
        const _response = await this.updateFile(existingFile.id, blob);
        return {
          success: true,
          fileId: existingFile.id,
          fileName: fileName,
        };
      } else {
        // Creer un nouveau fichier
        const metadata = {
          name: fileName,
          parents: [folderId],
          mimeType: 'application/json',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: form,
        });

        const result = await response.json();

        if (result.id) {
          return {
            success: true,
            fileId: result.id,
            fileName: fileName,
          };
        } else {
          return { success: false, error: 'Echec creation fichier' };
        }
      }
    } catch (error) {
      console.error('Erreur backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Met a jour un fichier existant
   */
  private async updateFile(fileId: string, content: Blob): Promise<any> {
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: content,
    });

    return response.json();
  }

  /**
   * Trouve un fichier par nom
   */
  private async findFile(fileName: string): Promise<BackupFile | null> {
    try {
      const folderId = await this.getOrCreateScrutixFolder();
      const response = await window.gapi.client.drive.files.list({
        q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, size, createdTime, modifiedTime, mimeType)',
      });

      if (response.result.files && response.result.files.length > 0) {
        const file = response.result.files[0];
        return {
          id: file.id,
          name: file.name,
          size: parseInt(file.size || '0'),
          createdAt: new Date(file.createdTime),
          modifiedAt: new Date(file.modifiedTime),
          mimeType: file.mimeType,
        };
      }

      return null;
    } catch (error) {
      console.error('Erreur recherche fichier:', error);
      return null;
    }
  }

  /**
   * Liste tous les backups
   */
  async listBackups(): Promise<BackupFile[]> {
    if (!this.accessToken) {
      return [];
    }

    try {
      const folderId = await this.getOrCreateScrutixFolder();
      const response = await window.gapi.client.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, size, createdTime, modifiedTime, mimeType)',
        orderBy: 'modifiedTime desc',
      });

      return (response.result.files || []).map((file: any) => ({
        id: file.id,
        name: file.name,
        size: parseInt(file.size || '0'),
        createdAt: new Date(file.createdTime),
        modifiedAt: new Date(file.modifiedTime),
        mimeType: file.mimeType,
      }));
    } catch (error) {
      console.error('Erreur liste backups:', error);
      return [];
    }
  }

  /**
   * Restaure un backup
   */
  async restore(fileId: string): Promise<{ success: boolean; data?: object; error?: string }> {
    if (!this.accessToken) {
      return { success: false, error: 'Non connecte a Google Drive' };
    }

    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Echec telechargement fichier');
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Erreur restauration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Supprime un backup
   */
  async deleteBackup(fileId: string): Promise<boolean> {
    if (!this.accessToken) {
      return false;
    }

    try {
      await window.gapi.client.drive.files.delete({ fileId });
      return true;
    } catch (error) {
      console.error('Erreur suppression:', error);
      return false;
    }
  }

  /**
   * Verifie si le service est configure
   */
  isConfigured(): boolean {
    return Boolean(GOOGLE_CLIENT_ID && GOOGLE_API_KEY);
  }
}

// Export singleton
export const GoogleDriveService = new GoogleDriveServiceClass();
