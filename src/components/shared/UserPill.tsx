// ============================================================================
// <UserPill /> — avatar + nom + rôle compact
// ============================================================================

import { RoleBadge } from '../../workspace/RoleBadge';
import type { CabinetRole } from '../../workspace/types';

interface UserPillProps {
  user: {
    userId?: string;
    handle: string;        // ex. 'PameA' (Pamela ATOKOUNA)
    displayName?: string;  // ex. 'Pamela ATOKOUNA'
    role?: CabinetRole | null;
    avatarUrl?: string | null;
  };
  showRole?: boolean;
  className?: string;
}

export function UserPill({ user, showRole = true, className = '' }: UserPillProps) {
  const initials = (user.displayName ?? user.handle)
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-200">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          initials || '?'
        )}
      </span>
      <span className="text-xs font-mono text-ink-700">@{user.handle}</span>
      {showRole && user.role && <RoleBadge role={user.role} compact />}
    </span>
  );
}
