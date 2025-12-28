import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { User, CabinetSettings, Notification } from '../types';

interface AppState {
  // Current user
  currentUser: User | null;
  users: User[];

  // Cabinet settings
  cabinetSettings: CabinetSettings | null;

  // Notifications
  notifications: Notification[];

  // Theme
  theme: 'light' | 'dark';

  // User management
  setCurrentUser: (user: User | null) => void;
  addUser: (user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => User;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  getUser: (id: string) => User | undefined;

  // Cabinet settings
  setCabinetSettings: (settings: Omit<CabinetSettings, 'id'>) => void;
  updateCabinetSettings: (updates: Partial<CabinetSettings>) => void;

  // Notifications
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearNotifications: () => void;
  getUnreadCount: () => number;

  // Theme
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      users: [],
      cabinetSettings: null,
      notifications: [],
      theme: 'light',

      setCurrentUser: (user) => {
        set({ currentUser: user });
        if (user) {
          get().updateUser(user.id, { lastLogin: new Date() });
        }
      },

      addUser: (userData) => {
        const now = new Date();
        const user: User = {
          id: uuidv4(),
          ...userData,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          users: [...state.users, user],
        }));
        return user;
      },

      updateUser: (id, updates) => {
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id ? { ...u, ...updates, updatedAt: new Date() } : u
          ),
          currentUser:
            state.currentUser?.id === id
              ? { ...state.currentUser, ...updates, updatedAt: new Date() }
              : state.currentUser,
        }));
      },

      deleteUser: (id) => {
        set((state) => ({
          users: state.users.filter((u) => u.id !== id),
        }));
      },

      getUser: (id) => {
        return get().users.find((u) => u.id === id);
      },

      setCabinetSettings: (settings) => {
        set({
          cabinetSettings: {
            id: uuidv4(),
            ...settings,
          },
        });
      },

      updateCabinetSettings: (updates) => {
        set((state) => ({
          cabinetSettings: state.cabinetSettings
            ? { ...state.cabinetSettings, ...updates }
            : null,
        }));
      },

      addNotification: (notification) => {
        const newNotification: Notification = {
          id: uuidv4(),
          ...notification,
          isRead: false,
          createdAt: new Date(),
        };
        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(0, 100), // Keep last 100
        }));
      },

      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        }));
      },

      deleteNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      clearNotifications: () => {
        set({ notifications: [] });
      },

      getUnreadCount: () => {
        return get().notifications.filter((n) => !n.isRead).length;
      },

      setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.toggle('dark', theme === 'dark');
      },

      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        get().setTheme(newTheme);
      },
    }),
    {
      name: 'auditech-app',
      partialize: (state) => ({
        currentUser: state.currentUser,
        users: state.users,
        cabinetSettings: state.cabinetSettings,
        notifications: state.notifications,
        theme: state.theme,
      }),
    }
  )
);
