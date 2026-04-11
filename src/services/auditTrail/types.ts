/**
 * @module AtlasBanx
 * @file src/services/auditTrail/types.ts
 * @description Types et enums pour le système d'audit trail immuable.
 *              Chaque événement significatif de l'application est loggé dans
 *              une chaîne chiffrée (SHA-256) pour garantir la valeur probatoire
 *              des rapports d'audit produits.
 * @author Atlas Studio
 * @version 1.0.0
 * @ohada-compliance true
 */

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Catalogue exhaustif des événements traçables. Ajouter une valeur ici
 * implique de la documenter dans AuditTrailPanel pour le filtrage UI.
 */
export enum AuditEventType {
  // Authentication
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_LOGIN_FAILED = 'USER_LOGIN_FAILED',
  MFA_ENABLED = 'MFA_ENABLED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // Clients
  CLIENT_CREATED = 'CLIENT_CREATED',
  CLIENT_UPDATED = 'CLIENT_UPDATED',
  CLIENT_DELETED = 'CLIENT_DELETED',
  CLIENT_ARCHIVED = 'CLIENT_ARCHIVED',

  // Import & processing
  STATEMENT_IMPORTED = 'STATEMENT_IMPORTED',
  STATEMENT_PROCESSED = 'STATEMENT_PROCESSED',
  STATEMENT_DELETED = 'STATEMENT_DELETED',
  OCR_COMPLETED = 'OCR_COMPLETED',

  // Analyses
  ANALYSIS_STARTED = 'ANALYSIS_STARTED',
  ANALYSIS_COMPLETED = 'ANALYSIS_COMPLETED',
  ANALYSIS_FAILED = 'ANALYSIS_FAILED',
  ANOMALY_DETECTED = 'ANOMALY_DETECTED',
  ANOMALY_VALIDATED = 'ANOMALY_VALIDATED',
  ANOMALY_DISMISSED = 'ANOMALY_DISMISSED',

  // Reports
  REPORT_GENERATED = 'REPORT_GENERATED',
  REPORT_EDITED = 'REPORT_EDITED',
  REPORT_EXPORTED_PDF = 'REPORT_EXPORTED_PDF',
  REPORT_SENT_EMAIL = 'REPORT_SENT_EMAIL',
  REPORT_INTEGRITY_CHECKED = 'REPORT_INTEGRITY_CHECKED',

  // Billing (Bloc 4)
  INVOICE_CREATED = 'INVOICE_CREATED',
  INVOICE_SENT = 'INVOICE_SENT',
  INVOICE_PAID = 'INVOICE_PAID',
  INVOICE_CANCELLED = 'INVOICE_CANCELLED',

  // AI
  AI_CALL_MADE = 'AI_CALL_MADE',
  AI_CALL_FAILED = 'AI_CALL_FAILED',

  // Security
  SUSPICIOUS_ACTIVITY_DETECTED = 'SUSPICIOUS_ACTIVITY_DETECTED',
  IP_BLOCKED = 'IP_BLOCKED',
  DATA_EXPORT_REQUESTED = 'DATA_EXPORT_REQUESTED',
}

export type AuditResourceType =
  | 'analysis'
  | 'report'
  | 'client'
  | 'invoice'
  | 'import'
  | 'user'
  | 'statement'
  | 'anomaly'
  | 'ai_call'
  | 'system';

export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'exported'
  | 'sent'
  | 'signed'
  | 'started'
  | 'completed'
  | 'failed'
  | 'login'
  | 'logout'
  | 'detected'
  | 'validated'
  | 'dismissed';

// ============================================================================
// PAYLOADS
// ============================================================================

/**
 * Événement à logger. L'appelant n'a pas à remplir user_id / session_id /
 * user_agent / event_id — le service le fait automatiquement depuis le
 * contexte d'authentification.
 */
export interface AuditEventInput {
  eventType: AuditEventType;
  resourceType: AuditResourceType;
  action: AuditAction;
  resourceId?: string | null;
  clientId?: string | null;
  /**
   * Payload JSON libre. IMPORTANT : ne jamais y mettre de PII ou de montants
   * bruts sans passer par hashSensitive(). Voir AuditTrailService.hashSensitive.
   */
  payload?: Record<string, unknown>;
}

/**
 * Enregistrement tel que renvoyé par Supabase (colonnes snake_case).
 */
export interface AuditTrailRow {
  id: string;
  event_id: string;
  user_id: string | null;
  cabinet_id: string | null;
  client_id: string | null;
  event_type: string;
  resource_type: string;
  resource_id: string | null;
  action: string;
  payload: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  integrity_hash: string;
  previous_hash: string | null;
  created_at: string;
}

/**
 * Entrée normalisée côté UI (camelCase, Date parsée).
 */
export interface AuditEntry {
  id: string;
  eventId: string;
  userId: string | null;
  cabinetId: string | null;
  clientId: string | null;
  eventType: AuditEventType;
  resourceType: AuditResourceType;
  resourceId: string | null;
  action: AuditAction;
  payload: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  integrityHash: string;
  previousHash: string | null;
  createdAt: Date;
}

// ============================================================================
// INTEGRITY VERIFICATION
// ============================================================================

export interface IntegrityReport {
  userId: string;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  totalEvents: number;
  isValid: boolean;
  firstBrokenEventId: string | null;
  firstBrokenAt: Date | null;
  verifiedAt: Date;
}

export interface IntegrityCertificate {
  /** UUID du rapport audité */
  reportId: string;
  /** Date de génération du certificat */
  generatedAt: Date;
  /** Hash final de la chaîne pour ce rapport (dernier intégrityHash lié) */
  chainHash: string;
  /** Chaîne de custody : actions tracées sur ce rapport */
  chainOfCustody: Array<{
    timestamp: Date;
    action: AuditAction;
    eventType: AuditEventType;
    actor: string; // user id ou 'system'
    hash: string;
  }>;
  /** Nombre d'événements dans la chaîne */
  eventCount: number;
  /** Flag d'intégrité */
  isValid: boolean;
}

// ============================================================================
// BUFFER / INTERNAL
// ============================================================================

/**
 * Entrée prête à l'insertion Supabase (avec métadonnées résolues).
 * Utilisé en interne par le service et sa file d'attente.
 */
export interface AuditTrailInsertPayload {
  event_id: string;
  user_id: string | null;
  cabinet_id: string | null;
  client_id: string | null;
  event_type: string;
  resource_type: string;
  resource_id: string | null;
  action: string;
  payload: Record<string, unknown>;
  user_agent: string | null;
  session_id: string | null;
}
