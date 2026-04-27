// ============================================================================
// ATLASBANX - Auth Store
// Store d'authentification Supabase (mode legacy supprimé)
// ============================================================================

import { create } from 'zustand';
import { isSupabaseConfigured, getSupabaseClient } from '../lib/supabase';
import type { AccountType, Profile } from '../lib/database.types';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { getAuditTrailService, auditLog, AuditEventType, AuditTrailService } from '../services/auditTrail';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface AuthState {
  isInitialized: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  user: User | null;
  profile: Profile | null;
  error: string | null;
}

interface AuthActions {
  initialize: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
    accountType?: AccountType,
  ) => Promise<boolean>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  loadProfile: () => Promise<void>;
  setAccountType: (accountType: AccountType) => Promise<boolean>;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function isDemoModeEnabled(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

const DEMO_USER: User = {
  id: 'demo-user-00000000-0000-0000-0000-000000000000',
  email: 'demo@atlasbanx.com',
  app_metadata: {},
  user_metadata: { full_name: 'Utilisateur Démo' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User;

const DEMO_PROFILE: Profile = {
  id: 'demo-user-00000000-0000-0000-0000-000000000000',
  email: 'demo@atlasbanx.com',
  full_name: 'Utilisateur Démo',
  role: 'admin',
  account_type: 'cabinet',
  organization_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ----------------------------------------------------------------------------
// Store
// ----------------------------------------------------------------------------

export const useAuthStore = create<AuthStore>()((set, get) => ({
  // Initial state
  isInitialized: false,
  isLoading: false,
  isAuthenticated: false,
  isDemoMode: isDemoModeEnabled(),
  user: null,
  profile: null,
  error: null,

  // ============================================================================
  // Initialization
  // ============================================================================

  initialize: async () => {
    set({ isLoading: true, error: null });

    // Mode démo : authentification automatique sans Supabase
    if (isDemoModeEnabled()) {
      set({
        isInitialized: true,
        isLoading: false,
        isAuthenticated: true,
        isDemoMode: true,
        user: DEMO_USER,
        profile: DEMO_PROFILE,
      });
      return;
    }

    // Vérifier que Supabase est configuré
    if (!isSupabaseConfigured()) {
      set({
        isInitialized: true,
        isLoading: false,
        isAuthenticated: false,
        error: 'Supabase non configuré. Contactez l\'administrateur.',
      });
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      set({
        isInitialized: true,
        isLoading: false,
        isAuthenticated: false,
        error: 'Impossible d\'initialiser le client Supabase.',
      });
      return;
    }

    try {
      // Vérifier la session existante
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        set({
          isAuthenticated: true,
          user: session.user,
          isInitialized: true,
          isLoading: false,
        });
        getAuditTrailService().setContext({ userId: session.user.id });
        await get().loadProfile();
      } else {
        set({
          isAuthenticated: false,
          isInitialized: true,
          isLoading: false,
        });
      }

      // Écouter les changements d'état auth (store subscription for cleanup)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          set({
            isAuthenticated: true,
            user: session.user,
          });
          getAuditTrailService().setContext({ userId: session.user.id });
        } else {
          // Note: explicit logout already logs USER_LOGOUT in signOut().
          // The onAuthStateChange SIGNED_OUT event is redundant in that case.
          set({
            isAuthenticated: false,
            user: null,
            profile: null,
          });
          getAuditTrailService().setContext({ userId: null });
        }
      });
      // Store the unsubscribe function for potential cleanup
      (get() as Record<string, unknown>)._authSubscription = subscription;
    } catch (err) {
      set({
        isInitialized: true,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Erreur d\'initialisation de l\'authentification',
      });
    }
  },

  // ============================================================================
  // Supabase Auth
  // ============================================================================

  signInWithEmail: async (email, password) => {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const msg = error.message === 'Invalid login credentials'
          ? 'Identifiants incorrects. Vérifiez votre email et mot de passe.'
          : error.message;
        set({ isLoading: false, error: msg });
        // Login failed event: no user context yet, so we log best-effort.
        // (Will be dropped if user_id is null — acceptable trade-off vs RLS.)
        const hashedEmail = await AuditTrailService.hashSensitive(email);
        auditLog({
          eventType: AuditEventType.USER_LOGIN_FAILED,
          resourceType: 'user',
          action: 'login',
          payload: { emailHash: hashedEmail, reason: msg },
        });
        return false;
      }

      set({ isLoading: false, isAuthenticated: true, user: data.user ?? null });
      if (data.user) {
        getAuditTrailService().setContext({ userId: data.user.id });
        auditLog({
          eventType: AuditEventType.USER_LOGIN,
          resourceType: 'user',
          action: 'login',
          resourceId: data.user.id,
        });
      }
      await get().loadProfile();
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Erreur de connexion',
      });
      return false;
    }
  },

  signUp: async (email, password, fullName, accountType = 'enterprise') => {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    set({ isLoading: true, error: null });

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || '',
            account_type: accountType,
          },
        },
      });

      if (error) {
        set({ isLoading: false, error: error.message });
        return false;
      }

      set({ isLoading: false });
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Erreur d\'inscription',
      });
      return false;
    }
  },

  signOut: async () => {
    const currentUser = get().user;
    if (currentUser) {
      auditLog({
        eventType: AuditEventType.USER_LOGOUT,
        resourceType: 'user',
        action: 'logout',
        resourceId: currentUser.id,
      });
      // Ensure the event is persisted before the auth state is torn down
      await getAuditTrailService().flush();
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }

    set({
      isAuthenticated: false,
      user: null,
      profile: null,
      error: null,
    });
    getAuditTrailService().setContext({ userId: null });
  },

  resetPassword: async (email) => {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    set({ isLoading: true, error: null });

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        set({ isLoading: false, error: error.message });
        return false;
      }

      set({ isLoading: false });
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Erreur de réinitialisation',
      });
      return false;
    }
  },

  setAccountType: async (accountType) => {
    const { profile, user, isDemoMode } = get();

    // Optimistically update local profile
    if (profile) {
      set({ profile: { ...profile, account_type: accountType } });
    }

    // Demo mode: local-only change
    if (isDemoMode) {
      return true;
    }

    const supabase = getSupabaseClient();
    if (!supabase || !user) return true;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_type: accountType })
        .eq('id', user.id);

      if (error) {
        // Rollback on failure — merge into single set() call
        set({ profile: profile ?? get().profile, error: error.message });
        return false;
      }
      return true;
    } catch (err) {
      set({ profile: profile ?? get().profile, error: err instanceof Error ? err.message : 'Erreur de mise à jour du type de compte' });
      return false;
    }
  },

  loadProfile: async () => {
    const supabase = getSupabaseClient();
    const { user } = get();
    if (!supabase || !user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        set({ profile: data as Profile });
      }
    } catch {
      // Profil non trouvé — pas bloquant
    }
  },

  // ============================================================================
  // Common
  // ============================================================================

  clearError: () => set({ error: null }),
}));
