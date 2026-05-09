// ============================================================================
// CDC — React Hooks
// ============================================================================

import { useEffect } from 'react';
import { useCdcStore } from '../store/cdcStore';

/**
 * Load CDC banks on mount
 */
export function useCdcBanks(zone?: string) {
  const { banks, isLoading, error, loadBanks } = useCdcStore();

  useEffect(() => {
    if (banks.length === 0) {
      loadBanks(zone);
    }
  }, [zone]);

  return { banks, isLoading, error, reload: () => loadBanks(zone) };
}

/**
 * Load organizations for a tenant
 */
export function useCdcOrganizations(tenantId: string | null) {
  const { organizations, isLoading, error, loadOrganizations } = useCdcStore();

  useEffect(() => {
    if (tenantId) {
      loadOrganizations(tenantId);
    }
  }, [tenantId]);

  return { organizations, isLoading, error };
}

/**
 * Load bank accounts for an organization
 */
export function useCdcAccounts(orgId: string | null) {
  const { accounts, isLoading, error, loadAccounts } = useCdcStore();

  useEffect(() => {
    if (orgId) {
      loadAccounts(orgId);
    }
  }, [orgId]);

  return { accounts, isLoading, error };
}

/**
 * Load agreements for an organization
 */
export function useCdcAgreements(orgId: string | null, bankId?: string) {
  const { agreements, isLoading, error, loadAgreements } = useCdcStore();

  useEffect(() => {
    if (orgId) {
      loadAgreements(orgId, bankId);
    }
  }, [orgId, bankId]);

  return { agreements, isLoading, error };
}

/**
 * Load audit sessions for a tenant
 */
export function useCdcAuditSessions(tenantId: string | null) {
  const {
    auditSessions,
    selectedSessionId,
    ecarts,
    isLoading,
    error,
    loadAuditSessions,
    selectAuditSession,
  } = useCdcStore();

  useEffect(() => {
    if (tenantId) {
      loadAuditSessions(tenantId);
    }
  }, [tenantId]);

  return {
    sessions: auditSessions,
    selectedSessionId,
    ecarts,
    isLoading,
    error,
    selectSession: selectAuditSession,
  };
}

/**
 * Load jurisdictions on mount
 */
export function useCdcJurisdictions() {
  const { jurisdictions, isLoading, error, loadJurisdictions } = useCdcStore();

  useEffect(() => {
    if (jurisdictions.length === 0) {
      loadJurisdictions();
    }
  }, []);

  return { jurisdictions, isLoading, error };
}
