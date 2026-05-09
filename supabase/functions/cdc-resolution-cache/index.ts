// ============================================================================
// CDC — Edge Function: Resolution cache gateway (CDC §5.5)
// ============================================================================
// Cache Redis L2 (24h) partagé entre les workers d'audit, invalidé sur
// modification de convention ou de référentiel.
//
// Endpoints :
//   POST /cdc-resolution-cache/get      → renvoie une résolution si en cache
//   POST /cdc-resolution-cache/set      → met en cache après résolution
//   POST /cdc-resolution-cache/invalidate → invalide les clés correspondantes
//   POST /cdc-resolution-cache/sign     → signe un receipt (clé serveur)
//   GET  /cdc-resolution-cache/health   → ping
//
// Backend : Upstash Redis (REST API) — compatible Deno/Edge.
// Variables d'environnement attendues :
//   - UPSTASH_REDIS_REST_URL
//   - UPSTASH_REDIS_REST_TOKEN
//   - CDC_SIGNING_KEY               (clé HMAC-SHA256 pour les receipts)
//   - CDC_SIGNING_KEY_ID            (identifiant de la clé, ex. 'prod-2026-Q2')
//
// Auth : Supabase JWT obligatoire. Le `tenantId` est extrait du JWT via la
// table `licence_seats` côté SQL.
// ============================================================================

// @deno-types
// deno-lint-ignore-file no-explicit-any

const REDIS_URL = Deno.env.get('UPSTASH_REDIS_REST_URL') ?? '';
const REDIS_TOKEN = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') ?? '';
const SIGNING_KEY = Deno.env.get('CDC_SIGNING_KEY') ?? '';
const SIGNING_KEY_ID = Deno.env.get('CDC_SIGNING_KEY_ID') ?? 'unknown';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const TTL_SECONDS = 24 * 60 * 60; // 24h (CDC §5.5)
const NS = 'cdc:res:'; // Préfixe redis pour le namespace résolution

// ============================================================================
// Redis REST client
// ============================================================================

async function redis(...command: (string | number)[]): Promise<unknown> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error('UPSTASH_REDIS_REST_URL / TOKEN not configured');
  }
  const res = await fetch(`${REDIS_URL}/${command.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.result;
}

async function redisSet(key: string, value: string, ttl: number): Promise<void> {
  await redis('SET', key, value, 'EX', ttl);
}

async function redisGet(key: string): Promise<string | null> {
  const r = await redis('GET', key);
  return typeof r === 'string' ? r : null;
}

async function redisDelByPattern(pattern: string): Promise<number> {
  // SCAN + DEL (plus sûr que KEYS sur prod)
  let cursor = '0';
  let deleted = 0;
  do {
    const r = (await redis('SCAN', cursor, 'MATCH', pattern, 'COUNT', 200)) as [string, string[]];
    cursor = r[0];
    const keys = r[1];
    if (keys.length > 0) {
      await redis('DEL', ...keys);
      deleted += keys.length;
    }
  } while (cursor !== '0');
  return deleted;
}

// ============================================================================
// Signing (HMAC-SHA256)
// ============================================================================

async function hmacSha256Hex(input: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(input));
  let hex = '';
  const b = new Uint8Array(sig);
  for (let i = 0; i < b.length; i++) hex += b[i].toString(16).padStart(2, '0');
  return hex;
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
  let hex = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) hex += b[i].toString(16).padStart(2, '0');
  return hex;
}

// ============================================================================
// Auth — extrait le tenantId via Supabase
// ============================================================================

async function authenticate(req: Request): Promise<{ userId: string; tenantId: string } | null> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;

  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: SUPABASE_ANON_KEY },
  });
  if (!r.ok) return null;
  const user = await r.json();
  if (!user?.id) return null;

  const seatRes = await fetch(
    `${SUPABASE_URL}/rest/v1/licence_seats?user_id=eq.${user.id}&select=tenant_id&limit=1`,
    { headers: { Authorization: auth, apikey: SUPABASE_ANON_KEY } },
  );
  if (!seatRes.ok) return null;
  const seats = await seatRes.json();
  if (!Array.isArray(seats) || seats.length === 0) return null;
  return { userId: user.id, tenantId: seats[0].tenant_id };
}

// ============================================================================
// Cache key builder — déterministe et tenant-scoped
// ============================================================================

interface CacheKeyArgs {
  tenantId: string;
  accountId: string;
  rubricCode: string;
  referenceDate: string;        // YYYY-MM-DD
  mode: 'strict' | 'prescriptif';
  dimensionsHash?: string;
}

function buildKey(args: CacheKeyArgs): string {
  return `${NS}${args.tenantId}:${args.accountId}:${args.rubricCode}:${args.referenceDate}:${args.mode}:${args.dimensionsHash ?? ''}`;
}

async function dimensionsHash(dims: unknown): Promise<string> {
  if (!dims || typeof dims !== 'object') return '';
  // canonical: sort keys
  const obj = dims as Record<string, unknown>;
  const sorted = JSON.stringify(obj, Object.keys(obj).sort());
  return (await sha256Hex(sorted)).slice(0, 16);
}

// ============================================================================
// HTTP handlers
// ============================================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  const path = url.pathname.split('/').filter(Boolean).pop() ?? '';

  // Health check sans auth
  if (path === 'health') {
    return jsonResponse({
      status: 'ok',
      redisConfigured: Boolean(REDIS_URL && REDIS_TOKEN),
      signingConfigured: Boolean(SIGNING_KEY),
      keyId: SIGNING_KEY_ID,
    });
  }

  const auth = await authenticate(req);
  if (!auth) return jsonResponse({ error: 'unauthorized' }, 401);

  const body = req.method === 'POST' ? await req.json() : {};

  try {
    switch (path) {
      case 'get':       return await handleGet(auth, body);
      case 'set':       return await handleSet(auth, body);
      case 'invalidate':return await handleInvalidate(auth, body);
      case 'sign':      return await handleSign(auth, body);
      default:          return jsonResponse({ error: 'unknown path', path }, 404);
    }
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'internal' }, 500);
  }
}

// ----------------------------------------------------------------------------

async function handleGet(auth: { tenantId: string }, body: any): Promise<Response> {
  const key = buildKey({
    tenantId: auth.tenantId,
    accountId: body.accountId,
    rubricCode: body.rubricCode,
    referenceDate: body.referenceDate,
    mode: body.mode ?? 'strict',
    dimensionsHash: await dimensionsHash(body.dimensions),
  });
  const cached = await redisGet(key);
  if (!cached) return jsonResponse({ hit: false });
  return jsonResponse({ hit: true, value: JSON.parse(cached) });
}

async function handleSet(auth: { tenantId: string }, body: any): Promise<Response> {
  const key = buildKey({
    tenantId: auth.tenantId,
    accountId: body.accountId,
    rubricCode: body.rubricCode,
    referenceDate: body.referenceDate,
    mode: body.mode ?? 'strict',
    dimensionsHash: await dimensionsHash(body.dimensions),
  });
  await redisSet(key, JSON.stringify(body.value), TTL_SECONDS);
  return jsonResponse({ stored: true, ttl: TTL_SECONDS });
}

async function handleInvalidate(auth: { tenantId: string }, body: any): Promise<Response> {
  // Patterns supportés :
  //   - { scope: 'account', accountId } → toutes les résolutions du compte
  //   - { scope: 'tenant' }              → tout le tenant
  //   - { scope: 'rubric', rubricCode }  → toutes les résolutions d'une rubrique
  const scope = body.scope ?? 'tenant';
  let pattern = `${NS}${auth.tenantId}:*`;
  if (scope === 'account' && body.accountId) {
    pattern = `${NS}${auth.tenantId}:${body.accountId}:*`;
  } else if (scope === 'rubric' && body.rubricCode) {
    pattern = `${NS}${auth.tenantId}:*:${body.rubricCode}:*`;
  }
  const deleted = await redisDelByPattern(pattern);
  return jsonResponse({ invalidated: deleted, pattern });
}

async function handleSign(_auth: { tenantId: string }, body: any): Promise<Response> {
  if (!SIGNING_KEY) return jsonResponse({ error: 'signing not configured' }, 503);
  const canonical = body.canonical;
  if (typeof canonical !== 'string') {
    return jsonResponse({ error: 'canonical must be string' }, 400);
  }
  const signature = await hmacSha256Hex(canonical, SIGNING_KEY);
  const hash = await sha256Hex(canonical);
  return jsonResponse({
    signature,
    hash,
    algo: 'hmac-sha256',
    keyId: SIGNING_KEY_ID,
  });
}

// ============================================================================
// Bootstrap
// ============================================================================

Deno.serve(handle);
