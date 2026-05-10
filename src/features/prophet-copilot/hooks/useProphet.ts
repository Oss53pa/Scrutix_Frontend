// ============================================================================
// useProphet — hook copilote PROPH3T
// ============================================================================
// Gère l'état du drawer (ouvert/fermé, contexte courant) + chat messages.
// L'appel `ask()` invoke l'Edge Function prophet-chat OU exécute en local
// les outils déterministes en fallback offline / dev.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type {
  Anomaly,
  BankTransaction,
  ProphetMessage,
} from '../../statement-detail/types/statement.types';
import { searchTransactions, findAnomalies, draftEmail } from '../tools';
import { buildSampleProphetReply } from '../../statement-detail/mock-data';
import { isSupabaseConfigured } from '../../../lib/supabase';
import { loadOrCreateConversation, appendMessage as remoteAppend } from '../api/prophetApi';

export interface UseProphetResult {
  open: boolean;
  messages: ProphetMessage[];
  contextLabel: string;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  ask: (question: string) => Promise<ProphetMessage>;
  reset: () => void;
}

export interface UseProphetArgs {
  statementId: string | null;
  contextLabel: string;
  /** Identifiant utilisateur courant (pour la persistance des conversations). */
  userId?: string | null;
  /** Données du relevé pour les outils. */
  transactions?: BankTransaction[];
  anomalies?: Anomaly[];
  /** Endpoint Edge Function. Si non fourni → fallback local déterministe. */
  endpoint?: string;
  authToken?: string;
}

export function useProphet(args: UseProphetArgs): UseProphetResult {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ProphetMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const toggleDrawer = useCallback(() => setOpen((v) => !v), []);
  const reset = useCallback(() => setMessages([]), []);

  // Récupère ou crée la conversation persistée à l'ouverture du drawer
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
        /* fallback local en mémoire */
      }
    })();
    return () => { cancelled = true; };
  }, [open, args.userId, args.statementId]);

  const ask = useCallback<UseProphetResult['ask']>(
    async (question) => {
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
            return msg;
          }
        } catch {
          // tomber sur le fallback local
        }
      }

      // 2. Fallback local — exécution déterministe des outils
      const localReply = computeLocalReply(question, args);
      setMessages((m) => [...m, localReply]);

      // Persistance Supabase si disponible
      if (isSupabaseConfigured() && conversationId) {
        try {
          await remoteAppend(conversationId, {
            role: 'user',
            content: question,
          });
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
    openDrawer,
    closeDrawer,
    toggleDrawer,
    ask,
    reset,
  };
}

// ============================================================================
// Fallback local — déterministe, pas de LLM
// ============================================================================

function computeLocalReply(question: string, args: UseProphetArgs): ProphetMessage {
  const q = question.toLowerCase();
  const txs = args.transactions ?? [];
  const ans = args.anomalies ?? [];

  // Exemple : recherche SWIFT
  if (/swift/i.test(q)) {
    const out = searchTransactions(txs, { keywords: ['swift'] });
    return {
      id: 'msg-' + Math.random().toString(36).slice(2),
      role: 'assistant',
      content:
        out.transactions.length === 0
          ? 'Aucune transaction SWIFT identifiée sur ce relevé.'
          : `J'identifie ${out.transactions.length} transaction(s) SWIFT pour un total de ${formatFcfa(Math.abs(out.totalCentimes))} FCFA.\n\n` +
            out.transactions.slice(0, 5)
              .map((t) =>
                `• ${t.date} · ${formatFcfa(Math.max(t.debitCentimes, t.creditCentimes))} FCFA · ${t.label}`,
              )
              .join('\n'),
      citations: out.citations,
      followUps: ['Décompose par pays bénéficiaire', 'Compare au trimestre précédent'],
      createdAt: new Date().toISOString(),
    };
  }

  // Exemple : anomalies
  if (/anomalie/i.test(q)) {
    const out = findAnomalies(ans, {});
    const crit = out.anomalies.filter((a) => a.severity === 'critical');
    return {
      id: 'msg-' + Math.random().toString(36).slice(2),
      role: 'assistant',
      content:
        `Ce relevé contient ${out.anomalies.length} anomalie(s), dont ${crit.length} critique(s).\n\n` +
        out.anomalies.slice(0, 5).map((a) => `• [${a.severity}] ${a.title}`).join('\n'),
      citations: out.citations,
      followUps: ['Liste uniquement les anomalies tarifaires', 'Génère un mail au client pour la #1'],
      createdAt: new Date().toISOString(),
    };
  }

  // Exemple : draft mail
  if (/mail|email|reformule/i.test(q) && ans.length > 0) {
    const draft = draftEmail({
      topic: 'anomaly',
      anomaly: ans[0],
      recipientName: 'Pamela',
      tone: 'formel',
    });
    return {
      id: 'msg-' + Math.random().toString(36).slice(2),
      role: 'assistant',
      content: `Voici un brouillon de mail :\n\n**Objet :** ${draft.subject}\n\n${draft.body}`,
      followUps: ['Régénère plus court', 'Régénère ton chaleureux'],
      createdAt: new Date().toISOString(),
    };
  }

  // Fallback samples mock
  return buildSampleProphetReply(question);
}

function formatFcfa(centimes: number): string {
  const u = Math.round(centimes / 100);
  let out = '';
  const s = String(Math.abs(u));
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
    out += s[i];
  }
  return out;
}
