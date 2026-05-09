// ============================================================================
// ATLASBANX - C9 Handler: Generation rapport d'audit
// Zone: Verte (PROPH3T autonome)
// Baseline V1: generation deterministe structuree
// Validation: tous les montants mentionnes proviennent du moteur deterministe
// ============================================================================

import type { C9Input, C9Output, C8Input } from '../types';
import { handleC8, handleC8WithLlm } from './C8ExplicationHandler';
import { isLlmAvailable, llmCall } from '../llmEnricher';

// ----------------------------------------------------------------------------
// Amount formatting
// ----------------------------------------------------------------------------

function formatFCFA(amount: number): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount)).replace(/[\u00A0\u202F]/g, ' ');
  return formatted + ' FCFA';
}

// ----------------------------------------------------------------------------
// Tone adjustment
// ----------------------------------------------------------------------------

const TONE_INTRO: Record<C9Input['tone'], string> = {
  factuel: 'Le present rapport presente les resultats de l\'audit des conditions bancaires',
  assertif: 'Le present rapport d\'audit met en evidence des ecarts significatifs dans les conditions bancaires appliquees',
  pedagogique: 'Ce rapport a pour objectif d\'expliquer, de maniere accessible, les ecarts constates entre les conditions bancaires contractuelles et celles effectivement appliquees',
};

const TONE_CONCLUSION: Record<C9Input['tone'], string> = {
  factuel: 'Les constats ci-dessus sont presentes a titre informatif pour action par les equipes concernees.',
  assertif: 'Au vu des ecarts constates, il est vivement recommande d\'engager sans delai les demarches de reclamation aupres de l\'etablissement bancaire.',
  pedagogique: 'En resume, cet audit revele des opportunites concretes de recuperation de sommes indument prelevees. Les equipes sont invitees a se rapprocher de leur interlocuteur bancaire pour discuter de ces constats.',
};

// ----------------------------------------------------------------------------
// Section generators
// ----------------------------------------------------------------------------

function generatePageDeGarde(input: C9Input): string {
  return [
    '='.repeat(60),
    'RAPPORT D\'AUDIT DES CONDITIONS BANCAIRES',
    '='.repeat(60),
    '',
    `Client : ${input.client_name}`,
    `Periode : du ${input.period.from} au ${input.period.to}`,
    `Comptes analyses : ${input.accounts.join(', ')}`,
    `Nombre d\'ecarts detectes : ${input.ecarts.length}`,
    `Date d\'emission : ${new Date().toLocaleDateString('fr-FR')}`,
    `Reference analyse : ${input.analysis_id}`,
    '',
    '='.repeat(60),
  ].join('\n');
}

function generateResumeExecutif(input: C9Input, totalDelta: number, recoverableEstimate: number): string {
  const intro = TONE_INTRO[input.tone];
  const ecartCount = input.ecarts.length;

  const lines = [
    'RESUME EXECUTIF',
    '-'.repeat(40),
    '',
    `${intro} du client ${input.client_name} sur la periode du ${input.period.from} au ${input.period.to}.`,
    '',
    `L'audit a identifie ${ecartCount} ecart${ecartCount > 1 ? 's' : ''} representant un montant total de ${formatFCFA(totalDelta)}.`,
    `Le montant estimee recouvrable s'eleve a ${formatFCFA(recoverableEstimate)}.`,
    '',
  ];

  // Breakdown by code
  const byCode = new Map<string, { count: number; total: number }>();
  for (const e of input.ecarts) {
    const entry = byCode.get(e.code) ?? { count: 0, total: 0 };
    entry.count++;
    entry.total += Math.abs(e.delta_fcfa);
    byCode.set(e.code, entry);
  }

  lines.push('Synthese par categorie :');
  for (const [code, { count, total }] of byCode.entries()) {
    lines.push(`  - ${code} : ${count} ecart${count > 1 ? 's' : ''}, ${formatFCFA(total)}`);
  }

  return lines.join('\n');
}

function generateVueParCategorie(input: C9Input): string {
  const byCode = new Map<string, C9Input['ecarts']>();
  for (const e of input.ecarts) {
    const list = byCode.get(e.code) ?? [];
    list.push(e);
    byCode.set(e.code, list);
  }

  const sections: string[] = [
    'VUE PAR CATEGORIE',
    '-'.repeat(40),
    '',
  ];

  for (const [code, ecarts] of byCode.entries()) {
    const total = ecarts.reduce((s, e) => s + Math.abs(e.delta_fcfa), 0);
    sections.push(`${code} — ${ecarts.length} ecart${ecarts.length > 1 ? 's' : ''} — Total : ${formatFCFA(total)}`);
    for (const e of ecarts) {
      sections.push(`  * Rubrique "${e.rubric}" : attendu ${formatFCFA(e.expected_value)}, facture ${formatFCFA(e.actual_value)}, ecart ${formatFCFA(e.delta_fcfa)}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

function generateDetailEcartsMajeurs(input: C9Input): string {
  // Sort by absolute delta descending, take top 10
  const sorted = [...input.ecarts].sort((a, b) => Math.abs(b.delta_fcfa) - Math.abs(a.delta_fcfa));
  const top = sorted.slice(0, 10);

  const sections: string[] = [
    'DETAIL DES ECARTS MAJEURS',
    '-'.repeat(40),
    '',
  ];

  for (const ecart of top) {
    // Generate C8 explanation for each
    const c8Input: C8Input = {
      ecart,
      audience: input.tone === 'pedagogique' ? 'dirigeant' : 'daf',
      language: 'fr',
    };
    const explanation = handleC8(c8Input);

    sections.push(`--- ${ecart.code} : ${ecart.rubric} ---`);
    sections.push(explanation.short_description);
    sections.push('');
    sections.push(explanation.detailed_explanation);
    sections.push('');
    sections.push(`Recouvrement : ${explanation.recoverability_assessment}`);
    sections.push(`Action : ${explanation.recommended_action}`);
    if (explanation.legal_basis) {
      sections.push(`Base juridique : ${explanation.legal_basis}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

function generatePlanAction(input: C9Input, recoverableEstimate: number): string {
  const lines = [
    'PLAN D\'ACTION RECOMMANDE',
    '-'.repeat(40),
    '',
  ];

  // Group actions by priority
  const urgent = input.ecarts.filter(e => Math.abs(e.delta_fcfa) > 100000);
  const moderate = input.ecarts.filter(e => Math.abs(e.delta_fcfa) >= 10000 && Math.abs(e.delta_fcfa) <= 100000);
  const minor = input.ecarts.filter(e => Math.abs(e.delta_fcfa) < 10000);

  if (urgent.length > 0) {
    lines.push(`1. PRIORITE HAUTE (${urgent.length} ecart${urgent.length > 1 ? 's' : ''})`);
    lines.push(`   Montant total : ${formatFCFA(urgent.reduce((s, e) => s + Math.abs(e.delta_fcfa), 0))}`);
    lines.push('   Action : Reclamation formelle immediate avec justificatifs');
    lines.push('');
  }

  if (moderate.length > 0) {
    lines.push(`2. PRIORITE MOYENNE (${moderate.length} ecart${moderate.length > 1 ? 's' : ''})`);
    lines.push(`   Montant total : ${formatFCFA(moderate.reduce((s, e) => s + Math.abs(e.delta_fcfa), 0))}`);
    lines.push('   Action : Discussion avec le responsable de marche');
    lines.push('');
  }

  if (minor.length > 0) {
    lines.push(`3. PRIORITE BASSE (${minor.length} ecart${minor.length > 1 ? 's' : ''})`);
    lines.push(`   Montant total : ${formatFCFA(minor.reduce((s, e) => s + Math.abs(e.delta_fcfa), 0))}`);
    lines.push('   Action : Suivi et mention dans la revue annuelle');
    lines.push('');
  }

  lines.push(`Montant total recouvrable estime : ${formatFCFA(recoverableEstimate)}`);

  return lines.join('\n');
}

function generateAnnexes(input: C9Input): string {
  const lines = [
    'ANNEXES',
    '-'.repeat(40),
    '',
    'A1. Liste exhaustive des ecarts',
    '',
  ];

  for (let i = 0; i < input.ecarts.length; i++) {
    const e = input.ecarts[i];
    lines.push(`${i + 1}. [${e.code}] ${e.rubric} — Attendu: ${formatFCFA(e.expected_value)} — Facture: ${formatFCFA(e.actual_value)} — Ecart: ${formatFCFA(e.delta_fcfa)}`);
  }

  lines.push('');
  lines.push('A2. Methodologie');
  lines.push('L\'audit a ete realise par comparaison systematique entre les conditions contractuelles (conventions, conditions generales) et les montants effectivement preleves sur les releves de compte.');
  lines.push('');
  lines.push('A3. Avertissement');
  lines.push('Ce rapport est un outil d\'aide a la decision. Les montants recouvrables sont des estimations basees sur les conditions tarifaires en vigueur.');

  return lines.join('\n');
}

// ----------------------------------------------------------------------------
// Validation: all amounts in the report must come from input data
// ----------------------------------------------------------------------------

function validateReport(sections: C9Output['sections'], input: C9Input): string[] {
  const errors: string[] = [];

  // Extract all numbers from the report text
  const fullText = Object.values(sections).join('\n');
  const numbersInReport = new Set<number>();
  const numberRe = /(\d[\d\s\u00A0]*\d)\s*FCFA/g;
  let m;
  while ((m = numberRe.exec(fullText)) !== null) {
    const num = parseInt(m[1].replace(/[\s\u00A0]/g, ''), 10);
    if (!isNaN(num)) numbersInReport.add(num);
  }

  // Collect all valid source amounts
  const validAmounts = new Set<number>();
  for (const e of input.ecarts) {
    validAmounts.add(Math.abs(e.expected_value));
    validAmounts.add(Math.abs(e.actual_value));
    validAmounts.add(Math.abs(e.delta_fcfa));
  }
  // Also add computed aggregates
  const totalDelta = input.ecarts.reduce((s, e) => s + Math.abs(e.delta_fcfa), 0);
  validAmounts.add(totalDelta);

  // Aggregate by code
  const byCode = new Map<string, number>();
  for (const e of input.ecarts) {
    byCode.set(e.code, (byCode.get(e.code) ?? 0) + Math.abs(e.delta_fcfa));
  }
  for (const v of byCode.values()) validAmounts.add(v);

  // Aggregate by priority
  const urgent = input.ecarts.filter(e => Math.abs(e.delta_fcfa) > 100000);
  const moderate = input.ecarts.filter(e => Math.abs(e.delta_fcfa) >= 10000 && Math.abs(e.delta_fcfa) <= 100000);
  const minor = input.ecarts.filter(e => Math.abs(e.delta_fcfa) < 10000);
  validAmounts.add(urgent.reduce((s, e) => s + Math.abs(e.delta_fcfa), 0));
  validAmounts.add(moderate.reduce((s, e) => s + Math.abs(e.delta_fcfa), 0));
  validAmounts.add(minor.reduce((s, e) => s + Math.abs(e.delta_fcfa), 0));

  // Recoverable estimate (same logic as below)
  const recoverableEstimate = Math.round(totalDelta * 0.75);
  validAmounts.add(recoverableEstimate);

  // Check each number in the report
  for (const num of numbersInReport) {
    if (num === 0) continue;
    if (!validAmounts.has(num)) {
      errors.push(`Montant ${formatFCFA(num)} present dans le rapport mais absent des donnees source`);
    }
  }

  return errors;
}

// ----------------------------------------------------------------------------
// Public handler
// ----------------------------------------------------------------------------

export function handleC9(input: C9Input): C9Output {
  const totalDelta = input.ecarts.reduce((s, e) => s + Math.abs(e.delta_fcfa), 0);
  const recoverableEstimate = Math.round(totalDelta * 0.75); // Conservative 75% estimate

  const sections = {
    page_de_garde: generatePageDeGarde(input),
    resume_executif: generateResumeExecutif(input, totalDelta, recoverableEstimate),
    vue_par_categorie: generateVueParCategorie(input),
    detail_ecarts_majeurs: generateDetailEcartsMajeurs(input),
    plan_action: generatePlanAction(input, recoverableEstimate),
    annexes: generateAnnexes(input),
  };

  const validationErrors = validateReport(sections, input);

  return {
    sections,
    total_ecarts: input.ecarts.length,
    montant_recuperable_estime: recoverableEstimate,
    validation_ok: validationErrors.length === 0,
    validation_errors: validationErrors,
  };
}

// ----------------------------------------------------------------------------
// LLM-enriched report generation
// ----------------------------------------------------------------------------

const C9_SECTION_PROMPT = `Tu es un expert-comptable redigeant un rapport d'audit bancaire professionnel.
Tu reformules le texte fourni pour le rendre plus clair, fluide et professionnel.

REGLES STRICTES :
1. Tu conserves EXACTEMENT tous les montants, dates et references presentes dans le texte source.
2. Tu n'ajoutes AUCUN fait, montant ou reference absents du texte source.
3. Tu conserves la structure et l'ordre des informations.
4. Tu rediges en francais formel.
5. Ton : {tone}.`;

/**
 * Async version with LLM enrichment for resume executif and plan d'action.
 * Only enriches 2 sections (most user-visible), keeps the rest deterministic.
 * Validates all amounts post-enrichment.
 */
export async function handleC9WithLlm(input: C9Input): Promise<C9Output> {
  const baseline = handleC9(input);

  if (!isLlmAvailable()) return baseline;

  // Enrich resume executif
  const enrichedResume = await llmCall(
    C9_SECTION_PROMPT.replace('{tone}', input.tone),
    `Reformule ce resume executif de rapport d'audit :\n\n${baseline.sections.resume_executif}`,
    { role: 'fast', temperature: 0.3, maxTokens: 1500 },
  );

  // Enrich detail ecarts (use C8 with LLM for each ecart)
  const enrichedDetail = await enrichDetailWithLlm(input);

  const sections = {
    ...baseline.sections,
    ...(enrichedResume ? { resume_executif: enrichedResume.content.trim() } : {}),
    ...(enrichedDetail ? { detail_ecarts_majeurs: enrichedDetail } : {}),
  };

  // Re-validate after LLM enrichment
  const validationErrors = validateReport(sections, input);

  return {
    ...baseline,
    sections,
    validation_ok: validationErrors.length === 0,
    validation_errors: validationErrors,
  };
}

async function enrichDetailWithLlm(input: C9Input): Promise<string | null> {
  const sorted = [...input.ecarts].sort((a, b) => Math.abs(b.delta_fcfa) - Math.abs(a.delta_fcfa));
  const top = sorted.slice(0, 10);

  const sections: string[] = [
    'DETAIL DES ECARTS MAJEURS',
    '-'.repeat(40),
    '',
  ];

  for (const ecart of top) {
    const c8Input: C8Input = {
      ecart,
      audience: input.tone === 'pedagogique' ? 'dirigeant' : 'daf',
      language: 'fr',
    };
    const explanation = await handleC8WithLlm(c8Input);

    sections.push(`--- ${ecart.code} : ${ecart.rubric} ---`);
    sections.push(explanation.short_description);
    sections.push('');
    sections.push(explanation.detailed_explanation);
    sections.push('');
    sections.push(`Recouvrement : ${explanation.recoverability_assessment}`);
    sections.push(`Action : ${explanation.recommended_action}`);
    if (explanation.legal_basis) {
      sections.push(`Base juridique : ${explanation.legal_basis}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}
