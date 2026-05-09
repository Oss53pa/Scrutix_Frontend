// ============================================================================
// ATLASBANX — Workspace public API (V3 architecture)
// ============================================================================

export type {
  WorkspaceType,
  CabinetRole,
  Workspace,
  CabinetMember,
  ClientAssignment,
} from './types';

export {
  ANOMALY_GATING,
  ROLE_LABEL,
  ROLE_TONE,
  ROLE_RANK,
  roleAtLeast,
} from './types';

export { useWorkspaceStore } from './workspaceStore';
export { useWorkspace, useRole, useWorkspaceMembers } from './useWorkspace';

export type {
  AnomalyWorkflowStatus,
  AnomalyActor,
  AnomalyComment,
  AnomalyWorkflow,
  TransitionPolicy,
  NextAction,
} from './anomalyWorkflow';

export {
  requiredFinalStatus,
  isFullyRatified,
  canTransition,
  nextActionsFor,
  initWorkflow,
} from './anomalyWorkflow';

export { RoleBadge, RoleSelector, WorkspaceTypeBadge } from './RoleBadge';
