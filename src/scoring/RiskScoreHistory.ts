/**
 * @module AtlasBanx
 * @file src/scoring/RiskScoreHistory.ts
 * @description Persistance et lecture des scores de risque historiques
 *              dans `atlasbanx.risk_score_history`.
 *
 *              Append-only : on ne modifie jamais une ligne existante,
 *              chaque calcul produit une nouvelle entrée. Le score
 *              "actuel" d'un client est simplement la ligne la plus
 *              récente.
 * @author Atlas Studio
 * @version 1.0.0
 */

import { getSupabaseClient } from '../lib/supabase';
import type {
  RiskScore,
  RiskScoreHistoryEntry,
  RiskScoreHistoryRow,
  RiskLevel,
} from './types';

const TABLE = 'risk_score_history';

export class RiskScoreHistory {
  /**
   * Persiste un nouveau score pour un client. Non bloquant : si Supabase est
   * injoignable, on log et on continue (le score reste en mémoire dans le
   * store côté UI).
   */
  static async save(clientId: string, score: RiskScore): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return;

    const { error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — risk_score_history defined in migration 006
      .from(TABLE)
      .insert({
        user_id: userId,
        client_id: clientId,
        score: score.score,
        risk_level: score.level,
        dimensions: score.dimensions,
        metadata: score.metadata,
        period: score.metadata.period ?? null,
      });

    if (error) {
      console.warn('[RiskScoreHistory] save failed:', error.message);
    }
  }

  /**
   * Récupère le score le plus récent pour un client.
   */
  static async getLatest(clientId: string): Promise<RiskScoreHistoryEntry | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — risk_score_history defined in migration 006
      .from(TABLE)
      .select('*')
      .eq('client_id', clientId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return rowToEntry(data as RiskScoreHistoryRow);
  }

  /**
   * Récupère l'historique sur les N derniers mois (par défaut 12).
   * Trié chronologiquement (ancien → récent) pour les graphiques.
   */
  static async getHistory(clientId: string, months = 12): Promise<RiskScoreHistoryEntry[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const { data, error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — risk_score_history defined in migration 006
      .from(TABLE)
      .select('*')
      .eq('client_id', clientId)
      .gte('computed_at', since.toISOString())
      .order('computed_at', { ascending: true });

    if (error || !data) return [];
    return (data as RiskScoreHistoryRow[]).map(rowToEntry);
  }

  /**
   * Top N clients à risque élevé / critique pour le dashboard.
   * Retourne une seule entrée par client (la plus récente).
   */
  static async getTopRiskClients(limit = 5): Promise<RiskScoreHistoryEntry[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    // Note : on récupère plus que `limit` puis on déduplique en mémoire
    // (Postgres a des manières plus élégantes via DISTINCT ON mais ça
    // nécessite une vue ou une RPC).
    const { data, error } = await supabase
      .schema('atlasbanx')
      // @ts-expect-error — risk_score_history defined in migration 006
      .from(TABLE)
      .select('*')
      .in('risk_level', ['high', 'critical'] as RiskLevel[])
      .order('computed_at', { ascending: false })
      .limit(limit * 4);

    if (error || !data) return [];

    const seen = new Set<string>();
    const result: RiskScoreHistoryEntry[] = [];
    for (const row of data as RiskScoreHistoryRow[]) {
      if (seen.has(row.client_id)) continue;
      seen.add(row.client_id);
      result.push(rowToEntry(row));
      if (result.length >= limit) break;
    }
    return result;
  }
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function rowToEntry(row: RiskScoreHistoryRow): RiskScoreHistoryEntry {
  return {
    id: row.id,
    clientId: row.client_id,
    score: row.score,
    level: row.risk_level,
    dimensions: row.dimensions,
    metadata: row.metadata,
    period: row.period,
    computedAt: new Date(row.computed_at),
  };
}
