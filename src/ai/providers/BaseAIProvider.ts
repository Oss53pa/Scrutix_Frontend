// ============================================================================
// SCRUTIX - Base AI Provider
// Classe abstraite de base pour tous les fournisseurs IA
// ============================================================================

import {
  AIProviderType,
  AIProviderConfig,
  AIModel,
  AIChatMessage,
  AIChatOptions,
  AIChatResponse,
  AIDetectionType,
  AICategoryResult,
  AIFraudAnalysis,
  AIReportContent,
  AIReportData,
  AIUsageStats,
  AIError,
  AIErrorCode,
  AI_ERROR_MESSAGES,
  DETECTION_TO_ANOMALY_MAP,
  IAIProvider,
} from '../types';
import { Transaction, Anomaly, AnomalyType, Severity, BankConditions, TransactionType } from '../../types';

/**
 * Classe abstraite de base pour les fournisseurs IA
 * Implémente la logique commune et définit les méthodes abstraites
 */
export abstract class BaseAIProvider implements IAIProvider {
  // Propriétés abstraites à implémenter
  abstract readonly name: string;
  abstract readonly type: AIProviderType;
  abstract readonly models: AIModel[];

  // Configuration
  protected config: AIProviderConfig;

  // Usage tracking
  protected usage: AIUsageStats;
  protected lastTokens: { input: number; output: number } | null = null;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.usage = {
      provider: config.provider,
      totalRequests: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      totalCost: 0,
    };
  }

  // ============================================================================
  // Configuration Methods
  // ============================================================================

  configure(config: AIProviderConfig): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AIProviderConfig {
    return { ...this.config };
  }

  // Méthode abstraite - chaque provider implémente sa propre logique de test
  abstract testConnection(): Promise<{ valid: boolean; error?: string }>;

  // ============================================================================
  // Core API Methods (Abstract)
  // ============================================================================

  /**
   * Appel API de base - à implémenter par chaque provider
   */
  protected abstract callAPI(
    messages: Array<{ role: string; content: string }>,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }>;

  // ============================================================================
  // Chat Implementation
  // ============================================================================

  async chat(messages: AIChatMessage[], options?: AIChatOptions): Promise<AIChatResponse> {
    const apiMessages: Array<{ role: string; content: string }> = [];

    // Ajouter le system prompt si fourni
    if (options?.systemPrompt) {
      apiMessages.push({ role: 'system', content: options.systemPrompt });
    }

    // Construire le contexte si fourni
    if (options?.context) {
      const contextMessage = this.buildContextMessage(options.context);
      if (contextMessage) {
        apiMessages.push({ role: 'user', content: `[CONTEXTE]\n${contextMessage}\n[FIN CONTEXTE]` });
        apiMessages.push({ role: 'assistant', content: 'Compris. Je suis prêt à vous aider avec l\'analyse de ces données bancaires.' });
      }
    }

    // Ajouter les messages de la conversation
    for (const msg of messages) {
      if (msg.role !== 'system') {
        apiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const result = await this.callAPI(apiMessages, {
      maxTokens: options?.maxTokens ?? this.config.maxTokens,
      temperature: options?.temperature ?? this.config.temperature,
    });

    this.updateUsage(result.inputTokens, result.outputTokens);

    return {
      content: result.content,
      tokensUsed: {
        input: result.inputTokens,
        output: result.outputTokens,
        total: result.inputTokens + result.outputTokens,
      },
      model: this.config.model,
      finishReason: 'stop',
    };
  }

  // ============================================================================
  // Completion Implementation
  // ============================================================================

  async complete(prompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<string> {
    const result = await this.callAPI(
      [{ role: 'user', content: prompt }],
      {
        maxTokens: options?.maxTokens ?? this.config.maxTokens,
        temperature: options?.temperature ?? this.config.temperature,
      }
    );

    this.updateUsage(result.inputTokens, result.outputTokens);
    return result.content;
  }

  // ============================================================================
  // Banking Audit Features
  // ============================================================================

  async categorizeTransactions(transactions: Transaction[], existingCategories?: string[]): Promise<AICategoryResult[]> {
    const batchSize = 50;
    const results: AICategoryResult[] = [];

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const batchResults = await this.categorizeBatch(batch, existingCategories);
      results.push(...batchResults);
    }

    return results;
  }

  private async categorizeBatch(transactions: Transaction[], existingCategories?: string[]): Promise<AICategoryResult[]> {
    const transactionList = transactions.map(t => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      date: t.date,
    }));

    const categoriesContext = existingCategories?.length
      ? `Catégories existantes à privilégier: ${existingCategories.join(', ')}`
      : 'Crée des catégories appropriées pour une comptabilité bancaire.';

    const prompt = `Tu es un expert comptable spécialisé dans l'audit bancaire africain (CEMAC/UEMOA).

Catégorise ces transactions bancaires:

${JSON.stringify(transactionList, null, 2)}

${categoriesContext}

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans commentaires) dans ce format:
[
  {
    "transactionId": "id",
    "category": "Nom de la catégorie",
    "confidence": 0.95,
    "type": "DEBIT|CREDIT|FEE|INTEREST|TRANSFER|CARD|ATM|CHECK|OTHER"
  }
]

Catégories suggérées: Frais bancaires, Virement entrant, Virement sortant, Prélèvement, Carte bancaire, Retrait DAB, Agios/Intérêts, Commission, Salaires, Fournisseurs, Clients, Impôts/Taxes, Loyer, Télécom, Assurances, Divers`;

    try {
      const response = await this.complete(prompt, { maxTokens: 4000 });
      const jsonStr = this.extractJson(response);
      return JSON.parse(jsonStr) as AICategoryResult[];
    } catch (error) {
      console.error('Erreur de catégorisation:', error);
      return transactions.map(t => ({
        transactionId: t.id,
        category: 'Non catégorisé',
        confidence: 0,
        type: TransactionType.OTHER,
      }));
    }
  }

  async detectAnomalies(
    transactions: Transaction[],
    type: AIDetectionType,
    context?: { bankConditions?: BankConditions }
  ): Promise<Anomaly[]> {
    const prompt = this.buildDetectionPrompt(transactions, type, context);

    try {
      const response = await this.complete(prompt, { maxTokens: 4000 });
      const jsonStr = this.extractJson(response);
      const rawAnomalies = JSON.parse(jsonStr) as Array<{
        transactionIds: string[];
        severity: string;
        confidence: number;
        amount: number;
        description: string;
        recommendation: string;
        evidence: string[];
      }>;

      const anomalyType = DETECTION_TO_ANOMALY_MAP[type];

      return rawAnomalies.map((raw, index) => ({
        id: `ai-${type}-${Date.now()}-${index}`,
        type: anomalyType,
        severity: this.parseSeverity(raw.severity),
        confidence: raw.confidence,
        amount: raw.amount,
        transactions: transactions.filter(t => raw.transactionIds.includes(t.id)),
        evidence: raw.evidence.map(e => ({ type: 'ai_analysis', description: e, value: '' })),
        recommendation: raw.recommendation,
        status: 'pending' as const,
        detectedAt: new Date(),
        detectionSource: 'ai' as const,
        aiAnalysis: {
          explanation: raw.description,
          suggestedActions: [raw.recommendation],
        },
      }));
    } catch (error) {
      console.error(`Erreur détection ${type}:`, error);
      return [];
    }
  }

  async analyzeFraud(transactions: Transaction[], existingAnomalies?: Anomaly[]): Promise<AIFraudAnalysis[]> {
    const recentTransactions = transactions.slice(-200);

    const transactionSummary = recentTransactions.map(t => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      description: t.description,
      type: t.type,
    }));

    const anomalySummary = existingAnomalies?.map(a => ({
      type: a.type,
      amount: a.amount,
      severity: a.severity,
    })) || [];

    const prompt = `Tu es un expert en détection de fraude bancaire pour les entreprises africaines.

Analyse ces transactions pour détecter des patterns de fraude potentielle:

TRANSACTIONS:
${JSON.stringify(transactionSummary, null, 2)}

ANOMALIES DÉJÀ DÉTECTÉES:
${JSON.stringify(anomalySummary, null, 2)}

Cherche ces patterns de fraude:
1. Fractionnement de paiements (structuration)
2. Transactions rondes suspectes
3. Horaires inhabituels
4. Bénéficiaires inconnus récurrents
5. Augmentation soudaine des frais
6. Transactions juste sous les seuils de contrôle
7. Double facturation déguisée
8. Virements circulaires

Réponds UNIQUEMENT avec un JSON valide:
[
  {
    "transactionId": "id ou 'PATTERN'",
    "isSuspicious": true,
    "riskScore": 0.85,
    "reasons": ["Raison 1", "Raison 2"],
    "recommendation": "Action recommandée"
  }
]

Si aucune fraude n'est détectée, retourne un tableau vide: []`;

    try {
      const response = await this.complete(prompt, { maxTokens: 4000 });
      const jsonStr = this.extractJson(response);
      return JSON.parse(jsonStr) as AIFraudAnalysis[];
    } catch (error) {
      console.error('Erreur de détection de fraude:', error);
      return [];
    }
  }

  async generateReport(data: AIReportData): Promise<AIReportContent> {
    const periodStr = `du ${this.formatDate(data.period.start)} au ${this.formatDate(data.period.end)}`;
    const anomalySummary = this.groupAnomalies(data.anomalies);

    const prompt = `Tu es un expert-comptable rédigeant un rapport d'audit bancaire professionnel.

CLIENT: ${data.clientName}
PÉRIODE: ${periodStr}

STATISTIQUES:
- Transactions analysées: ${data.statistics.totalTransactions}
- Volume total: ${data.statistics.totalAmount.toLocaleString('fr-FR')} FCFA
- Économies potentielles: ${data.statistics.potentialSavings.toLocaleString('fr-FR')} FCFA

ANOMALIES PAR TYPE:
${anomalySummary}

Rédige un rapport d'audit professionnel en français. Le rapport doit être formel, précis et actionnable.

Réponds UNIQUEMENT avec un JSON valide:
{
  "title": "Titre du rapport",
  "executiveSummary": "Résumé exécutif (2-3 paragraphes)",
  "keyFindings": ["Constatation clé 1", "Constatation clé 2", "..."],
  "detailedAnalysis": "Analyse détaillée (plusieurs paragraphes)",
  "recommendations": ["Recommandation 1 avec justification", "Recommandation 2 avec justification", "..."],
  "conclusion": "Conclusion et prochaines étapes"
}`;

    try {
      const response = await this.complete(prompt, { maxTokens: 4000 });
      const jsonStr = this.extractJson(response);
      return JSON.parse(jsonStr) as AIReportContent;
    } catch (error) {
      console.error('Erreur de génération de rapport:', error);
      return {
        title: `Rapport d'audit bancaire - ${data.clientName}`,
        executiveSummary: 'Erreur lors de la génération du rapport.',
        keyFindings: [],
        detailedAnalysis: '',
        recommendations: [],
        conclusion: '',
      };
    }
  }

  // ============================================================================
  // Usage Tracking
  // ============================================================================

  getUsage(): AIUsageStats {
    return { ...this.usage };
  }

  getLastTokensUsed(): { input: number; output: number } | null {
    return this.lastTokens;
  }

  protected updateUsage(inputTokens: number, outputTokens: number): void {
    this.lastTokens = { input: inputTokens, output: outputTokens };
    this.usage.totalRequests++;
    this.usage.totalTokensInput += inputTokens;
    this.usage.totalTokensOutput += outputTokens;
    this.usage.lastRequestAt = new Date();
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  protected buildContextMessage(context: AIChatOptions['context']): string {
    const parts: string[] = [];

    if (context?.clientName) {
      parts.push(`Client en cours d'analyse: ${context.clientName}`);
    }

    if (context?.transactions && context.transactions.length > 0) {
      const summary = context.transactions.slice(0, 50).map(t => ({
        date: t.date,
        montant: t.amount,
        description: t.description,
        type: t.type,
      }));
      parts.push(`Dernières transactions (${context.transactions.length} total):\n${JSON.stringify(summary, null, 2)}`);
    }

    if (context?.anomalies && context.anomalies.length > 0) {
      const anomalySummary = context.anomalies.map(a => ({
        type: a.type,
        severite: a.severity,
        montant: a.amount,
        confiance: a.confidence,
      }));
      parts.push(`Anomalies détectées (${context.anomalies.length}):\n${JSON.stringify(anomalySummary, null, 2)}`);
    }

    if (context?.bankConditions) {
      parts.push(`Conditions bancaires: ${context.bankConditions.bankName}`);
    }

    return parts.join('\n\n');
  }

  protected buildDetectionPrompt(
    transactions: Transaction[],
    type: AIDetectionType,
    context?: { bankConditions?: BankConditions }
  ): string {
    const transactionSummary = transactions.slice(0, 100).map(t => ({
      id: t.id,
      date: t.date,
      valueDate: t.valueDate,
      amount: t.amount,
      balance: t.balance,
      description: t.description,
      type: t.type,
    }));

    const conditionsContext = context?.bankConditions
      ? `Conditions bancaires: ${context.bankConditions.bankName}, Frais: ${context.bankConditions.fees.map(f => `${f.name}: ${f.amount} FCFA`).join(', ')}`
      : 'Pas de conditions bancaires de référence.';

    const detectionInstructions = this.getDetectionInstructions(type);

    return `Tu es un auditeur bancaire expert spécialisé dans les banques CEMAC/UEMOA.

OBJECTIF: ${detectionInstructions.objective}

TRANSACTIONS À ANALYSER:
${JSON.stringify(transactionSummary, null, 2)}

${conditionsContext}

CRITÈRES DE DÉTECTION:
${detectionInstructions.criteria.join('\n')}

Réponds UNIQUEMENT avec un JSON valide:
[
  {
    "transactionIds": ["id1", "id2"],
    "severity": "LOW|MEDIUM|HIGH|CRITICAL",
    "confidence": 0.85,
    "amount": 50000,
    "description": "Description de l'anomalie",
    "recommendation": "Action recommandée",
    "evidence": ["Preuve 1", "Preuve 2"]
  }
]

Si aucune anomalie n'est détectée, retourne: []`;
  }

  protected getDetectionInstructions(type: AIDetectionType): { objective: string; criteria: string[] } {
    const instructions: Record<AIDetectionType, { objective: string; criteria: string[] }> = {
      [AIDetectionType.DUPLICATES]: {
        objective: 'Détecter les transactions en double ou frais facturés plusieurs fois',
        criteria: [
          '- Mêmes montants à des dates proches',
          '- Descriptions similaires',
          '- Même bénéficiaire',
        ],
      },
      [AIDetectionType.GHOST_FEES]: {
        objective: 'Identifier les frais fantômes sans justification',
        criteria: [
          '- Frais sans transaction associée',
          '- Libellés vagues ou génériques',
          '- Montants inhabituels',
        ],
      },
      [AIDetectionType.OVERCHARGES]: {
        objective: 'Détecter les surfacturations par rapport aux conditions',
        criteria: [
          '- Frais supérieurs aux tarifs convenus',
          '- Commissions excessives',
          '- Écarts significatifs avec les conditions bancaires',
        ],
      },
      [AIDetectionType.INTEREST_ERRORS]: {
        objective: 'Vérifier les calculs d\'intérêts et d\'agios',
        criteria: [
          '- Taux appliqués vs taux contractuels',
          '- Base de calcul incorrecte',
          '- Périodes de calcul erronées',
        ],
      },
      [AIDetectionType.VALUE_DATE]: {
        objective: 'Analyser les écarts entre dates d\'opération et dates de valeur',
        criteria: [
          '- Décalages excessifs défavorables',
          '- Non-respect des délais réglementaires',
          '- Impact sur le calcul des intérêts',
        ],
      },
      [AIDetectionType.SUSPICIOUS]: {
        objective: 'Identifier les transactions suspectes ou inhabituelles',
        criteria: [
          '- Montants anormalement élevés',
          '- Fréquence inhabituelle',
          '- Patterns atypiques',
        ],
      },
      [AIDetectionType.COMPLIANCE]: {
        objective: 'Vérifier la conformité aux conditions contractuelles',
        criteria: [
          '- Respect des plafonds',
          '- Application correcte des tarifs',
          '- Conformité aux engagements',
        ],
      },
      [AIDetectionType.CASHFLOW]: {
        objective: 'Détecter les anomalies de trésorerie',
        criteria: [
          '- Incohérences de soldes',
          '- Mouvements inhabituels',
          '- Écarts de rapprochement',
        ],
      },
      [AIDetectionType.RECONCILIATION]: {
        objective: 'Identifier les écarts de rapprochement bancaire',
        criteria: [
          '- Transactions non rapprochées',
          '- Écarts persistants',
          '- Erreurs de saisie potentielles',
        ],
      },
      [AIDetectionType.MULTI_BANK]: {
        objective: 'Analyser les incohérences multi-banques',
        criteria: [
          '- Virements inter-bancaires non reçus',
          '- Doublons entre banques',
          '- Incohérences de dates',
        ],
      },
      [AIDetectionType.OHADA]: {
        objective: 'Vérifier la conformité OHADA',
        criteria: [
          '- Respect des normes comptables',
          '- Documentation appropriée',
          '- Classement correct des opérations',
        ],
      },
      [AIDetectionType.AML_LCB_FT]: {
        objective: 'Détecter les indicateurs de blanchiment (LCB-FT)',
        criteria: [
          '- Fractionnement de transactions',
          '- Montants juste sous les seuils',
          '- Transactions circulaires',
          '- Bénéficiaires à risque',
        ],
      },
      [AIDetectionType.FEES]: {
        objective: 'Analyse complète des frais bancaires',
        criteria: [
          '- Comparaison avec les grilles tarifaires',
          '- Évolution des frais dans le temps',
          '- Frais cachés ou mal libellés',
        ],
      },
    };

    return instructions[type];
  }

  protected extractJson(text: string): string {
    // Remove markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return jsonMatch[1].trim();
    }

    // Try to find JSON array or object
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    const objectMatch = text.match(/\{[\s\S]*\}/);

    if (arrayMatch && (!objectMatch || arrayMatch.index! < objectMatch.index!)) {
      return arrayMatch[0];
    }
    if (objectMatch) {
      return objectMatch[0];
    }

    return text.trim();
  }

  protected parseSeverity(value: string): Severity {
    const upper = value.toUpperCase();
    if (upper === 'LOW') return Severity.LOW;
    if (upper === 'MEDIUM') return Severity.MEDIUM;
    if (upper === 'HIGH') return Severity.HIGH;
    if (upper === 'CRITICAL') return Severity.CRITICAL;
    return Severity.MEDIUM;
  }

  protected formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  protected groupAnomalies(anomalies: Anomaly[]): string {
    const groups: Record<string, { count: number; amount: number }> = {};

    for (const anomaly of anomalies) {
      if (!groups[anomaly.type]) {
        groups[anomaly.type] = { count: 0, amount: 0 };
      }
      groups[anomaly.type].count++;
      groups[anomaly.type].amount += anomaly.amount;
    }

    return Object.entries(groups)
      .map(([type, data]) => `- ${type}: ${data.count} cas, ${data.amount.toLocaleString('fr-FR')} FCFA`)
      .join('\n');
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  protected createError(code: AIErrorCode, message?: string, statusCode?: number, retryAfter?: number): AIError {
    return {
      code,
      message: message || AI_ERROR_MESSAGES[code],
      provider: this.type,
      timestamp: new Date(),
      statusCode,
      retryAfter,
      isRetryable: ['NETWORK', 'RATE_LIMIT', 'TIMEOUT', 'SERVER'].includes(code),
    };
  }
}
