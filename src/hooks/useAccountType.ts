// ============================================================================
// ATLASBANX - useAccountType hook
// Returns the current user's account type (enterprise vs cabinet)
// Legacy accounts (no account_type) fall back to 'cabinet' for retro-compat.
// ============================================================================

import { useAuthStore } from '../store/authStore';
import type { AccountType } from '../lib/database.types';

export function useAccountType(): {
  accountType: AccountType;
  isEnterprise: boolean;
  isCabinet: boolean;
} {
  const profile = useAuthStore((s) => s.profile);
  const accountType: AccountType = profile?.account_type ?? 'cabinet';
  return {
    accountType,
    isEnterprise: accountType === 'enterprise',
    isCabinet: accountType === 'cabinet',
  };
}
