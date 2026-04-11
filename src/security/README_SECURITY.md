# AtlasBanx — Architecture de sécurité

> Version : 1.0.0 · Dernière mise à jour : 2026-04-11
> Référence : Bloc 3 du playbook de complétion enterprise

Ce document décrit l'architecture de sécurité d'AtlasBanx et la protection
des données sensibles (relevés bancaires, rapports d'audit, consentements).
Il est destiné aux administrateurs de cabinets d'audit, aux DSI des clients
entreprises, et aux équipes de conformité.

---

## 1. Modèle de menaces

**Actifs protégés**
- Relevés bancaires des clients (PDF, CSV, Excel) — données financières
  sensibles
- Transactions normalisées en base
- Rapports d'audit générés — valeur probatoire en cas de contentieux
- Identifiants et sessions utilisateur
- Clés API IA (Claude, OpenAI, Mistral, etc.) stockées dans les paramètres

**Adversaires considérés**
1. Attaquant externe opportuniste (scraping, bot, phishing)
2. Compte utilisateur compromis (credentials leak, réutilisation)
3. Employé malveillant du cabinet
4. Administrateur Supabase malveillant (hors scope — défense via Vault /
   row-level security)

**Hors scope de ce bloc**
- Compromission du serveur Supabase sous-jacent (responsabilité Supabase)
- Compromission du navigateur de l'utilisateur (responsabilité OS / AV)
- Attaques physiques sur les machines clientes

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Navigateur client                        │
│                                                                 │
│  ┌───────────┐  ┌──────────────┐  ┌────────────────────────┐    │
│  │ LoginThr. │  │ PasswordPol. │  │ FileSecurityValidator  │    │
│  └─────┬─────┘  └──────┬───────┘  └───────────┬────────────┘    │
│        │               │                      │                 │
│        │               │HIBP (k-anon)         │                  │
│        │               └─────────►api.pwn...  │                  │
│        │                                      │                  │
│  ┌─────▼──────────────────────────────────────▼──────────────┐   │
│  │                    AuthStore + hooks                      │   │
│  └───────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐   │
│  │           Supabase JS Client (TLS 1.3 enforced)           │   │
│  └───────────────────────────┬───────────────────────────────┘   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                        Supabase backend                        │
│                                                                │
│  Auth (MFA TOTP)  │  RLS per user_id  │  Append-only audit    │
│                   │                   │                        │
│  policy_versions  │ user_consents     │ data_deletion_requests │
│  ip_allowlists    │ audit_trail (005) │                        │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Matrice des données sensibles

| Donnée | Stockage | Protection in-transit | Protection at-rest | Durée de rétention |
|---|---|---|---|---|
| Clés API IA | localStorage (chiffré AES-256-GCM via `src/utils/crypto.ts`, clé dérivée du fingerprint navigateur) | N/A (jamais envoyé) | AES-256-GCM local | Session navigateur |
| Mot de passe | Jamais stocké en clair | TLS 1.3 (Supabase) | bcrypt (Supabase) | — |
| Session JWT | localStorage (Supabase SDK) | TLS 1.3 | — | 1 heure (refresh auto) |
| Relevés PDF/CSV/Excel | **Jamais uploadés** — parsés 100% localement | — | — | Session |
| Transactions normalisées | Table `atlasbanx.transactions` | TLS 1.3 | RLS (user_id), chiffrement au repos Supabase (gp2/gp3 AWS KMS) | OHADA: 7 ans |
| Rapports d'audit | Table `atlasbanx.reports` + PDF généré localement | TLS 1.3 | RLS | OHADA: 10 ans |
| Audit trail | Table `atlasbanx.audit_trail` | TLS 1.3 | RLS + chaîne SHA-256 immuable | 10 ans (preuve) |
| Consentements | Table `atlasbanx.user_consents` | TLS 1.3 | RLS + append-only | Durée du compte |
| Règles IP allowlist | Table `atlasbanx.ip_allowlists` | TLS 1.3 | RLS | Durée de vie active |

### Note sur le chiffrement at-rest "applicatif"

Le prompt d'origine du Bloc 3 suggérait un chiffrement colonnaire des
transactions via un `EncryptionService` avec une hiérarchie de clés
`MasterKey → ClientKey → DataKey`. **Cette approche a été écartée** pour
les raisons suivantes :

1. **`MasterKey` en variable d'environnement Vite** serait inclus dans
   le bundle `index.html` généré par `vite-plugin-singlefile`, et donc
   visible par n'importe quel utilisateur qui inspecte le HTML. C'est une
   fausse sécurité pire qu'aucun chiffrement.
2. **Chiffrement colonnaire côté client** briserait les requêtes RLS
   serveur (tri, filtre, jointures sur `amount`, `date`, `description`).
3. **La protection actuelle est suffisante** : TLS 1.3 in-transit +
   Supabase chiffrement disque AES-256 at-rest + RLS par utilisateur.
   L'attaquant devrait compromettre simultanément le navigateur *et*
   Supabase, ce qui sort du modèle de menaces.

Un chiffrement colonnaire réel nécessiterait une refonte architecturale
(queue de décryption, index chiffrés type PSI) qui fera l'objet d'un bloc
dédié si le besoin se matérialise.

---

## 4. Contrôles implémentés

### 4.1 Authentification

- **Supabase Auth** avec email/mot de passe
- **MFA TOTP** disponible via `MfaService` (Supabase natif) — recommandé
  pour les comptes cabinet, non imposé (enforcement soft côté UI)
- **Politique de mot de passe** : 12 caractères minimum, majuscule,
  chiffre, caractère spécial — voir `PasswordPolicy.ts`
- **HaveIBeenPwned** : check k-anonymity (prefix SHA-1 5 chars) à
  l'inscription et au changement de mot de passe
- **Login throttle** : 5 tentatives/15 min puis lockout 15 min
  (`LoginThrottle.ts`)
- **Session timeout** : 30 min d'inactivité + hard ceiling 8h
  (`useSessionTimeout.ts`)

### 4.2 Autorisation

- **Row Level Security** sur toutes les tables `atlasbanx.*`
- **Grants explicites** par table (pas de `GRANT ALL` générique)
- Les policies de lecture filtrent systématiquement par `user_id = auth.uid()`

### 4.3 Intégrité & non-répudiation

- **Audit trail immuable** (Bloc 5) avec chaînage SHA-256
- **Certificat d'intégrité** injecté en dernière page des PDF exportés
- Fonction `verify_audit_chain()` pour détecter toute altération

### 4.4 Confidentialité

- **Masquage des PII** dans les logs via `AuditTrailService.hashSensitive()`
  (SHA-256 tronqué 12 chars)
- **Pas d'envoi de PII** à des services tiers en dehors des appels IA
  explicitement configurés par l'utilisateur
- **HIBP** ne transmet que les 5 premiers chars du SHA-1 du mot de passe
  (k-anonymity, la valeur est non-récupérable)

### 4.5 Conformité RGPD / ARTCI / ANPDP

- **Consentement versionné** via `policy_versions` + `user_consents`
- **Droit à l'effacement** via `DataDeletionService` (requête → validation
  humaine → cascade ON DELETE)
- **Droit d'accès** : l'utilisateur voit toutes ses données via ses
  propres écrans (clients, rapports, audit trail)
- **Portabilité** : export CSV/Excel/PDF disponible (via `ReportService`)

### 4.6 Headers HTTP (Vercel)

Voir `vercel.json` :
- `Strict-Transport-Security` (HSTS 2 ans + preload)
- `Content-Security-Policy` strict avec allowlist des domaines IA
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (pas de camera/microphone/géolocation)

---

## 5. Procédures d'incident

### 5.1 Compte utilisateur compromis suspecté

1. L'utilisateur ou l'admin cabinet dépose une demande d'effacement via
   Settings → Mon compte → "Supprimer mon compte"
2. Un admin vérifie la demande dans `atlasbanx.data_deletion_requests`
3. Force la déconnexion via Supabase dashboard → Authentication → Users
4. Rotation des clés API (Settings → Providers IA)
5. Review de l'audit trail pour identifier les actions suspectes
6. Si MFA n'était pas activé, imposer MFA avant réactivation

### 5.2 Fuite détectée dans l'audit trail

1. Appeler `verify_audit_chain()` pour identifier le point de rupture
2. Geler les exports de rapports (désactiver le bouton si possible)
3. Exporter tout l'audit trail pour expertise forensique
4. Notifier les clients concernés (RGPD Art. 33)
5. Ouvrir une investigation et documenter dans `security_events` (via
   audit trail `SUSPICIOUS_ACTIVITY_DETECTED`)

### 5.3 Fichier suspect bloqué par `FileSecurityValidator`

Le fichier n'est jamais traité — aucune action supplémentaire requise. Si
les blocages sont récurrents pour un utilisateur donné, investiguer dans
l'audit trail.

---

## 6. Checklist de conformité

### ARTCI (Côte d'Ivoire)

- [x] Déclaration de traitement à l'ARTCI (hors périmètre technique)
- [x] Consentement explicite du client avant collecte
- [x] Droit d'accès, rectification, effacement
- [x] Mesures techniques de protection (TLS, RLS, audit trail)
- [ ] Désignation d'un DPO (à la charge du cabinet client)

### ANPDP (Sénégal)

- [x] Collecte limitée à la finalité
- [x] Conservation limitée dans le temps (7 ans OHADA)
- [x] Sécurité des traitements
- [ ] Déclaration préalable à l'ANPDP

### OHADA Art. 17

- [x] Conservation des pièces comptables pendant 10 ans
- [x] Traçabilité des opérations via audit trail

---

## 7. TODO & limitations connues

- [ ] **IP allowlist enforcement** — nécessite une Edge Function Supabase
  pour intercepter les logins (stub dans `supabase/functions/enforce-ip-allowlist/`)
- [ ] **Chiffrement colonnaire** — reporté, voir §3
- [ ] **MFA obligatoire** pour cabinet — actuellement soft, à activer
  après période de migration
- [ ] **Textes légaux** — les politiques seedées sont du boilerplate à
  remplacer par un document validé par un juriste
- [ ] **SOC 2 Type II** — ce document couvre Type I (contrôles décrits),
  pas Type II (efficacité opérationnelle sur 6-12 mois)
- [ ] **Certification formelle ISO 27001** — non couverte

---

## 8. Contact sécurité

Pour signaler une vulnérabilité : `security@atlasbanx.com` (à configurer).
Programme bug bounty : non disponible actuellement.
