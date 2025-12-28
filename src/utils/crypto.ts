/**
 * Utilitaire de chiffrement AES-256-GCM pour securiser la cle API Claude
 * Utilise Web Crypto API native (pas de dependance externe)
 */

// Cle de chiffrement stockee en memoire pour la session
let encryptionKey: CryptoKey | null = null;

/**
 * Genere une cle de chiffrement derivee d'un fingerprint navigateur
 * Cette cle est unique par navigateur/machine
 */
async function deriveEncryptionKey(): Promise<CryptoKey> {
  // Creer un fingerprint base sur des caracteristiques du navigateur
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width.toString(),
    screen.height.toString(),
    new Date().getTimezoneOffset().toString(),
    'scrutix-salt-v1', // Salt fixe pour cette application
  ].join('|');

  // Convertir le fingerprint en bytes
  const encoder = new TextEncoder();
  const fingerprintBytes = encoder.encode(fingerprint);

  // Importer comme cle pour derivation
  const baseKey = await crypto.subtle.importKey(
    'raw',
    fingerprintBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Deriver une cle AES-256 avec PBKDF2
  const salt = encoder.encode('scrutix-api-key-encryption');
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Obtient ou cree la cle de chiffrement
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (!encryptionKey) {
    encryptionKey = await deriveEncryptionKey();
  }
  return encryptionKey;
}

/**
 * Chiffre la cle API avec AES-256-GCM
 * @param apiKey - La cle API en clair
 * @returns Objet contenant les donnees chiffrees et l'IV (en base64)
 */
export async function encryptApiKey(apiKey: string): Promise<{ encrypted: string; iv: string }> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);

  // Generer un IV aleatoire (12 bytes pour GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Chiffrer
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    data
  );

  // Convertir en base64 pour stockage
  const encryptedArray = new Uint8Array(encryptedBuffer);
  const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray));
  const ivBase64 = btoa(String.fromCharCode(...iv));

  return {
    encrypted: encryptedBase64,
    iv: ivBase64,
  };
}

/**
 * Dechiffre la cle API
 * @param encrypted - Donnees chiffrees en base64
 * @param iv - Vecteur d'initialisation en base64
 * @returns La cle API en clair
 */
export async function decryptApiKey(encrypted: string, iv: string): Promise<string> {
  try {
    const key = await getEncryptionKey();

    // Decoder le base64
    const encryptedBytes = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
    const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));

    // Dechiffrer
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      encryptedBytes
    );

    // Decoder en texte
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Erreur de dechiffrement:', error);
    throw new Error('Impossible de dechiffrer la cle API. Elle a peut-etre ete chiffree sur un autre appareil.');
  }
}

/**
 * Verifie si une chaine ressemble a une cle API chiffree
 */
export function isEncrypted(value: string): boolean {
  // Une cle chiffree en base64 a une longueur minimale et ne commence pas par sk-
  return value.length > 50 && !value.startsWith('sk-');
}

/**
 * Masque une cle API pour affichage securise
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '********';
  return apiKey.substring(0, 7) + '...' + apiKey.substring(apiKey.length - 4);
}
