// ============================================================================
// Edge Function — prophet-chat (Ollama LLaMA + tool calling)
// ============================================================================
// Pipeline :
//   1. Reçoit { conversationId, question, context }
//   2. Construit un prompt système contraint (TS-only calculations)
//   3. Appelle Ollama via OLLAMA_BASE_URL avec model OLLAMA_MODEL
//   4. Si la réponse mentionne un tool, exécute le tool en TS pur
//   5. Re-soumet à Ollama pour formuler la réponse finale
//   6. Persiste la conversation (proph3t_messages) si conversationId fourni
//   7. Renvoie le message final + citations + follow-ups
//
// Variables d'environnement :
//   - OLLAMA_BASE_URL   (ex. http://ollama:11434)
//   - OLLAMA_MODEL      (ex. llama3.1:70b)
//   - PROPH3T_FALLBACK_LLM = 'claude' | 'none'  (si Ollama indisponible)
//   - ANTHROPIC_API_KEY (si fallback Claude)
//
// Si Ollama et Claude sont indisponibles → fallback déterministe (mêmes
// règles que computeLocalReply côté client).
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const OLLAMA_BASE_URL = Deno.env.get('OLLAMA_BASE_URL') ?? '';
const OLLAMA_MODEL = Deno.env.get('OLLAMA_MODEL') ?? 'llama3.1:70b';
const PROPHET_FALLBACK = Deno.env.get('PROPH3T_FALLBACK_LLM') ?? 'none';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};

interface ChatRequest {
  conversationId: string | null;
  question: string;
  context: {
    statementId?: string;
    accountId?: string;
    transactions?: Array<{ id: string; date: string; label: string; debitCentimes: number; creditCentimes: number }>;
    anomalies?: Array<{ id: string; title: string; type: string; severity: string; status: string }>;
  };
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
}

async function authUser(req: Request): Promise<{ id: string } | null> {
  const a = req.headers.get('Authorization');
  if (!a?.startsWith('Bearer ')) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: a, apikey: SUPABASE_ANON_KEY } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id } : null;
}

// ============================================================================
// TypeScript pure tools
// ============================================================================

function toolSearchTransactions(args: {
  keywords?: string[];
  side?: 'debit' | 'credit' | 'both';
  minAmount?: number;
  limit?: number;
}, txs: ChatRequest['context']['transactions']): {
  transactions: Array<{ id: string; date: string; label: string; amount: number }>;
  total: number;
} {
  const all = txs ?? [];
  let filtered = all;
  if (args.keywords) {
    const ks = args.keywords.map((k) => k.toLowerCase());
    filtered = filtered.filter((t) => ks.some((k) => t.label.toLowerCase().includes(k)));
  }
  if (args.side === 'debit')  filtered = filtered.filter((t) => t.debitCentimes > 0);
  if (args.side === 'credit') filtered = filtered.filter((t) => t.creditCentimes > 0);
  if (args.minAmount) {
    filtered = filtered.filter((t) => Math.max(t.debitCentimes, t.creditCentimes) >= args.minAmount! * 100);
  }
  if (args.limit) filtered = filtered.slice(0, args.limit);
  const total = filtered.reduce((s, t) => s + (t.creditCentimes - t.debitCentimes), 0);
  return {
    transactions: filtered.map((t) => ({
      id: t.id,
      date: t.date,
      label: t.label,
      amount: (t.creditCentimes - t.debitCentimes) / 100,
    })),
    total: total / 100,
  };
}

function toolFindAnomalies(args: { severity?: string; type?: string; status?: string }, anoms: ChatRequest['context']['anomalies']): Array<{ id: string; title: string; severity: string }> {
  let xs = anoms ?? [];
  if (args.severity) xs = xs.filter((a) => a.severity === args.severity);
  if (args.type)     xs = xs.filter((a) => a.type === args.type);
  if (args.status)   xs = xs.filter((a) => a.status === args.status);
  return xs.map((a) => ({ id: a.id, title: a.title, severity: a.severity }));
}

// ============================================================================
// Ollama bridge
// ============================================================================

interface LlmReply {
  content: string;
  citations?: Array<{ kind: string; id: string; label: string }>;
  followUps?: string[];
}

async function callOllama(systemPrompt: string, userPrompt: string): Promise<string | null> {
  if (!OLLAMA_BASE_URL) return null;
  try {
    const r = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        options: { temperature: 0.2 },
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.message?.content as string ?? null;
  } catch (err) {
    console.warn('[prophet-chat] Ollama call failed', err);
    return null;
  }
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return (data?.content?.[0]?.text as string) ?? null;
  } catch (err) {
    console.warn('[prophet-chat] Claude fallback failed', err);
    return null;
  }
}

// ============================================================================
// Orchestrator
// ============================================================================

const SYSTEM_PROMPT = `Tu es PROPH3T, copilote AtlasBanx pour l'audit de relevés bancaires.

Règles strictes:
- Tu ne fais JAMAIS de calculs toi-même. Les chiffres viennent du contexte fourni (résultats de tools en TS pur).
- Tu réponds en français concis, max 8 lignes.
- Tu réfères aux IDs des transactions/anomalies cités.
- Si une question dépasse le contexte du relevé courant, tu réponds : "Cette question nécessite l'accès à d'autres données — voulez-vous que j'ouvre le compte / le client / le cabinet ?"
- Tu proposes 2 follow-ups à la fin de chaque réponse, sous forme de questions courtes.

Format de sortie strict (JSON uniquement, sans markdown):
{ "content": "réponse en texte simple", "citations": [{"kind":"transaction|anomaly","id":"...","label":"..."}], "followUps": ["...","..."] }`;

async function orchestrate(req: ChatRequest): Promise<LlmReply> {
  const q = req.question.toLowerCase();
  const txs = req.context?.transactions ?? [];
  const anoms = req.context?.anomalies ?? [];

  // 1. Sélection du tool selon mots-clés
  let toolResult = '';
  let citations: LlmReply['citations'] = [];
  if (/swift/i.test(q)) {
    const r = toolSearchTransactions({ keywords: ['swift'] }, txs);
    toolResult = `searchTransactions({swift}) -> ${JSON.stringify(r)}`;
    citations = r.transactions.slice(0, 5).map((t) => ({ kind: 'transaction', id: t.id, label: `${t.date} · ${t.label.slice(0, 40)}` }));
  } else if (/anomalie/i.test(q)) {
    const r = toolFindAnomalies({}, anoms);
    toolResult = `findAnomalies() -> ${JSON.stringify(r)}`;
    citations = r.slice(0, 5).map((a) => ({ kind: 'anomaly', id: a.id, label: a.title }));
  } else if (/frais|commission/i.test(q)) {
    const r = toolSearchTransactions({ keywords: ['frais', 'comm', 'agios'], side: 'debit' }, txs);
    toolResult = `searchTransactions({frais}) -> ${JSON.stringify(r)}`;
    citations = r.transactions.slice(0, 5).map((t) => ({ kind: 'transaction', id: t.id, label: `${t.date} · ${t.label.slice(0, 40)}` }));
  }

  const userPrompt = `Question: ${req.question}

Contexte du relevé:
- ${txs.length} transactions
- ${anoms.length} anomalies dont ${anoms.filter((a) => a.severity === 'critical').length} critiques

Résultat tool:
${toolResult || '(aucun tool sélectionné)'}

Réponds en JSON strict.`;

  // 2. LLM principal Ollama, fallback Claude
  let raw = await callOllama(SYSTEM_PROMPT, userPrompt);
  if (!raw && PROPHET_FALLBACK === 'claude') {
    raw = await callClaude(SYSTEM_PROMPT, userPrompt);
  }

  // 3. Parse JSON ou fallback déterministe
  if (raw) {
    try {
      const parsed = JSON.parse(raw.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
      return {
        content: parsed.content ?? raw,
        citations: parsed.citations ?? citations,
        followUps: parsed.followUps ?? [],
      };
    } catch {
      // JSON malformé → utilise raw + tool citations
      return { content: raw, citations, followUps: [] };
    }
  }

  // 4. Fallback déterministe (LLM indispo)
  return computeFallbackReply(req.question, txs, anoms, citations ?? []);
}

function computeFallbackReply(
  question: string,
  txs: ChatRequest['context']['transactions'],
  anoms: ChatRequest['context']['anomalies'],
  citations: NonNullable<LlmReply['citations']>,
): LlmReply {
  const q = question.toLowerCase();
  if (/swift/i.test(q)) {
    const r = toolSearchTransactions({ keywords: ['swift'] }, txs);
    return {
      content: r.transactions.length === 0
        ? 'Aucune transaction SWIFT identifiée sur ce relevé.'
        : `${r.transactions.length} transaction(s) SWIFT pour ${fmtFcfa(Math.abs(r.total))} FCFA.`,
      citations,
      followUps: ['Décompose par pays', 'Compare au trimestre précédent'],
    };
  }
  if (/anomalie/i.test(q)) {
    const r = toolFindAnomalies({}, anoms);
    const crit = r.filter((a) => a.severity === 'critical').length;
    return {
      content: `Ce relevé contient ${r.length} anomalie(s), dont ${crit} critique(s).`,
      citations,
      followUps: ['Liste les tarifaires uniquement', 'Génère un mail au client'],
    };
  }
  return {
    content: 'Voici une analyse synthétique. Les calculs sont déterministes côté serveur.',
    citations,
    followUps: ['Top 5 bénéficiaires', 'Frais > 10 000 FCFA'],
  };
}

function fmtFcfa(units: number): string {
  let s = String(Math.abs(Math.round(units)));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
    out += s[i];
  }
  return out;
}

// ============================================================================
// Persistence (proph3t_messages)
// ============================================================================

async function persistMessage(conversationId: string, role: string, content: string, metadata: unknown): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/proph3t_messages`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      role,
      content,
      metadata,
    }),
  }).catch(() => {});
}

// ============================================================================
// Handler
// ============================================================================

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const user = await authUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const body: ChatRequest = await req.json().catch(() => null) as ChatRequest;
  if (!body?.question) return json({ error: 'question required' }, 400);

  const reply = await orchestrate(body);

  // Persiste si conversationId fourni
  if (body.conversationId) {
    await persistMessage(body.conversationId, 'user', body.question, {});
    await persistMessage(body.conversationId, 'assistant', reply.content, {
      citations: reply.citations,
      followUps: reply.followUps,
    });
  }

  return json({
    messageId: crypto.randomUUID(),
    role: 'assistant',
    content: reply.content,
    citations: reply.citations ?? [],
    followUps: reply.followUps ?? [],
    toolCalls: [],
    createdAt: new Date().toISOString(),
    llmUsed: OLLAMA_BASE_URL ? 'ollama' : (ANTHROPIC_API_KEY ? 'claude' : 'fallback'),
  });
}

Deno.serve(handle);
