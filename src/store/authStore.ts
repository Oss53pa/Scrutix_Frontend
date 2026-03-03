// ============================================================================
// SCRUTIX - Auth Store
// Store d'authentification dual mode: Supabase / Legacy
// ============================================================================

import { create } from 'zustand';
import { isSupabaseConfigured, getSupabaseClient } from '../lib/supabase';
import type { Profile } from '../lib/database.types';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type AuthMode = 'supabase' | 'legacy';

interface AuthState {
  mode: AuthMode;
  isInitialized: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  profile: Profile | null;
  error: string | null;
}

interface AuthActions {
  // Initialization
  initialize: () => Promise<void>;

  // Supabase auth
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, fullName?: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  loadProfile: () => Promise<void>;

  // Legacy auth
  legacySignIn: (password: string) => boolean;
  legacySignOut: () => void;

  // Common
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const LEGACY_PASSWORD = 'Scrutix2024!';
const LEGACY_AUTH_KEY = 'scrutix_authenticated';

// ----------------------------------------------------------------------------
// Store
// ----------------------------------------------------------------------------

export const useAuthStore = create<AuthStore>()((set, get) => ({
  // Initial state
  mode: isSupabaseConfigured() ? 'supabase' : 'legacy',
  isInitialized: false,
  isLoading: false,
  isAuthenticated: false,
  user: null,
  profile: null,
  error: null,

  // ============================================================================
  // Initialization
  // ============================================================================

  initialize: async () => {
    const { mode } = get();
    set({ isLoading: true, error: null });

    if (mode === 'supabase') {
      const supabase = getSupabaseClient();
      if (!supabase) {
        // Fallback to legacy if client init fails
        set({
          mode: 'legacy',
          isInitialized: true,
          isLoading: false,
          isAuthenticated: localStorage.getItem(LEGACY_AUTH_KEY) === 'true',
        });
        return;
      }

      try {
        // Check existing session
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          set({
            isAuthenticated: true,
            user: session.user,
            isInitialized: true,
            isLoading: false,
          });
          // Load profile in background
          get().loadProfile();
        } else {
          set({
            isAuthenticated: false,
            isInitialized: true,
            isLoading: false,
          });
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
          if (session?.user) {
            set({
              isAuthenticated: true,
              user: session.user,
            });
          } else {
            set({
              isAuthenticated: false,
              user: null,
              profile: null,
            });
          }
        });
      } catch (err) {
        console.error('Supabase auth init error:', err);
        set({
          isInitialized: true,
          isLoading: false,
          error: 'Erreur initialisation authentification',
        });
      }
    } else {
      // Legacy mode
      set({
        isInitialized: true,
        isLoading: false,
        isAuthenticated: localStorage.getItem(LEGACY_AUTH_KEY) === 'true',
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        set({ isLoading: false, error: error.message });
        return false;
      }

      set({ isLoading: false, isAuthenticated: true });
      get().loadProfile();
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Erreur de connexion',
      });
      return false;
    }
  },

  signUp: async (email, password, fullName) => {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    set({ isLoading: true, error: null });

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || '' },
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
        error: err instanceof Error ? err.message : "Erreur d'inscription",
      });
      return false;
    }
  },

  signOut: async () => {
    const { mode } = get();

    if (mode === 'supabase') {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    }

    // Clear legacy auth too
    localStorage.removeItem(LEGACY_AUTH_KEY);

    set({
      isAuthenticated: false,
      user: null,
      profile: null,
      error: null,
    });
  },

  resetPassword: async (email) => {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    set({ isLoading: true, error: null });

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        set({ isLoading: false, error: error.message });
        return false;
      }

      set({ isLoading: false });
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Erreur reinitialisation',
      });
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
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  },

  // ============================================================================
  // Legacy Auth
  // ============================================================================

  legacySignIn: (password) => {
    if (password.trim() === LEGACY_PASSWORD) {
      localStorage.setItem(LEGACY_AUTH_KEY, 'true');
      set({ isAuthenticated: true, error: null });
      return true;
    }

    set({ error: 'Mot de passe incorrect' });
    return false;
  },

  legacySignOut: () => {
    localStorage.removeItem(LEGACY_AUTH_KEY);
    set({
      isAuthenticated: false,
      user: null,
      profile: null,
      error: null,
    });
  },

  // ============================================================================
  // Common
  // ============================================================================

  clearError: () => set({ error: null }),
}));
