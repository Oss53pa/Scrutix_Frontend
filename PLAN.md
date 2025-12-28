# Plan d'intégration des fonctionnalités IA - Scrutix

## Objectif
Intégrer toutes les fonctionnalités IA de manière **agnostique au fournisseur** (Claude, OpenAI, Mistral, Ollama, etc.)

---

## Fonctionnalités à intégrer

### Fonctionnalités IA principales
- [x] Catégorisation automatique (existe déjà)
- [x] Détection fraude (existe déjà)
- [x] Génération rapports (existe déjà)
- [x] Chat IA (existe déjà)

### Détection IA de base
- 🔄 Doublons
- 👻 Frais fantômes
- 📈 Surfacturation
- 💰 Erreurs d'agios

### Détection IA étendue
- 📅 Dates valeur
- 🔍 Suspect
- ⚠️ Conformité
- 💵 Trésorerie
- 🔗 Rapprochement
- 🏦 Multi-banques
- 📋 OHADA
- 🚨 LCB-FT
- 🧾 Frais

### Paramètres avancés
- Temperature: 0.3 (configurable)
- Tokens maximum: 4000 (100-8000)

---

## Architecture proposée

### 1. Couche d'abstraction AI Provider

```
src/
├── ai/
│   ├── types.ts                    # Interfaces communes
│   ├── AIProviderFactory.ts        # Factory pour créer les providers
│   ├── providers/
│   │   ├── BaseAIProvider.ts       # Classe abstraite
│   │   ├── ClaudeProvider.ts       # Anthropic Claude
│   │   ├── OpenAIProvider.ts       # OpenAI GPT
│   │   ├── MistralProvider.ts      # Mistral AI
│   │   ├── OllamaProvider.ts       # Ollama (local)
│   │   └── index.ts
│   ├── detectors/
│   │   ├── AIDetectorBase.ts       # Base pour tous les détecteurs IA
│   │   ├── DuplicateAIDetector.ts  # 🔄 Doublons
│   │   ├── GhostFeeAIDetector.ts   # 👻 Frais fantômes
│   │   ├── OverchargeAIDetector.ts # 📈 Surfacturation
│   │   ├── InterestAIDetector.ts   # 💰 Erreurs d'agios
│   │   ├── ValueDateAIDetector.ts  # 📅 Dates valeur
│   │   ├── SuspiciousAIDetector.ts # 🔍 Suspect
│   │   ├── ComplianceAIDetector.ts # ⚠️ Conformité
│   │   ├── CashflowAIDetector.ts   # 💵 Trésorerie
│   │   ├── ReconciliationAIDetector.ts # 🔗 Rapprochement
│   │   ├── MultiBankAIDetector.ts  # 🏦 Multi-banques
│   │   ├── OhadaAIDetector.ts      # 📋 OHADA
│   │   ├── AmlAIDetector.ts        # 🚨 LCB-FT
│   │   ├── FeeAIDetector.ts        # 🧾 Frais
│   │   └── index.ts
│   ├── services/
│   │   ├── AICategorizationService.ts
│   │   ├── AIFraudDetectionService.ts
│   │   ├── AIReportGenerationService.ts
│   │   ├── AIChatService.ts
│   │   └── AIDetectionOrchestrator.ts
│   └── index.ts
```

### 2. Interface AIProvider

```typescript
interface AIProvider {
  name: string;
  models: AIModel[];

  // Configuration
  configure(config: AIProviderConfig): void;
  testConnection(): Promise<boolean>;

  // Core capabilities
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  complete(prompt: string, options?: CompletionOptions): Promise<string>;

  // Specialized methods
  categorizeTransactions(transactions: Transaction[]): Promise<CategorizedTransaction[]>;
  detectAnomalies(transactions: Transaction[], type: DetectionType): Promise<Anomaly[]>;
  generateReport(data: ReportData): Promise<string>;

  // Usage tracking
  getUsage(): AIUsageStats;
}
```

### 3. Types de détection IA

```typescript
enum AIDetectionType {
  // Détection de base
  DUPLICATES = 'duplicates',
  GHOST_FEES = 'ghost_fees',
  OVERCHARGES = 'overcharges',
  INTEREST_ERRORS = 'interest_errors',

  // Détection étendue
  VALUE_DATE = 'value_date',
  SUSPICIOUS = 'suspicious',
  COMPLIANCE = 'compliance',
  CASHFLOW = 'cashflow',
  RECONCILIATION = 'reconciliation',
  MULTI_BANK = 'multi_bank',
  OHADA = 'ohada',
  AML_LCB_FT = 'aml_lcb_ft',
  FEES = 'fees'
}
```

---

## Étapes d'implémentation

### Phase 1: Infrastructure AI Provider (Priorité haute)
1. [ ] Créer `src/ai/types.ts` - Interfaces et types communs
2. [ ] Créer `src/ai/providers/BaseAIProvider.ts` - Classe abstraite
3. [ ] Migrer `ClaudeService.ts` vers `ClaudeProvider.ts`
4. [ ] Créer `AIProviderFactory.ts` - Factory pattern
5. [ ] Mettre à jour `settingsStore.ts` - Configuration multi-provider

### Phase 2: Providers additionnels (Priorité moyenne)
6. [ ] Implémenter `OpenAIProvider.ts`
7. [ ] Implémenter `MistralProvider.ts`
8. [ ] Implémenter `OllamaProvider.ts` (modèles locaux)

### Phase 3: Détecteurs IA (Priorité haute)
9. [ ] Créer `AIDetectorBase.ts` - Classe de base
10. [ ] Implémenter les 4 détecteurs de base
11. [ ] Implémenter les 9 détecteurs étendus
12. [ ] Créer `AIDetectionOrchestrator.ts`

### Phase 4: Services IA (Priorité haute)
13. [ ] Refactorer les services existants pour utiliser les providers
14. [ ] Créer `AICategorizationService.ts`
15. [ ] Créer `AIFraudDetectionService.ts`
16. [ ] Mettre à jour le hook `useAI.ts` (remplace `useClaude.ts`)

### Phase 5: Interface utilisateur (Priorité moyenne)
17. [ ] Créer composant `AIProviderSelector`
18. [ ] Mettre à jour `SettingsPage` - Section AI Settings
19. [ ] Créer toggles pour chaque type de détection
20. [ ] Ajouter slider temperature et input tokens max

### Phase 6: Tests et documentation (Priorité basse)
21. [ ] Tests unitaires pour chaque provider
22. [ ] Tests d'intégration
23. [ ] Documentation API

---

## Fichiers à modifier

### Existants à modifier:
- `src/services/ClaudeService.ts` → Migrer vers provider
- `src/hooks/useClaude.ts` → Renommer en `useAI.ts`
- `src/store/settingsStore.ts` → Ajouter config multi-provider
- `src/services/AnalysisService.ts` → Utiliser AIDetectionOrchestrator
- `src/components/settings/ClaudeSettings.tsx` → `AISettings.tsx`

### Nouveaux fichiers:
- Tous les fichiers dans `src/ai/`

---

## Configuration UI attendue

```
┌─────────────────────────────────────────────────────────┐
│ Paramètres IA                                           │
├─────────────────────────────────────────────────────────┤
│ Fournisseur: [Claude ▼] [OpenAI ▼] [Mistral ▼] [Ollama]│
│                                                         │
│ Modèle: [claude-sonnet-4 ▼]                            │
│ Clé API: [••••••••••••••••] [Tester]                   │
├─────────────────────────────────────────────────────────┤
│ Fonctionnalités IA                                      │
│ ☑ Catégorisation auto    ☑ Détection fraude            │
│ ☑ Génération rapports    ☑ Chat IA                     │
├─────────────────────────────────────────────────────────┤
│ Détection IA de base                                    │
│ ☑ 🔄 Doublons           ☑ 👻 Frais fantômes           │
│ ☑ 📈 Surfacturation     ☑ 💰 Erreurs d'agios          │
├─────────────────────────────────────────────────────────┤
│ Détection IA étendue                                    │
│ ☑ 📅 Dates valeur       ☑ 🔍 Suspect                  │
│ ☑ ⚠️ Conformité         ☑ 💵 Trésorerie               │
│ ☑ 🔗 Rapprochement      ☑ 🏦 Multi-banques            │
│ ☑ 📋 OHADA              ☑ 🚨 LCB-FT                   │
│ ☑ 🧾 Frais                                             │
├─────────────────────────────────────────────────────────┤
│ Paramètres avancés                                      │
│ Temperature: [━━━━━●━━━━━] 0.3                         │
│              Précis ◄──────► Créatif                   │
│                                                         │
│ Tokens maximum: [4000    ]                             │
│ Limite la longueur des réponses (100-8000)             │
└─────────────────────────────────────────────────────────┘
```

---

## Estimation

- **Phase 1**: Infrastructure - Fondation critique
- **Phase 2**: Providers - Extensibilité
- **Phase 3-4**: Détecteurs & Services - Fonctionnalités core
- **Phase 5**: UI - Expérience utilisateur
- **Phase 6**: Qualité - Stabilité

---

## Notes techniques

1. **Rétrocompatibilité**: L'ancien `ClaudeService` restera fonctionnel pendant la migration
2. **Encryption**: Toutes les clés API seront chiffrées (AES-256-GCM existant)
3. **Rate limiting**: Chaque provider gère ses propres limites
4. **Fallback**: Si un provider échoue, possibilité de fallback vers un autre
5. **Offline**: Ollama permet une utilisation 100% locale/offline
