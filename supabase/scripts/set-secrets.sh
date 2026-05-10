#!/usr/bin/env bash
# ============================================================================
# AtlasBanx — set-secrets.sh
# ============================================================================
# Configure tous les secrets nécessaires pour les 5 Edge Functions déployées.
# Usage :
#   1. Vérifier que tu es loggé : supabase login
#   2. Renseigner les valeurs marquées TODO ci-dessous
#   3. Lancer : bash supabase/scripts/set-secrets.sh
#
# Sécurité : ce script lit les valeurs depuis l'environnement OU depuis
# des fichiers .env.local non commités. NE PAS commiter de vraies valeurs.
# ============================================================================

set -e

PROJECT_REF="vgtmljfayiysuvrcmunt"

echo "🔐 Configuration des secrets Supabase pour le projet $PROJECT_REF"
echo ""

# ============================================================================
# 1. CDC_SIGNING_KEY — généré automatiquement (HMAC-SHA256, 48 bytes URL-safe)
# ============================================================================
# Si déjà défini dans Vault, ne PAS regénérer (ça invaliderait toutes les
# signatures déjà émises). Décommenter la ligne suivante pour bootstrap.

if [ -z "$CDC_SIGNING_KEY" ]; then
  CDC_SIGNING_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))" 2>/dev/null \
                   || openssl rand -base64 48 | tr -d '\n')
  echo "🔑 CDC_SIGNING_KEY généré (${CDC_SIGNING_KEY:0:8}…${CDC_SIGNING_KEY: -4})"
fi

if [ -z "$CDC_SIGNING_KEY_ID" ]; then
  CDC_SIGNING_KEY_ID="prod-$(date -u +%Y-%m)-$(python3 -c 'import secrets;print(secrets.token_hex(4))' 2>/dev/null || openssl rand -hex 4)"
  echo "🏷  CDC_SIGNING_KEY_ID = $CDC_SIGNING_KEY_ID"
fi

# ============================================================================
# 2. ADVIST (signature électronique RFC 3161)
# ============================================================================
# TODO : remplacer par les creds réels obtenus auprès de ADVIST
# Si non configuré, sign-and-send dégrade en signature simple (hash seul)
ADVIST_CLIENT_ID="${ADVIST_CLIENT_ID:-}"
ADVIST_CLIENT_SECRET="${ADVIST_CLIENT_SECRET:-}"
ADVIST_TOKEN_URL="${ADVIST_TOKEN_URL:-https://api.advist.example/oauth/token}"
ADVIST_TSA_URL="${ADVIST_TSA_URL:-https://api.advist.example/timestamp}"

# ============================================================================
# 3. Resend (déjà configuré dans Vault selon l'utilisateur)
# ============================================================================
# Si tu utilises encore le sandbox Resend, garde 'onboarding@resend.dev'.
# Une fois ton domaine vérifié sur Resend, mets 'noreply@atlasbanx.com'.
RESEND_FROM_EMAIL="${RESEND_FROM_EMAIL:-AtlasBanx <noreply@atlasstudio.app>}"
RESEND_REPLY_TO="${RESEND_REPLY_TO:-support@atlasstudio.app}"

# ============================================================================
# 4. Ollama (LLM principal pour PROPH3T)
# ============================================================================
# TODO : si tu as une instance Ollama déployée (Atlas hosted ou self-host)
# Si non configuré, prophet-chat tombe sur Claude API
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.1:70b}"

# ============================================================================
# 5. Anthropic (fallback LLM si Ollama indispo)
# ============================================================================
# Devrait déjà être configuré (Atlas Studio utilise déjà Claude)
PROPH3T_FALLBACK_LLM="${PROPH3T_FALLBACK_LLM:-claude}"

# ============================================================================
# 6. Upstash Redis (cache CDC L2 24h)
# ============================================================================
# Provisionne sur https://console.upstash.com/redis (gratuit jusqu'à 10k cmd/jour)
# TODO : remplacer par tes creds
UPSTASH_REDIS_REST_URL="${UPSTASH_REDIS_REST_URL:-}"
UPSTASH_REDIS_REST_TOKEN="${UPSTASH_REDIS_REST_TOKEN:-}"

# ============================================================================
# Application des secrets
# ============================================================================

echo ""
echo "📤 Application des secrets sur le projet $PROJECT_REF…"
echo ""

# CDC signing
supabase secrets set \
  CDC_SIGNING_KEY="$CDC_SIGNING_KEY" \
  CDC_SIGNING_KEY_ID="$CDC_SIGNING_KEY_ID" \
  --project-ref "$PROJECT_REF"

# ADVIST (laisse vide si pas encore obtenu — sign-and-send dégrade gracieusement)
if [ -n "$ADVIST_CLIENT_ID" ]; then
  supabase secrets set \
    ADVIST_CLIENT_ID="$ADVIST_CLIENT_ID" \
    ADVIST_CLIENT_SECRET="$ADVIST_CLIENT_SECRET" \
    ADVIST_TOKEN_URL="$ADVIST_TOKEN_URL" \
    ADVIST_TSA_URL="$ADVIST_TSA_URL" \
    --project-ref "$PROJECT_REF"
  echo "✅ ADVIST configuré"
else
  echo "⚠  ADVIST non configuré (signature dégradée en simple)"
fi

# Resend (RESEND_API_KEY déjà dans Vault — on définit juste les params optionnels)
supabase secrets set \
  RESEND_FROM_EMAIL="$RESEND_FROM_EMAIL" \
  RESEND_REPLY_TO="$RESEND_REPLY_TO" \
  --project-ref "$PROJECT_REF"
echo "✅ Resend FROM/REPLY-TO configurés"

# Ollama
if [ -n "$OLLAMA_BASE_URL" ]; then
  supabase secrets set \
    OLLAMA_BASE_URL="$OLLAMA_BASE_URL" \
    OLLAMA_MODEL="$OLLAMA_MODEL" \
    --project-ref "$PROJECT_REF"
  echo "✅ Ollama configuré"
else
  echo "⚠  Ollama non configuré (fallback Claude)"
fi

# Fallback LLM
supabase secrets set \
  PROPH3T_FALLBACK_LLM="$PROPH3T_FALLBACK_LLM" \
  --project-ref "$PROJECT_REF"

# Upstash
if [ -n "$UPSTASH_REDIS_REST_URL" ]; then
  supabase secrets set \
    UPSTASH_REDIS_REST_URL="$UPSTASH_REDIS_REST_URL" \
    UPSTASH_REDIS_REST_TOKEN="$UPSTASH_REDIS_REST_TOKEN" \
    --project-ref "$PROJECT_REF"
  echo "✅ Upstash Redis configuré"
else
  echo "⚠  Upstash non configuré (cache L2 désactivé)"
fi

echo ""
echo "🎉 Configuration terminée. Vérification :"
supabase secrets list --project-ref "$PROJECT_REF" | grep -E '(CDC_|ADVIST_|RESEND_|OLLAMA_|UPSTASH_|PROPH3T_)' || true
echo ""
echo "📝 Sauvegarde-le : CDC_SIGNING_KEY=$CDC_SIGNING_KEY"
echo "   (Si tu perds cette valeur, toutes les signatures émises avec deviendront invérifiables.)"
