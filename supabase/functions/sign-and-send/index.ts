// ============================================================================
// Edge Function — sign-and-send
// ============================================================================
// Signe électroniquement un rapport (option ADVIST avec timestamp RFC 3161),
// scelle un bundle de preuve, envoie les emails et émet l'événement
// `atlasbanx.report.signed` sur le bus Realtime.
//
// Stub : la signature ADVIST est mockée (timestamp factice). Le mail est
// décrit mais non envoyé. Le bundle de preuve est référencé.
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

async function authUser(req: Request): Promise<{ id: string } | null> {
  const a = req.headers.get('Authorization');
  if (!a?.startsWith('Bearer ')) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: a, apikey: SUPABASE_ANON_KEY } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id } : null;
}

async function emitRealtimeEvent(eventName: string, payload: unknown) {
  // Insert dans la table events Realtime côté Atlas suite — stub
  await fetch(`${SUPABASE_URL}/rest/v1/atlasbanx_events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
    },
    body: JSON.stringify({ name: eventName, payload, occurred_at: new Date().toISOString() }),
  }).catch(() => {});
}

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const user = await authUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const { reportId, signatureType, recipients, message } = await req.json().catch(() => ({}));
  if (!reportId || !signatureType) return json({ error: 'reportId + signatureType required' }, 400);

  // Stub timestamp ADVIST
  const tsRfc3161 = signatureType === 'advist' ? `${Date.now()}.advist.mock.rfc3161` : null;

  // Stub bundle URL
  const proofBundleUrl = signatureType === 'advist'
    ? `https://storage.example.com/signed-reports/${reportId}.zip`
    : null;

  // Émission événement
  await emitRealtimeEvent('atlasbanx.report.signed', {
    reportId,
    signedBy: user.id,
    signatureType,
    timestampRfc3161: tsRfc3161,
    proofBundleUrl,
    recipients,
  });

  // Stub envoi email — en prod : Atlas Mail Service / SendGrid
  for (const r of recipients ?? []) {
    console.log(`[stub] email à ${r.email}`, { subject: 'Rapport AtlasBanx signé', message });
  }

  return json({
    reportId,
    signatureType,
    signedAt: new Date().toISOString(),
    timestampRfc3161: tsRfc3161,
    proofBundleUrl,
    recipientsCount: (recipients ?? []).length,
    status: 'signed',
    note: 'Stub — câbler ADVIST API + service mail effectif.',
  });
}

Deno.serve(handle);
