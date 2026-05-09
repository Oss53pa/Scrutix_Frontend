// ============================================================================
// ATLASBANX - C10 Handler: Q&A conversationnel
// Zone: Verte (PROPH3T autonome)
// Baseline V1: keyword-based search in receipt/taxonomy, no LLM
// Anti-hallucination: AUCUNE extrapolation — si info absente → reponse standard
// ============================================================================

import type { C10Input, C10Output } from '../types';
import { RUBRICS_TAXONOMY } from '../../../../cdc/taxonomy/rubrics';
import { isLlmAvailable, llmCall } from '../llmEnricher';

// ----------------------------------------------------------------------------
// Knowledge base: ecart codes
// ----------------------------------------------------------------------------

const ECART_KNOWLEDGE: Record<string, { description: string; category: string }> = {
  E01: { description: 'Surfacturation de frais bancaires par rapport aux conditions contractuelles', category: 'Frais' },
  E02: { description: 'Non-respect des conditions tarifaires contractuelles (convention client)', category: 'Contrat' },
  E03: { description: 'Erreur de calcul sur interets debiteurs (agios, TEG)', category: 'Interets' },
  E04: { description: 'Date de valeur defavorable par rapport aux normes BCEAO', category: 'Dates de valeur' },
  E05: { description: 'Commission de mouvement excessive par rapport au barème', category: 'Commissions' },
  E06: { description: 'CPFD non conforme au plafond reglementaire (50% des interets)', category: 'CPFD' },
  E07: { description: 'Frais non prevus au contrat, sans base contractuelle identifiee', category: 'Frais fantomes' },
  E08: { description: 'Anomalie diverse ne relevant pas des categories precedentes', category: 'Divers' },
};

// ----------------------------------------------------------------------------
// Regulatory knowledge (basic, non-exhaustive)
// ----------------------------------------------------------------------------

const REGULATORY_KNOWLEDGE: Array<{ keywords: string[]; reference: string; excerpt: string }> = [
  { keywords: ['teg', 'taux effectif global', 'usure'], reference: 'Instruction BCEAO n°017/2010', excerpt: 'Le TEG ne peut exceder le taux d\'usure fixe par la BCEAO pour la categorie de credit concernee.' },
  { keywords: ['date valeur', 'date de valeur', 'dates de valeur', 'j+0', 'j+1'], reference: 'Instruction BCEAO n°008-05-2015', excerpt: 'Les dates de valeur appliquees aux operations ne peuvent exceder J+1 pour les remises de cheques sur place et J pour les virements recus.' },
  { keywords: ['cpfd', 'plus fort decouvert'], reference: 'Reglementation COBAC', excerpt: 'La commission du plus fort decouvert est plafonnee a 50% du montant des interets debiteurs de la periode.' },
  { keywords: ['commission mouvement', 'commission de mouvement'], reference: 'Conditions generales de banque', excerpt: 'La commission de mouvement est calculee sur la somme des mouvements debiteurs du trimestre, hors agios et commissions.' },
  { keywords: ['frais tenue compte', 'tenue de compte'], reference: 'Convention de compte', excerpt: 'Les frais de tenue de compte sont fixes et definis dans la convention de compte signee entre la banque et le client.' },
  { keywords: ['ohada', 'acte uniforme'], reference: 'Acte uniforme OHADA sur le droit commercial', excerpt: 'L\'OHADA harmonise le droit des affaires dans 17 pays africains. Les dispositions s\'appliquent aux operations bancaires.' },
  { keywords: ['reclamation', 'reclamer', 'contestation'], reference: 'Procedure de reclamation bancaire', excerpt: 'Le client peut adresser une reclamation ecrite a sa banque. En l\'absence de reponse sous 30 jours, il peut saisir le mediateur bancaire ou la BCEAO/COBAC.' },
  { keywords: ['prescription', 'delai'], reference: 'Code Civil art. 2224', excerpt: 'Les actions en remboursement de frais bancaires se prescrivent par 5 ans a compter de la date du prelevement conteste.' },
];

// ----------------------------------------------------------------------------
// Search logic
// ----------------------------------------------------------------------------

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''´`]/g, "'")
    .trim();
}

function searchTaxonomy(query: string): C10Output['sources'] {
  const normalized = normalizeQuery(query);
  const sources: C10Output['sources'] = [];

  for (const rubric of RUBRICS_TAXONOMY) {
    const labelNorm = rubric.displayLabelFr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const descNorm = (rubric.description ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (normalized.includes(rubric.code) || normalized.includes(labelNorm) ||
        (descNorm && normalized.includes(descNorm.slice(0, 20)))) {
      sources.push({
        type: 'taxonomy',
        reference: rubric.code,
        excerpt: `${rubric.displayLabelFr} (${rubric.unit})${rubric.description ? ' — ' + rubric.description : ''}`,
      });
    }
  }

  // Also try word-level matching if no exact match
  if (sources.length === 0) {
    const queryWords = normalized.split(/\s+/).filter(w => w.length > 3);
    for (const rubric of RUBRICS_TAXONOMY) {
      if (rubric.parentCode === null) continue; // Skip root categories
      const labelNorm = rubric.displayLabelFr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const matchScore = queryWords.filter(w => labelNorm.includes(w)).length;
      if (matchScore >= 2 || (matchScore === 1 && queryWords.length === 1)) {
        sources.push({
          type: 'taxonomy',
          reference: rubric.code,
          excerpt: rubric.displayLabelFr,
        });
      }
    }
  }

  return sources.slice(0, 5);
}

function searchRegulatory(query: string): C10Output['sources'] {
  const normalized = normalizeQuery(query);
  const sources: C10Output['sources'] = [];

  for (const reg of REGULATORY_KNOWLEDGE) {
    const matches = reg.keywords.some(kw => normalized.includes(kw));
    if (matches) {
      sources.push({
        type: 'regulation',
        reference: reg.reference,
        excerpt: reg.excerpt,
      });
    }
  }

  return sources;
}

function searchEcartKnowledge(query: string): C10Output['sources'] {
  const normalized = normalizeQuery(query);
  const sources: C10Output['sources'] = [];

  for (const [code, info] of Object.entries(ECART_KNOWLEDGE)) {
    if (normalized.includes(code.toLowerCase()) || normalized.includes(info.category.toLowerCase())) {
      sources.push({
        type: 'receipt',
        reference: code,
        excerpt: info.description,
      });
    }
  }

  return sources;
}

// ----------------------------------------------------------------------------
// Answer generation (deterministic)
// ----------------------------------------------------------------------------

function generateAnswer(query: string, sources: C10Output['sources']): string {
  if (sources.length === 0) {
    return 'Cette information n\'est pas couverte par l\'audit en cours. Souhaitez-vous une investigation complementaire ?';
  }

  const parts: string[] = [];

  const regulatorySources = sources.filter(s => s.type === 'regulation');
  const taxonomySources = sources.filter(s => s.type === 'taxonomy');
  const receiptSources = sources.filter(s => s.type === 'receipt');

  if (receiptSources.length > 0) {
    parts.push('D\'apres les donnees de l\'audit :');
    for (const s of receiptSources) {
      parts.push(`- ${s.reference} : ${s.excerpt}`);
    }
  }

  if (taxonomySources.length > 0) {
    parts.push(parts.length > 0 ? '\nRubriques concernees :' : 'Rubriques concernees :');
    for (const s of taxonomySources) {
      parts.push(`- ${s.reference} : ${s.excerpt}`);
    }
  }

  if (regulatorySources.length > 0) {
    parts.push(parts.length > 0 ? '\nReferences reglementaires :' : 'References reglementaires :');
    for (const s of regulatorySources) {
      parts.push(`- ${s.reference} : ${s.excerpt}`);
    }
  }

  return parts.join('\n');
}

// ----------------------------------------------------------------------------
// Public handler
// ----------------------------------------------------------------------------

export function handleC10(input: C10Input): C10Output {
  const allSources: C10Output['sources'] = [
    ...searchEcartKnowledge(input.question),
    ...searchTaxonomy(input.question),
    ...searchRegulatory(input.question),
  ];

  // Deduplicate by reference
  const seen = new Set<string>();
  const uniqueSources = allSources.filter(s => {
    if (seen.has(s.reference)) return false;
    seen.add(s.reference);
    return true;
  });

  const answer = generateAnswer(input.question, uniqueSources);
  const requiresInvestigation = uniqueSources.length === 0;

  return {
    answer,
    sources: uniqueSources,
    requires_investigation: requiresInvestigation,
  };
}

// ----------------------------------------------------------------------------
// LLM-enriched Q&A
// ----------------------------------------------------------------------------

const C10_SYSTEM_PROMPT = `Tu es un assistant expert en audit bancaire CEMAC/UEMOA.
Tu reponds aux questions des auditeurs de maniere precise et utile.

REGLES STRICTES :
1. Tu ne reponds QUE sur la base des SOURCES fournies dans le contexte.
2. Si aucune source ne couvre la question, tu dois repondre : "Cette information n'est pas couverte par l'audit en cours. Souhaitez-vous une investigation complementaire ?"
3. Tu ne fais JAMAIS d'extrapolation depuis tes connaissances generales.
4. Tu cites les references (codes, articles, instructions) quand elles sont disponibles.
5. Tu rediges en francais, de maniere concise et professionnelle.`;

function buildC10UserPrompt(input: C10Input, sources: C10Output['sources']): string {
  const history = (input.conversation_history ?? [])
    .slice(-6) // Last 3 exchanges
    .map(m => `${m.role === 'user' ? 'Question' : 'Reponse'}: ${m.content}`)
    .join('\n');

  const sourcesText = sources.length > 0
    ? sources.map(s => `[${s.type}] ${s.reference}: ${s.excerpt}`).join('\n')
    : 'Aucune source disponible.';

  return `${history ? `HISTORIQUE CONVERSATION :\n${history}\n\n` : ''}SOURCES DISPONIBLES :
${sourcesText}

QUESTION : ${input.question}

Reponds en te basant UNIQUEMENT sur les sources ci-dessus.`;
}

/**
 * Async version with LLM enrichment for conversational Q&A.
 * Falls back to keyword-based answer if LLM unavailable.
 */
export async function handleC10WithLlm(input: C10Input): Promise<C10Output> {
  const baseline = handleC10(input);

  if (!isLlmAvailable()) return baseline;

  // If no sources found, don't even try LLM (anti-hallucination)
  if (baseline.requires_investigation) return baseline;

  const llmResult = await llmCall(
    C10_SYSTEM_PROMPT,
    buildC10UserPrompt(input, baseline.sources),
    { role: 'fast', temperature: 0.3, maxTokens: 1000 },
  );

  if (!llmResult) return baseline;

  return {
    ...baseline,
    answer: llmResult.content.trim(),
  };
}
