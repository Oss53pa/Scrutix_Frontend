/**
 * @module AtlasBanx
 * @file src/security/index.ts
 * @description Barrel export du module Sécurité & Conformité (Bloc 3).
 */

// Password & HIBP
export {
  validatePasswordStrength,
  validatePasswordFull,
  checkHaveIBeenPwned,
} from './PasswordPolicy';
export type {
  PasswordStrength,
  PasswordValidationResult,
  PasswordBreachResult,
} from './PasswordPolicy';

// Login throttling
export { LoginThrottle } from './LoginThrottle';
export type { ThrottleStatus } from './LoginThrottle';

// MFA
export { MfaService } from './MfaService';
export type { MfaFactor, MfaEnrollment } from './MfaService';

// File security
export { FileSecurityValidator } from './FileSecurityValidator';
export type { FileValidationResult, DetectedFileType } from './FileSecurityValidator';

// Consent & compliance
export { ConsentService } from './ConsentService';
export type { PolicyVersion, ConsentRecord, PolicyType } from './ConsentService';

// Data deletion (GDPR erasure)
export { DataDeletionService } from './DataDeletionService';
export type { DeletionRequest, DeletionStatus } from './DataDeletionService';

// IP allowlists
export { IpAllowlistService } from './IpAllowlistService';
export type { IpAllowlistRule } from './IpAllowlistService';
