// ============================================================================
// Edge Function — prophet-chat
// ============================================================================
// Proxy LLM avec sélection d'outils. Reçoit une question + contexte (relevé,
// transactions, anomalies), demande au LLM de sélectionner les outils
// appropriés, exécute les calculs déterministes côté serveur, puis demande
// au LLM de formuler la réponse.
//
// Stub : retourne une réponse pré-câblée. En prod : appelle Ollama (local)
// ou Claude API selon disponibilité.
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

async function auth(req: Request): Promise<boolean> {
  const a = req.headers.get('Authorization');
  if (!a?.startsWith('Bearer ')) return false;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: a, apikey: SUPABASE_ANON_KEY } });
  return r.ok;
}

interface ProphetChatRequest {
  conversationId: string | null;
  question: string;
  context: {
    statementId?: string;
    accountId?: string;
    /** Données du relevé pour les outils (transactions, anomalies). */
    transactions?: Array<{ id: string; date: string; label: string; debitCentimes: number; creditCentimes: number }>;
    anomalies?: Array<{ id: string; title: string; type: string; severity: string; status: string }>;
  };
}

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!(await auth(req))) return json({ error: 'unauthorized' }, 401);

  const body: ProphetChatRequest = await req.json().catch(() => null) as ProphetChatRequest;
  if (!body?.question) return json({ error: 'question required' }, 400);

  // Stub : on choisit un tool en fonction de mots-clés simples.
  const q = body.question.toLowerCase();
  const transactions = body.context?.transactions ?? [];
  const anomalies = body.context?.anomalies ?? [];

  let answer = '';
  let citations: Array<{ kind: string; id: string; label: string }> = [];
  let followUps: string[] = [];

  if (/swift/i.test(q)) {
    const swiftTx = transactions.filter((t) => /swift/i.test(t.label));
    const total = swiftTx.reduce((s, t) => s + Math.max(t.debitCentimes, t.creditCentimes), 0);
    answer = `Sur la période, j'identifie ${swiftTx.length} transactions SWIFT pour un total de ${formatFcfa(total)} FCFA.\n\n` +
      swiftTx.slice(0, 5).map((t) => `• ${t.date} · ${formatFcfa(Math.max(t.debitCentimes, t.creditCentimes))} FCFA · ${t.label}`).join('\n');
    citations = swiftTx.slice(0, 5).map((t) => ({ kind: 'transaction', id: t.id, label: `${t.label.slice(0, 40)}` }));
    followUps = ['Décompose par pays bénéficiaire', 'Compare au trimestre précédent'];
  } else if (/anomalie/i.test(q)) {
    const crit = anomalies.filter((a) => a.severity === 'critical');
    answer = `Ce relevé contient ${anomalies.length} anomalie(s), dont ${crit.length} critique(s).`;
    citations = anomalies.slice(0, 5).map((a) => ({ kind: 'anomaly', id: a.id, label: a.title }));
    followUps = ['Liste uniquement les anomalies tarifaires', 'Génère un mail de notification au client'];
  } else if (/mail|email|message/i.test(q)) {
    answer = 'Je peux générer un brouillon de mail. Précise le destinataire et le ton (formel, chaleureux, court).';
    followUps = ['Mail formel à Pamela', 'Mail court à NSIA'];
  } else {
    answer = 'Voici une analyse synthétique basée sur ce relevé. Les calculs sont déterministes et tirés des transactions extraites.';
    followUps = ['Donne le top 5 bénéficiaires', 'Liste les frais > 10 000 FCFA'];
  }

  return json({
    messageId: crypto.randomUUID(),
    role: 'assistant',
    content: answer,
    citations,
    followUps,
    toolCalls: [{ tool: 'searchTransactions', args: { keyword: 'auto' } }],
    createdAt: new Date().toISOString(),
    note: 'Stub — câbler Ollama LLaMA 3.1 70B local + tool calling effectif.',
  });
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

Deno.serve(handle);
