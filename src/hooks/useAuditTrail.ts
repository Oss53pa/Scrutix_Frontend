/**
 * @module AtlasBanx
 * @file src/hooks/useAuditTrail.ts
 * @description Hook React pour logger des événements d'audit depuis un
 *              composant, avec le contexte utilisateur auto-injecté.
 * @author Atlas Studio
 * @version 1.0.0
 * @ohada-compliance true
 */

import { useCallback, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { getAuditTrailService, auditLog, auditLogCritical } from '../services/auditTrail';
import type { AuditEventInput, AuditEntry, AuditResourceType } from '../services/auditTrail';

export function useAuditTrail() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  // Synchronise le contexte audit à chaque changement d'utilisateur
  useEffect(() => {
    const service = getAuditTrailService();
    service.setContext({
      userId: user?.id ?? null,
      cabinetId: profile?.organization_id ?? null,
    });
  }, [user?.id, profile?.organization_id]);

  const log = useCallback((event: AuditEventInput) => {
    auditLog(event);
  }, []);

  const logCritical = useCallback(async (event: AuditEventInput) => {
    return auditLogCritical(event);
  }, []);

  const getHistory = useCallback(
    async (
      resourceType: AuditResourceType,
      resourceId: string,
      limit = 100,
    ): Promise<AuditEntry[]> => {
      return getAuditTrailService().getResourceHistory(resourceType, resourceId, limit);
    },
    [],
  );

  return { log, logCritical, getHistory };
}
