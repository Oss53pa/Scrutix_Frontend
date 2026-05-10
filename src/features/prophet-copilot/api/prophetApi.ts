// ============================================================================
// prophetApi — Supabase data access pour les conversations PROPH3T
// ============================================================================
// Schéma cible :
//   public.proph3t_conversations  (déjà en prod)
//   public.proph3t_messages       (déjà en prod, 2 lignes)
// ============================================================================

import { getSupabaseClient } from '../../../lib/supabase';
import type { ProphetConversation, ProphetMessage } from '../../statement-detail/types/statement.types';

// ============================================================================
// Conversations
// ============================================================================

export async function loadOrCreateConversation(
  userId: string,
  statementId: string | null,
): Promise<ProphetConversation> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  // Cherche la dernière conversation active pour ce user × statement
  const { data: found } = await sb
    .from('proph3t_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (found && found.length > 0) {
    const c = found[0] as Record<string, unknown>;
    const msgs = await loadMessages(c.id as string);
    return {
      id: c.id as string,
      userId,
      statementId,
      context: ((c.context as Record<string, unknown>) ?? {}) as ProphetConversation['context'],
      messages: msgs,
      createdAt: (c.created_at as string) ?? new Date().toISOString(),
      updatedAt: (c.updated_at as string) ?? new Date().toISOString(),
    };
  }

  // Sinon création
  const { data, error } = await sb
    .from('proph3t_conversations')
    .insert({
      user_id: userId,
      title: statementId ? `Relevé ${statementId.slice(0, 8)}` : 'Conversation PROPH3T',
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Insert conversation: ${error?.message}`);

  const c = data as Record<string, unknown>;
  return {
    id: c.id as string,
    userId,
    statementId,
    context: { statementId: statementId ?? undefined },
    messages: [],
    createdAt: (c.created_at as string) ?? new Date().toISOString(),
    updatedAt: (c.updated_at as string) ?? new Date().toISOString(),
  };
}

export async function loadMessages(conversationId: string): Promise<ProphetMessage[]> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { data, error } = await sb
    .from('proph3t_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Erreur messages: ${error.message}`);

  return (data ?? []).map(mapMessageRow);
}

export async function appendMessage(
  conversationId: string,
  message: Omit<ProphetMessage, 'id' | 'createdAt'>,
): Promise<ProphetMessage> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase non configuré');

  const { data, error } = await sb
    .from('proph3t_messages')
    .insert({
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      metadata: {
        citations: message.citations ?? [],
        followUps: message.followUps ?? [],
        toolCalls: message.toolCalls ?? [],
      },
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Insert message: ${error?.message}`);

  // Bump updated_at sur la conversation
  await sb
    .from('proph3t_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return mapMessageRow(data);
}

// ============================================================================
// Mappers
// ============================================================================

function mapMessageRow(row: unknown): ProphetMessage {
  const r = row as Record<string, unknown>;
  const meta = (r.metadata as Record<string, unknown>) ?? {};
  return {
    id: r.id as string,
    role: ((r.role as string) ?? 'assistant') as ProphetMessage['role'],
    content: (r.content as string) ?? '',
    citations: (meta.citations as ProphetMessage['citations']) ?? [],
    followUps: (meta.followUps as string[]) ?? [],
    toolCalls: (meta.toolCalls as ProphetMessage['toolCalls']) ?? [],
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}
