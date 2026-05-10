// ============================================================================
// Edge Function — generate-report
// ============================================================================
// Génère le PDF d'un rapport (synthèse / valeur probante / export comptable).
// Stub : retourne un Storage signed URL vers un PDF placeholder.
// En production, génère via jsPDF côté Edge ou délègue à un worker Cloud Run.
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function auth(req: Request): Promise<boolean> {
  const a = req.headers.get('Authorization');
  if (!a?.startsWith('Bearer ')) return false;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: a, apikey: SUPABASE_ANON_KEY } });
  return r.ok;
}

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!(await auth(req))) return json({ error: 'unauthorized' }, 401);

  const { statementId, template, options } = await req.json().catch(() => ({}));
  if (!statementId || !template) return json({ error: 'statementId + template required' }, 400);

  const reportId = crypto.randomUUID();
  const hash = await sha256Hex(JSON.stringify({ statementId, template, options, ts: Date.now() }));

  // Stub : en prod, le PDF est généré et uploadé vers Supabase Storage.
  return json({
    reportId,
    statementId,
    template,
    documentUrl: `https://storage.example.com/reports/${reportId}.pdf`,
    hash,
    timestampRfc3161: null,    // sera rempli par sign-and-send
    status: 'draft',
    note: 'Stub — le rendu PDF effectif doit être implémenté (jsPDF Edge ou worker Cloud Run).',
  });
}

Deno.serve(handle);
