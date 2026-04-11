import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoginThrottle } from '../LoginThrottle';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

describe('LoginThrottle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('allows login by default when no prior attempts', () => {
    const status = LoginThrottle.check('new@example.com');
    expect(status.allowed).toBe(true);
    expect(status.remainingAttempts).toBe(LoginThrottle.MAX_ATTEMPTS);
    expect(status.lockedUntil).toBeNull();
  });

  it('decrements remainingAttempts on recorded failures', () => {
    LoginThrottle.recordFailure('user@example.com');
    LoginThrottle.recordFailure('user@example.com');
    const status = LoginThrottle.check('user@example.com');
    expect(status.allowed).toBe(true);
    expect(status.remainingAttempts).toBe(LoginThrottle.MAX_ATTEMPTS - 2);
  });

  it('locks the account after 5 consecutive failures', () => {
    for (let i = 0; i < LoginThrottle.MAX_ATTEMPTS; i++) {
      LoginThrottle.recordFailure('lockme@example.com');
    }
    const status = LoginThrottle.check('lockme@example.com');
    expect(status.allowed).toBe(false);
    expect(status.lockedUntil).not.toBeNull();
    expect(status.lockedForSeconds).toBeGreaterThan(0);
  });

  it('isolates throttle counters per email', () => {
    for (let i = 0; i < LoginThrottle.MAX_ATTEMPTS; i++) {
      LoginThrottle.recordFailure('a@example.com');
    }
    expect(LoginThrottle.check('a@example.com').allowed).toBe(false);
    expect(LoginThrottle.check('b@example.com').allowed).toBe(true);
  });

  it('reset() clears the counter for a given email', () => {
    for (let i = 0; i < 3; i++) LoginThrottle.recordFailure('reset@example.com');
    LoginThrottle.reset('reset@example.com');
    const status = LoginThrottle.check('reset@example.com');
    expect(status.allowed).toBe(true);
    expect(status.remainingAttempts).toBe(LoginThrottle.MAX_ATTEMPTS);
  });

  it('case-insensitive on email', () => {
    LoginThrottle.recordFailure('User@Example.com');
    const status = LoginThrottle.check('user@example.com');
    expect(status.remainingAttempts).toBe(LoginThrottle.MAX_ATTEMPTS - 1);
  });
});
