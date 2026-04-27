// ============================================================================
// ATLASBANX - Hook de timeout de session
// Déconnexion automatique après inactivité (défaut: 30 minutes)
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
const WARNING_BEFORE_MS = 2 * 60 * 1000; // Avertissement 2 min avant
const THROTTLE_MS = 30_000; // Ne tracker l'activité que toutes les 30s
const TICK_MS = 1_000; // Mise à jour du countdown chaque seconde

const SESSION_KEY = 'atlasbanx_last_activity';

export interface SessionTimeoutState {
  remainingMs: number;
  showWarning: boolean;
  extendSession: () => void;
}

export function useSessionTimeout(timeoutMs: number = 30 * 60 * 1000): SessionTimeoutState {
  const { signOut, isAuthenticated } = useAuthStore();
  const [remainingMs, setRemainingMs] = useState(timeoutMs);
  const [showWarning, setShowWarning] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const throttleRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);

  // Réinitialiser le timer
  const resetTimer = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    isPausedRef.current = false;
    setShowWarning(false);
    setRemainingMs(timeoutMs);

    try {
      sessionStorage.setItem(SESSION_KEY, String(now));
    } catch {
      // Silently fail
    }

    // Nettoyer les timers existants
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (tickRef.current) clearInterval(tickRef.current);

    // Timer d'avertissement (timeout - 2 min)
    const warningDelay = Math.max(0, timeoutMs - WARNING_BEFORE_MS);
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      isPausedRef.current = true;

      // Démarrer le countdown seconde par seconde
      let remaining = WARNING_BEFORE_MS;
      setRemainingMs(remaining);

      tickRef.current = setInterval(() => {
        remaining -= TICK_MS;
        setRemainingMs(Math.max(0, remaining));

        if (remaining <= 0) {
          if (tickRef.current) clearInterval(tickRef.current);
        }
      }, TICK_MS);
    }, warningDelay);

    // Timer de déconnexion
    timeoutRef.current = setTimeout(async () => {
      if (tickRef.current) clearInterval(tickRef.current);
      setShowWarning(false);
      sessionStorage.setItem('atlasbanx_session_expired', 'true');
      await signOut();
      window.location.reload();
    }, timeoutMs);
  }, [timeoutMs, signOut]);

  // Prolonger la session
  const extendSession = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Tracker l'activité utilisateur (throttlé)
  const handleActivity = useCallback(() => {
    if (throttleRef.current || isPausedRef.current) return;

    throttleRef.current = true;
    resetTimer();

    setTimeout(() => {
      throttleRef.current = false;
    }, THROTTLE_MS);
  }, [resetTimer]);

  // Setup event listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    // Vérifier si une session précédente a expiré
    const expired = sessionStorage.getItem('atlasbanx_session_expired');
    if (expired === 'true') {
      sessionStorage.removeItem('atlasbanx_session_expired');
    }

    // Récupérer le dernier timestamp d'activité
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      const elapsed = Date.now() - Number(stored);
      if (elapsed >= timeoutMs) {
        // Session déjà expirée — await signOut before reloading
        signOut().then(() => window.location.reload());
        return;
      }
    }

    // Démarrer le timer
    resetTimer();

    // Écouter l'activité
    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, handleActivity);
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isAuthenticated, timeoutMs, resetTimer, handleActivity, signOut]);

  return { remainingMs, showWarning, extendSession };
}
