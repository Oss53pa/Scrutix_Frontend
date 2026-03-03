import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../../store/authStore';

// Mock the supabase module to always return 'legacy' mode
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: () => false,
  getSupabaseClient: () => null,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: () => { store = {}; },
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

describe('AuthStore (Legacy Mode)', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();

    // Reset store state
    useAuthStore.setState({
      mode: 'legacy',
      isInitialized: false,
      isLoading: false,
      isAuthenticated: false,
      user: null,
      profile: null,
      error: null,
    });
  });

  describe('initial state', () => {
    it('should default to legacy mode when Supabase is not configured', () => {
      const state = useAuthStore.getState();
      expect(state.mode).toBe('legacy');
      expect(state.isAuthenticated).toBe(false);
      expect(state.isInitialized).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should initialize in legacy mode', async () => {
      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.mode).toBe('legacy');
    });

    it('should restore authenticated state from localStorage', async () => {
      localStorageMock.getItem.mockReturnValueOnce('true');

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('should not be authenticated when localStorage has no auth key', async () => {
      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('legacySignIn', () => {
    it('should authenticate with correct password', () => {
      const result = useAuthStore.getState().legacySignIn('Scrutix2024!');

      expect(result).toBe(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('scrutix_authenticated', 'true');
    });

    it('should reject wrong password', () => {
      const result = useAuthStore.getState().legacySignIn('wrongpassword');

      expect(result).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().error).toBe('Mot de passe incorrect');
    });

    it('should reject empty password', () => {
      const result = useAuthStore.getState().legacySignIn('');

      expect(result).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('should trim password before comparison', () => {
      const result = useAuthStore.getState().legacySignIn('  Scrutix2024!  ');

      // trim() only trims left/right, the password constant doesn't have spaces
      // so "  Scrutix2024!  ".trim() === "Scrutix2024!" → should pass
      expect(result).toBe(true);
    });
  });

  describe('legacySignOut', () => {
    it('should clear authenticated state', () => {
      // First sign in
      useAuthStore.getState().legacySignIn('Scrutix2024!');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Then sign out
      useAuthStore.getState().legacySignOut();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().profile).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('scrutix_authenticated');
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      // Trigger an error
      useAuthStore.getState().legacySignIn('wrong');
      expect(useAuthStore.getState().error).not.toBeNull();

      // Clear it
      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('signOut (common)', () => {
    it('should clear all auth state in legacy mode', async () => {
      // Sign in first
      useAuthStore.getState().legacySignIn('Scrutix2024!');

      // Use common signOut
      await useAuthStore.getState().signOut();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().profile).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('scrutix_authenticated');
    });
  });
});
