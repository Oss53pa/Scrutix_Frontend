// ============================================================================
// ATLASBANX - PROPH3T Intelligence Gateway (Edge Function)
// Point d'entree unique pour les 14 competences PROPH3T.
// Responsabilites : auth, validation, routage, rate limit, logging.
// Ref: CDC PROPH3T v1.0, Section 3 (Architecture couche 1)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

// ----------------------------------------------------------------------------
// Types (mirrored from src — Edge Functions can't import from src)
// ----------------------------------------------------------------------------

interface IntelligenceRequest {
  competence_id: number;
  context: Record<string, unknown>;
  client_consent_cloud?: boolean;
  user_id: string;
  organization_id: string;
}

interface IntelligenceTrace {
  model_used: string;
  competence_version: string;
  prompt_hash: string;
  confidence_score: number;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
}

interface IntelligenceResponse {
  output: unknown;
  trace: IntelligenceTrace;
}

interface ErrorPayload {
  error: string;
  code: string;
  competence_id?: number;
  details?: Record<string, unknown>;
}

// Competence version registry (sync with src/ai/proph3t/intelligence/types.ts)
const COMPETENCE_VERSIONS: Record<number, string> = {
  1: "1.0.0", 2: "1.0.0", 3: "1.0.0", 4: "1.0.0",
  5: "1.0.0", 6: "1.0.0", 7: "1.0.0", 8: "1.0.0",
  9: "1.0.0", 10: "1.0.0", 11: "1.0.0", 12: "1.0.0",
  13: "1.0.0", 14: "1.0.0",
};

// Orange zone competences requiring human validation
const ORANGE_ZONE: Set<number> = new Set([1, 2, 3, 4, 5, 6, 7, 11, 12, 13]);

// Rate limit: max requests per user per minute
const RATE_LIMIT_PER_MINUTE = 30;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_MINUTE) return false;
  entry.count++;
  return true;
}

function validateRequest(body: unknown): { ok: true; data: IntelligenceRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Corps de requete invalide" };
  }

  const req = body as Record<string, unknown>;

  if (typeof req.competence_id !== "number" || req.competence_id < 1 || req.competence_id > 14) {
    return { ok: false, error: `competence_id doit etre entre 1 et 14, recu: ${req.competence_id}` };
  }
  if (!req.context || typeof req.context !== "object") {
    return { ok: false, error: "context requis (object)" };
  }
  if (typeof req.user_id !== "string" || !req.user_id) {
    return { ok: false, error: "user_id requis (string UUID)" };
  }
  if (typeof req.organization_id !== "string" || !req.organization_id) {
    return { ok: false, error: "organization_id requis (string UUID)" };
  }

  return {
    ok: true,
    data: {
      competence_id: req.competence_id as number,
      context: req.context as Record<string, unknown>,
      client_consent_cloud: req.client_consent_cloud === true,
      user_id: req.user_id as string,
      organization_id: req.organization_id as string,
    },
  };
}

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

// ----------------------------------------------------------------------------
// Competence dispatch (stub — handlers will be implemented per-competence)
// ----------------------------------------------------------------------------

async function dispatchCompetence(
  req: IntelligenceRequest,
): Promise<IntelligenceResponse> {
  const startMs = Date.now();
  const competenceVersion = COMPETENCE_VERSIONS[req.competence_id] ?? "0.0.0";

  // TODO: Route to actual competence handlers as they are implemented.
  // For now, return a structured stub that confirms the gateway is functional.
  const output = {
    _stub: true,
    message: `Competence ${req.competence_id} recue. Handler non encore implemente.`,
    competence_id: req.competence_id,
    context_keys: Object.keys(req.context),
    requires_validation: ORANGE_ZONE.has(req.competence_id),
  };

  const durationMs = Date.now() - startMs;
  const promptHash = await hashString(JSON.stringify(req.context).slice(0, 500));
  const inputHash = await hashString(JSON.stringify(req.context));

  const trace: IntelligenceTrace = {
    model_used: "ollama-qwen2.5-7b",
    competence_version: competenceVersion,
    prompt_hash: promptHash,
    confidence_score: 0,
    duration_ms: durationMs,
    tokens_in: 0,
    tokens_out: 0,
  };

  return { output, trace };
}

// ----------------------------------------------------------------------------
// Persist inference record
// ----------------------------------------------------------------------------

async function persistInference(
  supabase: ReturnType<typeof createClient>,
  req: IntelligenceRequest,
  res: IntelligenceResponse,
  inputHash: string,
): Promise<void> {
  const { error } = await supabase
    .schema("atlasbanx" as "public")
    .from("proph3t_inferences")
    .insert({
      competence_id: req.competence_id,
      competence_version: res.trace.competence_version,
      model_used: res.trace.model_used,
      prompt_hash: res.trace.prompt_hash,
      input_hash: inputHash,
      output: res.output,
      confidence_score: res.trace.confidence_score || null,
      duration_ms: res.trace.duration_ms,
      tokens_in: res.trace.tokens_in,
      tokens_out: res.trace.tokens_out,
      user_id: req.user_id,
      organization_id: req.organization_id,
    });

  if (error) {
    console.error("[intelligence-gateway] Failed to persist inference:", error.message);
  }
}

// ----------------------------------------------------------------------------
// Main handler
// ----------------------------------------------------------------------------

Deno.serve(async (httpReq: Request) => {
  const origin = httpReq.headers.get("origin") ?? "";
  const cors = getCorsHeaders(origin);

  // CORS preflight
  if (httpReq.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  // Only POST allowed
  if (httpReq.method !== "POST") {
    return errorResponse("Methode non autorisee", 405, origin);
  }

  try {
    // --- Auth ---
    const authHeader = httpReq.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Token d'authentification requis", 401, origin);
    }
    const jwt = authHeader.slice(7);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return errorResponse("Configuration Supabase manquante", 500, origin);
    }

    // Verify user via their JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return errorResponse("Authentification echouee", 401, origin);
    }

    // --- Parse & validate request body ---
    let body: unknown;
    try {
      body = await httpReq.json();
    } catch {
      return errorResponse("JSON invalide", 400, origin);
    }

    const validation = validateRequest(body);
    if (!validation.ok) {
      const err: ErrorPayload = {
        error: validation.error,
        code: "VALIDATION_FAILED",
      };
      return jsonResponse(err, 400, origin);
    }

    const req = validation.data;

    // Enforce user_id matches authenticated user
    if (req.user_id !== user.id) {
      return errorResponse("user_id ne correspond pas au token", 403, origin);
    }

    // --- Rate limit ---
    if (!checkRateLimit(user.id)) {
      const err: ErrorPayload = {
        error: "Limite de requetes atteinte (30/min). Reessayez dans quelques secondes.",
        code: "RATE_LIMITED",
      };
      return jsonResponse(err, 429, origin);
    }

    // --- Dispatch to competence handler ---
    const result = await dispatchCompetence(req);

    // --- Persist inference (fire-and-forget with service role) ---
    if (supabaseServiceKey) {
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
      const inputHash = await hashString(JSON.stringify(req.context));
      // Don't await — non-blocking persistence
      persistInference(serviceClient, req, result, inputHash).catch((e) =>
        console.error("[intelligence-gateway] Persist error:", e)
      );
    }

    // --- Response ---
    return jsonResponse(result, 200, origin);
  } catch (err) {
    console.error("[intelligence-gateway] Unhandled error:", err);
    const payload: ErrorPayload = {
      error: "Erreur interne du gateway",
      code: "INTERNAL",
    };
    return jsonResponse(payload, 500, origin);
  }
});
