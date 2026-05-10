// ============================================================================
// PROPH3T tool · findAnomalies
// ============================================================================

import type { Anomaly, ProphetCitation } from '../../statement-detail/types/statement.types';

export interface FindAnomaliesArgs {
  severity?: Anomaly['severity'];
  type?: Anomaly['type'];
  status?: Anomaly['status'];
  limit?: number;
}

export interface FindAnomaliesResult {
  anomalies: Anomaly[];
  citations: ProphetCitation[];
}

export function findAnomalies(pool: Anomaly[], args: FindAnomaliesArgs): FindAnomaliesResult {
  let xs = pool;
  if (args.severity) xs = xs.filter((a) => a.severity === args.severity);
  if (args.type)     xs = xs.filter((a) => a.type === args.type);
  if (args.status)   xs = xs.filter((a) => a.status === args.status);
  if (args.limit)    xs = xs.slice(0, args.limit);
  return {
    anomalies: xs,
    citations: xs.map((a) => ({ kind: 'anomaly', id: a.id, label: a.title })),
  };
}
