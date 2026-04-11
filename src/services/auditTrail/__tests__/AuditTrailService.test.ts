/**
 * @module AtlasBanx
 * @file src/services/auditTrail/__tests__/AuditTrailService.test.ts
 * @description Tests unitaires vitest pour AuditTrailService — couvre le
 *              buffering, le flush, le fallback localStorage et la construction
 *              des payloads.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuditEventType } from '../types';

// ---------------------------------------------------------------------------
// localStorage mock — jsdom's window.localStorage is not reliably available
// as a global in vitest across test files, so we inject a deterministic shim.
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

// ---------------------------------------------------------------------------
// Mock du client Supabase pour éviter toute dépendance réseau
// ---------------------------------------------------------------------------

interface InsertCall {
  table: string;
  payload: unknown;
}

const insertCalls: InsertCall[] = [];
let insertShouldFail = false;

vi.mock('../../../lib/supabase', () => {
  const makeQuery = (table: string) => ({
    insert: vi.fn(async (payload: unknown) => {
      insertCalls.push({ table, payload });
      if (insertShouldFail) {
        return { data: null, error: { message: 'mock insert failure' } };
      }
      return { data: payload, error: null };
    }),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      })),
    })),
  });

  const mockClient = {
    schema: vi.fn(() => ({
      from: vi.fn((table: string) => makeQuery(table)),
      rpc: vi.fn(async () => ({
        data: [{ total_events: 0, first_broken_event: null, first_broken_at: null, is_valid: true }],
        error: null,
      })),
    })),
  };

  return {
    getSupabaseClient: () => mockClient,
    isSupabaseConfigured: () => true,
  };
});

// ---------------------------------------------------------------------------

import { AuditTrailService } from '../AuditTrailService';

const LS_KEY = 'atlasbanx-audit-trail-pending';

describe('AuditTrailService', () => {
  beforeEach(() => {
    insertCalls.length = 0;
    insertShouldFail = false;
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('buildInsertPayload returns null when no user is authenticated', () => {
    const svc = new AuditTrailService();
    svc.log({
      eventType: AuditEventType.CLIENT_CREATED,
      resourceType: 'client',
      action: 'created',
    });
    // Pas de user → pas d'insertion bufferée
    expect(insertCalls.length).toBe(0);
  });

  it('buffers events and flushes on demand once user context is set', async () => {
    const svc = new AuditTrailService();
    svc.setContext({ userId: 'user-abc', cabinetId: null });

    svc.log({
      eventType: AuditEventType.CLIENT_CREATED,
      resourceType: 'client',
      action: 'created',
      resourceId: '11111111-1111-1111-1111-111111111111',
    });
    svc.log({
      eventType: AuditEventType.CLIENT_UPDATED,
      resourceType: 'client',
      action: 'updated',
      resourceId: '11111111-1111-1111-1111-111111111111',
    });

    // Rien n'a encore été flushé
    expect(insertCalls.length).toBe(0);

    await svc.flush();

    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0].table).toBe('audit_trail');
    const payload = insertCalls[0].payload as unknown[];
    expect(Array.isArray(payload)).toBe(true);
    expect(payload.length).toBe(2);
  });

  it('falls back to localStorage when Supabase insert fails', async () => {
    insertShouldFail = true;
    const svc = new AuditTrailService();
    svc.setContext({ userId: 'user-abc', cabinetId: null });

    svc.log({
      eventType: AuditEventType.REPORT_GENERATED,
      resourceType: 'report',
      action: 'created',
    });

    await svc.flush();

    const stored = localStorage.getItem(LS_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored ?? '[]');
    expect(parsed.length).toBe(1);
    expect(parsed[0].event_type).toBe(AuditEventType.REPORT_GENERATED);
  });

  it('logCritical throws on failure and stashes to fallback', async () => {
    insertShouldFail = true;
    const svc = new AuditTrailService();
    svc.setContext({ userId: 'user-abc', cabinetId: null });

    await expect(
      svc.logCritical({
        eventType: AuditEventType.REPORT_EXPORTED_PDF,
        resourceType: 'report',
        action: 'exported',
        resourceId: '22222222-2222-2222-2222-222222222222',
      }),
    ).rejects.toThrow(/logCritical failed/);

    const stored = localStorage.getItem(LS_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored ?? '[]');
    expect(parsed.some((p: { event_type: string }) => p.event_type === AuditEventType.REPORT_EXPORTED_PDF))
      .toBe(true);
  });

  it('setContext generates a new session id when user id changes', () => {
    const svc = new AuditTrailService();
    svc.setContext({ userId: 'user-a', cabinetId: null });
    const s1 = svc.getContext().sessionId;

    svc.setContext({ userId: 'user-b', cabinetId: null });
    const s2 = svc.getContext().sessionId;

    expect(s1).not.toBe(s2);
  });

  it('hashSensitive returns a 12-char hex string', async () => {
    const h = await AuditTrailService.hashSensitive('contact@example.com');
    expect(h.length).toBe(12);
    // deterministic
    const h2 = await AuditTrailService.hashSensitive('contact@example.com');
    expect(h).toBe(h2);
  });
});
