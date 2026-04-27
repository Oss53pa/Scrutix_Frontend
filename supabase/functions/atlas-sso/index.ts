/**
 * Edge Function: atlas-sso
 * SSO token exchange for Scrutix from Atlas Studio portal.
 * Validates JWT, creates/finds user + profile + organization, returns magic link.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAtlasJWT } from "../_shared/jwt.ts";
import { getCorsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const jwtSecret = Deno.env.get("JWT_SECRET")!;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const cors = getCorsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405, origin);

  try {
    const { token } = await req.json();
    if (!token) return errorResponse("Token manquant", 400, origin);

    const claims = await verifyAtlasJWT(token, jwtSecret);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find or create user
    let userId: string;
    const { data: existingUserData } = await supabase.auth.admin.listUsers({ filter: `email.eq.${claims.email}`, perPage: 1 });
    const existingUser = existingUserData?.users?.[0];

    if (existingUser) {
      userId = existingUser.id;
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { full_name: claims.fullName, atlas_studio_id: claims.userId, atlas_plan: claims.plan },
      });
    } else {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: claims.email,
        password: crypto.randomUUID() + "!Aa1",
        email_confirm: true,
        user_metadata: { full_name: claims.fullName, atlas_studio_id: claims.userId, atlas_plan: claims.plan },
      });
      if (createError || !newUser.user) {
        console.error("Create user error:", createError);
        return errorResponse("Impossible de créer l'utilisateur", 500, origin);
      }
      userId = newUser.user.id;
    }

    // Ensure profile exists (Scrutix profiles: id, email, full_name, organization_id, role)
    const { data: existingProfile } = await supabase.from("profiles").select("id, organization_id").eq("id", userId).single();

    if (!existingProfile) {
      // Create organization
      const { data: org, error: orgError } = await supabase.from("organizations").insert({
        name: `${claims.fullName}`,
        slug: claims.email.split("@")[0].replace(/[^a-z0-9-]/gi, "-").toLowerCase() + "-" + Date.now().toString(36),
      }).select("id").single();
      if (orgError) {
        console.error("Create org error:", orgError);
        return errorResponse("Impossible de créer l'organisation", 500, origin);
      }

      // Create profile with admin role
      await supabase.from("profiles").insert({
        id: userId,
        email: claims.email,
        full_name: claims.fullName,
        organization_id: org?.id || null,
        role: "admin",
      });
    } else {
      await supabase.from("profiles").update({
        email: claims.email,
        full_name: claims.fullName,
        updated_at: new Date().toISOString(),
      }).eq("id", userId);
    }

    // Generate magic link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email: claims.email });
    if (linkError || !linkData) {
      console.error("Generate link error:", linkError);
      return errorResponse("Impossible de générer le lien de connexion", 500, origin);
    }

    const url = new URL(linkData.properties.action_link);
    return jsonResponse({ token_hash: url.searchParams.get("token_hash") || url.hash, email: claims.email, type: "magiclink" }, 200, origin);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    console.error("atlas-sso error:", error);
    return errorResponse(message, 401, origin);
  }
});
