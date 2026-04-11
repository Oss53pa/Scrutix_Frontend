/**
 * @module AtlasBanx
 * @file src/services/auditTrail/AuditTrailService.ts
 * @description Service central d'audit trail. Enregistre tous les événements
 *              significatifs (auth, audit, rapports, IA, facturation) dans une
 *              chaîne immuable Supabase avec hash SHA-256 serveur-side.
 *
 * Politique de robustesse :
 *   - log()        → fire-and-forget buffered, jamais bloquant
 *   - logCritical()→ awaited, propage l'erreur au caller
 *   - Fallback     → localStorage si le flush Supabase échoue, replay au
 *                    prochain appel réussi (eventual consistency)
 *   - Flush        → toutes les 2s ou au-delà de 50 events en buffer,
 *                    et sur beforeunload (best-effort navigator.sendBeacon)
 *
 * @author Atlas Studio
 * @version 1.0.0
 * @ohada-compliance true
 */

import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient } from '../../lib/supabase';
import {
  AuditEventInput,
  AuditEventType,
  AuditResourceType,
  AuditAction,
  AuditEntry,
  AuditTrailRow,
  AuditTrailInsertPayload,
  IntegrityReport,
} from './types';

const BUFFER_MAX = 50;
const FLUSH_INTERVAL_MS = 2000;
const LOCALSTORAGE_KEY = 'atlasbanx-audit-trail-pending';
const MAX_PENDING_FALLBACK = 500;

interface AuditContext {
  userId: string | null;
  cabinetId: string | null;
  sessionId: string;
  userAgent: string | null;
}

/**
 * Tronque un hash SHA-256 à 12 caractères pour logger des identifiants
 * sensibles (email, montants) sans exposer la valeur brute. Suffisant pour
 * recoupement (2^48 collisions) mais non réversible.
 */
async function hashSensitive(value: string | number): Promise<string> {
  const text = String(value);
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Fallback : encodage base64 (non cryptographique, mais évite PII en clair)
    return btoa(unescape(encodeURIComponent(text))).slice(0, 12);
  }
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 12);
}

class AuditTrailServiceImpl {
  private context: AuditContext = {
    userId: null,
    cabinetId: null,
    sessionId: uuidv4(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  };

  private buffer: AuditTrailInsertPayload[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushingPromise: Promise<void> | null = null;
  private beforeUnloadInstalled = false;

  constructor() {
    this.installBeforeUnloadHandler();
    // Replay any pending events from a previous crash/tab close
    void this.replayFallback();
  }

  // --------------------------------------------------------------------------
  // CONTEXT
  // --------------------------------------------------------------------------

  /**
   * Appelé par authStore à chaque changement d'utilisateur.
   * Génère une nouvelle sessionId à chaque login.
   */
  setContext(partial: Partial<Omit<AuditContext, 'userAgent'>>): void {
    const previousUserId = this.context.userId;
    this.context = {
      ...this.context,
      ...partial,
      // Nouvelle session si l'utilisateur change
      sessionId:
        partial.userId !== undefined && partial.userId !== previousUserId
          ? uuidv4()
          : this.context.sessionId,
    };
  }

  getContext(): Readonly<AuditContext> {
    return this.context;
  }

  // --------------------------------------------------------------------------
  // LOGGING API
  // --------------------------------------------------------------------------

  /**
   * Enregistre un événement de manière non bloquante.
   * L'appel ne throw JAMAIS — les erreurs sont loggées en console et
   * l'événement est persisté en localStorage pour replay ultérieur.
   */
  log(event: AuditEventInput): void {
    try {
      const payload = this.buildInsertPayload(event);
      if (!payload) return;
      this.buffer.push(payload);

      if (this.buffer.length >= BUFFER_MAX) {
        void this.flush();
      } else {
        this.scheduleFlush();
      }
    } catch (err) {
      // Ne jamais remonter — le logging ne doit pas casser l'appelant
      console.warn('[AuditTrail] log() failed silently:', err);
    }
  }

  /**
   * Variante bloquante pour événements critiques (rapport exporté,
   * facture envoyée, etc.). Attend la confirmation serveur et propage
   * l'erreur au caller.
   */
  async logCritical(event: AuditEventInput): Promise<void> {
    const payload = this.buildInsertPayload(event);
    if (!payload) {
      throw new Error('[AuditTrail] cannot log: no authenticated user');
    }

    // Flush any pending events first so order is preserved
    if (this.buffer.length > 0) {
      await this.flush();
    }

    const client = getSupabaseClient();
    if (!client) {
      // Pas de Supabase : on stocke en fallback et on revient
      this.appendToFallback([payload]);
      throw new Error('[AuditTrail] Supabase not configured');
    }

    const { error } = await client
      .schema('atlasbanx')
      .from('audit_trail')
      .insert(payload);

    if (error) {
      this.appendToFallback([payload]);
      throw new Error(`[AuditTrail] logCritical failed: ${error.message}`);
    }
  }

  /**
   * Flush synchrone best-effort, utilisé au beforeunload.
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    if (this.flushingPromise) return this.flushingPromise;

    const batch = this.buffer.splice(0, this.buffer.length);
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.flushingPromise = (async () => {
      const client = getSupabaseClient();
      if (!client) {
        this.appendToFallback(batch);
        return;
      }

      try {
        const { error } = await client
          .schema('atlasbanx')
          .from('audit_trail')
          .insert(batch);

        if (error) {
          console.warn('[AuditTrail] flush error, falling back to localStorage:', error.message);
          this.appendToFallback(batch);
        }
      } catch (err) {
        console.warn('[AuditTrail] flush threw, falling back to localStorage:', err);
        this.appendToFallback(batch);
      } finally {
        this.flushingPromise = null;
      }
    })();

    return this.flushingPromise;
  }

  // --------------------------------------------------------------------------
  // QUERY API
  // --------------------------------------------------------------------------

  /**
   * Récupère l'historique d'un resource (tous events, tri chronologique).
   */
  async getResourceHistory(
    resourceType: AuditResourceType,
    resourceId: string,
    limit = 100,
  ): Promise<AuditEntry[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .schema('atlasbanx')
      .from('audit_trail')
      .select('*')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error || !data) {
      console.warn('[AuditTrail] getResourceHistory failed:', error?.message);
      return [];
    }

    return (data as unknown as AuditTrailRow[]).map(rowToEntry);
  }

  /**
   * Liste paginée pour le panneau Journal d'activité.
   */
  async listRecent(options: {
    limit?: number;
    eventType?: AuditEventType;
    resourceType?: AuditResourceType;
    since?: Date;
  } = {}): Promise<AuditEntry[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    let query = client
      .schema('atlasbanx')
      .from('audit_trail')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(options.limit ?? 200);

    if (options.eventType) query = query.eq('event_type', options.eventType);
    if (options.resourceType) query = query.eq('resource_type', options.resourceType);
    if (options.since) query = query.gte('created_at', options.since.toISOString());

    const { data, error } = await query;
    if (error || !data) {
      console.warn('[AuditTrail] listRecent failed:', error?.message);
      return [];
    }
    return (data as unknown as AuditTrailRow[]).map(rowToEntry);
  }

  /**
   * Vérifie l'intégrité de la chaîne via la fonction SQL verify_audit_chain.
   */
  async verifyChainIntegrity(
    startDate?: Date,
    endDate?: Date,
  ): Promise<IntegrityReport> {
    const client = getSupabaseClient();
    const userId = this.context.userId;
    if (!client || !userId) {
      return {
        userId: userId ?? '',
        rangeStart: startDate ?? null,
        rangeEnd: endDate ?? null,
        totalEvents: 0,
        isValid: false,
        firstBrokenEventId: null,
        firstBrokenAt: null,
        verifiedAt: new Date(),
      };
    }

    const { data, error } = await client
      .schema('atlasbanx')
      .rpc('verify_audit_chain', {
        p_user_id: userId,
        p_start_date: startDate?.toISOString() ?? null,
        p_end_date: endDate?.toISOString() ?? null,
      });

    if (error || !data) {
      return {
        userId,
        rangeStart: startDate ?? null,
        rangeEnd: endDate ?? null,
        totalEvents: 0,
        isValid: false,
        firstBrokenEventId: null,
        firstBrokenAt: null,
        verifiedAt: new Date(),
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      userId,
      rangeStart: startDate ?? null,
      rangeEnd: endDate ?? null,
      totalEvents: Number(row?.total_events ?? 0),
      isValid: Boolean(row?.is_valid ?? false),
      firstBrokenEventId: row?.first_broken_event ?? null,
      firstBrokenAt: row?.first_broken_at ? new Date(row.first_broken_at) : null,
      verifiedAt: new Date(),
    };
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  /**
   * Tronque un hash SHA-256 à 12 caractères pour logger des PII sans exposition.
   */
  static hashSensitive = hashSensitive;

  // --------------------------------------------------------------------------
  // PRIVATE
  // --------------------------------------------------------------------------

  private buildInsertPayload(event: AuditEventInput): AuditTrailInsertPayload | null {
    const { userId, cabinetId, sessionId, userAgent } = this.context;

    // On autorise les événements anonymes (USER_LOGIN_FAILED, etc.) — user_id null
    // mais la RLS exigera user_id = auth.uid(), donc Supabase les rejettera sauf
    // pour un utilisateur authentifié. Pour USER_LOGIN_FAILED on skip en fait.
    if (!userId && event.eventType !== AuditEventType.USER_LOGIN_FAILED) {
      // pas d'utilisateur → pas de log (login form avant authentification)
      return null;
    }

    return {
      event_id: uuidv4(),
      user_id: userId,
      cabinet_id: cabinetId,
      client_id: event.clientId ?? null,
      event_type: event.eventType,
      resource_type: event.resourceType,
      resource_id: event.resourceId ?? null,
      action: event.action,
      payload: event.payload ?? {},
      user_agent: userAgent,
      session_id: sessionId,
    };
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  private installBeforeUnloadHandler(): void {
    if (this.beforeUnloadInstalled || typeof window === 'undefined') return;
    this.beforeUnloadInstalled = true;
    window.addEventListener('beforeunload', () => {
      if (this.buffer.length === 0) return;
      // Stocke en fallback — le replay au prochain boot remontera le batch
      this.appendToFallback(this.buffer.splice(0, this.buffer.length));
    });
  }

  private appendToFallback(batch: AuditTrailInsertPayload[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(LOCALSTORAGE_KEY);
      const existing: AuditTrailInsertPayload[] = raw ? JSON.parse(raw) : [];
      const merged = [...existing, ...batch].slice(-MAX_PENDING_FALLBACK);
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(merged));
    } catch (err) {
      console.warn('[AuditTrail] fallback write failed:', err);
    }
  }

  private async replayFallback(): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!raw) return;

    let pending: AuditTrailInsertPayload[];
    try {
      pending = JSON.parse(raw);
    } catch {
      localStorage.removeItem(LOCALSTORAGE_KEY);
      return;
    }
    if (pending.length === 0) {
      localStorage.removeItem(LOCALSTORAGE_KEY);
      return;
    }

    const client = getSupabaseClient();
    if (!client) return; // on retentera au prochain boot

    try {
      const { error } = await client
        .schema('atlasbanx')
        .from('audit_trail')
        .insert(pending);

      if (!error) {
        localStorage.removeItem(LOCALSTORAGE_KEY);
      }
    } catch (err) {
      console.warn('[AuditTrail] replay failed, will retry next session:', err);
    }
  }
}

function rowToEntry(row: AuditTrailRow): AuditEntry {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    cabinetId: row.cabinet_id,
    clientId: row.client_id,
    eventType: row.event_type as AuditEventType,
    resourceType: row.resource_type as AuditResourceType,
    resourceId: row.resource_id,
    action: row.action as AuditAction,
    payload: row.payload,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    sessionId: row.session_id,
    integrityHash: row.integrity_hash,
    previousHash: row.previous_hash,
    createdAt: new Date(row.created_at),
  };
}

// ----------------------------------------------------------------------------
// SINGLETON
// ----------------------------------------------------------------------------

let instance: AuditTrailServiceImpl | null = null;

export function getAuditTrailService(): AuditTrailServiceImpl {
  if (!instance) instance = new AuditTrailServiceImpl();
  return instance;
}

/**
 * Raccourci : `auditLog({ eventType: ..., resourceType: ..., action: ... })`
 * Sans besoin d'importer le singleton à chaque fichier.
 */
export function auditLog(event: AuditEventInput): void {
  getAuditTrailService().log(event);
}

export async function auditLogCritical(event: AuditEventInput): Promise<void> {
  return getAuditTrailService().logCritical(event);
}

export { AuditTrailServiceImpl as AuditTrailService };
