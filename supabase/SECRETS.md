# AtlasBanx · Secrets Edge Functions

Ce fichier documente tous les secrets nécessaires aux 5 Edge Functions
déployées (`generate-report`, `sign-and-send`, `prophet-chat`,
`analyze-statement`, `cdc-resolution-cache`).

## TL;DR — déploiement rapide

```bash
# Si tu veux juste démarrer avec les secrets minimaux (Resend + clé CDC)
bash supabase/scripts/set-secrets.sh

# Pour le full-stack (avec ADVIST, Ollama, Upstash) :
export ADVIST_CLIENT_ID="..."
export ADVIST_CLIENT_SECRET="..."
export OLLAMA_BASE_URL="https://ollama.atlasstudio.internal"
export UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
export UPSTASH_REDIS_REST_TOKEN="..."
bash supabase/scripts/set-secrets.sh
```

## Liste exhaustive

| Secret | Utilisé par | Fallback si absent | Comment l'obtenir |
|---|---|---|---|
| `RESEND_API_KEY` | sign-and-send | Pas d'envoi mail (warn log) | ✅ Déjà dans Vault selon utilisateur |
| `RESEND_FROM_EMAIL` | sign-and-send | `AtlasBanx <noreply@atlasstudio.app>` | Domaine vérifié sur Resend |
| `RESEND_REPLY_TO` | sign-and-send | (non défini) | Optionnel |
| `CDC_SIGNING_KEY` | cdc-resolution-cache | Endpoint /sign retourne 503 | **Généré par `set-secrets.sh`** au premier run |
| `CDC_SIGNING_KEY_ID` | cdc-resolution-cache | `unknown` | Idem |
| `ADVIST_CLIENT_ID` | sign-and-send | Signature dégradée en simple | Contact ADVIST commercial |
| `ADVIST_CLIENT_SECRET` | sign-and-send | Idem | Idem |
| `ADVIST_TOKEN_URL` | sign-and-send | Idem | Doc ADVIST OAuth |
| `ADVIST_TSA_URL` | sign-and-send | Idem | Doc ADVIST TSA |
| `OLLAMA_BASE_URL` | prophet-chat | Fallback Claude | Self-host ou Atlas hosted |
| `OLLAMA_MODEL` | prophet-chat | `llama3.1:70b` | Selon modèle disponible |
| `PROPH3T_FALLBACK_LLM` | prophet-chat | `none` | Mettre `claude` si ANTHROPIC_API_KEY dispo |
| `ANTHROPIC_API_KEY` | prophet-chat | Pas de fallback LLM | ✅ Déjà dans Vault (utilisé par `claude-proxy`) |
| `UPSTASH_REDIS_REST_URL` | cdc-resolution-cache | Endpoint /get,/set retournent 500 | https://console.upstash.com (free tier OK) |
| `UPSTASH_REDIS_REST_TOKEN` | cdc-resolution-cache | Idem | Idem |

## Auto-fournis par Supabase (pas besoin de set)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Comportement de dégradation

Chaque Edge Function dégrade **gracieusement** si un secret manque :

- **sign-and-send sans ADVIST** → signature simple (juste hash SHA-256). Le rapport est tout de même persisté avec `signature_type='simple'`.
- **sign-and-send sans RESEND** → log seulement, retour `{ mails: { sent: 0, errors: ['RESEND_API_KEY missing'] } }`. La signature n'est PAS bloquée.
- **prophet-chat sans Ollama et sans Claude** → réponses déterministes locales (mêmes règles que `computeFallbackReply` côté client).
- **cdc-resolution-cache sans Upstash** → endpoint `/health` indique `redisConfigured: false`, les autres endpoints retournent 500 (le frontend dégrade fail-open et utilise son cache in-memory).

## Test rapide après déploiement

```bash
# Health check (sans auth)
curl https://vgtmljfayiysuvrcmunt.supabase.co/functions/v1/cdc-resolution-cache/health

# Réponse attendue :
# { "status": "ok", "redisConfigured": true|false, "signingConfigured": true|false, "keyId": "..." }
```

```bash
# Generate report (avec auth)
curl -X POST https://vgtmljfayiysuvrcmunt.supabase.co/functions/v1/generate-report \
  -H "Authorization: Bearer $SUPABASE_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"statementId":"2156f322-1a09-45cc-b1af-faa1cdd251c5","template":"valeur_probante"}'
```
