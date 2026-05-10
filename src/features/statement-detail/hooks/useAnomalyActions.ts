// ============================================================================
// useAnomalyActions — extrait la logique de transitions du workflow
// ============================================================================
// Wrap useAnomalies pour exposer une API plus ciblée sur les actions :
//   - getAvailableActions(anomaly) selon rôle courant
//   - performAction(kind, anomaly, comment)
//
// Permet à un composant qui ne fait que des actions de ne pas dépendre de
// l'ensemble du store anomalies (évite les re-renders inutiles).
// ============================================================================

import { useCallback } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { useRole } from '../../../workspace/useWorkspace';
import { useAnomalies } from './useAnomalies';
import { getAvailableActions } from '../workflow/anomalyActions';
import type { Anomaly, DialogAction, DialogKind } from '../types/statement.types';

export interface UseAnomalyActionsResult {
  /** Renvoie les actions disponibles pour l'utilisateur courant sur cette anomalie. */
  availableActionsFor: (anomaly: Anomaly) => DialogAction[];
  /** Applique une action workflow + persiste audit. */
  performAction: (kind: DialogKind, anomaly: Anomaly, comment: string) => Promise<void>;
  /** Ajoute un commentaire (avec mentions). */
  addComment: (anomalyId: string, content: string, mentions: string[]) => Promise<void>;
}

export function useAnomalyActions(statementId: string): UseAnomalyActionsResult {
  const anomaliesH = useAnomalies(statementId);
  const authUser = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const { role } = useRole();

  const userId = authUser?.id ?? '';
  const handle = buildHandle(profile, authUser?.email);

  const availableActionsFor = useCallback(
    (anomaly: Anomaly) => (role ? getAvailableActions(role, anomaly) : []),
    [role],
  );

  const performAction = useCallback<UseAnomalyActionsResult['performAction']>(
    async (kind, anomaly, comment) => {
      if (!role || !userId) return;
      await anomaliesH.performAction(kind, anomaly.id, handle, userId, role, comment);
    },
    [anomaliesH, handle, role, userId],
  );

  const addComment = useCallback<UseAnomalyActionsResult['addComment']>(
    async (anomalyId, content, mentions) => {
      if (!role || !userId) return;
      await anomaliesH.addComment(anomalyId, content, mentions, { userId, handle, role });
    },
    [anomaliesH, handle, role, userId],
  );

  return { availableActionsFor, performAction, addComment };
}

function buildHandle(
  profile: { full_name?: string | null } | null,
  email?: string | null,
): string {
  if (profile?.full_name) {
    const parts = profile.full_name.trim().split(/\s+/);
    if (parts.length >= 2) return parts[0] + parts[1][0].toUpperCase();
    return parts[0];
  }
  if (email) return email.split('@')[0];
  return 'user';
}
