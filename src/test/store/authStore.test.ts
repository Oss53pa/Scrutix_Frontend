import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../../store/authStore';

// Mock Supabase module — pas de Supabase configuré par défaut
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: () => false,
  getSupabaseClient: () => null,
}));

// Mock localStorage & sessionStorage
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

describe('AuthStore (Supabase non configuré)', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();

    // Reset store state
    useAuthStore.setState({
      isInitialized: false,
      isLoading: false,
      isAuthenticated: false,
      isDemoMode: false,
      user: null,
      profile: null,
      error: null,
    });
  });

  describe('état initial', () => {
    it('ne doit pas être authentifié par défaut', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isInitialized).toBe(false);
    });
  });

  describe('initialize', () => {
    it('doit afficher une erreur quand Supabase n\'est pas configuré', async () => {
      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.error).toContain('Supabase non configuré');
    });
  });

  describe('clearError', () => {
    it('doit effacer l\'erreur', async () => {
      await useAuthStore.getState().initialize();
      expect(useAuthStore.getState().error).not.toBeNull();

      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('signOut', () => {
    it('doit réinitialiser tout l\'état auth', async () => {
      useAuthStore.setState({ isAuthenticated: true });

      await useAuthStore.getState().signOut();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().profile).toBeNull();
    });
  });

  describe('signInWithEmail', () => {
    it('doit retourner false sans client Supabase', async () => {
      const result = await useAuthStore.getState().signInWithEmail('test@test.com', 'password');
      expect(result).toBe(false);
    });
  });

  describe('signUp', () => {
    it('doit retourner false sans client Supabase', async () => {
      const result = await useAuthStore.getState().signUp('test@test.com', 'password', 'Test');
      expect(result).toBe(false);
    });
  });

  describe('resetPassword', () => {
    it('doit retourner false sans client Supabase', async () => {
      const result = await useAuthStore.getState().resetPassword('test@test.com');
      expect(result).toBe(false);
    });
  });
});
