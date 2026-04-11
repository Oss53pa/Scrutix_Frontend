/**
 * @module AtlasBanx
 * @file src/services/auditTrail/index.ts
 * @description Barrel export du module Audit Trail.
 */

export {
  AuditTrailService,
  getAuditTrailService,
  auditLog,
  auditLogCritical,
} from './AuditTrailService';

export {
  generateIntegrityCertificate,
  formatCertificateForPdf,
} from './IntegrityCertificate';

export {
  AuditEventType,
} from './types';

export type {
  AuditEventInput,
  AuditEntry,
  AuditTrailRow,
  AuditTrailInsertPayload,
  AuditResourceType,
  AuditAction,
  IntegrityReport,
  IntegrityCertificate,
} from './types';
