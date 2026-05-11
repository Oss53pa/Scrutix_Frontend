// ============================================================================
// useProphet — hook copilote PROPH3T
// ============================================================================
// Gere l'etat du drawer (ouvert/ferme, contexte courant) + chat messages.
// L'appel `ask()` invoke l'Edge Function prophet-chat OU execute en local
// les outils deterministes en fallback offline / dev.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type {
  Anomaly,
  BankTransaction,
  ProphetMessage,
  ProphetCitation,
} from '../../statement-detail/types/statement.types';
import { searchTransactions, aggregateAmount, findAnomalies, draftEmail } from '../tools';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { loadOrCreateConversation, appendMessage as remoteAppend } from '../api/prophetApi';

export interface UseProphetResult {
  open: boolean;
  messages: ProphetMessage[];
  contextLabel: string;
  /** True when using deterministic fallback (no LLM). */
  isDeterministic: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  ask: (question: string) => Promise<ProphetMessage>;
  reset: () => void;
}

export interface UseProphetArgs {
  statementId: string | null;
  contextLabel: string;
  userId?: string | null;
  transactions?: BankTransaction[];
  anomalies?: Anomaly[];
  endpoint?: string;
  authToken?: string;
}

export function useProphet(args: UseProphetArgs): UseProphetResult {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ProphetMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isDeterministic, setIsDeterministic] = useState(true);

  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const toggleDrawer = useCallback(() => setOpen((v) => !v), []);
  const reset = useCallback(() => setMessages([]), []);

  // Recupere ou cree la conversation persistee a l'ouverture du drawer
  useEffect(() => {
    if (!open || !isSupabaseConfigured() || !args.userId) return;
    let cancelled = false;
    (async () => {
      try {
        const conv = await loadOrCreateConversation(args.userId!, args.statementId);
        if (cancelled) return;
        setConversationId(conv.id);
        if (conv.messages.length > 0) setMessages(conv.messages);
      } catch {
        /* fallback local en memoire */
      }
    })();
    return () => { cancelled = true; };
  }, [open, args.userId, args.statementId]);

  const ask = useCallback<UseProphetResult['ask']>(
    async (question) => {
      // Add user message
      const userMsg: ProphetMessage = {
        id: 'msg-u-' + Date.now(),
        role: 'user',
        content: question,
        createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m, userMsg]);

      // 1. Edge Function si disponible
      if (args.endpoint && args.authToken) {
        try {
          const r = await fetch(`${args.endpoint}/prophet-chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${args.authToken}`,
            },
            body: JSON.stringify({
              conversationId: null,
              question,
              context: {
                statementId: args.statementId,
                transactions: args.transactions,
                anomalies: args.anomalies,
              },
            }),
          });
          if (r.ok) {
            const data = await r.json();
            const msg: ProphetMessage = {
              id: data.messageId,
              role: 'assistant',
              content: data.content,
              citations: data.citations,
              followUps: data.followUps,
              toolCalls: data.toolCalls,
              createdAt: data.createdAt ?? new Date().toISOString(),
            };
            setMessages((m) => [...m, msg]);
            setIsDeterministic(false);
            return msg;
          }
        } catch {
          // fallback local
        }
      }

      // 2. Fallback local — execution deterministe des outils
      setIsDeterministic(true);
      const localReply = computeLocalReply(question, args);
      setMessages((m) => [...m, localReply]);

      // Persistance Supabase si disponible
      if (isSupabaseConfigured() && conversationId) {
        try {
          await remoteAppend(conversationId, { role: 'user', content: question });
          await remoteAppend(conversationId, {
            role: 'assistant',
            content: localReply.content,
            citations: localReply.citations,
            followUps: localReply.followUps,
            toolCalls: localReply.toolCalls,
          });
        } catch {
          /* persistance non bloquante */
        }
      }

      return localReply;
    },
    [args, conversationId],
  );

  return {
    open,
    messages,
    contextLabel: args.contextLabel,
    isDeterministic,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    ask,
    reset,
  };
}

// ============================================================================
// Fallback local — deterministe, pas de LLM
// ============================================================================
// Detecte l'intention de l'utilisateur via des patterns regex et route vers
// les outils TypeScript purs. Couvre 12+ patterns courants.
// ============================================================================

function computeLocalReply(question: string, args: UseProphetArgs): ProphetMessage {
  const q = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const txs = args.transactions ?? [];
  const ans = args.anomalies ?? [];

  // --- Frais / commissions ---
  if (/frais|commission|tenue|agios?/i.test(q)) {
    const keywords = ['frais', 'commission', 'tenue', 'agio', 'cotisation'];
    const out = searchTransactions(txs, { keywords, side: 'debit' });
    const total = aggregateAmount(txs, { keywords, side: 'debit', operation: 'sum' });
    return reply(
      out.transactions.length === 0
        ? 'Aucun frais bancaire identifie sur ce releve.'
        : `J'identifie **${out.transactions.length}** lignes de frais pour un total de **${fcfa(total.groups[0]?.valueCentimes ?? 0)}** FCFA.\n\n` +
          out.transactions.slice(0, 6).map((t) => `- ${t.date} · ${fcfa(amt(t))} FCFA · ${t.label}`).join('\n'),
      out.citations,
      ['Decompose les frais par mois', 'Compare avec le trimestre precedent', 'Quels frais sont les plus eleves ?'],
    );
  }

  // --- SWIFT ---
  if (/swift/i.test(q)) {
    const out = searchTransactions(txs, { keywords: ['swift'] });
    return reply(
      out.transactions.length === 0
        ? 'Aucune transaction SWIFT identifiee sur ce releve.'
        : `J'identifie **${out.transactions.length}** transaction(s) SWIFT pour un total de **${fcfa(Math.abs(out.totalCentimes))}** FCFA.\n\n` +
          out.transactions.slice(0, 6).map((t) => `- ${t.date} · ${fcfa(amt(t))} FCFA · ${t.label}`).join('\n'),
      out.citations,
      ['Decompose par pays beneficiaire', 'Compare au trimestre precedent'],
    );
  }

  // --- Virements ---
  if (/virement|transfert|vir\b/i.test(q)) {
    const out = searchTransactions(txs, { keywords: ['virement', 'vir', 'transfert'] });
    return reply(
      out.transactions.length === 0
        ? 'Aucun virement identifie.'
        : `**${out.transactions.length}** virement(s) identifies pour **${fcfa(Math.abs(out.totalCentimes))}** FCFA.\n\n` +
          out.transactions.slice(0, 6).map((t) => `- ${t.date} · ${fcfa(amt(t))} FCFA · ${t.label}`).join('\n'),
      out.citations,
      ['Virements emis uniquement', 'Virements recus uniquement', 'Plus gros virement ?'],
    );
  }

  // --- Beneficiaires / contreparties ---
  if (/beneficiaire|contrepartie|destinataire|fournisseur/i.test(q)) {
    const agg = aggregateAmount(txs, { side: 'debit', groupBy: 'counterparty', operation: 'sum' });
    const sorted = [...agg.groups].sort((a, b) => b.valueCentimes - a.valueCentimes);
    return reply(
      sorted.length === 0
        ? 'Aucune contrepartie identifiee.'
        : `Top ${Math.min(sorted.length, 5)} contreparties par volume :\n\n` +
          sorted.slice(0, 5).map((g, i) => `${i + 1}. **${g.key}** · ${fcfa(g.valueCentimes)} FCFA (${g.count} tx)`).join('\n'),
      [],
      ['Contreparties inedites', 'Uniquement les credits'],
    );
  }

  // --- Montant > X / gros montants ---
  if (/montant.*(sup|plus|>|dessus|\d)|gros|important|eleve/i.test(q)) {
    const match = q.match(/(\d[\d\s]*)/);
    const threshold = match ? parseInt(match[1].replace(/\s/g, ''), 10) * 100 : 500_000_00;
    const out = searchTransactions(txs, { amountMin: threshold });
    return reply(
      out.transactions.length === 0
        ? 'Aucune transaction au-dessus de ce seuil.'
        : `**${out.transactions.length}** transaction(s) au-dessus du seuil :\n\n` +
          out.transactions.slice(0, 8).map((t) => `- ${t.date} · ${fcfa(amt(t))} FCFA · ${t.label}`).join('\n'),
      out.citations,
      ['Uniquement les debits', 'Uniquement les credits'],
    );
  }

  // --- Anomalies ---
  if (/anomalie|probleme|erreur|alerte|irregularite/i.test(q)) {
    const out = findAnomalies(ans, {});
    const crit = out.anomalies.filter((a) => a.severity === 'critical');
    const high = out.anomalies.filter((a) => a.severity === 'high');
    return reply(
      out.anomalies.length === 0
        ? 'Aucune anomalie detectee sur ce releve.'
        : `Ce releve contient **${out.anomalies.length}** anomalie(s) dont **${crit.length}** critique(s) et **${high.length}** haute(s).\n\n` +
          out.anomalies.slice(0, 6).map((a) => `- [${a.severity.toUpperCase()}] ${a.title} · ${a.description}`).join('\n'),
      out.citations,
      ['Details sur la premiere anomalie', 'Anomalies tarifaires uniquement', 'Genere un mail au client'],
    );
  }

  // --- LCB-FT / conformite ---
  if (/lcb|lbc|ft|blanchiment|conformite|gafi|aml/i.test(q)) {
    const out = findAnomalies(ans, { type: 'lcb_ft' });
    const gafi = findAnomalies(ans, { type: 'pays_gafi_risque' });
    const all = [...out.anomalies, ...gafi.anomalies];
    return reply(
      all.length === 0
        ? 'Aucune alerte LCB-FT sur ce releve. Les controles de conformite sont OK.'
        : `**${all.length}** alerte(s) LCB-FT detectee(s) :\n\n` +
          all.slice(0, 5).map((a) => `- [${a.severity.toUpperCase()}] ${a.title}`).join('\n'),
      [...out.citations, ...gafi.citations],
      ['Details du risque', 'Genere le rapport conformite'],
    );
  }

  // --- Solde / tresorerie ---
  if (/solde|tresorerie|balance|decouvert/i.test(q)) {
    if (txs.length === 0) return reply('Aucune transaction disponible pour analyser la tresorerie.', [], []);
    const last = txs[txs.length - 1];
    const first = txs[0];
    const delta = last.runningBalanceCentimes - first.runningBalanceCentimes;
    const neg = txs.filter((t) => t.runningBalanceCentimes < 0);
    return reply(
      `**Solde debut** : ${fcfa(first.runningBalanceCentimes)} FCFA\n` +
      `**Solde fin** : ${fcfa(last.runningBalanceCentimes)} FCFA\n` +
      `**Variation** : ${delta >= 0 ? '+' : ''}${fcfa(delta)} FCFA\n` +
      (neg.length > 0 ? `\n⚠ **${neg.length}** jour(s) en solde negatif detecte(s).` : '\nAucun jour en solde negatif.'),
      [],
      ['Evolution par semaine', 'Jours en decouvert', 'Prevision de tresorerie'],
    );
  }

  // --- Resume / synthese ---
  if (/resume|synthese|recapitulatif|overview/i.test(q)) {
    const credits = txs.filter((t) => t.creditCentimes > 0);
    const debits = txs.filter((t) => t.debitCentimes > 0);
    const totalCredits = credits.reduce((s, t) => s + t.creditCentimes, 0);
    const totalDebits = debits.reduce((s, t) => s + t.debitCentimes, 0);
    return reply(
      `**Synthese du releve** (${txs.length} transactions)\n\n` +
      `- Encaissements : **${fcfa(totalCredits)}** FCFA (${credits.length} tx)\n` +
      `- Decaissements : **${fcfa(totalDebits)}** FCFA (${debits.length} tx)\n` +
      `- Anomalies detectees : **${ans.length}** dont ${ans.filter((a) => a.severity === 'critical').length} critique(s)\n`,
      [],
      ['Detail des frais', 'Top contreparties', 'Anomalies tarifaires'],
    );
  }

  // --- Mail / email ---
  if (/mail|email|reformule|lettre|courrier/i.test(q) && ans.length > 0) {
    const draft = draftEmail({
      topic: 'anomaly',
      anomaly: ans[0],
      recipientName: 'Client',
      tone: 'formel',
    });
    return reply(
      `Voici un brouillon de mail :\n\n**Objet :** ${draft.subject}\n\n${draft.body}`,
      [],
      ['Regenere plus court', 'Regenere ton chaleureux', 'Pour une autre anomalie'],
    );
  }

  // --- Mois / mensuel ---
  if (/mois|mensuel|par mois|evolution/i.test(q)) {
    const agg = aggregateAmount(txs, { groupBy: 'month', operation: 'sum' });
    return reply(
      agg.groups.length === 0
        ? 'Pas assez de donnees pour une ventilation mensuelle.'
        : `**Ventilation mensuelle** :\n\n` +
          agg.groups.map((g) => `- ${g.key} : ${fcfa(g.valueCentimes)} FCFA (${g.count} tx)`).join('\n'),
      [],
      ['Uniquement les frais par mois', 'Evolution des debits'],
    );
  }

  // --- Fallback generique ---
  return reply(
    `Je n'ai pas pu repondre precisement a cette question en mode deterministe. ` +
    `Essayez l'une de ces questions :\n\n` +
    `- "Combien de frais SWIFT ce trimestre ?"\n` +
    `- "Liste les anomalies detectees"\n` +
    `- "Resume du releve"\n` +
    `- "Top beneficiaires"\n` +
    `- "Solde et tresorerie"\n` +
    `- "Reformule l'anomalie en mail"\n\n` +
    `_Mode deterministe — activez PROPH3T dans les parametres pour des reponses enrichies par IA._`,
    [],
    ['Resume du releve', 'Anomalies detectees', 'Frais bancaires', 'Solde et tresorerie'],
  );
}

// ============================================================================
// Helpers
// ============================================================================

function reply(content: string, citations: ProphetCitation[], followUps: string[]): ProphetMessage {
  return {
    id: 'msg-' + Math.random().toString(36).slice(2),
    role: 'assistant',
    content,
    citations: citations.length > 0 ? citations : undefined,
    followUps,
    createdAt: new Date().toISOString(),
  };
}

function fcfa(centimes: number): string {
  const u = Math.round(centimes / 100);
  let out = '';
  const s = String(Math.abs(u));
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
    out += s[i];
  }
  return u < 0 ? '-' + out : out;
}

function amt(t: BankTransaction): number {
  return Math.max(t.debitCentimes, t.creditCentimes);
}
