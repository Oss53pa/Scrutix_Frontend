/**
 * @module AtlasBanx
 * @file src/security/LoginThrottle.ts
 * @description Throttling des tentatives de connexion côté client.
 *              Après 5 échecs consécutifs pour un même email → lockout de
 *              15 minutes.
 *
 *              Note: c'est une défense DE SURFACE (client-side). Un attaquant
 *              qui modifie localStorage ou utilise un autre navigateur peut
 *              contourner. La vraie défense réside dans le rate-limit
 *              Supabase côté serveur. Ce throttle empêche simplement l'UX
 *              "mot de passe oublié → essai brute force local" et alerte
 *              l'utilisateur légitime d'une activité suspecte sur son poste.
 * @author Atlas Studio
 * @version 1.0.0
 */

const STORAGE_KEY = 'atlasbanx-login-throttle';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;   // sliding window 15 min

interface ThrottleEntry {
  email: string;
  failedCount: number;
  firstFailedAt: number;
  lockedUntil: number | null;
}

interface ThrottleStore {
  entries: ThrottleEntry[];
}

function hashEmail(email: string): string {
  // Hash léger (djb2) pour ne pas stocker l'email en clair — on se sert
  // juste d'un identifiant stable entre sessions. Non cryptographique, OK.
  const s = email.toLowerCase().trim();
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

function loadStore(): ThrottleStore {
  if (typeof localStorage === 'undefined') return { entries: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.entries)) return { entries: [] };
    return parsed;
  } catch {
    return { entries: [] };
  }
}

function saveStore(store: ThrottleStore): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // quota exceeded / disabled — silent
  }
}

function findEntry(store: ThrottleStore, emailHash: string): ThrottleEntry | undefined {
  return store.entries.find((e) => e.email === emailHash);
}

function purgeExpired(store: ThrottleStore): ThrottleStore {
  const now = Date.now();
  return {
    entries: store.entries.filter((e) => {
      // Garder si lockout actif
      if (e.lockedUntil && e.lockedUntil > now) return true;
      // Garder si encore dans la fenêtre
      if (now - e.firstFailedAt < ATTEMPT_WINDOW_MS) return true;
      return false;
    }),
  };
}

// ----------------------------------------------------------------------------
// PUBLIC API
// ----------------------------------------------------------------------------

export interface ThrottleStatus {
  /** Tentative autorisée */
  allowed: boolean;
  /** Tentatives restantes avant lockout */
  remainingAttempts: number;
  /** Si lockout actif: timestamp de libération */
  lockedUntil: number | null;
  /** Secondes restantes avant libération (0 si pas lockout) */
  lockedForSeconds: number;
}

export class LoginThrottle {
  /**
   * Vérifie si un email est autorisé à tenter un login.
   * À appeler avant `supabase.auth.signInWithPassword`.
   */
  static check(email: string): ThrottleStatus {
    const hash = hashEmail(email);
    const store = purgeExpired(loadStore());
    saveStore(store);

    const entry = findEntry(store, hash);
    if (!entry) {
      return {
        allowed: true,
        remainingAttempts: MAX_ATTEMPTS,
        lockedUntil: null,
        lockedForSeconds: 0,
      };
    }

    const now = Date.now();
    if (entry.lockedUntil && entry.lockedUntil > now) {
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil: entry.lockedUntil,
        lockedForSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
      };
    }

    return {
      allowed: true,
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - entry.failedCount),
      lockedUntil: null,
      lockedForSeconds: 0,
    };
  }

  /**
   * Enregistre un échec de login. Déclenche le lockout si le seuil est atteint.
   */
  static recordFailure(email: string): ThrottleStatus {
    const hash = hashEmail(email);
    const store = purgeExpired(loadStore());
    const now = Date.now();
    let entry = findEntry(store, hash);

    if (!entry) {
      entry = {
        email: hash,
        failedCount: 1,
        firstFailedAt: now,
        lockedUntil: null,
      };
      store.entries.push(entry);
    } else {
      // Reset du compteur si la fenêtre est expirée
      if (now - entry.firstFailedAt >= ATTEMPT_WINDOW_MS) {
        entry.failedCount = 1;
        entry.firstFailedAt = now;
        entry.lockedUntil = null;
      } else {
        entry.failedCount += 1;
      }
    }

    if (entry.failedCount >= MAX_ATTEMPTS) {
      entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    }

    saveStore(store);

    return {
      allowed: entry.lockedUntil === null,
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - entry.failedCount),
      lockedUntil: entry.lockedUntil,
      lockedForSeconds: entry.lockedUntil
        ? Math.ceil((entry.lockedUntil - now) / 1000)
        : 0,
    };
  }

  /**
   * Reset complet pour un email donné — à appeler après login réussi.
   */
  static reset(email: string): void {
    const hash = hashEmail(email);
    const store = loadStore();
    store.entries = store.entries.filter((e) => e.email !== hash);
    saveStore(store);
  }

  /**
   * Constantes exportées pour les tests et l'UI.
   */
  static readonly MAX_ATTEMPTS = MAX_ATTEMPTS;
  static readonly LOCKOUT_DURATION_MS = LOCKOUT_DURATION_MS;
  static readonly ATTEMPT_WINDOW_MS = ATTEMPT_WINDOW_MS;
}
