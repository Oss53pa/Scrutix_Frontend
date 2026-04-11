/**
 * @module AtlasBanx
 * @file src/security/ConsentService.ts
 * @description Gère les consentements RGPD-like : récupère la dernière
 *              version publiée de chaque politique, vérifie si l'utilisateur
 *              a déjà consenti à la version courante, enregistre les
 *              nouveaux consentements (append-only).
 *
 *              Les politiques sont seedées par la migration 005 avec du
 *              texte boilerplate. Remplacer par le texte validé par un
 *              juriste avant mise en production.
 * @author Atlas Studio
 * @version 1.0.0
 */

import { getSupabaseClient } from '../lib/supabase';

export type PolicyType = 'cgu' | 'privacy' | 'legal' | 'cookies';

export interface PolicyVersion {
  id: string;
  policyType: PolicyType;
  version: string;
  content: string;
  contentHash: string;
  language: string;
  publishedAt: Date;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  policyVersionId: string;
  policyType: PolicyType;
  version: string;
  consentedAt: Date;
}

export class ConsentService {
  /**
   * Récupère toutes les politiques en vigueur (non-superseded).
   */
  static async getCurrentPolicies(language = 'fr'): Promise<PolicyVersion[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — policy_versions defined in migration 005, types pending
      .from('policy_versions')
      .select('*')
      .eq('language', language)
      .is('superseded_at', null)
      .order('published_at', { ascending: false });

    if (error || !data) return [];

    // Déduplique par policy_type en gardant la plus récente
    const latest = new Map<PolicyType, PolicyVersion>();
    for (const row of data as Array<{
      id: string;
      policy_type: PolicyType;
      version: string;
      content: string;
      content_hash: string;
      language: string;
      published_at: string;
    }>) {
      if (!latest.has(row.policy_type)) {
        latest.set(row.policy_type, {
          id: row.id,
          policyType: row.policy_type,
          version: row.version,
          content: row.content,
          contentHash: row.content_hash,
          language: row.language,
          publishedAt: new Date(row.published_at),
        });
      }
    }
    return Array.from(latest.values());
  }

  /**
   * Récupère la version courante d'une politique spécifique.
   */
  static async getCurrentPolicy(
    policyType: PolicyType,
    language = 'fr',
  ): Promise<PolicyVersion | null> {
    const policies = await this.getCurrentPolicies(language);
    return policies.find((p) => p.policyType === policyType) ?? null;
  }

  /**
   * Liste les consentements déjà accordés par l'utilisateur courant.
   */
  static async listUserConsents(): Promise<ConsentRecord[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — user_consents defined in migration 005, types pending
      .from('user_consents')
      .select(`
        id,
        user_id,
        policy_version_id,
        consented_at,
        policy_versions ( policy_type, version )
      `)
      .order('consented_at', { ascending: false });

    if (error || !data) return [];

    return (
      data as Array<{
        id: string;
        user_id: string;
        policy_version_id: string;
        consented_at: string;
        policy_versions: { policy_type: PolicyType; version: string } | null;
      }>
    )
      .filter((row) => row.policy_versions !== null)
      .map((row) => ({
        id: row.id,
        userId: row.user_id,
        policyVersionId: row.policy_version_id,
        policyType: row.policy_versions!.policy_type,
        version: row.policy_versions!.version,
        consentedAt: new Date(row.consented_at),
      }));
  }

  /**
   * Vérifie si l'utilisateur a consenti à toutes les politiques courantes.
   * Retourne la liste des politiques en attente de consentement.
   */
  static async getPendingConsents(language = 'fr'): Promise<PolicyVersion[]> {
    const [current, given] = await Promise.all([
      this.getCurrentPolicies(language),
      this.listUserConsents(),
    ]);

    const givenIds = new Set(given.map((c) => c.policyVersionId));
    return current.filter((p) => !givenIds.has(p.id));
  }

  /**
   * Enregistre un consentement pour la version courante d'une politique.
   * Append-only — si déjà consenti, no-op.
   */
  static async recordConsent(policyVersionId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Utilisateur non authentifié');

    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;

    const { error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — user_consents defined in migration 005, types pending
      .from('user_consents')
      .insert({
        user_id: userId,
        policy_version_id: policyVersionId,
        user_agent: userAgent,
      });

    if (error && !error.message.includes('duplicate')) {
      throw new Error(`Enregistrement consentement impossible: ${error.message}`);
    }
  }

  /**
   * Enregistre tous les consentements en attente en un seul batch.
   * À appeler après acceptation de la ConsentModal.
   */
  static async recordAllPending(language = 'fr'): Promise<void> {
    const pending = await this.getPendingConsents(language);
    for (const policy of pending) {
      await this.recordConsent(policy.id);
    }
  }
}
