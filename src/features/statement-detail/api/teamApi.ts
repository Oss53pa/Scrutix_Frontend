// ============================================================================
// teamApi — chargement de l'équipe cabinet + résolution des handles utilisateurs
// ============================================================================

import { getSupabaseClient } from '../../../lib/supabase';
import type { MentionableUser } from '../../../components/shared';
import type { CabinetRole } from '../../../workspace/types';

interface ProfileRow {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
}

/**
 * Charge l'équipe d'un workspace (membres du cabinet) avec profils.
 */
export async function loadTeamMembers(workspaceId: string): Promise<MentionableUser[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data: members, error } = await sb
    .schema('atlasbanx' as never)
    .from('cabinet_members' as never)
    .select('user_id, role')
    .eq('workspace_id', workspaceId);
  if (error || !members) return [];

  const userIds = (members as Array<{ user_id: string }>).map((m) => m.user_id);
  if (userIds.length === 0) return [];

  // Récupère les profils en une seule requête
  const { data: profiles } = await sb
    .from('profiles')
    .select('user_id, full_name, email')
    .in('user_id', userIds);

  const profileMap = new Map<string, ProfileRow>();
  for (const p of (profiles ?? []) as ProfileRow[]) profileMap.set(p.user_id, p);

  return (members as Array<{ user_id: string; role: CabinetRole }>).map((m) => {
    const p = profileMap.get(m.user_id);
    return {
      userId: m.user_id,
      handle: buildHandle(p),
      displayName: p?.full_name ?? p?.email?.split('@')[0] ?? 'Utilisateur',
      role: m.role,
    };
  });
}

/**
 * Récupère le profil d'un user (pour résoudre @handle dans les commentaires/audit).
 */
export async function loadUserProfiles(userIds: string[]): Promise<Map<string, MentionableUser>> {
  const map = new Map<string, MentionableUser>();
  const sb = getSupabaseClient();
  if (!sb || userIds.length === 0) return map;

  const { data } = await sb
    .from('profiles')
    .select('user_id, full_name, email')
    .in('user_id', userIds);

  for (const p of ((data ?? []) as ProfileRow[])) {
    map.set(p.user_id, {
      userId: p.user_id,
      handle: buildHandle(p),
      displayName: p.full_name ?? p.email?.split('@')[0] ?? 'Utilisateur',
      role: null,
    });
  }
  return map;
}

function buildHandle(p?: ProfileRow | null): string {
  if (!p) return 'user';
  if (p.full_name) {
    const parts = p.full_name.trim().split(/\s+/);
    if (parts.length >= 2) return parts[0] + parts[1][0].toUpperCase();
    return parts[0];
  }
  if (p.email) return p.email.split('@')[0];
  return 'user';
}
