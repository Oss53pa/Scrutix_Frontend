// ============================================================================
// PROPH3T tools — calculs déterministes invoqués par le LLM
// ============================================================================
// Spec onglets 2-5 §4.2 : "Tous les chiffres affichés viennent d'un calcul
// TypeScript déterministe — le LLM ne calcule jamais. Il interprète
// l'intention et formule la réponse."
//
// Chaque tool prend des arguments structurés et retourne un résultat
// structuré + des citations (pour traçabilité).
// ============================================================================

import type { Anomaly, BankTransaction, ProphetCitation } from '../../statement-detail/types/statement.types';

// ============================================================================
// searchTransactions
// ============================================================================

export interface SearchTransactionsArgs {
  /** Mots-clés à matcher dans le label (case-insensitive). */
  keywords?: string[];
  /** Période optionnelle. */
  dateFrom?: string;
  dateTo?: string;
  /** Bornes de montant en centimes. */
  minAmountCentimes?: number;
  maxAmountCentimes?: number;
  /** Filtre côté débit/crédit. */
  side?: 'debit' | 'credit' | 'both';
  /** Limite. */
  limit?: number;
}

export interface SearchTransactionsResult {
  transactions: BankTransaction[];
  totalCentimes: number;
  citations: ProphetCitation[];
}

export function searchTransactions(
  pool: BankTransaction[],
  args: SearchTransactionsArgs,
): SearchTransactionsResult {
  let txs = pool;

  if (args.dateFrom) txs = txs.filter((t) => t.date >= args.dateFrom!);
  if (args.dateTo)   txs = txs.filter((t) => t.date <= args.dateTo!);

  if (args.keywords && args.keywords.length > 0) {
    const ks = args.keywords.map((k) => k.toLowerCase());
    txs = txs.filter((t) => ks.some((k) => t.label.toLowerCase().includes(k)));
  }

  if (args.side === 'debit')  txs = txs.filter((t) => t.debitCentimes > 0);
  if (args.side === 'credit') txs = txs.filter((t) => t.creditCentimes > 0);

  if (args.minAmountCentimes !== undefined) {
    txs = txs.filter((t) => Math.max(t.debitCentimes, t.creditCentimes) >= args.minAmountCentimes!);
  }
  if (args.maxAmountCentimes !== undefined) {
    txs = txs.filter((t) => Math.max(t.debitCentimes, t.creditCentimes) <= args.maxAmountCentimes!);
  }

  if (args.limit) txs = txs.slice(0, args.limit);

  const total = txs.reduce((s, t) => s + (t.creditCentimes - t.debitCentimes), 0);

  return {
    transactions: txs,
    totalCentimes: total,
    citations: txs.slice(0, 5).map((t) => ({
      kind: 'transaction',
      id: t.id,
      label: `${t.label.slice(0, 40)} — ${t.date}`,
    })),
  };
}

// ============================================================================
// aggregateAmount
// ============================================================================

export interface AggregateAmountArgs extends SearchTransactionsArgs {
  groupBy?: 'month' | 'category' | 'counterparty' | 'none';
  operation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
}

export interface AggregateAmountResult {
  groups: Array<{ key: string; valueCentimes: number; count: number }>;
  total: number;
}

export function aggregateAmount(
  pool: BankTransaction[],
  args: AggregateAmountArgs,
): AggregateAmountResult {
  const filtered = searchTransactions(pool, args).transactions;
  const operation = args.operation ?? 'sum';
  const groupBy = args.groupBy ?? 'none';

  const groups = new Map<string, { sum: number; count: number; min: number; max: number }>();
  for (const tx of filtered) {
    let key = 'all';
    if (groupBy === 'month') key = tx.date.slice(0, 7);
    if (groupBy === 'counterparty') key = tx.label.split(' ').slice(0, 3).join(' ');

    const amount = Math.abs(tx.creditCentimes - tx.debitCentimes);
    const cur = groups.get(key) ?? { sum: 0, count: 0, min: Infinity, max: -Infinity };
    cur.sum += amount;
    cur.count++;
    if (amount < cur.min) cur.min = amount;
    if (amount > cur.max) cur.max = amount;
    groups.set(key, cur);
  }

  const out = Array.from(groups.entries()).map(([key, v]) => {
    let value = v.sum;
    if (operation === 'avg')   value = v.count > 0 ? v.sum / v.count : 0;
    if (operation === 'count') value = v.count;
    if (operation === 'min')   value = isFinite(v.min) ? v.min : 0;
    if (operation === 'max')   value = isFinite(v.max) ? v.max : 0;
    return { key, valueCentimes: Math.round(value), count: v.count };
  });

  return { groups: out, total: filtered.length };
}

// ============================================================================
// findAnomalies
// ============================================================================

export interface FindAnomaliesArgs {
  severity?: Anomaly['severity'];
  type?: Anomaly['type'];
  status?: Anomaly['status'];
  limit?: number;
}

export function findAnomalies(pool: Anomaly[], args: FindAnomaliesArgs): {
  anomalies: Anomaly[];
  citations: ProphetCitation[];
} {
  let xs = pool;
  if (args.severity) xs = xs.filter((a) => a.severity === args.severity);
  if (args.type)     xs = xs.filter((a) => a.type === args.type);
  if (args.status)   xs = xs.filter((a) => a.status === args.status);
  if (args.limit)    xs = xs.slice(0, args.limit);
  return {
    anomalies: xs,
    citations: xs.map((a) => ({ kind: 'anomaly' as const, id: a.id, label: a.title })),
  };
}

// ============================================================================
// draftEmail
// ============================================================================

export interface DraftEmailArgs {
  topic: 'anomaly' | 'reconciliation' | 'general';
  /** Anomalie source si topic=anomaly. */
  anomaly?: Anomaly;
  recipientName: string;
  tone?: 'formel' | 'chaleureux' | 'court';
}

export interface DraftEmailResult {
  subject: string;
  body: string;
}

export function draftEmail(args: DraftEmailArgs): DraftEmailResult {
  const tone = args.tone ?? 'formel';
  const greeting = tone === 'chaleureux' ? `Bonjour ${args.recipientName},` : `Madame, Monsieur ${args.recipientName},`;
  const closing = tone === 'chaleureux' ? 'Bien à vous,' : 'Cordialement,';

  if (args.topic === 'anomaly' && args.anomaly) {
    const a = args.anomaly;
    const subject = `Anomalie tarifaire identifiée — ${a.title}`;
    const body =
      `${greeting}\n\n` +
      `Suite à l'audit de votre dernier relevé, nous avons identifié l'anomalie suivante :\n\n` +
      `• Type : ${a.title}\n` +
      `• Description : ${a.description}\n` +
      `• Transaction concernée : ${a.transaction.label} (${a.transaction.date})\n` +
      `• Montant : ${formatFcfa(Math.abs(a.transaction.amountCentimes))} FCFA\n\n` +
      (tone === 'court'
        ? `Nous procédons aux démarches nécessaires.\n\n${closing}`
        : `Nous vous tiendrons informé(e) des suites données à cette détection. ` +
          `N'hésitez pas à revenir vers nous pour tout complément d'information.\n\n${closing}`);
    return { subject, body };
  }

  return {
    subject: 'Audit de votre relevé bancaire',
    body: `${greeting}\n\nVeuillez trouver ci-après l'analyse synthétique de votre relevé.\n\n${closing}`,
  };
}

function formatFcfa(centimes: number): string {
  const u = Math.round(centimes / 100);
  let out = '', s = String(Math.abs(u));
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
    out += s[i];
  }
  return out;
}

// ============================================================================
// Tool registry — pour l'orchestrateur LLM côté Edge Function
// ============================================================================

export const PROPHET_TOOLS = {
  searchTransactions,
  aggregateAmount,
  findAnomalies,
  draftEmail,
} as const;

export type ProphetToolName = keyof typeof PROPHET_TOOLS;
