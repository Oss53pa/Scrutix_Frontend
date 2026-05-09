// ============================================================================
// ATLASBANX — Workspace types (V3 architecture foundation)
// ============================================================================
// First-class workspace_type drives all navigation. A workspace is either
// a cabinet (multi-client, multi-collaborator with role hierarchy) or an
// entreprise (single-org, all members see everything, no client browsing).
//
// 90% of the codebase is shared between modes. The workspace_type acts as
// a router-level guard plus per-component conditional UI.
// ============================================================================

export type WorkspaceType = 'cabinet' | 'entreprise';

/** Cabinet roles, in increasing privilege order. */
export type CabinetRole = 'consultation' | 'junior' | 'senior' | 'dg';

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  ownerId: string;
  /** Branding, default report cabinet info, etc. */
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CabinetMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: CabinetRole;
  invitedBy: string | null;
  createdAt: Date;
  /** Joined from auth.users — populated by the API */
  fullName?: string;
  email?: string;
}

export interface ClientAssignment {
  id: string;
  clientId: string;
  userId: string;
  role: CabinetRole;
  assignedBy: string | null;
  createdAt: Date;
  fullName?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// PERMISSION MATRIX — single source of truth for "who can do what"
// ───────────────────────────────────────────────────────────────────────────

/** Severity-keyed gating matrix for the anomaly workflow. */
export const ANOMALY_GATING: Record<
  'qualify' | 'validate' | 'sign' | 'dismiss',
  Record<CabinetRole, boolean>
> = {
  qualify: {
    consultation: false,
    junior: true,
    senior: true,
    dg: true,
  },
  validate: {
    consultation: false,
    junior: false,
    senior: true,
    dg: true,
  },
  sign: {
    consultation: false,
    junior: false,
    senior: false,
    dg: true,
  },
  dismiss: {
    consultation: false,
    junior: true,
    senior: true,
    dg: true,
  },
};

export const ROLE_LABEL: Record<CabinetRole, string> = {
  dg: 'Directeur',
  senior: 'Senior',
  junior: 'Junior',
  consultation: 'Consultation',
};

export const ROLE_TONE: Record<CabinetRole, string> = {
  dg: 'bg-amber-100 text-amber-800 border-amber-300',
  senior: 'bg-blue-100 text-blue-800 border-blue-300',
  junior: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  consultation: 'bg-canvas-200 text-ink-700 border-primary-300',
};

/** Numeric ordering for comparisons (e.g., "is at least senior?") */
export const ROLE_RANK: Record<CabinetRole, number> = {
  consultation: 0,
  junior: 1,
  senior: 2,
  dg: 3,
};

export function roleAtLeast(actual: CabinetRole, required: CabinetRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}
