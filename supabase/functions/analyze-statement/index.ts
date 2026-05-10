// ============================================================================
// Edge Function — analyze-statement
// ============================================================================
// Déclenche les 19 algorithmes de détection AtlasBanx sur un relevé donné.
// Stub : reçoit { statementId } et orchestre l'appel au worker pool côté
// client OU appelle un worker Supabase Functions dédié.
//
// Auth : Supabase JWT requis. RLS côté `statements` filtre l'accès.
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function authenticate(req: Request): Promise<{ userId: string } | null> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: SUPABASE_ANON_KEY },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { userId: u.id } : null;
}

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  const auth = await authenticate(req);
  if (!auth) return jsonResponse({ error: 'unauthorized' }, 401);

  const { statementId } = await req.json().catch(() => ({}));
  if (!statementId) return jsonResponse({ error: 'statementId required' }, 400);

  // Stub : en prod, déclencherait le worker pool. Ici on retourne un
  // run_id que le client peut poller pour récupérer le résultat.
  return jsonResponse({
    runId: `run-${crypto.randomUUID()}`,
    statementId,
    status: 'queued',
    enqueuedAt: new Date().toISOString(),
    estimatedDurationMs: 12_000,
    note: 'Stub Edge Function — câbler le worker pool effectif (analyseService) côté backend.',
  });
}

Deno.serve(handle);
