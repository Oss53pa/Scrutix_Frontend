// ============================================================================
// <RoleGuard /> — affichage conditionnel selon rôle utilisateur
// ============================================================================

import type { ReactNode } from 'react';
import { useRole } from '../../workspace/useWorkspace';
import type { CabinetRole } from '../../workspace/types';

interface RoleGuardProps {
  /** Rôles autorisés. L'enfant s'affiche si le rôle courant est dans la liste. */
  role: CabinetRole | CabinetRole[];
  children: ReactNode;
  /** Fallback affiché si le rôle ne matche pas (par défaut: rien). */
  fallback?: ReactNode;
}

export function RoleGuard({ role, children, fallback = null }: RoleGuardProps) {
  const { role: currentRole } = useRole();
  if (!currentRole) return <>{fallback}</>;

  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(currentRole)) return <>{fallback}</>;

  return <>{children}</>;
}
