/**
 * @module AtlasBanx
 * @file src/security/IpAllowlistService.ts
 * @description Gestion d'une liste blanche d'IP (CIDR) pour restreindre
 *              l'accès aux comptes sensibles.
 *
 *              ⚠️ ENFORCEMENT DÉFÉRÉ — cette table et ce service exposent
 *              la CRUD côté cabinet, mais la validation effective lors du
 *              login nécessite une Edge Function / middleware serveur que
 *              le SDK JS ne peut pas implémenter seul (pas d'accès à l'IP
 *              client côté navigateur). Voir le stub dans
 *              supabase/functions/enforce-ip-allowlist/.
 *
 *              Jusqu'à ce que l'Edge Function soit activée, les règles ne
 *              bloquent PAS les logins — elles sont purement informatives.
 * @author Atlas Studio
 * @version 1.0.0
 */

import { getSupabaseClient } from '../lib/supabase';

export interface IpAllowlistRule {
  id: string;
  userId: string;
  cabinetId: string | null;
  cidr: string;
  label: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class IpAllowlistService {
  /**
   * Liste les règles de l'utilisateur/cabinet courant.
   */
  static async list(): Promise<IpAllowlistRule[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — ip_allowlists defined in migration 005
      .from('ip_allowlists')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return (data as IpAllowlistRow[]).map(rowToRule);
  }

  /**
   * Ajoute une règle. Le CIDR doit être valide (ex: 192.168.1.0/24 ou
   * 2001:db8::/32). La validation stricte est faite par Postgres (type CIDR).
   */
  static async add(cidr: string, label: string): Promise<IpAllowlistRule> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    if (!isValidCidr(cidr)) {
      throw new Error('Plage CIDR invalide');
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Utilisateur non authentifié');

    const { data, error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — ip_allowlists defined in migration 005
      .from('ip_allowlists')
      .insert({ user_id: userId, cidr, label, active: true })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Ajout règle IP impossible: ${error?.message ?? 'erreur inconnue'}`);
    }
    return rowToRule(data as IpAllowlistRow);
  }

  /**
   * Active ou désactive une règle sans la supprimer.
   */
  static async setActive(id: string, active: boolean): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    const { error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — ip_allowlists defined in migration 005
      .from('ip_allowlists')
      .update({ active })
      .eq('id', id);

    if (error) throw new Error(`Mise à jour règle IP impossible: ${error.message}`);
  }

  /**
   * Supprime définitivement une règle.
   */
  static async remove(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    const { error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — ip_allowlists defined in migration 005
      .from('ip_allowlists')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Suppression règle IP impossible: ${error.message}`);
  }
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

/**
 * Validation CIDR légère (v4 et v6). La validation stricte est au niveau DB.
 */
function isValidCidr(cidr: string): boolean {
  const trimmed = cidr.trim();
  // IPv4: a.b.c.d/n
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;
  const m4 = trimmed.match(ipv4);
  if (m4) {
    const [, a, b, c, d, n] = m4;
    const octets = [a, b, c, d].map(Number);
    const prefix = Number(n);
    if (octets.some((o) => o < 0 || o > 255)) return false;
    if (prefix < 0 || prefix > 32) return false;
    return true;
  }
  // IPv6 (heuristique)
  const ipv6 = /^[0-9a-fA-F:]+\/\d{1,3}$/;
  if (ipv6.test(trimmed)) return true;
  return false;
}

interface IpAllowlistRow {
  id: string;
  user_id: string;
  cabinet_id: string | null;
  cidr: string;
  label: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function rowToRule(row: IpAllowlistRow): IpAllowlistRule {
  return {
    id: row.id,
    userId: row.user_id,
    cabinetId: row.cabinet_id,
    cidr: row.cidr,
    label: row.label,
    active: row.active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
