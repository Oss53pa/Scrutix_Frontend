// ============================================================================
// ATLASBANX — RoleBadge + WorkspaceTypeBadge UI components
// ============================================================================
// Visual surfaces for the role system. The RoleBadge appears next to the
// connected user (top-right of the layout). Buttons throughout the app
// disable themselves based on `useRole().can.*` — when disabled, hovering
// shows an explanation tooltip ("Réservé aux DG").
// ============================================================================

import { Crown, ShieldCheck, GraduationCap, Eye, Building2, Briefcase } from 'lucide-react';
import { ROLE_LABEL, ROLE_TONE, type CabinetRole, type WorkspaceType } from './types';
import { useRole, useWorkspace } from './useWorkspace';

const ROLE_ICON: Record<CabinetRole, typeof Crown> = {
  dg: Crown,
  senior: ShieldCheck,
  junior: GraduationCap,
  consultation: Eye,
};

interface RoleBadgeProps {
  role?: CabinetRole;
  /** When true, shows just the icon (compact mode for tight headers). */
  compact?: boolean;
  className?: string;
}

export function RoleBadge({ role: explicitRole, compact = false, className = '' }: RoleBadgeProps) {
  const { role: currentRole } = useRole();
  const role = explicitRole ?? currentRole;
  if (!role) return null;

  const Icon = ROLE_ICON[role];
  const tone = ROLE_TONE[role];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full border ${tone} ${className}`}
        title={ROLE_LABEL[role]}
      >
        <Icon className="w-3 h-3" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-pill text-[11px] font-semibold border ${tone} ${className}`}
    >
      <Icon className="w-3 h-3" />
      {ROLE_LABEL[role]}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// WorkspaceTypeBadge — shows whether the user is in cabinet or entreprise mode
// ───────────────────────────────────────────────────────────────────────────

interface WorkspaceTypeBadgeProps {
  type?: WorkspaceType;
  className?: string;
}

export function WorkspaceTypeBadge({ type: explicitType, className = '' }: WorkspaceTypeBadgeProps) {
  const { type: currentType } = useWorkspace();
  const type = explicitType ?? currentType;
  if (!type) return null;

  const Icon = type === 'cabinet' ? Briefcase : Building2;
  const label = type === 'cabinet' ? 'Cabinet' : 'Entreprise';
  const tone =
    type === 'cabinet'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-blue-50 text-blue-800 border-blue-200';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-pill text-[10px] font-semibold uppercase tracking-wider border ${tone} ${className}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// RoleSelector — DEMO-MODE-ONLY widget to switch roles at runtime
// ───────────────────────────────────────────────────────────────────────────
// Displayed in the top bar when the app is in demo mode. Lets the demo user
// experience the UI from each role's perspective without re-signing-in.
// In production, this is hidden — the role is server-controlled via RLS.
// ───────────────────────────────────────────────────────────────────────────

interface RoleSelectorProps {
  onSelect: (role: CabinetRole) => void;
  current?: CabinetRole;
  className?: string;
}

export function RoleSelector({ onSelect, current, className = '' }: RoleSelectorProps) {
  return (
    <div className={`inline-flex bg-canvas-100 rounded-lg p-0.5 ${className}`}>
      {(['dg', 'senior', 'junior', 'consultation'] as CabinetRole[]).map((r) => {
        const Icon = ROLE_ICON[r];
        const active = current === r;
        return (
          <button
            key={r}
            onClick={() => onSelect(r)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              active
                ? 'bg-white text-ink-900 shadow-sm'
                : 'text-ink-500 hover:text-ink-900'
            }`}
            title={`Passer en mode ${ROLE_LABEL[r]}`}
          >
            <Icon className="w-3 h-3" />
            {ROLE_LABEL[r]}
          </button>
        );
      })}
    </div>
  );
}
