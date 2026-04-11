// ============================================================================
// AtlasBanx — Edge Function: enforce-ip-allowlist
// ----------------------------------------------------------------------------
// ⚠️  STUB — NOT YET WIRED INTO PRODUCTION
//
// This function is intended to be called as a Supabase Auth Hook
// (pre-login or post-auth) to enforce per-user IP allowlists stored in
// `atlasbanx.ip_allowlists`. It is NOT active yet — deploying it requires:
//
//   1. Enabling Auth Hooks in the Supabase dashboard (Auth → Hooks)
//   2. Choosing the hook type (HTTP / before-signin)
//   3. Pointing the hook URL to this function's deployed endpoint
//   4. Testing carefully — a bug here can lock every user out
//
// Until then, IP allowlist rules exist as advisory metadata only: the
// table and CRUD UI let cabinets express their policy, but the policy is
// not enforced at the auth layer.
//
// ----------------------------------------------------------------------------
// Expected flow when enabled
// ----------------------------------------------------------------------------
//
//   1. User submits login → Supabase triggers this hook with the payload
//      { user_id, email, ip }
//   2. We load ip_allowlists WHERE user_id = payload.user_id AND active = true
//   3. If the set is empty → allow (no restriction set)
//   4. If the set is non-empty → check if payload.ip is contained in ANY
//      active CIDR range
//        - Yes → allow login
//        - No  → deny login, log SUSPICIOUS_ACTIVITY_DETECTED event
//
// ----------------------------------------------------------------------------
// Why this is a stub and not a real implementation
// ----------------------------------------------------------------------------
//
//   a. Supabase Auth Hooks are still evolving — the payload schema and
//      the exact hook registration mechanism change across minor versions
//      of the Supabase platform. Implementing against a moving spec risks
//      shipping a function that breaks silently.
//   b. CIDR containment check requires either:
//        - A raw SQL query using the `<<=` operator on the CIDR column
//        - Or a TS CIDR library (adds a dep)
//      Both are straightforward, but we want to do it correctly once.
//   c. Locking users out of their own app because of a bug here is a
//      catastrophic failure mode. Shipping this dormant until properly
//      reviewed is the right call.
//
// When you activate this, delete this comment block and replace with the
// real implementation. See README_SECURITY.md §7 for the tracking item.
// ============================================================================

// @ts-expect-error — Deno std import available only in Supabase Edge runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

interface AuthHookPayload {
  user_id?: string;
  email?: string;
  ip?: string;
  event_type?: string;
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: AuthHookPayload;
  try {
    payload = (await req.json()) as AuthHookPayload;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  // STUB BEHAVIOR — always allow.
  //
  // TODO: Replace with real enforcement once Auth Hooks schema is stable.
  //
  // const supabase = createClient(
  //   Deno.env.get('SUPABASE_URL')!,
  //   Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  // );
  //
  // const { data: rules } = await supabase
  //   .schema('atlasbanx')
  //   .from('ip_allowlists')
  //   .select('cidr')
  //   .eq('user_id', payload.user_id)
  //   .eq('active', true);
  //
  // if (!rules || rules.length === 0) {
  //   return new Response(JSON.stringify({ decision: 'allow' }), { status: 200 });
  // }
  //
  // const { data: match } = await supabase.rpc('ip_in_cidr_list', {
  //   p_ip: payload.ip,
  //   p_user_id: payload.user_id,
  // });
  //
  // if (match) {
  //   return new Response(JSON.stringify({ decision: 'allow' }), { status: 200 });
  // }
  //
  // return new Response(
  //   JSON.stringify({
  //     decision: 'deny',
  //     reason: 'IP not in allowlist',
  //   }),
  //   { status: 200, headers: { 'content-type': 'application/json' } },
  // );

  return new Response(
    JSON.stringify({
      decision: 'allow',
      stub: true,
      message: 'IP allowlist enforcement is not yet active',
      payload,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
