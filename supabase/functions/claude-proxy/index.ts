// ============================================================================
// Edge Function: claude-proxy
// ============================================================================
// Server-side proxy for Anthropic Claude API. Reads the calling user's
// stored API key from atlasbanx.user_ai_keys, forwards the request to
// api.anthropic.com, returns the response.
//
// The API key NEVER leaves the server. The browser only ever sees the
// Anthropic response payload.
//
// Request body (mirrors a subset of Anthropic /v1/messages):
//   {
//     model:        string,
//     max_tokens:   number,
//     temperature?: number,
//     messages:     Array<{ role: 'user' | 'assistant', content: string }>,
//     system?:      string
//   }
//
// Special action: { action: "validate" } → tries a 1-token call to confirm
// the stored key works. Returns { valid: boolean, error?: string }.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const cors = getCorsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405, origin);

  // -----------------------------------------------------------------------
  // 1. Authenticate the caller via their JWT (user-bound client)
  // -----------------------------------------------------------------------
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authorization header manquant", 401, origin);
  }
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth:   { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return errorResponse("Session invalide", 401, origin);
  }
  const userId = userData.user.id;

  // -----------------------------------------------------------------------
  // 2. Fetch the user's Anthropic key with service_role (bypasses RLS)
  // -----------------------------------------------------------------------
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: keyRow, error: keyErr } = await adminClient
    .schema("atlasbanx")
    .from("user_ai_keys")
    .select("anthropic_api_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (keyErr) {
    console.error("[claude-proxy] key fetch error:", keyErr);
    return errorResponse("Erreur de lecture de la clé", 500, origin);
  }
  if (!keyRow?.anthropic_api_key) {
    return errorResponse(
      "Aucune clé Anthropic configurée. Renseignez votre clé dans Paramètres → IA.",
      400,
      origin
    );
  }
  const apiKey = keyRow.anthropic_api_key;

  // -----------------------------------------------------------------------
  // 3. Parse request body
  // -----------------------------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Corps JSON invalide", 400, origin);
  }

  // -----------------------------------------------------------------------
  // 4a. Special action: "validate" → tiny test call to confirm key works
  // -----------------------------------------------------------------------
  if (body.action === "validate") {
    try {
      const testRes = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: (body.model as string) || "claude-haiku-4-5-20251001",
          max_tokens: 5,
          messages: [{ role: "user", content: "OK" }],
        }),
      });

      if (!testRes.ok) {
        const errData = await testRes.json().catch(() => ({}));
        return jsonResponse(
          {
            valid: false,
            status: testRes.status,
            error: (errData?.error?.message as string) || testRes.statusText,
          },
          200,
          origin
        );
      }

      // Mark validated
      await adminClient
        .schema("atlasbanx")
        .from("user_ai_keys")
        .update({ anthropic_validated_at: new Date().toISOString() })
        .eq("user_id", userId);

      return jsonResponse({ valid: true }, 200, origin);
    } catch (err) {
      return jsonResponse(
        { valid: false, error: err instanceof Error ? err.message : "Erreur réseau" },
        200,
        origin
      );
    }
  }

  // -----------------------------------------------------------------------
  // 4b. Forward request to Anthropic
  // -----------------------------------------------------------------------
  const forward: Record<string, unknown> = {
    model:       body.model      ?? "claude-sonnet-4-6-20250514",
    max_tokens:  body.max_tokens  ?? 4000,
    temperature: body.temperature ?? 0.3,
    messages:    body.messages    ?? [],
  };
  if (body.system) forward.system = body.system;

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(forward),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...cors,
        "Content-Type": upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    console.error("[claude-proxy] forward error:", err);
    return errorResponse(
      err instanceof Error ? err.message : "Erreur réseau vers Anthropic",
      502,
      origin
    );
  }
});
