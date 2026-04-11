/**
 * @module AtlasBanx
 * @file src/security/FileSecurityValidator.ts
 * @description Validation de sécurité des fichiers avant traitement local.
 *
 *              AtlasBanx n'uploade JAMAIS de fichier vers un serveur — tout
 *              est parsé localement via pdfjs/tesseract/exceljs/papaparse.
 *              Ce validateur empêche néanmoins :
 *                1. le parsing d'un fichier dont l'extension ne correspond
 *                   pas au contenu réel (magic bytes)
 *                2. les fichiers dépassant une taille raisonnable (DoS local)
 *                3. les types de fichier non supportés
 *
 *              Aucune dépendance npm — détection par magic bytes via
 *              comparaison des premiers octets.
 * @author Atlas Studio
 * @version 1.0.0
 */

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export type DetectedFileType =
  | 'pdf'
  | 'xlsx'
  | 'xls'
  | 'csv'
  | 'png'
  | 'jpeg'
  | 'unknown';

export interface FileValidationResult {
  valid: boolean;
  detectedType: DetectedFileType;
  declaredType: string;
  reason?: string;
}

// ----------------------------------------------------------------------------
// MAGIC BYTES
// ----------------------------------------------------------------------------

/**
 * Compare un buffer aux magic bytes connus pour déterminer le vrai type.
 */
function identifyByMagicBytes(bytes: Uint8Array): DetectedFileType {
  if (bytes.length < 4) return 'unknown';

  // PDF : "%PDF" = 25 50 44 46
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf';
  }

  // XLSX (zip) : "PK\x03\x04" = 50 4B 03 04
  // XLS et XLSX peuvent avoir ce header aussi ; on départage par l'extension
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'xlsx';
  }

  // XLS (OLE Compound Document) : D0 CF 11 E0 A1 B1 1A E1
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  ) {
    return 'xls';
  }

  // PNG : 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png';
  }

  // JPEG : FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }

  return 'unknown';
}

/**
 * Lit un File en ArrayBuffer via FileReader (mieux supporté que les autres
 * options dans jsdom). En cas d'environnement sans FileReader (Node pur),
 * fallback sur Blob.arrayBuffer() puis Response().arrayBuffer().
 */
async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader did not return an ArrayBuffer'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }
  // Fallbacks
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  return new Response(file).arrayBuffer();
}

/**
 * Heuristique CSV : présence de séparateurs habituels (comma / semicolon /
 * pipe) sur les premières lignes, absence de bytes binaires non-ASCII au-delà
 * d'un seuil raisonnable (on tolère les accents UTF-8).
 */
function looksLikeCsv(text: string): boolean {
  if (text.length === 0) return false;
  const sample = text.slice(0, 2048);

  // Refuse si on détecte trop d'octets de contrôle non imprimables
  let controlChars = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      controlChars += 1;
    }
  }
  if (controlChars / sample.length > 0.01) return false;

  // Doit contenir au moins un séparateur courant
  return /[,;|\t]/.test(sample);
}

// ----------------------------------------------------------------------------
// PUBLIC API
// ----------------------------------------------------------------------------

export class FileSecurityValidator {
  static readonly MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_BYTES;

  /**
   * Valide un fichier avant parsing. Opération asynchrone car on lit les
   * premiers octets pour identifier le type.
   */
  static async validate(file: File): Promise<FileValidationResult> {
    // 1. Taille
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        detectedType: 'unknown',
        declaredType: file.type,
        reason: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB > 50 MB)`,
      };
    }
    if (file.size === 0) {
      return {
        valid: false,
        detectedType: 'unknown',
        declaredType: file.type,
        reason: 'Fichier vide',
      };
    }

    // 2. Lecture des premiers octets. On préfère FileReader car il est
    // mieux supporté que Blob.arrayBuffer() / Response().arrayBuffer() dans
    // jsdom (utilisé en test).
    const fullBuf = await readFileAsArrayBuffer(file);
    const header = new Uint8Array(fullBuf, 0, Math.min(16, fullBuf.byteLength));
    const magicType = identifyByMagicBytes(header);

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const declared = file.type || extension;

    // 3. CSV : pas de magic bytes fiables — on lit un échantillon texte
    if (extension === 'csv' && magicType === 'unknown') {
      const sampleBytes = new Uint8Array(fullBuf, 0, Math.min(4096, fullBuf.byteLength));
      const text = new TextDecoder('utf-8', { fatal: false }).decode(sampleBytes);
      if (looksLikeCsv(text)) {
        return { valid: true, detectedType: 'csv', declaredType: declared };
      }
      return {
        valid: false,
        detectedType: 'unknown',
        declaredType: declared,
        reason: 'Le fichier est déclaré CSV mais son contenu ne ressemble pas à du CSV',
      };
    }

    // 4. Cohérence extension ↔ magic bytes
    const extensionMap: Record<string, DetectedFileType[]> = {
      pdf: ['pdf'],
      xlsx: ['xlsx'],
      xls: ['xls', 'xlsx'], // certains "xls" modernes sont en fait xlsx
      png: ['png'],
      jpg: ['jpeg'],
      jpeg: ['jpeg'],
    };

    const allowed = extensionMap[extension];
    if (!allowed) {
      return {
        valid: false,
        detectedType: magicType,
        declaredType: declared,
        reason: `Extension non supportée: .${extension}`,
      };
    }

    if (!allowed.includes(magicType)) {
      return {
        valid: false,
        detectedType: magicType,
        declaredType: declared,
        reason:
          magicType === 'unknown'
            ? `Impossible de vérifier l'identité du fichier .${extension}`
            : `Extension .${extension} incohérente avec le contenu détecté (${magicType})`,
      };
    }

    return { valid: true, detectedType: magicType, declaredType: declared };
  }
}
