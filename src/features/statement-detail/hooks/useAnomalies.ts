// ============================================================================
// useAnomalies — load + transitions workflow + commentaires + audit chain
// ============================================================================
// Bascule auto :
//   - Supabase configuré → lecture/écriture réelle via anomaliesApi
//   - Sinon → fallback mock (mock-data.ts) pour développement offline
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type {
  Anomaly,
  AnomalyComment,
  AuditEntry,
  DialogKind,
} from '../types/statement.types';
import {
  MOCK_ANOMALIES,
  MOCK_COMMENTS,
  MOCK_AUDIT_TRAIL,
} from '../mock-data';
import { isSupabaseConfigured } from '../../../lib/supabase';
import {
  loadAnomalies as remoteLoadAnomalies,
  loadAnomalyComments as remoteLoadComments,
  loadAuditTrail as remoteLoadAudit,
  performTransition as remotePerformTransition,
  addComment as remoteAddComment,
} from '../api/anomaliesApi';

export interface UseAnomaliesResult {
  anomalies: Anomaly[];
  comments: AnomalyComment[];
  auditTrail: AuditEntry[];
  loading: boolean;
  error: string | null;

  performAction: (
    kind: DialogKind,
    anomalyId: string,
    actorHandle: string,
    actorUserId: string,
    actorRole: AuditEntry['actor']['role'],
    comment: string,
  ) => Promise<void>;

  addComment: (
    anomalyId: string,
    content: string,
    mentions: string[],
    author: { userId: string; handle: string; role: AuditEntry['actor']['role'] },
  ) => Promise<void>;

  refresh: () => Promise<void>;
}

export function useAnomalies(statementId: string): UseAnomaliesResult {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [comments, setComments] = useState<AnomalyComment[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isSupabaseConfigured()) {
        const ax = await remoteLoadAnomalies(statementId);
        setAnomalies(ax);
        const ids = ax.map((a) => a.id);
        const [cx, ax2] = await Promise.all([
          remoteLoadComments(ids),
          remoteLoadAudit(ids),
        ]);
        setComments(cx);
        setAuditTrail(ax2);
      } else {
        // Fallback mock
        setAnomalies(MOCK_ANOMALIES.filter((a) => a.statementId === statementId));
        setComments(MOCK_COMMENTS);
        setAuditTrail(MOCK_AUDIT_TRAIL);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'load failed');
    } finally {
      setLoading(false);
    }
  }, [statementId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // ============================================================================
  // performAction
  // ============================================================================

  const performAction = useCallback<UseAnomaliesResult['performAction']>(
    async (kind, anomalyId, actorHandle, actorUserId, actorRole, comment) => {
      if (isSupabaseConfigured()) {
        try {
          const out = await remotePerformTransition(
            kind,
            anomalyId,
            { userId: actorUserId, userHandle: actorHandle },
            comment,
          );
          // Optimistic refresh
          setAuditTrail((xs) => [...xs, out.entry]);
          setAnomalies((xs) =>
            xs.map((a) => (a.id === anomalyId ? applyLocalTransition(a, kind, {
              userId: actorUserId, userHandle: actorHandle, at: new Date().toISOString(), comment,
            }) : a)),
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : 'transition failed');
          throw err;
        }
        return;
      }

      // Fallback mock — applique en mémoire
      const now = new Date().toISOString();
      const target = anomalies.find((a) => a.id === anomalyId);
      if (!target) return;
      const next = applyLocalTransition(target, kind, { userId: actorUserId, userHandle: actorHandle, at: now, comment });
      setAnomalies((xs) => xs.map((a) => (a.id === anomalyId ? next : a)));
      setAuditTrail((xs) => {
        const entry: AuditEntry = {
          id: 'audit-' + Math.random().toString(36).slice(2, 10),
          entityType: 'anomaly',
          entityId: anomalyId,
          action: actionFromKind(kind),
          actor: { userId: actorUserId, handle: actorHandle, role: actorRole },
          payload: { old_value: { status: target.status }, new_value: { status: next.status }, comment },
          hash: 'h' + Math.random().toString(36).slice(2, 12),
          prevHash: xs.length > 0 ? xs[xs.length - 1].hash : null,
          createdAt: now,
        };
        return [...xs, entry];
      });
    },
    [anomalies],
  );

  // ============================================================================
  // addComment
  // ============================================================================

  const addComment = useCallback<UseAnomaliesResult['addComment']>(
    async (anomalyId, content, mentions, author) => {
      if (isSupabaseConfigured()) {
        try {
          const c = await remoteAddComment(anomalyId, author.userId, content, mentions);
          // Le mapper API ne connaît pas le rôle — on l'enrichit ici
          c.author = { ...c.author, handle: author.handle, role: author.role };
          setComments((xs) => [...xs, c]);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'comment failed');
          throw err;
        }
        return;
      }

      // Mock
      const now = new Date().toISOString();
      setComments((xs) => [...xs, {
        id: 'cmt-' + Math.random().toString(36).slice(2, 10),
        anomalyId,
        author,
        content,
        mentions,
        createdAt: now,
      }]);
    },
    [],
  );

  return { anomalies, comments, auditTrail, loading, error, performAction, addComment, refresh: fetchAll };
}

// ============================================================================
// Helpers
// ============================================================================

interface ActorMeta {
  userId: string;
  userHandle: string;
  at: string;
  comment: string;
}

function applyLocalTransition(a: Anomaly, kind: DialogKind, m: ActorMeta): Anomaly {
  const ref = { userId: m.userId, userHandle: m.userHandle, at: m.at };
  switch (kind) {
    case 'qualifyDialog':       return { ...a, status: 'qualified', qualifiedBy: ref };
    case 'validateDialog':      return { ...a, status: 'validated', validatedBy: ref };
    case 'signDialog':          return { ...a, status: 'signed', signedBy: ref };
    case 'closeDialog':         return { ...a, status: 'closed', closedBy: { ...ref, reason: m.comment } };
    case 'falsePositiveDialog': return { ...a, status: 'false_positive' };
    case 'rejectDialog': {
      if (a.status === 'qualified') return { ...a, status: 'detected', qualifiedBy: null };
      if (a.status === 'validated') return { ...a, status: 'qualified', validatedBy: null };
      return a;
    }
    default: return a;
  }
}

function actionFromKind(kind: DialogKind): AuditEntry['action'] {
  switch (kind) {
    case 'qualifyDialog':       return 'qualified';
    case 'validateDialog':      return 'validated';
    case 'signDialog':          return 'signed';
    case 'closeDialog':         return 'closed';
    case 'falsePositiveDialog': return 'false_positive_marked';
    case 'rejectDialog':        return 'reopened';
  }
}
