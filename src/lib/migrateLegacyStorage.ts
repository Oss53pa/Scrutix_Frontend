// ============================================================================
// ATLASBANX - Legacy storage migration (from legacy `scrutix-*` keys)
// One-shot rename of localStorage keys from `scrutix-*` to `atlasbanx-*`.
// Must run BEFORE any zustand/persist store module is imported, otherwise
// stores will hydrate from the new (empty) keys before migration happens.
// Import this file FIRST in main.tsx.
// ============================================================================

const LEGACY_KEY_SUFFIXES = [
  // Store persistence
  'transactions',
  'settings',
  'reports',
  'regulatory-store',
  'rag',
  'clients',
  'banks',
  'analysis',
  'billing',
  // Misc
  'dark-mode',
  'rate-limits',
  'rate-limits-config',
  'app-version',
  'app',
];

const MIGRATION_FLAG = 'atlasbanx-migrated-from-scrutix';

export function migrateLegacyStorage(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    if (localStorage.getItem(MIGRATION_FLAG) === 'true') return;

    for (const suffix of LEGACY_KEY_SUFFIXES) {
      const oldKey = `scrutix-${suffix}`;
      const newKey = `atlasbanx-${suffix}`;
      const value = localStorage.getItem(oldKey);
      if (value !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, value);
        localStorage.removeItem(oldKey);
      }
    }

    localStorage.setItem(MIGRATION_FLAG, 'true');
  } catch {
    // localStorage may be unavailable (private mode, quota) — non-fatal
  }
}

// Run immediately on import (side-effect module)
migrateLegacyStorage();
