/**
 * @module AtlasBanx
 * @file src/security/PasswordPolicy.ts
 * @description Politique de mot de passe enterprise :
 *                • 12 caractères minimum
 *                • au moins une majuscule, un chiffre, un caractère spécial
 *                • vérification HaveIBeenPwned via k-anonymity (SHA-1 prefix)
 *                • rejet des mots de passe communs (dictionnaire court)
 * @author Atlas Studio
 * @version 1.0.0
 */

// ----------------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------------

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

/**
 * Dictionnaire court des mots de passe les plus utilisés — rejette
 * localement sans avoir besoin de HIBP pour ce cas trivial.
 */
const COMMON_PASSWORDS = new Set([
  'azerty123',
  'motdepasse',
  '123456789012',
  'qwerty123456',
  'password1234',
  'admin1234567',
  'atlasbanx123',
  'scrutix12345',
]);

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export type PasswordStrength = 'weak' | 'fair' | 'strong' | 'excellent';

export interface PasswordValidationResult {
  valid: boolean;
  strength: PasswordStrength;
  /** Score 0-100 pour affichage barre de progression */
  score: number;
  /** Liste des règles non respectées */
  failures: string[];
  /** Suggestions d'amélioration (français) */
  suggestions: string[];
}

export interface PasswordBreachResult {
  /** True si le mot de passe apparaît dans une fuite connue */
  breached: boolean;
  /** Nombre de fois qu'il apparaît dans les fuites */
  occurrences: number;
  /** Erreur réseau si HIBP est injoignable */
  error?: string;
}

// ----------------------------------------------------------------------------
// VALIDATION
// ----------------------------------------------------------------------------

/**
 * Valide la force d'un mot de passe selon la politique enterprise.
 * Opération 100% locale — pas d'appel réseau.
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const failures: string[] = [];
  const suggestions: string[] = [];

  if (password.length < MIN_LENGTH) {
    failures.push(`Au moins ${MIN_LENGTH} caractères`);
    suggestions.push(`Ajoutez ${MIN_LENGTH - password.length} caractère(s) supplémentaire(s)`);
  }
  if (password.length > MAX_LENGTH) {
    failures.push(`Maximum ${MAX_LENGTH} caractères`);
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (!hasUpper) {
    failures.push('Au moins une majuscule');
    suggestions.push('Ajoutez une majuscule');
  }
  if (!hasLower) {
    failures.push('Au moins une minuscule');
    suggestions.push('Ajoutez une minuscule');
  }
  if (!hasDigit) {
    failures.push('Au moins un chiffre');
    suggestions.push('Ajoutez un chiffre');
  }
  if (!hasSpecial) {
    failures.push('Au moins un caractère spécial');
    suggestions.push('Ajoutez un caractère spécial (!@#$...)');
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    failures.push('Mot de passe trop commun');
    suggestions.push('Choisissez une combinaison moins prévisible');
  }

  // Pénalités pour patterns faibles
  if (/^(.)\1+$/.test(password)) {
    failures.push('Mot de passe trop répétitif');
  }
  if (/^(0123|1234|2345|3456|4567|5678|6789|abcd|qwert|azert)/i.test(password)) {
    failures.push('Séquence trop prévisible');
  }

  // Calcul du score
  let score = 0;
  if (password.length >= MIN_LENGTH) score += 25;
  if (password.length >= 16) score += 10;
  if (password.length >= 20) score += 10;
  if (hasUpper) score += 10;
  if (hasLower) score += 10;
  if (hasDigit) score += 10;
  if (hasSpecial) score += 15;
  // Entropie bonus pour variété
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= 8) score += 5;
  if (uniqueChars >= 12) score += 5;
  score = Math.min(100, Math.max(0, score));

  let strength: PasswordStrength;
  if (score < 40) strength = 'weak';
  else if (score < 65) strength = 'fair';
  else if (score < 85) strength = 'strong';
  else strength = 'excellent';

  return {
    valid: failures.length === 0,
    strength,
    score,
    failures,
    suggestions,
  };
}

// ----------------------------------------------------------------------------
// HAVE I BEEN PWNED — k-anonymity check
// ----------------------------------------------------------------------------

/**
 * Calcule le hash SHA-1 du mot de passe (pour HIBP).
 * HIBP utilise SHA-1 historiquement — non crypto-safe aujourd'hui mais
 * suffisant pour du dictionnaire de fuites car on compare juste des hashes.
 */
async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Vérifie si un mot de passe apparaît dans les fuites HaveIBeenPwned.
 *
 * Protocole k-anonymity :
 *   1. On calcule SHA-1(password) → 40 chars hex
 *   2. On envoie à api.pwnedpasswords.com les 5 premiers chars (prefix)
 *   3. HIBP retourne la liste de tous les hashes connus commençant par ce
 *      prefix, avec leur nombre d'occurrences
 *   4. On cherche notre suffixe (35 chars restants) dans la liste localement
 *
 * Le mot de passe en clair ne quitte JAMAIS le navigateur.
 */
export async function checkHaveIBeenPwned(password: string): Promise<PasswordBreachResult> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return { breached: false, occurrences: 0, error: 'Web Crypto indisponible' };
  }

  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: 'GET',
      headers: { 'Add-Padding': 'true' }, // randomize response size for extra privacy
    });

    if (!response.ok) {
      return {
        breached: false,
        occurrences: 0,
        error: `HIBP API error ${response.status}`,
      };
    }

    const body = await response.text();
    // Réponse : une ligne par hash ; format "SUFFIX:COUNT"
    for (const line of body.split('\n')) {
      const [lineSuffix, count] = line.trim().split(':');
      if (lineSuffix === suffix) {
        return { breached: true, occurrences: parseInt(count, 10) || 0 };
      }
    }

    return { breached: false, occurrences: 0 };
  } catch (err) {
    return {
      breached: false,
      occurrences: 0,
      error: err instanceof Error ? err.message : 'Erreur réseau',
    };
  }
}

/**
 * Validation complète : politique locale + HIBP.
 * Retourne le premier problème rencontré pour affichage concis à l'utilisateur.
 */
export async function validatePasswordFull(
  password: string,
): Promise<PasswordValidationResult & { breached?: boolean; breachCount?: number }> {
  const local = validatePasswordStrength(password);
  if (!local.valid) return local;

  const hibp = await checkHaveIBeenPwned(password);
  if (hibp.breached) {
    return {
      ...local,
      valid: false,
      failures: [
        ...local.failures,
        `Ce mot de passe a été exposé dans ${hibp.occurrences.toLocaleString('fr-FR')} fuites connues`,
      ],
      suggestions: [
        ...local.suggestions,
        'Choisissez un mot de passe qui ne figure pas dans les fuites publiques',
      ],
      breached: true,
      breachCount: hibp.occurrences,
    };
  }

  return { ...local, breached: false };
}
