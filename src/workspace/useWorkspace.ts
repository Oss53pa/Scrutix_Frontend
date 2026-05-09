// ============================================================================
// ATLASBANX — useWorkspace + useRole hooks
// ============================================================================
// Component-level access to the active workspace + role + permission gates.
// Consumers should NEVER hardcode "if cabinet" — always go through these hooks.
// ============================================================================

import { useMemo } from 'react';
import { useWorkspaceStore } from './workspaceStore';
import {
  ANOMALY_GATING,
  type CabinetRole,
  ROLE_LABEL,
  ROLE_RANK,
  ROLE_TONE,
  roleAtLeast,
  type WorkspaceType,
} from './types';

export interface UseWorkspaceReturn {
  workspace: ReturnType<typeof useWorkspaceStore.getState>['workspace'];
  type: WorkspaceType | null;
  isCabinet: boolean;
  isEntreprise: boolean;
  loading: boolean;
}

export function useWorkspace(): UseWorkspaceReturn {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const loading = useWorkspaceStore((s) => s.loading);
  return useMemo(
    () => ({
      workspace,
      type: workspace?.type ?? null,
      isCabinet: workspace?.type === 'cabinet',
      isEntreprise: workspace?.type === 'entreprise',
      loading,
    }),
    [workspace, loading],
  );
}

export interface UseRoleReturn {
  role: CabinetRole | null;
  label: string;
  toneClass: string;
  rank: number;
  /** True when the user has at least the given role (DG > senior > junior > consultation). */
  atLeast: (required: CabinetRole) => boolean;
  /** Permission gates aligned with the anomaly workflow. */
  can: {
    qualify: boolean;
    validate: boolean;
    sign: boolean;
    dismiss: boolean;
    /** Anything DG-only (manage members, sign reports for evidentiary value). */
    admin: boolean;
  };
}

export function useRole(): UseRoleReturn {
  const role = useWorkspaceStore((s) => s.myRole);

  return useMemo(() => {
    const r = role ?? 'consultation';
    return {
      role,
      label: role ? ROLE_LABEL[role] : 'Non connecté',
      toneClass: role ? ROLE_TONE[role] : '',
      rank: role ? ROLE_RANK[role] : -1,
      atLeast: (required: CabinetRole) => (role ? roleAtLeast(role, required) : false),
      can: {
        qualify: role ? ANOMALY_GATING.qualify[r] : false,
        validate: role ? ANOMALY_GATING.validate[r] : false,
        sign: role ? ANOMALY_GATING.sign[r] : false,
        dismiss: role ? ANOMALY_GATING.dismiss[r] : false,
        admin: role === 'dg',
      },
    };
  }, [role]);
}

/**
 * Members of the current workspace — used by the team management UI and by
 * the anomaly workflow to display "@junior", "@senior" mentions.
 */
export function useWorkspaceMembers() {
  return useWorkspaceStore((s) => s.members);
}
