// ============================================================================
// ATLASBANX - C8 Handler: Explication des ecarts
// Zone: Verte (PROPH3T autonome)
// Baseline V1: generation deterministe a partir du receipt fourni
// Anti-hallucination: AUCUN fait exterieur au receipt cite
// ============================================================================

import type { C8Input, C8Output, EcartCode, Recoverability } from '../types';
import { isLlmAvailable, llmCall } from '../llmEnricher';

// ----------------------------------------------------------------------------
// Ecart code descriptions & legal basis
// ----------------------------------------------------------------------------

const ECART_DESCRIPTIONS: Record<EcartCode, {
  nature: string;
  legalBasis: string | null;
  defaultRecoverability: Recoverability;
}> = {
  E01: {
    nature: 'Surfacturation de frais bancaires',
    legalBasis: null,
    defaultRecoverability: 'forte',
  },
  E02: {
    nature: 'Non-respect des conditions tarifaires contractuelles',
    legalBasis: 'Article 1103 du Code Civil (force obligatoire du contrat) ; Instruction BCEAO sur la tarification des services bancaires',
    defaultRecoverability: 'forte',
  },
  E03: {
    nature: 'Erreur de calcul sur interets debiteurs',
    legalBasis: 'Reglement COBAC R-2018/01 relatif aux taux d\'interet ; Article 1907 du Code Civil',
    defaultRecoverability: 'forte',
  },
  E04: {
    nature: 'Date de valeur defavorable',
    legalBasis: 'Instruction BCEAO n°008-05-2015 relative aux dates de valeur',
    defaultRecoverability: 'moyenne',
  },
  E05: {
    nature: 'Commission de mouvement excessive',
    legalBasis: null,
    defaultRecoverability: 'moyenne',
  },
  E06: {
    nature: 'CPFD non conforme',
    legalBasis: 'Plafond CPFD reglementaire (50% des interets debiteurs)',
    defaultRecoverability: 'forte',
  },
  E07: {
    nature: 'Frais non prevus au contrat',
    legalBasis: null,
    defaultRecoverability: 'forte',
  },
  E08: {
    nature: 'Anomalie diverse',
    legalBasis: null,
    defaultRecoverability: 'faible',
  },
};

// ----------------------------------------------------------------------------
// Audience-specific formatting
// ----------------------------------------------------------------------------

const AUDIENCE_STYLES: Record<C8Input['audience'], {
  register: string;
  detailLevel: 'high' | 'medium' | 'low';
}> = {
  daf: { register: 'technique', detailLevel: 'high' },
  comptable: { register: 'factuel', detailLevel: 'high' },
  dirigeant: { register: 'synthetique', detailLevel: 'low' },
};

// ----------------------------------------------------------------------------
// Amount formatting
// ----------------------------------------------------------------------------

function formatFCFA(amount: number): string {
  const abs = Math.abs(amount);
  // Use Intl then normalize narrow no-break spaces to regular spaces for compatibility
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs).replace(/[\u00A0\u202F]/g, ' ');
  return formatted + ' FCFA';
}

function formatPercent(value: number): string {
  return value.toFixed(2).replace('.', ',') + ' %';
}

// ----------------------------------------------------------------------------
// Explanation generator (deterministic — no LLM)
// ----------------------------------------------------------------------------

function generateShortDescription(input: C8Input): string {
  const { ecart } = input;
  const info = ECART_DESCRIPTIONS[ecart.code];
  const delta = formatFCFA(ecart.delta_fcfa);

  return `${info.nature} : ecart de ${delta} sur la rubrique "${ecart.rubric}" (${ecart.code}).`;
}

function generateDetailedExplanation(input: C8Input): string {
  const { ecart, audience } = input;
  const info = ECART_DESCRIPTIONS[ecart.code];
  const style = AUDIENCE_STYLES[audience];
  const opCount = ecart.operations_concerned.length;

  const paragraphs: string[] = [];

  // Paragraph 1: Nature of the discrepancy
  paragraphs.push(
    `L'analyse de la rubrique "${ecart.rubric}" sur la periode du ${ecart.period.from} au ${ecart.period.to} ` +
    `revele un ecart de ${formatFCFA(ecart.delta_fcfa)} entre le montant attendu (${formatFCFA(ecart.expected_value)}) ` +
    `et le montant effectivement facture (${formatFCFA(ecart.actual_value)}).`
  );

  // Paragraph 2: Scope
  if (opCount > 0) {
    paragraphs.push(
      `Cet ecart concerne ${opCount} operation${opCount > 1 ? 's' : ''} identifiee${opCount > 1 ? 's' : ''} ` +
      `sur la periode d'analyse. ` +
      (ecart.delta_fcfa > 0
        ? `Le client a ete surfacture de ${formatFCFA(ecart.delta_fcfa)}.`
        : `Le client a ete sous-facture de ${formatFCFA(Math.abs(ecart.delta_fcfa))}.`)
    );
  }

  // Paragraph 3: Technical detail (for DAF/comptable)
  if (style.detailLevel === 'high') {
    const expected = ecart.expected_value;
    const actual = ecart.actual_value;
    const variationPct = expected !== 0
      ? ((actual - expected) / expected * 100)
      : 0;

    paragraphs.push(
      `En detail : la valeur de reference pour cette rubrique est de ${formatFCFA(expected)}, ` +
      `tandis que la banque a applique ${formatFCFA(actual)}, ` +
      `soit une variation de ${formatPercent(variationPct)}. ` +
      `Cette difference ${Math.abs(variationPct) > 10 ? 'significative' : 'moderee'} ` +
      `merite ${ecart.delta_fcfa > 0 ? 'une reclamation formelle' : 'une verification complementaire'}.`
    );
  }

  // Paragraph 4: Legal context (if available)
  if (info.legalBasis) {
    paragraphs.push(
      `Base reglementaire : ${info.legalBasis}.`
    );
  }

  return paragraphs.join('\n\n');
}

function generateRecommendation(input: C8Input): string {
  const { ecart } = input;
  const info = ECART_DESCRIPTIONS[ecart.code];

  if (ecart.delta_fcfa > 0) {
    switch (info.defaultRecoverability) {
      case 'forte':
        return `Adresser une reclamation ecrite a la banque avec reference au contrat et demander le remboursement integral de ${formatFCFA(ecart.delta_fcfa)}. Conserver les justificatifs (releves, convention, grille tarifaire).`;
      case 'moyenne':
        return `Engager une discussion avec le responsable de marche pour clarifier l'ecart de ${formatFCFA(ecart.delta_fcfa)} et negocier un avoir ou un ajustement tarifaire.`;
      case 'faible':
        return `Documenter l'ecart de ${formatFCFA(ecart.delta_fcfa)} pour suivi. Envisager une mention dans la prochaine revue de la relation bancaire.`;
    }
  }

  return `L'ecart est en faveur du client (${formatFCFA(Math.abs(ecart.delta_fcfa))}). Verifier qu'il ne s'agit pas d'une erreur temporaire susceptible d'etre corrigee par la banque.`;
}

function assessRecoverability(input: C8Input): Recoverability {
  const { ecart } = input;
  const info = ECART_DESCRIPTIONS[ecart.code];

  // Override default if the amount is very small
  if (Math.abs(ecart.delta_fcfa) < 1000) return 'faible';

  // Override if legal basis exists and amount is significant
  if (info.legalBasis && Math.abs(ecart.delta_fcfa) > 50000) return 'forte';

  return info.defaultRecoverability;
}

// ----------------------------------------------------------------------------
// LLM enrichment prompt
// ----------------------------------------------------------------------------

const C8_SYSTEM_PROMPT = `Tu es un expert-comptable specialise en audit bancaire CEMAC/UEMOA.
Tu reformules des explications d'ecarts tarifaires pour les rendre plus claires et professionnelles.

REGLES STRICTES :
1. Tu ne peux citer QUE les faits fournis dans le contexte (montants, dates, rubriques, operations).
2. Tu n'inventes JAMAIS un fait, un montant, une date ou une reference absente du contexte.
3. Tu conserves la structure : description courte, explication detaillee, recommandation.
4. Tu rediges en francais formel, sans familiarite.
5. Tous les montants doivent etre en FCFA.`;

function buildC8UserPrompt(input: C8Input, baseline: C8Output): string {
  return `Reformule cette explication d'ecart tarifaire pour l'audience "${input.audience}".

CONTEXTE ECART :
- Code: ${input.ecart.code}
- Rubrique: ${input.ecart.rubric}
- Attendu: ${formatFCFA(input.ecart.expected_value)}
- Facture: ${formatFCFA(input.ecart.actual_value)}
- Ecart: ${formatFCFA(input.ecart.delta_fcfa)}
- Periode: ${input.ecart.period.from} au ${input.ecart.period.to}
- Operations concernees: ${input.ecart.operations_concerned.length}
${baseline.legal_basis ? `- Base juridique: ${baseline.legal_basis}` : ''}

EXPLICATION BASELINE A REFORMULER :
${baseline.detailed_explanation}

RECOMMANDATION BASELINE :
${baseline.recommended_action}

Reponds avec une explication reformulee (2-4 paragraphes) puis une recommandation. Pas de JSON, texte libre.`;
}

// ----------------------------------------------------------------------------
// Public handler (sync baseline + optional async LLM enrichment)
// ----------------------------------------------------------------------------

export function handleC8(input: C8Input): C8Output {
  return {
    short_description: generateShortDescription(input),
    detailed_explanation: generateDetailedExplanation(input),
    legal_basis: ECART_DESCRIPTIONS[input.ecart.code].legalBasis,
    recommended_action: generateRecommendation(input),
    recoverability_assessment: assessRecoverability(input),
  };
}

/**
 * Async version with LLM enrichment.
 * Falls back to deterministic baseline if LLM unavailable.
 */
export async function handleC8WithLlm(input: C8Input): Promise<C8Output> {
  const baseline = handleC8(input);

  if (!isLlmAvailable()) return baseline;

  const llmResult = await llmCall(
    C8_SYSTEM_PROMPT,
    buildC8UserPrompt(input, baseline),
    { role: 'fast', temperature: 0.3, maxTokens: 1500 },
  );

  if (!llmResult) return baseline;

  // Split LLM response into explanation + recommendation
  const text = llmResult.content.trim();
  const recIdx = text.search(/recommandation|action\s+recommand/i);

  if (recIdx > 0) {
    return {
      ...baseline,
      detailed_explanation: text.slice(0, recIdx).trim(),
      recommended_action: text.slice(recIdx).replace(/^.*?:\s*/i, '').trim() || baseline.recommended_action,
    };
  }

  // If can't split, use full text as explanation
  return {
    ...baseline,
    detailed_explanation: text,
  };
}
