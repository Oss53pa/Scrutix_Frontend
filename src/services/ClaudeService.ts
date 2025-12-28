import {
  Transaction,
  Anomaly,
  AnomalyType,
  Severity,
  BankConditions,
  AIAuditResponse,
  AIFinding,
  TransactionType,
} from '../types';
import { RegulatorySearchService, RegulatoryReference } from './RegulatorySearchService';

interface ClaudeConfig {
  apiKey: string;
  model: 'claude-sonnet-4-20250514' | 'claude-opus-4-1-20250414' | 'claude-3-5-sonnet-20241022' | 'claude-3-haiku-20240307';
  temperature?: number;
  maxTokens?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokensUsed?: number;
}

interface ChatContext {
  transactions?: Transaction[];
  anomalies?: Anomaly[];
  clientName?: string;
  bankConditions?: BankConditions;
}

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface CategoryResult {
  transactionId: string;
  category: string;
  confidence: number;
  type: TransactionType;
}

interface FraudAnalysis {
  transactionId: string;
  isSuspicious: boolean;
  riskScore: number;
  reasons: string[];
  recommendation: string;
}

interface ReportContent {
  title: string;
  executiveSummary: string;
  keyFindings: string[];
  detailedAnalysis: string;
  recommendations: string[];
  conclusion: string;
}

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds

// Error types for better handling
export class ClaudeAPIError extends Error {
  constructor(
    message: string,
    public readonly code: 'NETWORK' | 'AUTH' | 'RATE_LIMIT' | 'TIMEOUT' | 'INVALID_REQUEST' | 'SERVER' | 'UNKNOWN',
    public readonly statusCode?: number,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'ClaudeAPIError';
  }

  get isRetryable(): boolean {
    return ['NETWORK', 'RATE_LIMIT', 'TIMEOUT', 'SERVER'].includes(this.code);
  }

  get userMessage(): string {
    switch (this.code) {
      case 'NETWORK':
        return 'Erreur de connexion. Vérifiez votre accès internet.';
      case 'AUTH':
        return 'Clé API invalide ou expirée. Veuillez vérifier vos paramètres.';
      case 'RATE_LIMIT':
        return `Limite d'appels API atteinte. Réessayez dans ${this.retryAfter || 60} secondes.`;
      case 'TIMEOUT':
        return 'Délai d\'attente dépassé. L\'opération a pris trop de temps.';
      case 'INVALID_REQUEST':
        return 'Requête invalide. Contactez le support si le problème persiste.';
      case 'SERVER':
        return 'Erreur serveur Claude. Réessayez dans quelques instants.';
      default:
        return 'Une erreur inattendue s\'est produite.';
    }
  }
}

export class ClaudeService {
  private config: ClaudeConfig;
  private lastUsage: { inputTokens: number; outputTokens: number } | null = null;

  constructor(config: ClaudeConfig) {
    this.config = {
      ...config,
      temperature: config.temperature ?? 0.3,
      maxTokens: config.maxTokens ?? 4000,
    };
  }

  /**
   * Retourne les tokens utilises lors du dernier appel
   */
  getLastUsage(): { inputTokens: number; outputTokens: number } | null {
    return this.lastUsage;
  }

  /**
   * Met a jour la configuration
   */
  updateConfig(updates: Partial<ClaudeConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Validate API key by making a simple request
   */
  async validateApiKey(): Promise<{ valid: boolean; error?: string; errorCode?: string }> {
    try {
      await this.callClaude([
        { role: 'user', content: 'Réponds simplement "OK" pour valider la connexion.' }
      ], 10);

      return { valid: true };
    } catch (error) {
      if (error instanceof ClaudeAPIError) {
        return { valid: false, error: error.userMessage, errorCode: error.code };
      }
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      return { valid: false, error: message };
    }
  }

  /**
   * Categorize transactions using Claude AI
   */
  async categorizeTransactions(
    transactions: Transaction[],
    existingCategories?: string[]
  ): Promise<CategoryResult[]> {
    const batchSize = 50;
    const results: CategoryResult[] = [];

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const batchResults = await this.categorizeBatch(batch, existingCategories);
      results.push(...batchResults);
    }

    return results;
  }

  private async categorizeBatch(
    transactions: Transaction[],
    existingCategories?: string[]
  ): Promise<CategoryResult[]> {
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
      const response = await this.callClaude([{ role: 'user', content: prompt }], 4000);
      const jsonStr = this.extractJson(response);
      return JSON.parse(jsonStr) as CategoryResult[];
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

  /**
   * Detect fraud patterns using AI
   */
  async detectFraudPatterns(
    transactions: Transaction[],
    existingAnomalies: Anomaly[]
  ): Promise<FraudAnalysis[]> {
    const recentTransactions = transactions.slice(-200);

    const transactionSummary = recentTransactions.map(t => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      description: t.description,
      type: t.type,
    }));

    const anomalySummary = existingAnomalies.map(a => ({
      type: a.type,
      amount: a.amount,
      severity: a.severity,
    }));

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
      const response = await this.callClaude([{ role: 'user', content: prompt }], 4000);
      const jsonStr = this.extractJson(response);
      return JSON.parse(jsonStr) as FraudAnalysis[];
    } catch (error) {
      console.error('Erreur de détection de fraude:', error);
      return [];
    }
  }

  /**
   * Analyze anomalies in depth with regulatory references
   */
  async analyzeAnomalies(
    anomalies: Anomaly[],
    bankConditions?: BankConditions,
    options?: { includeReferences?: boolean; region?: 'CEMAC' | 'UEMOA' }
  ): Promise<AIAuditResponse & { references?: RegulatoryReference[] }> {
    const startTime = Date.now();
    const { includeReferences = true, region } = options || {};

    const anomalySummary = anomalies.map(a => ({
      type: a.type,
      severity: a.severity,
      amount: a.amount,
      confidence: a.confidence,
      transactionCount: a.transactions.length,
      description: a.transactions[0]?.description || 'N/A',
    }));

    const conditionsContext = bankConditions
      ? `Conditions bancaires de référence: ${bankConditions.bankName}, Frais: ${bankConditions.fees.map(f => `${f.name}: ${f.amount} FCFA`).join(', ')}`
      : 'Pas de conditions bancaires de référence disponibles.';

    // Obtenir les references reglementaires
    let regulatoryContext = '';
    let references: RegulatoryReference[] = [];

    if (includeReferences) {
      const anomalyTypes = [...new Set(anomalies.map(a => a.type))];
      references = await RegulatorySearchService.getReferencesForAnalysis({
        anomalyTypes,
        region,
      });

      if (references.length > 0) {
        regulatoryContext = RegulatorySearchService.formatReferencesForAI(references);
      }
    }

    const prompt = `Tu es un auditeur bancaire senior spécialisé dans les banques CEMAC/UEMOA.

Analyse en profondeur ces anomalies détectées:

${JSON.stringify(anomalySummary, null, 2)}

${conditionsContext}
${regulatoryContext}

Fournis une analyse détaillée avec:
1. Évaluation du risque global
2. Patterns identifiés
3. Impact financier estimé
4. Recommandations d'actions prioritaires (cite les references reglementaires si pertinent)
5. Points à vérifier manuellement

IMPORTANT: Si des references reglementaires sont fournies, cite-les dans tes recommandations pour appuyer ton analyse.

Réponds UNIQUEMENT avec un JSON valide:
{
  "summary": "Résumé exécutif de l'analyse",
  "findings": [
    {
      "type": "Type d'anomalie",
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "description": "Description détaillée",
      "evidence": ["Preuve 1", "Preuve 2"],
      "suggestedAction": "Action recommandée",
      "estimatedImpact": 50000,
      "regulatoryReference": "Reference reglementaire si applicable"
    }
  ],
  "recommendations": ["Recommandation 1 (cf. Reference X)", "Recommandation 2"],
  "riskScore": 0.65,
  "confidence": 0.85
}`;

    try {
      const response = await this.callClaude([{ role: 'user', content: prompt }], 4000);
      const jsonStr = this.extractJson(response);
      const analysis = JSON.parse(jsonStr);

      return {
        id: `ai-audit-${Date.now()}`,
        status: 'completed',
        analysis: {
          summary: analysis.summary,
          findings: analysis.findings as AIFinding[],
          recommendations: analysis.recommendations,
          riskScore: analysis.riskScore,
          confidence: analysis.confidence,
        },
        references: references.length > 0 ? references : undefined,
        processingTime: Date.now() - startTime,
        createdAt: new Date(),
        completedAt: new Date(),
      };
    } catch (error) {
      return {
        id: `ai-audit-${Date.now()}`,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        createdAt: new Date(),
      };
    }
  }

  /**
   * Generate a narrative report
   */
  async generateReport(
    clientName: string,
    period: { start: Date; end: Date },
    anomalies: Anomaly[],
    statistics: {
      totalTransactions: number;
      totalAmount: number;
      potentialSavings: number;
    }
  ): Promise<ReportContent> {
    const periodStr = `du ${this.formatDate(period.start)} au ${this.formatDate(period.end)}`;

    const anomalySummary = this.groupAnomalies(anomalies);

    const prompt = `Tu es un expert-comptable rédigeant un rapport d'audit bancaire professionnel.

CLIENT: ${clientName}
PÉRIODE: ${periodStr}

STATISTIQUES:
- Transactions analysées: ${statistics.totalTransactions}
- Volume total: ${statistics.totalAmount.toLocaleString('fr-FR')} FCFA
- Économies potentielles: ${statistics.potentialSavings.toLocaleString('fr-FR')} FCFA

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
      const response = await this.callClaude([{ role: 'user', content: prompt }], 4000);
      const jsonStr = this.extractJson(response);
      return JSON.parse(jsonStr) as ReportContent;
    } catch (error) {
      console.error('Erreur de génération de rapport:', error);
      return {
        title: `Rapport d'audit bancaire - ${clientName}`,
        executiveSummary: 'Erreur lors de la génération du rapport.',
        keyFindings: [],
        detailedAnalysis: '',
        recommendations: [],
        conclusion: '',
      };
    }
  }

  /**
   * Core method to call Claude API with proper error handling
   */
  private async callClaude(messages: ClaudeMessage[], maxTokens?: number): Promise<string> {
    // Validate API key
    if (!this.config.apiKey || this.config.apiKey.trim() === '') {
      throw new ClaudeAPIError('Clé API non configurée', 'AUTH');
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: maxTokens ?? this.config.maxTokens ?? 4000,
          temperature: this.config.temperature ?? 0.3,
          messages: messages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: { message?: string; type?: string } };
        const errorMessage = errorData?.error?.message || response.statusText;

        // Map HTTP status codes to error types
        switch (response.status) {
          case 401:
            throw new ClaudeAPIError(errorMessage, 'AUTH', response.status);
          case 429: {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
            throw new ClaudeAPIError(errorMessage, 'RATE_LIMIT', response.status, retryAfter);
          }
          case 400:
            throw new ClaudeAPIError(errorMessage, 'INVALID_REQUEST', response.status);
          case 500:
          case 502:
          case 503:
          case 504:
            throw new ClaudeAPIError(errorMessage, 'SERVER', response.status);
          default:
            throw new ClaudeAPIError(errorMessage, 'UNKNOWN', response.status);
        }
      }

      const data = await response.json() as ClaudeResponse;

      // Validate response structure
      if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
        throw new ClaudeAPIError('Réponse API invalide', 'INVALID_REQUEST');
      }

      // Track usage
      this.lastUsage = {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      };

      return data.content[0]?.text || '';
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ClaudeAPIError('Délai d\'attente dépassé', 'TIMEOUT');
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ClaudeAPIError('Impossible de contacter l\'API Claude', 'NETWORK');
      }

      // Re-throw ClaudeAPIError as-is
      if (error instanceof ClaudeAPIError) {
        throw error;
      }

      // Wrap unknown errors
      throw new ClaudeAPIError(
        error instanceof Error ? error.message : 'Erreur inconnue',
        'UNKNOWN'
      );
    }
  }

  /**
   * Chat conversationnel avec Claude
   */
  async chat(
    message: string,
    context?: ChatContext,
    history?: ChatMessage[]
  ): Promise<{ response: string; tokensUsed: number }> {
    // Construire le contexte
    let systemContext = `Tu es un assistant expert en audit bancaire pour les entreprises africaines (CEMAC/UEMOA).
Tu aides les auditeurs a analyser les transactions et anomalies detectees.
Reponds toujours en francais, de maniere professionnelle et concise.`;

    if (context?.clientName) {
      systemContext += `\n\nClient en cours d'analyse: ${context.clientName}`;
    }

    if (context?.transactions && context.transactions.length > 0) {
      const summary = context.transactions.slice(0, 50).map(t => ({
        date: t.date,
        montant: t.amount,
        description: t.description,
        type: t.type,
      }));
      systemContext += `\n\nDernieres transactions (${context.transactions.length} total):\n${JSON.stringify(summary, null, 2)}`;
    }

    if (context?.anomalies && context.anomalies.length > 0) {
      const anomalySummary = context.anomalies.map(a => ({
        type: a.type,
        severite: a.severity,
        montant: a.amount,
        confiance: a.confidence,
      }));
      systemContext += `\n\nAnomalies detectees (${context.anomalies.length}):\n${JSON.stringify(anomalySummary, null, 2)}`;
    }

    if (context?.bankConditions) {
      systemContext += `\n\nConditions bancaires: ${context.bankConditions.bankName}`;
    }

    // Construire l'historique des messages
    const messages: ClaudeMessage[] = [];

    // Ajouter le contexte systeme comme premier message user
    messages.push({
      role: 'user',
      content: `[CONTEXTE SYSTEME]\n${systemContext}\n\n[FIN CONTEXTE]`,
    });
    messages.push({
      role: 'assistant',
      content: 'Compris. Je suis pret a vous aider avec l\'analyse de ces donnees bancaires. Que souhaitez-vous savoir?',
    });

    // Ajouter l'historique
    if (history && history.length > 0) {
      for (const msg of history.slice(-10)) { // Garder les 10 derniers messages
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Ajouter le nouveau message
    messages.push({
      role: 'user',
      content: message,
    });

    try {
      const response = await this.callClaude(messages);
      const usage = this.getLastUsage();
      const tokensUsed = (usage?.inputTokens || 0) + (usage?.outputTokens || 0);

      return {
        response,
        tokensUsed,
      };
    } catch (error) {
      console.error('Erreur chat Claude:', error);
      throw error;
    }
  }

  /**
   * Extract JSON from response (handles markdown code blocks)
   */
  private extractJson(text: string): string {
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

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  /**
   * Group anomalies by type for summary
   */
  private groupAnomalies(anomalies: Anomaly[]): string {
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
}

// Singleton instance management
let instance: ClaudeService | null = null;

export function getClaudeService(config?: ClaudeConfig): ClaudeService | null {
  if (config) {
    instance = new ClaudeService(config);
  }
  return instance;
}

export function hasClaudeService(): boolean {
  return instance !== null;
}

export function clearClaudeService(): void {
  instance = null;
}
