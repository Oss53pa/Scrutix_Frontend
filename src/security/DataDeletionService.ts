/**
 * @module AtlasBanx
 * @file src/security/DataDeletionService.ts
 * @description Gère le droit à l'effacement RGPD. L'utilisateur dépose une
 *              requête qui est traitée manuellement par un administrateur
 *              (service_role côté Supabase).
 *
 *              L'exécution effective de la suppression est supervisée car :
 *                1. OHADA exige la conservation des pièces comptables 7 ans
 *                   — une demande d'effacement doit être mise en balance
 *                   avec les obligations légales de l'utilisateur lui-même.
 *                2. Une suppression définitive est irréversible et ne
 *                   doit pas être déclenchée par un clic accidentel.
 *
 *              Le retrait effectif des données est effectué par l'admin via
 *              la console Supabase (DELETE FROM auth.users WHERE id = ...),
 *              ce qui cascade vers toutes les tables atlasbanx.* via les FK.
 * @author Atlas Studio
 * @version 1.0.0
 */

import { getSupabaseClient } from '../lib/supabase';

export type DeletionStatus = 'pending' | 'in_review' | 'executed' | 'rejected';

export interface DeletionRequest {
  id: string;
  userId: string;
  requestedBy: string;
  requestedAt: Date;
  status: DeletionStatus;
  reason: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  executedAt: Date | null;
  notes: string | null;
}

export class DataDeletionService {
  /**
   * Dépose une demande d'effacement pour l'utilisateur courant.
   * Ne supprime RIEN immédiatement — un admin doit valider.
   */
  static async requestErasure(reason?: string): Promise<DeletionRequest> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré');

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Utilisateur non authentifié');

    const { data, error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — data_deletion_requests defined in migration 005
      .from('data_deletion_requests')
      .insert({
        user_id: userId,
        requested_by: userId,
        reason: reason ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Demande d'effacement impossible: ${error?.message ?? 'erreur inconnue'}`);
    }

    return rowToRequest(data as DeletionRequestRow);
  }

  /**
   * Liste toutes les demandes de l'utilisateur courant (il voit son propre
   * historique mais pas celui des autres).
   */
  static async listMyRequests(): Promise<DeletionRequest[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — data_deletion_requests defined in migration 005
      .from('data_deletion_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (error || !data) return [];
    return (data as DeletionRequestRow[]).map(rowToRequest);
  }

  /**
   * Retourne la demande en attente la plus récente, ou null.
   * Utilisé pour afficher "Demande en cours de traitement" dans l'UI.
   */
  static async getPendingRequest(): Promise<DeletionRequest | null> {
    const requests = await this.listMyRequests();
    return (
      requests.find((r) => r.status === 'pending' || r.status === 'in_review') ?? null
    );
  }
}

// ----------------------------------------------------------------------------
// INTERNAL
// ----------------------------------------------------------------------------

interface DeletionRequestRow {
  id: string;
  user_id: string;
  requested_by: string;
  requested_at: string;
  status: DeletionStatus;
  reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  executed_at: string | null;
  notes: string | null;
}

function rowToRequest(row: DeletionRequestRow): DeletionRequest {
  return {
    id: row.id,
    userId: row.user_id,
    requestedBy: row.requested_by,
    requestedAt: new Date(row.requested_at),
    status: row.status,
    reason: row.reason,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : null,
    executedAt: row.executed_at ? new Date(row.executed_at) : null,
    notes: row.notes,
  };
}
