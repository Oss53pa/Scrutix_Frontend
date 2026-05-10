// ============================================================================
// useStatementContext — charge équipe + convention réelles pour un relevé
// ============================================================================

import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { loadTeamMembers } from '../api/teamApi';
import { loadLatestConventionForAccount } from '../api/conventionApi';
import { MOCK_TEAM, MOCK_CONVENTION } from '../mock-data';
import type { MentionableUser } from '../../../components/shared';
import type { AccountConvention } from '../types/statement.types';
import { useWorkspace } from '../../../workspace/useWorkspace';

export interface UseStatementContextResult {
  team: MentionableUser[];
  convention: AccountConvention | null;
  loading: boolean;
}

export function useStatementContext(accountId: string | undefined): UseStatementContextResult {
  const [team, setTeam] = useState<MentionableUser[]>([]);
  const [convention, setConvention] = useState<AccountConvention | null>(null);
  const [loading, setLoading] = useState(true);

  const { workspace } = useWorkspace();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (isSupabaseConfigured()) {
          const tasks: Array<Promise<unknown>> = [];

          // Team via cabinet_members
          if (workspace?.id) {
            tasks.push(
              loadTeamMembers(workspace.id).then((t) => {
                if (!cancelled) setTeam(t.length > 0 ? t : MOCK_TEAM);
              }).catch(() => { if (!cancelled) setTeam(MOCK_TEAM); }),
            );
          } else {
            setTeam(MOCK_TEAM);
          }

          // Convention via account_conventions
          if (accountId) {
            tasks.push(
              loadLatestConventionForAccount(accountId).then((c) => {
                if (!cancelled) setConvention(c ?? MOCK_CONVENTION);
              }).catch(() => { if (!cancelled) setConvention(MOCK_CONVENTION); }),
            );
          } else {
            setConvention(MOCK_CONVENTION);
          }

          await Promise.all(tasks);
        } else {
          setTeam(MOCK_TEAM);
          setConvention(MOCK_CONVENTION);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accountId, workspace?.id]);

  return { team, convention, loading };
}
